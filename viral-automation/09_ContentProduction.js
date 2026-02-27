/**
 * @returns {{
 *   sheetName: string,
 *   totalRows: number,
 *   processedRows: number,
 *   okRows: number,
 *   errorRows: number,
 *   remainingRows: number,
 *   timedOut: boolean,
 *   fileCount: number,
 *   fileUrl: string
 * }}
 */
function runContentProduction_() {
  const sheet = initTargetSheetHeaders_();
  initProductSheetHeaders_();
  initContentHistorySheetHeaders_();

  const rows = readProduceRows_(sheet);
  if (!rows.length) {
    throw new Error('제작 대상이 없습니다. M열(제작) 체크박스를 선택하세요.');
  }

  const productProfiles = readProductProfiles_();
  const startedAt = Date.now();

  const summary = {
    sheetName: sheet.getName(),
    totalRows: rows.length,
    processedRows: 0,
    okRows: 0,
    errorRows: 0,
    remainingRows: 0,
    timedOut: false,
    fileCount: 0,
    fileUrl: '',
  };

  for (let i = 0; i < rows.length; i += 1) {
    if (Date.now() - startedAt > PARSER_CFG.PRODUCE_MAX_RUNTIME_MS) {
      summary.timedOut = true;
      summary.remainingRows = rows.length - i;
      break;
    }

    const row = rows[i];
    const producedAt = formatNowForSheet_();

    try {
      if (!row.productName) {
        throw new Error('제작제품이 비어 있습니다. S열(제작제품)에서 제품을 선택하세요.');
      }
      if (!row.intent) {
        throw new Error('작성의도가 비어 있습니다. T열(작성의도)을 입력하세요.');
      }

      const productProfile = findProductProfile_(productProfiles, row.productName);
      if (!productProfile) {
        throw new Error(`PRODUCTS 시트에서 제품을 찾지 못했습니다: ${row.productName}`);
      }

      const result = produceKeywordContent_(row, productProfile);
      writeProduceSuccess_(sheet, row.rowIndex, {
        title: result.selectedTitle,
        fileUrl: result.fileUrl,
        producedAt: producedAt,
      });

      summary.okRows += 1;
      summary.fileCount += Math.max(1, Number(result.fileCount || 0));
      if (!summary.fileUrl) summary.fileUrl = result.firstFileUrl || result.fileUrl;
    } catch (err) {
      const fileUrl = err && err.fileUrl ? String(err.fileUrl) : '';
      writeProduceError_(sheet, row.rowIndex, producedAt, safeErrorMessage_(err), fileUrl);
      summary.errorRows += 1;
      if (!summary.fileUrl && fileUrl) summary.fileUrl = fileUrl;
    }

    summary.processedRows += 1;
  }

  return summary;
}

/**
 * @param {{rowIndex:number,keyword:string,query:string,productName:string,intent:string,rankResult:string}} row
 * @param {Object<string,string>} productProfile
 * @returns {{selectedTitle:string, fileUrl:string, fileCount:number, firstFileUrl:string}}
 */
function produceKeywordContent_(row, productProfile) {
  const contextResult = collectProductionContextForRow_(row);
  const topicBlocks = selectProduceTopicBlocks_(contextResult.blocks);
  if (!topicBlocks.length) {
    throw new Error('제작 가능한 인기주제 블록이 없습니다. (인플루언서/카페/브랜드 콘텐츠 제외 후 0건)');
  }

  const recentHistory = readRecentContentHistory_(row.keyword, productProfile.productName, 20);
  const results = [];

  for (let i = 0; i < topicBlocks.length; i += 1) {
    const topicBlock = topicBlocks[i];
    const topicResult = produceTopicContentFile_(
      row,
      productProfile,
      contextResult.smartSummary,
      topicBlock,
      recentHistory,
      i + 1,
      topicBlocks.length
    );
    results.push(topicResult);
  }

  const titleSummary = results
    .map(function (x) { return `${x.topicTitle}: ${x.selectedTitle}`; })
    .join(' | ');
  const urlSummary = results
    .map(function (x) { return x.fileUrl; })
    .join('\n');

  return {
    selectedTitle: titleSummary,
    fileUrl: urlSummary,
    fileCount: results.length,
    firstFileUrl: results.length ? results[0].fileUrl : '',
  };
}

/**
 * @param {{keyword:string,query:string}} row
 * @returns {{sectionsCount:number, smartSummary:QueryResult, blocks:Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>}}
 */
