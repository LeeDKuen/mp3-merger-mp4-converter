const NAVER_OFFICIAL_REFERENCE_NOTES = [
  {
    title: '네이버 검색광고 공지 - 맞춤형 블록/스마트블록 관련 안내',
    url: 'https://saedu.naver.com/adnews/notice/view?no=3294',
    note: '질의 의도와 문맥에 따라 통합검색 블록 구성이 달라질 수 있다는 점을 참고한다.',
  },
  {
    title: '네이버 검색광고 공지 - 모바일 통합검색 블록 운영 안내',
    url: 'https://saedu.naver.com/adnews/notice/view?no=3355',
    note: '검색 결과는 고정 순서가 아니라 질의/문맥/실험 상태에 따라 조합될 수 있다.',
  },
  {
    title: '네이버 검색광고 공지 - 키워드별 맞춤형 블록 사례',
    url: 'https://saedu.naver.com/adnews/notice/view?no=3455',
    note: '같은 주제라도 키워드 표현에 따라 노출 블록이 달라질 수 있다.',
  },
  {
    title: 'Naver Search Advisor',
    url: 'https://searchadvisor.naver.com/',
    note: '검색 노출 기본 원칙(문서 품질, 사용자 의도 충족, 신뢰성)을 참고한다.',
  },
];

/**
 * @returns {{
 *   sheetName: string,
 *   totalRows: number,
 *   processedRows: number,
 *   okRows: number,
 *   errorRows: number,
 *   remainingRows: number,
 *   timedOut: boolean,
 *   fileUrl: string,
 *   fileCount: number,
 *   saveLocationLabel: string,
 *   saveLocationUrl: string,
 *   saveLocationId: string
 * }}
 */
function runTopPostCollection_() {
  return runPostWorkbookJob_({
    queueColumn: COL.POST_COLLECT_QUEUE,
    queueLabel: '글 수집',
    runtimeMs: PARSER_CFG.POST_COLLECT_MAX_RUNTIME_MS,
    runAiAnalysis: false,
  });
}

/**
 * @returns {{
 *   sheetName: string,
 *   totalRows: number,
 *   processedRows: number,
 *   okRows: number,
 *   errorRows: number,
 *   remainingRows: number,
 *   timedOut: boolean,
 *   fileUrl: string,
 *   fileCount: number,
 *   saveLocationLabel: string,
 *   saveLocationUrl: string,
 *   saveLocationId: string
 * }}
 */
function runTopExposureAnalysis_() {
  getGeminiApiKey_();
  return runPostWorkbookJob_({
    queueColumn: COL.POST_ANALYSIS_QUEUE,
    queueLabel: '글 분석',
    runtimeMs: PARSER_CFG.ANALYSIS_MAX_RUNTIME_MS,
    runAiAnalysis: true,
  });
}

/**
 * @param {{queueColumn:number, queueLabel:string, runtimeMs:number, runAiAnalysis:boolean}} options
 * @returns {{
 *   sheetName: string,
 *   totalRows: number,
 *   processedRows: number,
 *   okRows: number,
 *   errorRows: number,
 *   remainingRows: number,
 *   timedOut: boolean,
 *   fileUrl: string,
 *   fileCount: number,
 *   saveLocationLabel: string,
 *   saveLocationUrl: string,
 *   saveLocationId: string
 * }}
 */
function runPostWorkbookJob_(options) {
  const queueColumn = Number(options && options.queueColumn ? options.queueColumn : 0);
  const queueLabel = String(options && options.queueLabel ? options.queueLabel : '작업');
  const runtimeMs = Number(options && options.runtimeMs ? options.runtimeMs : PARSER_CFG.ANALYSIS_MAX_RUNTIME_MS);
  const runAiAnalysis = !!(options && options.runAiAnalysis);

  const sheet = initTargetSheetHeaders_();
  const rows = readKeywordRows_(sheet, queueColumn);
  if (!rows.length) {
    const colName = columnToLabel_(queueColumn);
    throw new Error(`${queueLabel} 대상이 없습니다. ${colName}열(${queueLabel}) 체크박스를 선택하세요.`);
  }

  const saveLocation = resolveAnalysisSaveLocation_();
  const startedAt = Date.now();

  const summary = {
    sheetName: sheet.getName(),
    totalRows: rows.length,
    processedRows: 0,
    okRows: 0,
    errorRows: 0,
    remainingRows: 0,
    timedOut: false,
    fileUrl: '',
    fileCount: 0,
    saveLocationLabel: saveLocation.label,
    saveLocationUrl: saveLocation.url,
    saveLocationId: saveLocation.folderId,
  };

  for (let i = 0; i < rows.length; i += 1) {
    if (Date.now() - startedAt > runtimeMs) {
      summary.timedOut = true;
      summary.remainingRows = rows.length - i;
      break;
    }

    const row = rows[i];
    try {
      const info = analyzeKeywordToSpreadsheet_(row, saveLocation.folder, {
        runAiAnalysis,
      });
      summary.okRows += 1;
      summary.fileCount += 1;
      if (!summary.fileUrl) summary.fileUrl = info.fileUrl;
    } catch (err) {
      summary.errorRows += 1;
      if (!summary.fileUrl && err && err.fileUrl) summary.fileUrl = String(err.fileUrl);
      Logger.log(`[${runAiAnalysis ? 'POST_ANALYSIS_ERROR' : 'POST_COLLECT_ERROR'}] ${row.keyword} :: ${safeErrorMessage_(err)}`);
    } finally {
      clearRowQueue_(sheet, row.rowIndex, queueColumn);
    }
    summary.processedRows += 1;
  }

  return summary;
}

