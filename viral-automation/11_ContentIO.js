/**
 * @returns {{list:Array<Object<string,string>>, byName:Object<string,Object<string,string>>}}
 */
function readProductProfiles_() {
  const sheet = initProductSheetHeaders_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= PARSER_CFG.HEADER_ROW) {
    return { list: [], byName: {} };
  }

  const numRows = lastRow - PARSER_CFG.HEADER_ROW;
  const values = sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 1, numRows, PRODUCT_HEADERS.length).getValues();

  const list = [];
  const byName = {};
  for (let i = 0; i < values.length; i += 1) {
    const productName = normalizeWhitespace_(values[i][0]);
    if (!productName) continue;

    const profile = {
      productName: productName,
      targetKeyword: normalizeWhitespace_(values[i][1]),
      category: normalizeWhitespace_(values[i][2]),
      pain: normalizeWhitespace_(values[i][3]),
      wrongSolution: normalizeWhitespace_(values[i][4]),
      enemy: normalizeWhitespace_(values[i][5]),
      usp: normalizeWhitespace_(values[i][6]),
      routine: normalizeWhitespace_(values[i][7]),
      knowledge: normalizeWhitespace_(values[i][8]),
      complianceMemo: normalizeWhitespace_(values[i][9]),
    };

    list.push(profile);
    byName[normalizeProductNameKey_(productName)] = profile;
  }

  return { list: list, byName: byName };
}

/**
 * @param {{list:Array<Object<string,string>>, byName:Object<string,Object<string,string>>}} productProfiles
 * @param {string} productName
 * @returns {Object<string,string>|null}
 */
function findProductProfile_(productProfiles, productName) {
  const key = normalizeProductNameKey_(productName);
  if (!key) return null;
  const map = productProfiles && productProfiles.byName ? productProfiles.byName : {};
  return map[key] || null;
}

/**
 * @param {string} name
 * @returns {string}
 */
function normalizeProductNameKey_(name) {
  return normalizeWhitespace_(name).toLowerCase();
}

/**
 * @param {string} keyword
 * @param {string} productName
 * @param {number=} limit
 * @returns {Array<{createdAt:string, keyword:string, productName:string, title:string, draftHash:string, rewriteHash:string, fileUrl:string}>}
 */
function readRecentContentHistory_(keyword, productName, limit) {
  const sheet = initContentHistorySheetHeaders_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= PARSER_CFG.HEADER_ROW) return [];

  const numRows = lastRow - PARSER_CFG.HEADER_ROW;
  const values = sheet.getRange(PARSER_CFG.HEADER_ROW + 1, 1, numRows, CONTENT_HISTORY_HEADERS.length).getValues();
  const targetKeyword = normalizeWhitespace_(keyword);
  const targetProduct = normalizeProductNameKey_(productName);
  const maxCount = Math.max(1, Number(limit || 5));

  const out = [];
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const rowKeyword = normalizeWhitespace_(values[i][1]);
    const rowProduct = normalizeProductNameKey_(values[i][2]);
    if (targetKeyword && rowKeyword !== targetKeyword) continue;
    if (targetProduct && rowProduct !== targetProduct) continue;

    out.push({
      createdAt: normalizeWhitespace_(values[i][0]),
      keyword: rowKeyword,
      productName: normalizeWhitespace_(values[i][2]),
      title: normalizeWhitespace_(values[i][3]),
      draftHash: normalizeWhitespace_(values[i][4]),
      rewriteHash: normalizeWhitespace_(values[i][5]),
      fileUrl: normalizeWhitespace_(values[i][6]),
    });
    if (out.length >= maxCount) break;
  }
  return out;
}

/**
 * @param {{createdAt:string,keyword:string,productName:string,title:string,draftHash:string,rewriteHash:string,fileUrl:string}} entry
 */
function appendContentHistory_(entry) {
  const sheet = initContentHistorySheetHeaders_();
  const row = [
    normalizeWhitespace_(entry && entry.createdAt),
    normalizeWhitespace_(entry && entry.keyword),
    normalizeWhitespace_(entry && entry.productName),
    normalizeWhitespace_(entry && entry.title),
    normalizeWhitespace_(entry && entry.draftHash),
    normalizeWhitespace_(entry && entry.rewriteHash),
    normalizeWhitespace_(entry && entry.fileUrl),
  ];
  sheet.appendRow(row);
}

/**
 * @param {string} text
 * @returns {string}
 */