function collectProductionContextForRow_(row) {
  const html = fetchMobileSerpHtml_(row.query);
  const sections = parseSerpSectionsFromHtml_(html);
  const smartSummary = summarizeSmartblocks_(sections);
  const blocks = collectAnalyzableBlocks_(sections, PARSER_CFG.ANALYSIS_MAX_POSTS_PER_BLOCK);
  return {
    sectionsCount: sections.length,
    smartSummary: smartSummary,
    blocks: blocks,
  };
}

/**
 * @param {Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>} blocks
 * @returns {Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>}
 */
function selectProduceTopicBlocks_(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  const out = [];
  const seen = {};

  for (let i = 0; i < list.length; i += 1) {
    const b = list[i];
    if (!b || b.blockType !== '인기주제') continue;

    const title = normalizeWhitespace_(b.blockTitle);
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(b);
  }

  out.sort(function (a, b) {
    return Number(a.blockIndex || 0) - Number(b.blockIndex || 0);
  });
  return out;
}

/**
 * @param {{rowIndex:number,keyword:string,query:string,productName:string,intent:string,rankResult:string}} row
 * @param {Object<string,string>} productProfile
 * @param {QueryResult} smartSummary
 * @param {{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}} topicBlock
 * @param {Array<{createdAt:string, keyword:string, productName:string, title:string, draftHash:string, rewriteHash:string, fileUrl:string}>} recentHistory
 * @param {number} topicNo
 * @param {number} topicCount
 * @returns {{selectedTitle:string, fileUrl:string, fileId:string, topicTitle:string}}
 */