/**
 * @param {number} col
 * @returns {string}
 */
function columnToLabel_(col) {
  let n = Math.max(1, Number(col || 1));
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * @param {KeywordRow} row
 * @param {GoogleAppsScript.Drive.Folder|null} targetFolder
 * @param {{runAiAnalysis:boolean}=} options
 * @returns {{fileId:string, fileUrl:string, fileTitle:string}}
 */
function analyzeKeywordToSpreadsheet_(row, targetFolder, options) {
  const runAiAnalysis = options && options.runAiAnalysis === false ? false : true;
  const timestamp = Utilities.formatDate(new Date(), getParserTimezone_(), 'yyyyMMdd_HHmmss');
  const fileTitle = buildKeywordAnalysisFileTitle_(timestamp, row.keyword, runAiAnalysis ? '상위노출분석' : '상위글수집');
  const book = SpreadsheetApp.create(fileTitle);
  const fileId = book.getId();

  moveAnalysisFileToFolder_(fileId, targetFolder);

  let smartSummary = buildEmptySmartSummary_();
  let blocks = [];
  let collectionErrorMessage = '';

  try {
    const html = fetchMobileSerpHtml_(row.query);
    const sections = parseSerpSectionsFromHtml_(html);
    smartSummary = summarizeSmartblocks_(sections);
    blocks = collectAnalyzableBlocks_(sections, PARSER_CFG.ANALYSIS_MAX_POSTS_PER_BLOCK);
  } catch (err) {
    collectionErrorMessage = safeErrorMessage_(err);
    Logger.log(`[ANALYSIS_COLLECT_ERROR] ${row.keyword} :: ${collectionErrorMessage}`);
  }

  let analysisText = '';
  let analysisErrorMessage = '';
  let topicAnalyses = [];
  if (!collectionErrorMessage) {
    if (runAiAnalysis) {
      topicAnalyses = buildTopicAnalyses_(row.keyword, blocks);
      try {
        analysisText = generateTopExposureStrategy_(row.keyword, smartSummary, blocks);
      } catch (geminiErr) {
        analysisErrorMessage = safeErrorMessage_(geminiErr);
        Logger.log(`[GEMINI_ANALYSIS_SKIP] ${row.keyword} :: ${analysisErrorMessage}`);
      }
    }
  }

  try {
    writeAnalysisWorkbook_(
      book,
      row.keyword,
      smartSummary,
      blocks,
      topicAnalyses,
      analysisText,
      analysisErrorMessage,
      collectionErrorMessage,
      !runAiAnalysis
    );
  } catch (err) {
    err.fileUrl = book.getUrl();
    throw err;
  }

  return {
    fileId,
    fileUrl: book.getUrl(),
    fileTitle,
  };
}

/**
 * @param {string} timestamp
 * @param {string} keyword
 * @param {string=} suffix
 * @returns {string}
 */
function buildKeywordAnalysisFileTitle_(timestamp, keyword, suffix) {
  const safeKeyword = sanitizeFileNamePart_(keyword) || 'keyword';
  const safeSuffix = sanitizeFileNamePart_(suffix || '상위노출분석') || '상위노출분석';
  return `${timestamp}_${safeKeyword}_${safeSuffix}`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function sanitizeFileNamePart_(value) {
  const trimmed = normalizeWhitespace_(value);
  if (!trimmed) return '';
  return trimmed
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
}

/**
 * @returns {{
 *   folder: GoogleAppsScript.Drive.Folder|null,
 *   folderId: string,
 *   label: string,
 *   url: string
 * }}
 */
function resolveAnalysisSaveLocation_() {
  const rawFolderId = String(getParserProp_(PARSER_PROP_KEYS.PARSER_ANALYSIS_DRIVE_FOLDER_ID, '') || '').trim();
  if (!rawFolderId) {
    return {
      folder: null,
      folderId: '',
      label: '내 드라이브(루트)',
      url: 'https://drive.google.com/drive/my-drive',
    };
  }

  let folder;
  try {
    folder = DriveApp.getFolderById(rawFolderId);
  } catch (err) {
    throw new Error(`Invalid Script Property ${PARSER_PROP_KEYS.PARSER_ANALYSIS_DRIVE_FOLDER_ID}: ${safeErrorMessage_(err)}`);
  }

  return {
    folder: folder,
    folderId: folder.getId(),
    label: folder.getName(),
    url: `https://drive.google.com/drive/folders/${folder.getId()}`,
  };
}

/**
 * @param {string} fileId
 * @param {GoogleAppsScript.Drive.Folder|null} targetFolder
 */
function moveAnalysisFileToFolder_(fileId, targetFolder) {
  if (!targetFolder) return;
  const file = DriveApp.getFileById(fileId);
  file.moveTo(targetFolder);
}

/**
 * @returns {QueryResult}
 */
function buildEmptySmartSummary_() {
  return {
    pcVolume: '',
    moVolume: '',
    totalVolume: '',
    smartblockFlag: '없음',
    popularArticleTitles: '',
    popularTopicTitles: '',
    sectionIndexesRaw: '',
  };
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} book
 * @param {string} keyword
 * @param {QueryResult} smartSummary
 * @param {Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>} blocks
 * @param {Array<{topicNo:number, topicLabel:string, analysisText:string, errorMessage:string}>} topicAnalyses
 * @param {string} analysisText
 * @param {string} analysisErrorMessage
 * @param {string} collectionErrorMessage
 * @param {boolean} analysisSkipped
 */
function writeAnalysisWorkbook_(book, keyword, smartSummary, blocks, topicAnalyses, analysisText, analysisErrorMessage, collectionErrorMessage, analysisSkipped) {
  const overviewSheet = ensureWorkbookBaseSheet_(book, '개요');
  const topicSheetMeta = [];
  const runAiAnalysis = !analysisSkipped;

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const topicNo = i + 1;
    const collectSheetName = createUniqueSheetName_(book, buildTopicSheetName_(topicNo, '수집', block));
    let analysisSheetName = '';

    const collectSheet = book.insertSheet(collectSheetName);
    writeTopicCollectionSheet_(collectSheet, keyword, block, i);

    if (runAiAnalysis) {
      analysisSheetName = createUniqueSheetName_(book, buildTopicSheetName_(topicNo, '분석', block));
      const topicAnalysis = topicAnalyses[i] || {
        topicNo,
        topicLabel: buildBlockDisplayLabel_(block, i),
        analysisText: '주제 분석 결과가 없습니다.',
        errorMessage: '',
      };
      const analysisSheet = book.insertSheet(analysisSheetName);
      writeTopicAnalysisSheet_(analysisSheet, keyword, block, i, topicAnalysis);
    }

    topicSheetMeta.push({
      topicNo,
      blockType: block.blockType || '',
      blockTitle: block.blockTitle || '',
      blockIndex: block.blockIndex,
      postsCount: Array.isArray(block.posts) ? block.posts.length : 0,
      collectSheetName,
      analysisSheetName: analysisSheetName || '-',
    });
  }

  writeOverviewSheet_(
    overviewSheet,
    keyword,
    smartSummary,
    blocks,
    topicSheetMeta,
    analysisText,
    analysisErrorMessage,
    collectionErrorMessage,
    analysisSkipped
  );
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} book
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureWorkbookBaseSheet_(book, sheetName) {
  const sheets = book.getSheets();
  if (!sheets.length) return book.insertSheet(sheetName);

  const first = sheets[0];
  const desired = sanitizeSheetName_(sheetName || '개요');
  if (first.getName() !== desired) {
    if (book.getSheetByName(desired)) {
      const existing = book.getSheetByName(desired);
      if (existing) existing.clear();
      return existing || first;
    }
    first.setName(desired);
  }
  first.clear();
  return first;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} book
 * @param {string} rawName
 * @returns {string}
 */
function createUniqueSheetName_(book, rawName) {
  const base = sanitizeSheetName_(rawName || '시트');
  if (!book.getSheetByName(base)) return base;

  for (let i = 2; i <= 999; i += 1) {
    const suffix = `_${i}`;
    const headLen = Math.max(1, 100 - suffix.length);
    const candidate = `${base.substring(0, headLen)}${suffix}`;
    if (!book.getSheetByName(candidate)) return candidate;
  }
  const stamp = String(new Date().getTime()).slice(-6);
  return `${base.substring(0, 93)}_${stamp}`;
}

/**
 * @param {string} rawName
 * @returns {string}
 */
function sanitizeSheetName_(rawName) {
  const cleaned = String(rawName || '')
    .replace(/[\\/?*:[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '시트';
  return cleaned.substring(0, 100);
}

/**
 * @param {number} topicNo
 * @param {string} kind
 * @param {{blockType:string, blockTitle:string}} block
 * @returns {string}
 */
function buildTopicSheetName_(topicNo, kind, block) {
  const no = Number(topicNo) || 1;
  const blockType = normalizeWhitespace_(block && block.blockType ? block.blockType : '주제')
    .replace(/\s+/g, '');
  const blockTitle = normalizeWhitespace_(block && block.blockTitle ? block.blockTitle : '제목없음')
    .replace(/\s+/g, '');
  const base = `주제${no}_${kind}_${blockType}_${blockTitle}`;
  return sanitizeSheetName_(base);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} keyword
 * @param {QueryResult} smartSummary
 * @param {Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>} blocks
 * @param {Array<{topicNo:number, blockType:string, blockTitle:string, blockIndex:number, postsCount:number, collectSheetName:string, analysisSheetName:string}>} topicSheetMeta
 * @param {string} analysisText
 * @param {string} analysisErrorMessage
 * @param {string} collectionErrorMessage
 * @param {boolean} analysisSkipped
 */
function writeOverviewSheet_(sheet, keyword, smartSummary, blocks, topicSheetMeta, analysisText, analysisErrorMessage, collectionErrorMessage, analysisSkipped) {
  sheet.clear();

  const summaryRows = [
    ['항목', '값'],
    ['키워드', keyword],
    ['생성시각', formatNowForSheet_()],
    ['Gemini 모델', getGeminiModel_()],
    ['스마트블록 여부', smartSummary.smartblockFlag || '-'],
    ['인기글명', smartSummary.popularArticleTitles || '-'],
    ['인기주제명들', smartSummary.popularTopicTitles || '-'],
    ['스마트블록 섹션순번', smartSummary.sectionIndexesRaw || '-'],
    ['분석 블록 수', String(blocks.length)],
    ['수집 상태', collectionErrorMessage ? 'ERROR' : 'OK'],
    ['수집 에러', collectionErrorMessage || '-'],
    ['Gemini 전체분석 상태', analysisSkipped ? 'SKIPPED' : (analysisErrorMessage ? 'ERROR' : 'OK')],
    ['Gemini 전체분석 에러', analysisSkipped ? '-' : (analysisErrorMessage || '-')],
  ];

  sheet.getRange(1, 1, summaryRows.length, 2).setValues(summaryRows);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');

  let row = summaryRows.length + 2;
  sheet.getRange(row, 1).setValue('주제 탭 목록').setFontWeight('bold');
  row += 1;
  const topicRows = [['주제번호', '블록유형', '주제명', '섹션순번', '수집글수', '수집탭', '분석탭']];
  if (!topicSheetMeta.length) {
    topicRows.push(['-', '-', '-', '-', '0', '-', '-']);
  } else {
    for (let i = 0; i < topicSheetMeta.length; i += 1) {
      const meta = topicSheetMeta[i];
      topicRows.push([
        String(meta.topicNo),
        meta.blockType || '-',
        meta.blockTitle || '-',
        `${meta.blockIndex}번째`,
        String(meta.postsCount),
        meta.collectSheetName,
        meta.analysisSheetName,
      ]);
    }
  }
  sheet.getRange(row, 1, topicRows.length, 7).setValues(topicRows);
  sheet.getRange(row, 1, 1, 7).setFontWeight('bold');
  row += topicRows.length + 2;

  sheet.getRange(row, 1).setValue('Gemini 전체 분석').setFontWeight('bold');
  row += 1;
  const finalAnalysisText = analysisSkipped
    ? '글 수집 전용 실행입니다. Gemini 분석은 수행하지 않았습니다.'
    : (collectionErrorMessage
      ? `수집 실패로 전체 분석을 생략했습니다.\n${collectionErrorMessage}`
      : (analysisErrorMessage
        ? `Gemini 분석 실패: ${analysisErrorMessage}`
        : (analysisText || '전체 분석 결과가 비어 있습니다.')));
  sheet.getRange(row, 1).setValue(finalAnalysisText);

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 560);
  sheet.setColumnWidth(3, 420);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 220);
  sheet.setColumnWidth(7, 220);
  sheet.getRange(1, 1, sheet.getMaxRows(), 7).setWrap(true);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} keyword
 * @param {{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}} block
 * @param {number} idx
 */
function writeTopicCollectionSheet_(sheet, keyword, block, idx) {
  sheet.clear();

  const createdAt = formatNowForSheet_();
  const rowStart = 1;
  const dataRows = [['순위', '블록유형', '주제명', '섹션순번', '제목', 'URL', '태그', '원고', '생성시각']];
  const posts = Array.isArray(block.posts) ? block.posts : [];

  if (!posts.length) {
    dataRows.push(['-', block.blockType || '-', block.blockTitle || '-', `${block.blockIndex}번째`, '상위 글 없음', '-', '-', '-', createdAt]);
  } else {
    for (let i = 0; i < posts.length; i += 1) {
      const post = posts[i];
      dataRows.push([
        String(i + 1),
        block.blockType || '-',
        block.blockTitle || '-',
        `${block.blockIndex}번째`,
        post.title || '-',
        post.url || '-',
        post.tags || '-',
        post.body || '-',
        createdAt,
      ]);
    }
  }

  sheet.getRange(rowStart, 1, dataRows.length, 9).setValues(dataRows);
  sheet.getRange(rowStart, 1, 1, 9).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 70);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 220);
  sheet.setColumnWidth(4, 95);
  sheet.setColumnWidth(5, 360);
  sheet.setColumnWidth(6, 420);
  sheet.setColumnWidth(7, 220);
  sheet.setColumnWidth(8, 760);
  sheet.setColumnWidth(9, 170);
  sheet.getRange(1, 1, sheet.getMaxRows(), 9).setWrap(true);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} keyword
 * @param {{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}} block
 * @param {number} idx
 * @param {{topicNo:number, topicLabel:string, analysisText:string, errorMessage:string}} topicAnalysis
 */