function computeTextHash_(text) {
  const raw = String(text || '');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(digest);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} book
 * @returns {{
 *   processSheet: GoogleAppsScript.Spreadsheet.Sheet,
 *   contentSheet: GoogleAppsScript.Spreadsheet.Sheet,
 *   reviewSheet: GoogleAppsScript.Spreadsheet.Sheet,
 *   rewriteSheet: GoogleAppsScript.Spreadsheet.Sheet
 * }}
 */
function initContentWorkbookSheets_(book) {
  const sheets = book.getSheets();
  const first = sheets.length ? sheets[0] : book.insertSheet('과정');
  if (first.getName() !== '과정') first.setName('과정');
  first.clear();

  const contentSheet = book.getSheetByName('콘텐츠') || book.insertSheet('콘텐츠');
  const reviewSheet = book.getSheetByName('검수') || book.insertSheet('검수');
  const rewriteSheet = book.getSheetByName('수정') || book.insertSheet('수정');

  contentSheet.clear();
  reviewSheet.clear();
  rewriteSheet.clear();

  ensureProcessSheetHeader_(first);
  return {
    processSheet: first,
    contentSheet: contentSheet,
    reviewSheet: reviewSheet,
    rewriteSheet: rewriteSheet,
  };
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function ensureProcessSheetHeader_(sheet) {
  const headers = ['Step', 'StartedAt', 'DurationMs', 'Status', 'InputSummary', 'Output'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 170);
  sheet.setColumnWidth(3, 110);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 420);
  sheet.setColumnWidth(6, 980);
  sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).setWrap(true);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {{step:string,startedAt:string,durationMs:number,status:string,inputSummary:string,output:string}} entry
 */
function appendProcessLog_(sheet, entry) {
  const row = [
    normalizeWhitespace_(entry && entry.step),
    normalizeWhitespace_(entry && entry.startedAt),
    Number(entry && entry.durationMs ? entry.durationMs : 0),
    normalizeWhitespace_(entry && entry.status),
    clampCellText_(entry && entry.inputSummary, 48000),
    clampCellText_(entry && entry.output, 48000),
  ];
  sheet.appendRow(row);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} title
 * @param {string} body
 */
function writeContentDraftSheet_(sheet, title, body) {
  sheet.clear();
  sheet.getRange(1, 1).setValue(String(title || '').trim());
  sheet.getRange(3, 1).setValue(String(body || '').trim());
  sheet.setColumnWidth(1, 980);
  sheet.getRange(1, 1, sheet.getMaxRows(), 1).setWrap(true);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} reviewText
 */
function writeReviewSheet_(sheet, reviewText) {
  sheet.clear();
  sheet.getRange(1, 1).setValue(String(reviewText || '').trim());
  sheet.setColumnWidth(1, 980);
  sheet.getRange(1, 1, sheet.getMaxRows(), 1).setWrap(true);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} title
 * @param {string} body
 */
function writeRewriteSheet_(sheet, title, body) {
  sheet.clear();
  sheet.getRange(1, 1).setValue(String(title || '').trim());
  sheet.getRange(3, 1).setValue(String(body || '').trim());
  sheet.setColumnWidth(1, 980);
  sheet.getRange(1, 1, sheet.getMaxRows(), 1).setWrap(true);
}

/**
 * @param {*} value
 * @param {number} maxLen
 * @returns {string}
 */
function toLogText_(value, maxLen) {
  if (value == null) return '';
  const n = Math.max(1, Number(maxLen || 48000));
  let text = '';
  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text = JSON.stringify(value, null, 2);
    } catch (_) {
      text = String(value);
    }
  }
  return clampCellText_(text, n);
}

/**
 * @param {*} value
 * @param {number} maxLen
 * @returns {string}
 */
function clampCellText_(value, maxLen) {
  const text = String(value == null ? '' : value);
  const n = Math.max(1, Number(maxLen || 48000));
  if (text.length <= n) return text;
  return text.substring(0, n - 3) + '...';
}

/**
 * @param {string} keyword
 * @param {string} selectedTitle
 * @param {string} timestamp
 * @returns {string}
 */
function buildContentFileTitle_(keyword, selectedTitle, timestamp) {
  const safeKeyword = sanitizeContentFileNamePart_(keyword) || 'keyword';
  const safeTitle = sanitizeContentFileNamePart_(selectedTitle) || 'title';
  const safeTimestamp = sanitizeContentFileNamePart_(timestamp) || Utilities.formatDate(new Date(), getParserTimezone_(), 'yyyyMMdd_HHmmss');
  return `${safeTimestamp}_${safeKeyword}_${safeTitle}`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function sanitizeContentFileNamePart_(value) {
  const trimmed = normalizeWhitespace_(value);
  if (!trimmed) return '';
  return trimmed
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
}