function produceTopicContentFile_(row, productProfile, smartSummary, topicBlock, recentHistory, topicNo, topicCount) {
  const timestamp = Utilities.formatDate(new Date(), getParserTimezone_(), 'yyyyMMdd_HHmmss');
  const topicTitle = normalizeWhitespace_(topicBlock.blockTitle) || `주제${topicNo}`;
  const tempTitle = buildContentFileTitle_(row.keyword, `제작중_${topicTitle}`, timestamp);
  const book = SpreadsheetApp.create(tempTitle);
  const fileId = book.getId();
  const fileUrl = book.getUrl();

  const saveLocation = resolveAnalysisSaveLocation_();
  moveAnalysisFileToFolder_(fileId, saveLocation.folder);

  const sheets = initContentWorkbookSheets_(book);
  try {
    const contextResult = executeProductionStep_(sheets.processSheet, 'CONTEXT', {
      keyword: row.keyword,
      topicNo: topicNo,
      topicCount: topicCount,
      topicTitle: topicTitle,
      productName: productProfile.productName,
      intent: row.intent,
      rankResult: row.rankResult || '',
    }, function () {
      return {
        topicNo: topicNo,
        topicCount: topicCount,
        topicTitle: topicTitle,
        smartSummary: smartSummary,
        blocks: [topicBlock],
      };
    });

    const ctx = {
      keyword: row.keyword,
      intent: row.intent,
      topicTitle: topicTitle,
      topicNo: topicNo,
      topicCount: topicCount,
      productProfile: productProfile,
      rankResult: row.rankResult || '',
      smartSummary: contextResult.smartSummary,
      blocks: contextResult.blocks,
      recentHistory: recentHistory,
    };

    const titleGen = executeProductionStep_(sheets.processSheet, 'TITLE_GEN', {
      keyword: row.keyword,
      topicTitle: topicTitle,
      intent: row.intent,
    }, function () {
      const prompt = buildTitleGenerationPrompt_(ctx);
      const raw = generateGeminiText_(prompt);
      const titles = normalizeGeneratedTitles_(raw, row.keyword, 20);
      return {
        prompt: prompt,
        raw: raw,
        titles: titles,
      };
    });

    const titleScore = executeProductionStep_(sheets.processSheet, 'TITLE_SCORE', {
      topicTitle: topicTitle,
      titleCount: titleGen.titles.length,
    }, function () {
      const prompt = buildTitleScoringPrompt_(ctx, titleGen.titles);
      const raw = generateGeminiText_(prompt);
      const scored = normalizeTitleScoreResult_(raw, titleGen.titles);
      return {
        prompt: prompt,
        raw: raw,
        scored: scored,
      };
    });

    const selectedTitle = titleScore.scored.bestTitle || titleGen.titles[0] || row.keyword;

    const planResult = executeProductionStep_(sheets.processSheet, 'PLAN', {
      topicTitle: topicTitle,
      selectedTitle: selectedTitle,
    }, function () {
      const prompt = buildPlanningPrompt_(ctx, selectedTitle);
      const raw = generateGeminiText_(prompt);
      const normalized = normalizePlanResult_(raw, selectedTitle);
      return {
        prompt: prompt,
        raw: raw,
        plan: normalized,
      };
    });

    const selectedPlanIndex = Math.max(1, Number(planResult.plan.selectedPlanIndex || 1));
    const selectedPlan = planResult.plan.plans[selectedPlanIndex - 1] || planResult.plan.plans[0];

    const part1Result = executeProductionStep_(sheets.processSheet, 'DRAFT_P1', {
      topicTitle: topicTitle,
      selectedTitle: selectedTitle,
      selectedPattern: selectedPlan ? selectedPlan.pattern : '',
    }, function () {
      const prompt = buildDraftPart1Prompt_(ctx, selectedTitle, selectedPlan);
      const raw = generateGeminiText_(prompt);
      return {
        prompt: prompt,
        raw: raw,
        text: String(raw || '').trim(),
      };
    });

    const part2Result = executeProductionStep_(sheets.processSheet, 'DRAFT_P2', {
      topicTitle: topicTitle,
      selectedTitle: selectedTitle,
      selectedPattern: selectedPlan ? selectedPlan.pattern : '',
    }, function () {
      const prompt = buildDraftPart2Prompt_(ctx, selectedTitle, selectedPlan, part1Result.text);
      const raw = generateGeminiText_(prompt);
      return {
        prompt: prompt,
        raw: raw,
        text: String(raw || '').trim(),
      };
    });

    const draftBody = [part1Result.text, part2Result.text].filter(Boolean).join('\n\n').trim();

    const reviewResult = executeProductionStep_(sheets.processSheet, 'REVIEW', {
      topicTitle: topicTitle,
      selectedTitle: selectedTitle,
      draftLength: draftBody.length,
    }, function () {
      const prompt = buildReviewPrompt_(ctx, selectedTitle, draftBody);
      const raw = generateGeminiText_(prompt);
      return {
        prompt: prompt,
        raw: raw,
        text: String(raw || '').trim(),
      };
    });

    const rewriteResult = executeProductionStep_(sheets.processSheet, 'REWRITE', {
      topicTitle: topicTitle,
      selectedTitle: selectedTitle,
    }, function () {
      const prompt = buildRewritePrompt_(ctx, selectedTitle, draftBody, reviewResult.text);
      const raw = generateGeminiText_(prompt);
      return {
        prompt: prompt,
        raw: raw,
        text: String(raw || '').trim(),
      };
    });

    writeContentDraftSheet_(sheets.contentSheet, selectedTitle, draftBody);
    writeReviewSheet_(sheets.reviewSheet, reviewResult.text);
    writeRewriteSheet_(sheets.rewriteSheet, selectedTitle, rewriteResult.text);

    appendContentHistory_({
      createdAt: formatNowForSheet_(),
      keyword: row.keyword,
      productName: productProfile.productName,
      title: `${topicTitle} | ${selectedTitle}`,
      draftHash: computeTextHash_(draftBody),
      rewriteHash: computeTextHash_(rewriteResult.text),
      fileUrl: fileUrl,
    });

    DriveApp
      .getFileById(fileId)
      .setName(buildContentFileTitle_(row.keyword, `${topicTitle}_${selectedTitle}`, timestamp));

    return {
      selectedTitle: selectedTitle,
      fileId: fileId,
      fileUrl: fileUrl,
      topicTitle: topicTitle,
    };
  } catch (err) {
    err.fileUrl = fileUrl;
    throw err;
  }
}

/**
 * @template T
 * @param {GoogleAppsScript.Spreadsheet.Sheet} processSheet
 * @param {string} step
 * @param {*} inputPayload
 * @param {function():T} run
 * @returns {T}
 */
function executeProductionStep_(processSheet, step, inputPayload, run) {
  const started = Date.now();
  const startedAt = Utilities.formatDate(new Date(started), getParserTimezone_(), PARSER_CFG.DATETIME_FORMAT);
  try {
    const output = run();
    appendProcessLog_(processSheet, {
      step: step,
      startedAt: startedAt,
      durationMs: Date.now() - started,
      status: 'OK',
      inputSummary: toLogText_(inputPayload, 48000),
      output: toLogText_(output, 48000),
    });
    return output;
  } catch (err) {
    appendProcessLog_(processSheet, {
      step: step,
      startedAt: startedAt,
      durationMs: Date.now() - started,
      status: 'ERROR',
      inputSummary: toLogText_(inputPayload, 48000),
      output: safeErrorMessage_(err),
    });
    throw err;
  }
}