function writeTopicAnalysisSheet_(sheet, keyword, block, idx, topicAnalysis) {
  sheet.clear();

  const headerRows = [
    ['항목', '값'],
    ['키워드', keyword],
    ['주제', buildBlockDisplayLabel_(block, idx)],
    ['Gemini 모델', getGeminiModel_()],
    ['생성시각', formatNowForSheet_()],
    ['분석 상태', topicAnalysis.errorMessage ? 'ERROR' : 'OK'],
    ['분석 에러', topicAnalysis.errorMessage || '-'],
  ];
  sheet.getRange(1, 1, headerRows.length, 2).setValues(headerRows);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');

  let row = headerRows.length + 2;
  sheet.getRange(row, 1).setValue('주제 분석').setFontWeight('bold');
  row += 1;
  sheet.getRange(row, 1).setValue(topicAnalysis.analysisText || '분석 결과가 비어 있습니다.');

  row += 3;
  sheet.getRange(row, 1).setValue('참고 샘플').setFontWeight('bold');
  row += 1;
  const sampleRows = [['순위', '제목', 'URL', '태그']];
  const posts = Array.isArray(block.posts) ? block.posts : [];
  if (!posts.length) {
    sampleRows.push(['-', '상위 글 없음', '-', '-']);
  } else {
    for (let i = 0; i < posts.length; i += 1) {
      const post = posts[i];
      sampleRows.push([
        String(i + 1),
        post.title || '-',
        post.url || '-',
        post.tags || '-',
      ]);
    }
  }
  sheet.getRange(row, 1, sampleRows.length, 4).setValues(sampleRows);
  sheet.getRange(row, 1, 1, 4).setFontWeight('bold');

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 560);
  sheet.setColumnWidth(3, 420);
  sheet.setColumnWidth(4, 240);
  sheet.getRange(1, 1, sheet.getMaxRows(), 4).setWrap(true);
}

