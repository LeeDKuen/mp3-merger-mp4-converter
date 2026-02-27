/**
 * @returns {{
 *   sheetName: string,
 *   totalRows: number,
 *   processedRows: number,
 *   okRows: number,
 *   errorRows: number,
 *   remainingRows: number,
 *   timedOut: boolean,
 *   activeBlogIdCount: number
 * }}
 */
function runBlogRankCollect_() {
  const sheet = initTargetSheetHeaders_();
  initBlogIdSheetHeaders_();

  const rows = readKeywordRows_(sheet, COL.RANK_COLLECT_QUEUE);
  if (!rows.length) {
    throw new Error('순위 수집 대상이 없습니다. I열(순위 수집) 체크박스를 선택하세요.');
  }

  const activeBlogIds = normalizeTargetBlogIds_(readActiveBlogIds_());
  if (!activeBlogIds.length) {
    throw new Error(`${PARSER_CFG.BLOG_ID_SHEET_NAME} 시트에 활성 블로그ID가 없습니다. A열(활성) 체크 후 B열에 블로그ID를 입력하세요.`);
  }

  const startedAt = Date.now();
  const summary = {
    sheetName: sheet.getName(),
    totalRows: rows.length,
    processedRows: 0,
    okRows: 0,
    errorRows: 0,
    remainingRows: 0,
    timedOut: false,
    activeBlogIdCount: activeBlogIds.length,
  };

  for (let i = 0; i < rows.length; i += 1) {
    if (Date.now() - startedAt > PARSER_CFG.RANK_COLLECT_MAX_RUNTIME_MS) {
      summary.timedOut = true;
      summary.remainingRows = rows.length - i;
      break;
    }

    const row = rows[i];
    const collectedAt = formatNowForSheet_();

    try {
      const rankResult = collectBlogRankResultForKeyword_(row.query, activeBlogIds);
      writeRankRowSuccess_(sheet, row.rowIndex, {
        rankResult,
        collectedAt,
      });
      summary.okRows += 1;
    } catch (err) {
      writeRankRowError_(sheet, row.rowIndex, collectedAt, safeErrorMessage_(err));
      summary.errorRows += 1;
    }

    summary.processedRows += 1;
  }

  return summary;
}

/**
 * @param {string} query
 * @param {string[]} targetBlogIds
 * @returns {string}
 */
function collectBlogRankResultForKeyword_(query, targetBlogIds) {
  const targets = normalizeTargetBlogIds_(targetBlogIds);
  if (!targets.length) return '순위 없음';

  const targetSet = {};
  for (let i = 0; i < targets.length; i += 1) {
    targetSet[targets[i]] = true;
  }

  const html = fetchMobileSerpHtml_(query);
  const sections = parseSerpSectionsFromHtml_(html);
  const hits = {};
  let unresolved = targets.length;

  for (let i = 0; i < sections.length; i += 1) {
    if (unresolved <= 0) break;

    const sec = sections[i];
    const rankedBlogIds = extractSectionBlogRanks_(sec);
    for (let j = 0; j < rankedBlogIds.length; j += 1) {
      const item = rankedBlogIds[j];
      const blogId = item.blogId;
      if (!targetSet[blogId]) continue;
      if (hits[blogId]) continue;

      hits[blogId] = {
        sectionIndex: sec.index,
        rank: item.rank,
        sectionTitle: normalizeWhitespace_(sec.title) || '제목없음',
      };
      unresolved -= 1;
      if (unresolved <= 0) break;
    }
  }

  const parts = [];
  for (let i = 0; i < targets.length; i += 1) {
    const blogId = targets[i];
    const hit = hits[blogId];
    if (!hit) continue;
    parts.push(`${blogId}: ${hit.sectionIndex}섹션 ${hit.rank}위 (${hit.sectionTitle})`);
  }

  return parts.length ? parts.join(' | ') : '순위 없음';
}

/**
 * @param {SerpSection} section
 * @returns {Array<{blogId:string, rank:number}>}
 */
function extractSectionBlogRanks_(section) {
  const segment = String(section && section.segment ? section.segment : '');
  const candidates = extractBlogUrlsFromSection_(segment);
  const out = [];
  const seenUrl = {};
  const seenBlogId = {};
  let rank = 0;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    let resolved = '';

    try {
      resolved = resolveBlogPostUrl_(candidate);
    } catch (_) {
      resolved = '';
    }

    if (!resolved) continue;
    const normalizedPostUrl = normalizeBlogUrl_(resolved) || resolved;
    const dedupeKey = normalizedPostUrl.toLowerCase();
    if (seenUrl[dedupeKey]) continue;
    seenUrl[dedupeKey] = true;

    const blogId = extractBlogIdFromBlogPostUrl_(normalizedPostUrl);
    if (!blogId) continue;

    rank += 1;
    if (seenBlogId[blogId]) continue;
    seenBlogId[blogId] = true;

    out.push({
      blogId,
      rank,
    });
  }

  return out;
}

/**
 * @param {string} postUrl
 * @returns {string}
 */
function extractBlogIdFromBlogPostUrl_(postUrl) {
  const normalized = normalizeBlogUrl_(postUrl);
  if (!normalized) return '';

  const m = normalized.match(/^https?:\/\/m\.blog\.naver\.com\/([^\/?#]+)\/\d{5,}/i);
  if (!m || !m[1]) return '';

  return decodeUrlComponentSafe_(m[1]).replace(/\s+/g, '').toLowerCase();
}

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function normalizeTargetBlogIds_(values) {
  const list = Array.isArray(values) ? values : [];
  const out = [];
  const seen = {};

  for (let i = 0; i < list.length; i += 1) {
    const id = normalizeBlogIdCellValue_(list[i]);
    if (!id || seen[id]) continue;
    seen[id] = true;
    out.push(id);
  }
  return out;
}
