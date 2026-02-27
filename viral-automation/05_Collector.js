/**
 * @returns {{
 *   sheetName: string,
 *   totalRows: number,
 *   processedRows: number,
 *   okRows: number,
 *   errorRows: number,
 *   remainingRows: number,
 *   timedOut: boolean
 * }}
 */
function runKeywordParser_() {
  const sheet = initTargetSheetHeaders_();
  const rows = readKeywordRows_(sheet, COL.KEY_COLLECT_QUEUE);
  if (!rows.length) {
    throw new Error('수집 대상이 없습니다. J열(키 수집) 체크박스를 선택하세요.');
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
  };

  for (let i = 0; i < rows.length; i += 1) {
    if (Date.now() - startedAt > PARSER_CFG.MAX_RUNTIME_MS) {
      summary.timedOut = true;
      summary.remainingRows = rows.length - i;
      break;
    }

    const row = rows[i];
    const collectedAt = formatNowForSheet_();

    try {
      processKeywordRow_(sheet, row, collectedAt);
      summary.okRows += 1;
    } catch (err) {
      writeRowError_(sheet, row.rowIndex, collectedAt, safeErrorMessage_(err));
      summary.errorRows += 1;
    }

    summary.processedRows += 1;
  }

  return summary;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {KeywordRow} row
 * @param {string} collectedAt
 */
function processKeywordRow_(sheet, row, collectedAt) {
  const volumeMap = fetchSearchAdVolumesByQueries_([row.query]);
  const result = fetchSerpQueryResult_(row.query);
  const volume = pickSearchAdVolume_(volumeMap, row.query);

  result.pcVolume = volume.pcVolume;
  result.moVolume = volume.moVolume;
  result.totalVolume = volume.totalVolume;

  writeRowSuccess_(sheet, row.rowIndex, {
    result,
    collectedAt,
  });
}