/**
 * @param {SerpSection[]} sections
 * @param {number} maxPostsPerBlock
 * @returns {Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>}
 */
function collectAnalyzableBlocks_(sections, maxPostsPerBlock) {
  const blocks = [];
  const maxPosts = Math.max(1, Number(maxPostsPerBlock || 1));

  for (let i = 0; i < sections.length; i += 1) {
    const sec = sections[i];
    const title = normalizeWhitespace_(sec.title);

    let blockType = '';
    if (title && title.indexOf('인기글') !== -1) blockType = '인기글';
    else if (isPopularTopicSection_(sec)) blockType = '인기주제';
    if (!blockType) continue;
    if (isExcludedFromTopAnalysis_(sec)) continue;

    const posts = extractTopBlogPostsFromSection_(sec, maxPosts);
    blocks.push({
      blockType,
      blockTitle: title,
      blockIndex: sec.index,
      posts,
    });
  }

  return blocks;
}

/**
 * @param {string} keyword
 * @param {Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>} blocks
 * @returns {Array<{topicNo:number, topicLabel:string, analysisText:string, errorMessage:string}>}
 */
function buildTopicAnalyses_(keyword, blocks) {
  const out = [];
  const list = Array.isArray(blocks) ? blocks : [];

  for (let i = 0; i < list.length; i += 1) {
    const block = list[i];
    const topic = {
      topicNo: i + 1,
      topicLabel: buildBlockDisplayLabel_(block, i),
      analysisText: '',
      errorMessage: '',
    };

    if (!block.posts || !block.posts.length) {
      topic.analysisText = '상위 글 데이터가 없어 주제 분석을 생략했습니다.';
      out.push(topic);
      continue;
    }

    try {
      topic.analysisText = generateTopExposureStrategyForBlock_(keyword, block);
    } catch (err) {
      topic.errorMessage = safeErrorMessage_(err);
    }
    out.push(topic);
  }
  return out;
}

