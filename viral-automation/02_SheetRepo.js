function getParserTimezone_() {
  const raw = getParserProp_(PARSER_PROP_KEYS.PARSER_TIMEZONE, '');
  return raw ? String(raw).trim() : 'Asia/Seoul';
}

function getTargetSheetName_() {
  const raw = getParserProp_(PARSER_PROP_KEYS.PARSER_TARGET_SHEET_NAME, '');
  const name = String(raw || '').trim();
  return name || PARSER_CFG.DEFAULT_SHEET_NAME;
}

function getOrCreateTargetSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = getTargetSheetName_();
  const existing = ss.getSheetByName(name);
  if (existing) return existing;
  return ss.insertSheet(name);
}

function getOrCreateBlogIdSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = PARSER_CFG.BLOG_ID_SHEET_NAME;
  const existing = ss.getSheetByName(name);
  if (existing) return existing;
  return ss.insertSheet(name);
}

function getOrCreateProductSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = PARSER_CFG.PRODUCT_SHEET_NAME;
  const existing = ss.getSheetByName(name);
  if (existing) return existing;
  return ss.insertSheet(name);
}

function getOrCreateContentHistorySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = PARSER_CFG.CONTENT_HISTORY_SHEET_NAME;
  const existing = ss.getSheetByName(name);
  if (existing) return existing;
  return ss.insertSheet(name);
}

function initTargetSheetHeaders_() {
  const sheet = getOrCreateTargetSheet_();
  migrateLegacyHeaderIfNeeded_(sheet);

  const requiredCols = SHEET_HEADERS.length;
  const maxCols = sheet.getMaxColumns();
  if (maxCols < requiredCols) {
    sheet.insertColumnsAfter(maxCols, requiredCols - maxCols);
  }
  sheet.getRange(PARSER_CFG.HEADER_ROW, 1, 1, requiredCols).setValues([SHEET_HEADERS]);
  ensureQueueCheckboxColumns_(sheet);
  ensureProduceProductValidation_(sheet);
  sheet.setFrozenRows(PARSER_CFG.HEADER_ROW);
  return sheet;
}

function initBlogIdSheetHeaders_() {
  const sheet = getOrCreateBlogIdSheet_();
  const requiredCols = BLOG_ID_HEADERS.length;
  const maxCols = sheet.getMaxColumns();
  if (maxCols < requiredCols) {
    sheet.insertColumnsAfter(maxCols, requiredCols - maxCols);
  }
  sheet.getRange(PARSER_CFG.HEADER_ROW, 1, 1, requiredCols).setValues([BLOG_ID_HEADERS]);
  ensureBlogIdCheckboxColumn_(sheet);
  sheet.setFrozenRows(PARSER_CFG.HEADER_ROW);
  return sheet;
}

function initProductSheetHeaders_() {
  const sheet = getOrCreateProductSheet_();
  const requiredCols = PRODUCT_HEADERS.length;
  const maxCols = sheet.getMaxColumns();
  if (maxCols < requiredCols) {
    sheet.insertColumnsAfter(maxCols, requiredCols - maxCols);
  }
  sheet.getRange(PARSER_CFG.HEADER_ROW, 1, 1, requiredCols).setValues([PRODUCT_HEADERS]);
  sheet.setFrozenRows(PARSER_CFG.HEADER_ROW);
  return sheet;
}

function initContentHistorySheetHeaders_() {
  const sheet = getOrCreateContentHistorySheet_();
  const requiredCols = CONTENT_HISTORY_HEADERS.length;
  const maxCols = sheet.getMaxColumns();
  if (maxCols < requiredCols) {
    sheet.insertColumnsAfter(maxCols, requiredCols - maxCols);
  }
  sheet.getRange(PARSER_CFG.HEADER_ROW, 1, 1, requiredCols).setValues([CONTENT_HISTORY_HEADERS]);
  sheet.setFrozenRows(PARSER_CFG.HEADER_ROW);
  return sheet;
}