/**
 * @param {{blockType:string, blockTitle:string, blockIndex:number}} block
 * @param {number} idx
 * @returns {string}
 */
function buildBlockDisplayLabel_(block, idx) {
  const topicNo = Number(idx) + 1;
  return `주제 ${topicNo}. ${block.blockType} | ${block.blockTitle || '(제목없음)'} | ${block.blockIndex}번째`;
}

/**
 * @param {SerpSection} section
 * @param {number} limit
 * @returns {Array<{url:string,title:string,body:string,tags:string}>}
 */
function extractTopBlogPostsFromSection_(section, limit) {
  const maxCount = Math.max(1, Number(limit || 1));
  const candidates = extractBlogUrlsFromSection_(section.segment);
  const posts = [];
  const resolvedSeen = {};

  for (let i = 0; i < candidates.length; i += 1) {
    if (posts.length >= maxCount) break;

    try {
      const resolvedUrl = resolveBlogPostUrl_(candidates[i]);
      if (!resolvedUrl) continue;
      const dedupeKey = resolvedUrl.toLowerCase();
      if (resolvedSeen[dedupeKey]) continue;
      resolvedSeen[dedupeKey] = true;

      const post = fetchBlogPostData_(resolvedUrl);
      if (!post) continue;
      posts.push(post);
    } catch (err) {
      Logger.log(`[BLOG_PARSE_SKIP] ${candidates[i]} :: ${safeErrorMessage_(err)}`);
    }
  }

  return posts;
}

/**
 * @param {string} segment
 * @returns {string[]}
 */
function extractBlogUrlsFromSection_(segment) {
  const html = String(segment || '');
  if (!html) return [];

  const out = [];
  const seen = {};
  const hrefRe = /href=["']([^"']+)["']/gi;
  const jsonRe = /"(?:titleHref|contentHref|imageHref|keepTriggerUrl|link|href)"\s*:\s*"([^"]+)"/gi;
  let m;

  while ((m = hrefRe.exec(html)) !== null) {
    const candidate = normalizeUrlCandidate_(m[1] || '');
    if (!candidate) continue;
    const key = candidate.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(candidate);
  }

  while ((m = jsonRe.exec(html)) !== null) {
    const candidate = normalizeUrlCandidate_(m[1] || '');
    if (!candidate) continue;
    const key = candidate.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(candidate);
  }
  return out;
}

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeUrlCandidate_(raw) {
  let urlText = String(raw || '').trim();
  if (!urlText) return '';
  urlText = decodeHtmlEntities_(urlText);
  urlText = decodeScriptEscapedUrl_(urlText);
  urlText = urlText.replace(/&amp;/g, '&');
  if (urlText.indexOf('//') === 0) urlText = 'https:' + urlText;
  if (!/^https?:\/\//i.test(urlText)) return '';

  const host = extractHostFromUrl_(urlText);
  if (host === 'blog.naver.com' || host === 'm.blog.naver.com' || host === 'in.naver.com') {
    return urlText;
  }
  return '';
}

/**
 * @param {string} urlText
 * @returns {string}
 */
function decodeScriptEscapedUrl_(urlText) {
  return String(urlText || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\u003A/gi, ':')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/');
}

/**
 * @param {string} rawUrl
 * @returns {string}
 */
function normalizeBlogUrl_(rawUrl) {
  let urlText = String(rawUrl || '').trim();
  if (!urlText) return '';
  if (urlText.charAt(0) === '#') return '';

  urlText = decodeScriptEscapedUrl_(decodeHtmlEntities_(urlText));
  urlText = urlText.replace(/&amp;/g, '&');
  if (urlText.indexOf('//') === 0) urlText = 'https:' + urlText;
  if (!/^https?:\/\//i.test(urlText)) return '';

  const parts = parseHttpUrlParts_(urlText);
  if (!parts) return '';
  if (parts.host !== 'blog.naver.com' && parts.host !== 'm.blog.naver.com') return '';

  const lowerPath = String(parts.path || '').toLowerCase();
  if (lowerPath.indexOf('/postview.naver') !== -1) {
    const blogId = extractQueryParamFromUrl_(parts.query, 'blogId');
    const logNo = extractQueryParamFromUrl_(parts.query, 'logNo');
    if (!blogId || !logNo) return '';
    return `https://m.blog.naver.com/${encodeURIComponent(blogId)}/${encodeURIComponent(logNo)}`;
  }

  const segments = String(parts.path || '')
    .split('/')
    .map(function (s) { return String(s || '').trim(); })
    .filter(Boolean);

  if (segments.length < 2) return '';
  const blogId = segments[0];
  const logNo = segments[segments.length - 1];
  if (!/^\d{5,}$/.test(logNo)) return '';
  if (!blogId) return '';

  return `https://m.blog.naver.com/${encodeURIComponent(blogId)}/${encodeURIComponent(logNo)}`;
}

/**
 * @param {string} rawUrl
 * @returns {string}
 */
function resolveBlogPostUrl_(rawUrl) {
  const direct = normalizeBlogUrl_(rawUrl);
  if (direct) return direct;

  const host = extractHostFromUrl_(rawUrl);
  if (host === 'in.naver.com') {
    return resolveInNaverToBlogUrl_(rawUrl);
  }
  return '';
}

/**
 * @param {string} urlText
 * @returns {string}
 */
function extractHostFromUrl_(urlText) {
  const parts = parseHttpUrlParts_(String(urlText || ''));
  return parts ? parts.host : '';
}

/**
 * @param {string} urlText
 * @returns {{host:string, path:string, query:string}|null}
 */
function parseHttpUrlParts_(urlText) {
  const src = String(urlText || '').trim();
  const m = src.match(/^https?:\/\/([^\/?#]+)([^?#]*)?(\?[^#]*)?/i);
  if (!m) return null;

  const hostRaw = String(m[1] || '')
    .trim()
    .toLowerCase()
    .split('@')
    .pop();
  const host = String(hostRaw || '').split(':')[0];
  const path = String(m[2] || '/');
  const query = String(m[3] || '');
  if (!host) return null;

  return { host, path, query };
}

/**
 * @param {string} query
 * @param {string} key
 * @returns {string}
 */
function extractQueryParamFromUrl_(query, key) {
  const q = String(query || '').replace(/^\?/, '');
  if (!q || !key) return '';

  const parts = q.split('&');
  const target = String(key).toLowerCase();

  for (let i = 0; i < parts.length; i += 1) {
    const kv = String(parts[i] || '');
    if (!kv) continue;
    const pos = kv.indexOf('=');
    const k = pos === -1 ? kv : kv.substring(0, pos);
    const v = pos === -1 ? '' : kv.substring(pos + 1);
    const decodedKey = decodeUrlComponentSafe_(k).toLowerCase();
    if (decodedKey !== target) continue;
    return decodeUrlComponentSafe_(v).trim();
  }
  return '';
}

/**
 * @param {string} value
 * @returns {string}
 */
function decodeUrlComponentSafe_(value) {
  const raw = String(value || '').replace(/\+/g, '%20');
  try {
    return decodeURIComponent(raw);
  } catch (_) {
    return '';
  }
}

/**
 * @param {string} inNaverUrl
 * @returns {string}
 */
function resolveInNaverToBlogUrl_(inNaverUrl) {
  const urlText = String(inNaverUrl || '').trim();
  if (!urlText) return '';

  const locationHeaders = ['Location', 'location'];

  try {
    const redirected = withRetry_(
      function () {
        const resp = UrlFetchApp.fetch(urlText, {
          method: 'get',
          headers: {
            'User-Agent': PARSER_CFG.MOBILE_USER_AGENT,
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
          },
          muteHttpExceptions: true,
          followRedirects: false,
        });

        const status = resp.getResponseCode();
        if (status >= 300 && status < 400) {
          const headers = resp.getHeaders() || {};
          for (let i = 0; i < locationHeaders.length; i += 1) {
            const loc = headers[locationHeaders[i]];
            const normalized = normalizeBlogUrl_(String(loc || ''));
            if (normalized) return normalized;
          }
        }

        if (status >= 200 && status < 300) {
          const text = resp.getContentText() || '';
          const ogUrl = extractMetaContent_(text, 'property', 'og:url');
          const canonical = extractCanonicalHref_(text);
          const normalizedOg = normalizeBlogUrl_(ogUrl);
          if (normalizedOg) return normalizedOg;
          const normalizedCanonical = normalizeBlogUrl_(canonical);
          if (normalizedCanonical) return normalizedCanonical;
          return '';
        }

        const retryable = status === 429 || status >= 500;
        throw createHttpError_('in.naver resolve', status, resp.getContentText() || '', retryable);
      },
      PARSER_CFG.MAX_ATTEMPTS,
      PARSER_CFG.RETRY_BASE_DELAY_MS
    );
    return redirected || '';
  } catch (_) {
    return '';
  }
}

/**
 * @param {string} html
 * @returns {string}
 */
function extractCanonicalHref_(html) {
  const src = String(html || '');
  const m = src.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (!m) return '';
  return normalizeWhitespace_(decodeHtmlEntities_(m[1] || ''));
}

/**
 * @param {SerpSection} section
 * @returns {boolean}
 */
function isExcludedFromTopAnalysis_(section) {
  const blockId = String(section && section.blockId ? section.blockId : '');
  const title = normalizeWhitespace_(section && section.title ? section.title : '');

  if (/^ugc\/prs_template_v2_ugc_popular_cafe_/i.test(blockId)) return true;
  if (/카페/.test(title)) return true;

  if (/^ugc\/prs_template_ugc_influencer_participation_/i.test(blockId)) return true;
  if (/인플루언서/.test(title)) return true;

  if (/^ugc\/prs_template_v2_ugc_powercontents_/i.test(blockId)) return true;
  if (/브랜드 콘텐츠/.test(title)) return true;

  return false;
}

/**
 * @param {string} url
 * @returns {{url:string,title:string,body:string,tags:string}|null}
 */
function fetchBlogPostData_(url) {
  const html = withRetry_(
    function () {
      const resp = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: {
          'User-Agent': PARSER_CFG.MOBILE_USER_AGENT,
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        },
        muteHttpExceptions: true,
        followRedirects: true,
      });
      const status = resp.getResponseCode();
      const text = resp.getContentText() || '';
      if (status >= 200 && status < 300 && text) return text;
      const retryable = status === 429 || status >= 500;
      throw createHttpError_('Naver Blog fetch', status, text, retryable);
    },
    PARSER_CFG.MAX_ATTEMPTS,
    PARSER_CFG.RETRY_BASE_DELAY_MS
  );

  const title = extractMetaContent_(html, 'property', 'og:title')
    || extractMetaContent_(html, 'name', 'title')
    || extractTitleTag_(html);
  const desc = extractMetaContent_(html, 'property', 'og:description')
    || extractMetaContent_(html, 'name', 'description');
  const bodyRaw = extractBlogBodyText_(html, desc);
  const body = removeDuplicatedTitleFromBody_(title, bodyRaw);
  const tags = extractBlogTags_(html, `${title}\n${desc}\n${body}`);

  if (!title && !body) return null;
  return {
    url,
    title: truncateText_(title || '', 200),
    body: body || '',
    tags: tags.join(','),
  };
}

/**
 * 본문 첫 줄이 제목과 사실상 동일하면 제거한다.
 * @param {string} title
 * @param {string} body
 * @returns {string}
 */
function removeDuplicatedTitleFromBody_(title, body) {
  const t = normalizeWhitespace_(title || '');
  const src = String(body || '');
  if (!t || !src) return src;

  const lines = src
    .split('\n')
    .map(function (x) { return normalizeWhitespace_(x); })
    .filter(Boolean);
  if (!lines.length) return src;

  const first = lines[0];
  const titleKey = toCompareKey_(t);
  const firstKey = toCompareKey_(first);
  if (!titleKey || !firstKey) return src;

  const same = firstKey === titleKey;
  const contains = firstKey.length >= 8 && titleKey.length >= 8
    && (firstKey.indexOf(titleKey) !== -1 || titleKey.indexOf(firstKey) !== -1);

  if (same || contains) {
    lines.shift();
    return lines.join('\n');
  }
  return src;
}

/**
 * @param {string} value
 * @returns {string}
 */
function toCompareKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/gi, '');
}

/**
 * @param {string} html
 * @param {'property'|'name'} attrName
 * @param {string} attrValue
 * @returns {string}
 */
function extractMetaContent_(html, attrName, attrValue) {
  const src = String(html || '');
  const escaped = escapeRegExp_(String(attrValue || ''));
  const re = new RegExp(
    `<meta[^>]+${attrName}=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    'i'
  );
  const m = src.match(re);
  if (!m) return '';
  return normalizeWhitespace_(decodeHtmlEntities_(m[1] || ''));
}

/**
 * @param {string} html
 * @returns {string}
 */
function extractTitleTag_(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return normalizeWhitespace_(decodeHtmlEntities_(stripHtmlTags_(m[1] || '')));
}

/**
 * @param {string} html
 * @param {string} fallbackText
 * @returns {string}
 */
function extractBlogBodyText_(html, fallbackText) {
  const src = String(html || '');
  const seParagraphs = extractSmartEditorParagraphs_(src);
  if (seParagraphs.length) {
    return seParagraphs.join('\n');
  }

  const paragraphs = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;

  while ((m = re.exec(src)) !== null) {
    const text = normalizeWhitespace_(decodeHtmlEntities_(stripHtmlTags_(m[1] || '')));
    if (!text) continue;
    if (text.length < 15) continue;
    paragraphs.push(text);
  }

  if (paragraphs.length) {
    return paragraphs.join('\n');
  }

  const fallback = normalizeWhitespace_(fallbackText || '');
  if (fallback) return fallback;
  return '';
}

/**
 * @param {string} html
 * @param {string} seedText
 * @returns {string[]}
 */
function extractBlogTags_(html, seedText) {
  const result = [];
  const seen = {};

  const add = function (tagText) {
    const normalized = normalizeWhitespace_(decodeHtmlEntities_(String(tagText || '')))
      .replace(/^#+/, '')
      .replace(/[,|]+/g, ' ')
      .replace(/\s+/g, '')
      .trim();
    if (!normalized) return;
    const tag = `#${normalized}`;
    const key = tag.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    result.push(tag);
  };

  const src = String(html || '');
  let m;

  // 1) SmartEditor hash tag span (가장 정확)
  const seTagRe = /<span[^>]*class=["'][^"']*__se-hash-tag[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
  while ((m = seTagRe.exec(src)) !== null) {
    add(stripHtmlTags_(m[1] || ''));
    if (result.length >= 15) return result;
  }

  // 2) 페이지 데이터 JSON의 tagNames
  const tagNamesRe = /"tagNames"\s*:\s*"([^"]*)"/gi;
  while ((m = tagNamesRe.exec(src)) !== null) {
    const decoded = decodeUnicodeEscapes_(m[1] || '');
    const parts = String(decoded || '')
      .split(',')
      .map(function (x) { return normalizeWhitespace_(x); })
      .filter(Boolean);
    for (let i = 0; i < parts.length; i += 1) {
      add(parts[i]);
      if (result.length >= 15) return result;
    }
  }

  // 3) fallback: 일반 해시태그 패턴
  const seText = extractSmartEditorParagraphs_(src).join('\n');
  const plain = decodeHtmlEntities_(stripHtmlTags_(src));
  const seed = `${seText}\n${plain}\n${seedText || ''}`.substring(0, 50000);
  const re = /(^|[\s\u00A0])#([0-9A-Za-z가-힣_]{2,30})/g;
  while ((m = re.exec(seed)) !== null) {
    add(m[2]);
    if (result.length >= 15) break;
  }
  return result;
}

/**
 * @param {string} html
 * @returns {string[]}
 */
function extractSmartEditorParagraphs_(html) {
  const src = String(html || '');
  const out = [];
  const re = /<p[^>]*class=["'][^"']*se-text-paragraph[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi;
  let m;

  while ((m = re.exec(src)) !== null) {
    const text = normalizeWhitespace_(decodeHtmlEntities_(stripHtmlTags_(m[1] || '')));
    if (!text) continue;
    if (text.length < 2) continue;
    out.push(text);
  }
  return out;
}

/**
 * @param {string} value
 * @returns {string}
 */
function decodeUnicodeEscapes_(value) {
  return String(value || '')
    .replace(/\\u([0-9a-fA-F]{4})/g, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    })
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/\\\\/g, '\\');
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp_(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