/**
 * Legacy schema v1 (A:K):
 * ... H:스마트블록섹션순번 I:수집날짜 J:상태 K:에러
 * Legacy schema v2 (A:M):
 * ... H:스마트블록섹션순번 I:수집큐 J:분석큐 K:수집날짜 L:상태 M:에러
 * Legacy schema v3 (A:N):
 * ... H:스마트블록섹션순번 I:수집 J:분석 K:제작 L:수집날짜 M:상태 N:에러
 * Legacy schema v4 (A:O):
 * ... H:스마트블록섹션순번 I:키 수집 J:글 수집 K:글 분석 L:제작 M:수집날짜 N:상태 O:에러
 * Current schema v6 (A:R):
 * ... H:스마트블록섹션순번 I:순위 수집 J:키 수집 K:글 수집 L:글 분석 M:제작
 * N:순위결과 O:키워드 수집날짜 P:순위 수집날짜 Q:상태 R:에러
 * Current schema v7 (A:Y):
 * ... + S:제작제품 T:작성의도 U:제작제목 V:제작파일URL W:제작일시 X:제작상태 Y:제작에러
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function migrateLegacyHeaderIfNeeded_(sheet) {
  const maxCols = sheet.getMaxColumns();
  if (maxCols < 11) return;

  const headers = readHeaderRow_(sheet, Math.min(maxCols, 30));
  if (isCurrentSchemaV6OrLater_(headers)) return;

  const h9 = headers[8] || '';
  const h10 = headers[9] || '';
  const h11 = headers[10] || '';

  const isLegacyV3 = h9 === '수집' && h10 === '분석' && h11 === '제작';
  const isLegacyV2 = h9 === '수집큐' && h10 === '분석큐' && h11 === '수집날짜';
  const isLegacyV1 = h9 === '수집날짜' && h10 === '상태' && h11 === '에러';
  const isKnownV4OrLater = h9 === '키 수집' || h9 === '순위 조사' || h9 === '순위 수집';
  const forceInsertRankQueue = isLegacyV1 || isLegacyV2 || isLegacyV3;

  if (isLegacyV3) {
    migrateQueueValuesV3ToV4_(sheet);
  } else if (isLegacyV2) {
    migrateQueueValuesV2ToV4_(sheet);
  } else if (isLegacyV1) {
    // I~L 큐 4개 추가
    sheet.insertColumnsBefore(9, 4);
  } else if (!isKnownV4OrLater) {
    // 빈 시트/알 수 없는 헤더는 강제 삽입 없이 최신 헤더 쓰기로 정렬
    return;
  }

  migrateToSchemaV6_(sheet, forceInsertRankQueue);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {boolean} forceInsertRankQueue
 */
function migrateToSchemaV6_(sheet, forceInsertRankQueue) {
  let headers = readHeaderRow_(sheet, Math.min(sheet.getMaxColumns(), 30));
  const h9 = headers[8] || '';
  const hasRankQueueAlready = h9 === '순위 수집' || h9 === '순위 조사';

  // v4 -> v6 step1: I열 앞에 "순위 수집" 큐 추가
  if ((forceInsertRankQueue && !hasRankQueueAlready) || h9 === '키 수집') {
    sheet.insertColumnsBefore(COL.RANK_COLLECT_QUEUE, 1);
  }

  headers = readHeaderRow_(sheet, Math.min(sheet.getMaxColumns(), 30));
  const h14 = headers[13] || '';
  // v6 고정: N열은 순위결과
  if (h14 !== '순위결과') {
    sheet.insertColumnsBefore(COL.RANK_RESULT, 1);
  }

  headers = readHeaderRow_(sheet, Math.min(sheet.getMaxColumns(), 30));
  const h16 = headers[15] || '';
  // v6 고정: P열은 순위 수집날짜
  if (h16 !== '순위 수집날짜') {
    sheet.insertColumnsBefore(COL.RANK_COLLECTED_AT, 1);
  }
}

/**
 * @param {string[]} headers
 * @returns {boolean}
 */
function isCurrentSchemaV6OrLater_(headers) {
  const h = Array.isArray(headers) ? headers : [];
  return (
    (h[8] || '') === '순위 수집'
    && (h[9] || '') === '키 수집'
    && (h[10] || '') === '글 수집'
    && (h[11] || '') === '글 분석'
    && (h[12] || '') === '제작'
    && (h[13] || '') === '순위결과'
    && (h[14] || '') === '키워드 수집날짜'
    && (h[15] || '') === '순위 수집날짜'
    && (h[16] || '') === '상태'
    && (h[17] || '') === '에러'
  );
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} width
 * @returns {string[]}
 */
function readHeaderRow_(sheet, width) {
  const maxCols = sheet.getMaxColumns();
  const readCols = Math.max(1, Math.min(maxCols, Number(width || maxCols)));
  const values = sheet.getRange(PARSER_CFG.HEADER_ROW, 1, 1, readCols).getValues()[0];
  const out = [];
  for (let i = 0; i < readCols; i += 1) {
    out.push(normalizeWhitespace_(values[i]));
  }
  return out;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function migrateQueueValuesV3ToV4_(sheet) {
  // old v3: I(수집), J(분석), K(제작), L(수집날짜), M(상태), N(에러)
  // to v4:   I(키 수집), J(글 수집), K(글 분석), L(제작), M(수집날짜), N(상태), O(에러)
  sheet.insertColumnsBefore(11, 1);

  const lastRow = sheet.getLastRow();
  if (lastRow <= PARSER_CFG.HEADER_ROW) return;

  const numRows = lastRow - PARSER_CFG.HEADER_ROW;
  const oldAnalysisRange = sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 10, numRows, 1); // old J(분석)
  const oldValues = oldAnalysisRange.getValues();
  const toAnalysis = [];
  const toPostCollect = [];

  for (let i = 0; i < oldValues.length; i += 1) {
    const marked = isQueueMarked_(oldValues[i][0]);
    toAnalysis.push([marked]);
    toPostCollect.push([false]);
  }

  sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 11, numRows, 1).setValues(toAnalysis); // new K(글 분석)
  sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 10, numRows, 1).setValues(toPostCollect); // new J(글 수집)
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function migrateQueueValuesV2ToV4_(sheet) {
  // old v2: I(수집큐), J(분석큐), K(수집날짜), L(상태), M(에러)
  // to v4:   I(키 수집), J(글 수집), K(글 분석), L(제작), M(수집날짜), N(상태), O(에러)
  sheet.insertColumnsBefore(11, 2);

  const lastRow = sheet.getLastRow();
  if (lastRow <= PARSER_CFG.HEADER_ROW) return;

  const numRows = lastRow - PARSER_CFG.HEADER_ROW;
  const oldKeyRange = sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 9, numRows, 1); // old I(수집큐)
  const oldAnalysisRange = sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 10, numRows, 1); // old J(분석큐)
  const oldKeyValues = oldKeyRange.getValues();
  const oldAnalysisValues = oldAnalysisRange.getValues();

  const keyValues = [];
  const postCollectValues = [];
  const postAnalysisValues = [];
  const produceValues = [];

  for (let i = 0; i < numRows; i += 1) {
    keyValues.push([isQueueMarked_(oldKeyValues[i][0])]);
    postCollectValues.push([false]);
    postAnalysisValues.push([isQueueMarked_(oldAnalysisValues[i][0])]);
    produceValues.push([false]);
  }

  sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 9, numRows, 1).setValues(keyValues);
  sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 10, numRows, 1).setValues(postCollectValues);
  sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 11, numRows, 1).setValues(postAnalysisValues);
  sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 12, numRows, 1).setValues(produceValues);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number=} queueColumn
 * @returns {KeywordRow[]}
 */
function readKeywordRows_(sheet, queueColumn) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= PARSER_CFG.HEADER_ROW) return [];

  const numRows = lastRow - PARSER_CFG.HEADER_ROW;
  const readCols = Math.max(COL.KEYWORD, Number(queueColumn || COL.KEYWORD));
  const values = sheet
    .getRange(PARSER_CFG.HEADER_ROW + 1, COL.KEYWORD, numRows, readCols)
    .getValues();

  const rows = [];
  for (let i = 0; i < values.length; i += 1) {
    const keyword = normalizeWhitespace_(values[i][0]);
    if (!keyword) continue;
    if (queueColumn && !isQueueMarked_(values[i][queueColumn - 1])) continue;

    rows.push({
      rowIndex: PARSER_CFG.HEADER_ROW + 1 + i,
      keyword,
      query: keyword,
    });
  }
  return rows;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Array<{rowIndex:number,keyword:string,query:string,productName:string,intent:string,rankResult:string}>}
 */
function readProduceRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= PARSER_CFG.HEADER_ROW) return [];

  const numRows = lastRow - PARSER_CFG.HEADER_ROW;
  const values = sheet
    .getRange(PARSER_CFG.HEADER_ROW + 1, COL.KEYWORD, numRows, COL.PRODUCE_INTENT)
    .getValues();

  const rows = [];
  for (let i = 0; i < values.length; i += 1) {
    const keyword = normalizeWhitespace_(values[i][COL.KEYWORD - 1]);
    if (!keyword) continue;
    if (!isQueueMarked_(values[i][COL.PRODUCE_QUEUE - 1])) continue;

    rows.push({
      rowIndex: PARSER_CFG.HEADER_ROW + 1 + i,
      keyword,
      query: keyword,
      rankResult: normalizeWhitespace_(values[i][COL.RANK_RESULT - 1]),
      productName: normalizeWhitespace_(values[i][COL.PRODUCE_PRODUCT - 1]),
      intent: normalizeWhitespace_(values[i][COL.PRODUCE_INTENT - 1]),
    });
  }
  return rows;
}

/**
 * @returns {string[]}
 */
function readActiveBlogIds_() {
  const sheet = initBlogIdSheetHeaders_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= PARSER_CFG.HEADER_ROW) return [];

  const numRows = lastRow - PARSER_CFG.HEADER_ROW;
  const values = sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 1, numRows, 2).getValues();
  const out = [];
  const seen = {};

  for (let i = 0; i < values.length; i += 1) {
    if (!isQueueMarked_(values[i][0])) continue;
    const id = normalizeBlogIdCellValue_(values[i][1]);
    if (!id || seen[id]) continue;
    seen[id] = true;
    out.push(id);
  }

  return out;
}

/**
 * @param {*} value
 * @returns {string}
 */
function normalizeBlogIdCellValue_(value) {
  const raw = normalizeWhitespace_(value);
  if (!raw) return '';

  const compact = String(raw).replace(/\s+/g, '');
  if (!compact) return '';

  const blogIdFromQuery = compact.match(/[?&]blogId=([^&#]+)/i);
  if (blogIdFromQuery && blogIdFromQuery[1]) {
    return decodeUrlComponentSafe_(blogIdFromQuery[1]).replace(/\s+/g, '').toLowerCase();
  }

  const blogHost = compact.match(/^https?:\/\/(?:m\.)?blog\.naver\.com\/([^\/?#]+)/i);
  if (blogHost && blogHost[1]) {
    return decodeUrlComponentSafe_(blogHost[1]).replace(/\s+/g, '').toLowerCase();
  }

  return compact.replace(/^@+/, '').toLowerCase();
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowIndex
 * @param {{
 *   result: QueryResult,
 *   collectedAt: string
 * }} payload
 */
function writeRowSuccess_(sheet, rowIndex, payload) {
  const metricValues = [
    payload.result.pcVolume,
    payload.result.moVolume,
    payload.result.totalVolume,
    payload.result.smartblockFlag,
    payload.result.popularArticleTitles,
    payload.result.popularTopicTitles,
    payload.result.sectionIndexesRaw,
  ];

  sheet.getRange(rowIndex, COL.PC, 1, metricValues.length).setValues([metricValues]);
  clearRowQueue_(sheet, rowIndex, COL.KEY_COLLECT_QUEUE);
  sheet.getRange(rowIndex, COL.KEYWORD_COLLECTED_AT).setValue(payload.collectedAt);
  sheet.getRange(rowIndex, COL.STATUS).setValue(RESULT_STATUS.OK);
  sheet.getRange(rowIndex, COL.ERROR).setValue('');
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowIndex
 * @param {string} collectedAt
 * @param {string} errorMessage
 */
function writeRowError_(sheet, rowIndex, collectedAt, errorMessage) {
  const emptyMetrics = [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  sheet.getRange(rowIndex, COL.PC, 1, emptyMetrics.length).setValues([emptyMetrics]);
  clearRowQueue_(sheet, rowIndex, COL.KEY_COLLECT_QUEUE);
  sheet.getRange(rowIndex, COL.KEYWORD_COLLECTED_AT).setValue(collectedAt);
  sheet.getRange(rowIndex, COL.STATUS).setValue(RESULT_STATUS.ERROR);
  sheet.getRange(rowIndex, COL.ERROR).setValue(errorMessage);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowIndex
 * @param {{rankResult:string, collectedAt:string}} payload
 */
function writeRankRowSuccess_(sheet, rowIndex, payload) {
  clearRowQueue_(sheet, rowIndex, COL.RANK_COLLECT_QUEUE);
  sheet.getRange(rowIndex, COL.RANK_RESULT).setValue(payload.rankResult);
  sheet.getRange(rowIndex, COL.RANK_COLLECTED_AT).setValue(payload.collectedAt);
  sheet.getRange(rowIndex, COL.STATUS).setValue(RESULT_STATUS.OK);
  sheet.getRange(rowIndex, COL.ERROR).setValue('');
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowIndex
 * @param {string} collectedAt
 * @param {string} errorMessage
 */
function writeRankRowError_(sheet, rowIndex, collectedAt, errorMessage) {
  clearRowQueue_(sheet, rowIndex, COL.RANK_COLLECT_QUEUE);
  sheet.getRange(rowIndex, COL.RANK_RESULT).setValue('');
  sheet.getRange(rowIndex, COL.RANK_COLLECTED_AT).setValue(collectedAt);
  sheet.getRange(rowIndex, COL.STATUS).setValue(RESULT_STATUS.ERROR);
  sheet.getRange(rowIndex, COL.ERROR).setValue(errorMessage);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowIndex
 * @param {{title:string,fileUrl:string,producedAt:string}} payload
 */
function writeProduceSuccess_(sheet, rowIndex, payload) {
  clearRowQueue_(sheet, rowIndex, COL.PRODUCE_QUEUE);
  sheet
    .getRange(rowIndex, COL.PRODUCE_TITLE, 1, 5)
    .setValues([[payload.title || '', payload.fileUrl || '', payload.producedAt || '', RESULT_STATUS.OK, '']]);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowIndex
 * @param {string} producedAt
 * @param {string} errorMessage
 * @param {string=} fileUrl
 */
function writeProduceError_(sheet, rowIndex, producedAt, errorMessage, fileUrl) {
  clearRowQueue_(sheet, rowIndex, COL.PRODUCE_QUEUE);
  sheet
    .getRange(rowIndex, COL.PRODUCE_TITLE, 1, 5)
    .setValues([['', fileUrl || '', producedAt || '', RESULT_STATUS.ERROR, errorMessage || 'Unknown error']]);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowIndex
 * @param {number} queueColumn
 */
function clearRowQueue_(sheet, rowIndex, queueColumn) {
  if (!queueColumn) return;
  sheet.getRange(rowIndex, queueColumn).setValue(false);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function ensureQueueCheckboxColumns_(sheet) {
  const startRow = PARSER_CFG.HEADER_ROW + 1;
  const maxRows = sheet.getMaxRows();
  const numRows = Math.max(1, maxRows - PARSER_CFG.HEADER_ROW);
  const queueCols = 5;

  const checkboxRule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .build();

  sheet
    .getRange(startRow, COL.RANK_COLLECT_QUEUE, numRows, queueCols)
    .setDataValidation(checkboxRule);

  const lastRow = sheet.getLastRow();
  if (lastRow <= PARSER_CFG.HEADER_ROW) return;

  const dataRows = lastRow - PARSER_CFG.HEADER_ROW;
  const range = sheet.getRange(startRow, COL.RANK_COLLECT_QUEUE, dataRows, queueCols);
  const values = range.getValues();
  let changed = false;

  for (let r = 0; r < values.length; r += 1) {
    for (let c = 0; c < queueCols; c += 1) {
      const current = values[r][c];
      const normalized = isQueueMarked_(current);
      if (current !== normalized) {
        values[r][c] = normalized;
        changed = true;
      }
    }
  }

  if (changed) {
    range.setValues(values);
  }
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function ensureBlogIdCheckboxColumn_(sheet) {
  const startRow = PARSER_CFG.HEADER_ROW + 1;
  const maxRows = sheet.getMaxRows();
  const numRows = Math.max(1, maxRows - PARSER_CFG.HEADER_ROW);

  const checkboxRule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .build();

  sheet.getRange(startRow, 1, numRows, 1).setDataValidation(checkboxRule);

  const lastRow = sheet.getLastRow();
  if (lastRow <= PARSER_CFG.HEADER_ROW) return;

  const dataRows = lastRow - PARSER_CFG.HEADER_ROW;
  const range = sheet.getRange(startRow, 1, dataRows, 1);
  const values = range.getValues();
  let changed = false;

  for (let i = 0; i < values.length; i += 1) {
    const current = values[i][0];
    const normalized = isQueueMarked_(current);
    if (current !== normalized) {
      values[i][0] = normalized;
      changed = true;
    }
  }

  if (changed) {
    range.setValues(values);
  }
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} keywordSheet
 */
function ensureProduceProductValidation_(keywordSheet) {
  const productSheet = initProductSheetHeaders_();
  const startRow = PARSER_CFG.HEADER_ROW + 1;
  const maxRows = keywordSheet.getMaxRows();
  const numRows = Math.max(1, maxRows - PARSER_CFG.HEADER_ROW);
  const productMaxRows = Math.max(1, productSheet.getMaxRows() - PARSER_CFG.HEADER_ROW);
  const productRange = productSheet.getRange(startRow, 1, productMaxRows, 1);

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(productRange, true)
    .setAllowInvalid(true)
    .build();

  keywordSheet
    .getRange(startRow, COL.PRODUCE_PRODUCT, numRows, 1)
    .setDataValidation(rule);
}
