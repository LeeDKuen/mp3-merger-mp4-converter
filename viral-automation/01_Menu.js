function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('네이버 키워드 파서')
    .addItem('시트 초기화', 'menuInitSheet')
    .addItem('순위 수집 실행', 'menuRunBlogRankCollect')
    .addItem('키 수집 실행', 'menuRunKeywordParser')
    .addItem('글 수집 실행', 'menuRunTopPostCollection')
    .addItem('글 분석 실행', 'menuAnalyzeTopExposure')
    .addItem('제작 실행', 'menuRunContentProduction')
    .addSeparator()
    .addItem('설정 가이드', 'menuShowConfigGuide')
    .addToUi();
}

function menuInitSheet() {
  const sheet = initTargetSheetHeaders_();
  const blogIdSheet = initBlogIdSheetHeaders_();
  const productSheet = initProductSheetHeaders_();
  const historySheet = initContentHistorySheetHeaders_();
  SpreadsheetApp.getUi().alert(
    '초기화 완료',
    `시트 "${sheet.getName()}", "${blogIdSheet.getName()}", "${productSheet.getName()}", "${historySheet.getName()}" 헤더를 준비했습니다.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuShowConfigGuide() {
  const ui = SpreadsheetApp.getUi();
  const lines = [
    '[필수 Script Properties]',
    `- ${PARSER_PROP_KEYS.NAVER_SEARCHAD_API_KEY}`,
    `- ${PARSER_PROP_KEYS.NAVER_SEARCHAD_SECRET_KEY}`,
    `- ${PARSER_PROP_KEYS.NAVER_SEARCHAD_CUSTOMER_ID}`,
    `- ${PARSER_PROP_KEYS.PARSER_GEMINI_API_KEY} (또는 GEMINI_API_KEY)`,
    '',
    '[선택 Script Properties]',
    `- ${PARSER_PROP_KEYS.PARSER_TARGET_SHEET_NAME} (기본: ${PARSER_CFG.DEFAULT_SHEET_NAME})`,
    `- ${PARSER_PROP_KEYS.PARSER_TIMEZONE} (기본: Asia/Seoul)`,
    `- ${PARSER_PROP_KEYS.PARSER_GEMINI_MODEL} (기본: ${PARSER_CFG.GEMINI_DEFAULT_MODEL})`,
    `- ${PARSER_PROP_KEYS.PARSER_ANALYSIS_DRIVE_FOLDER_ID} (분석 시트파일 저장 폴더 ID, 미입력 시 내 드라이브 루트)`,
    '',
    '[큐 사용법]',
    '- I열(순위 수집) 체크 시 순위 수집 실행 대상',
    '- J열(키 수집) 체크 시 키 수집 실행 대상',
    '- K열(글 수집) 체크 시 글 수집 실행 대상 (AI 미사용)',
    '- L열(글 분석) 체크 시 글 분석 실행 대상 (수집 + AI 분석)',
    '- M열(제작) 체크 시 제목→기획→원고→검수→수정 자동 실행 대상',
    '- 제작 실행은 인기주제 블록별로 파일을 생성합니다. (인플루언서/카페/브랜드 콘텐츠 제외)',
    '- 처리 후 순위 수집/키 수집/글 수집/글 분석/제작 체크는 자동 해제됩니다.',
    '',
    '[BLOG_IDS 시트 사용법]',
    '- A열(활성)을 체크하고 B열에 블로그ID를 입력하세요.',
    '- 순위 수집 실행 시 활성 블로그ID만 검색합니다.',
    '',
    '[PRODUCTS 시트 사용법]',
    '- A열 제품명을 기준으로 KEYWORDS S열(제작제품) 드롭다운을 선택합니다.',
    '- T열(작성의도)도 함께 입력해야 제작 실행이 가능합니다.',
    '- 제작 결과는 U~Y열(제작제목/파일URL/일시/상태/에러)에 기록됩니다.',
  ];
  ui.alert('설정 가이드', lines.join('\n'), ui.ButtonSet.OK);
}

function menuRunBlogRankCollect() {
  const ui = SpreadsheetApp.getUi();
  try {
    const summary = runBlogRankCollect_();
    const lines = [
      `대상 시트: ${summary.sheetName}`,
      `활성 블로그ID 수: ${summary.activeBlogIdCount}`,
      `순위 수집 큐 대상 행: ${summary.totalRows}`,
      `처리 완료: ${summary.processedRows}`,
      `성공: ${summary.okRows}`,
      `실패: ${summary.errorRows}`,
    ];
    if (summary.timedOut) {
      lines.push(`시간 제한으로 중단됨: 남은 ${summary.remainingRows}행`);
    }
    ui.alert('순위 수집 완료', lines.join('\n'), ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('순위 수집 실패', safeErrorMessage_(err), ui.ButtonSet.OK);
    throw err;
  }
}

function menuRunKeywordParser() {
  const ui = SpreadsheetApp.getUi();
  try {
    const summary = runKeywordParser_();
    const lines = [
      `대상 시트: ${summary.sheetName}`,
      `키 수집 큐 대상 행: ${summary.totalRows}`,
      `처리 완료: ${summary.processedRows}`,
      `성공: ${summary.okRows}`,
      `실패: ${summary.errorRows}`,
    ];
    if (summary.timedOut) {
      lines.push(`시간 제한으로 중단됨: 남은 ${summary.remainingRows}행`);
    }
    ui.alert('키 수집 완료', lines.join('\n'), ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('키 수집 실패', safeErrorMessage_(err), ui.ButtonSet.OK);
    throw err;
  }
}

function menuRunTopPostCollection() {
  const ui = SpreadsheetApp.getUi();
  try {
    const summary = runTopPostCollection_();
    const lines = [
      `대상 시트: ${summary.sheetName}`,
      `글 수집 큐 대상 행: ${summary.totalRows}`,
      `처리 완료: ${summary.processedRows}`,
      `성공: ${summary.okRows}`,
      `실패: ${summary.errorRows}`,
      `생성 파일 수: ${summary.fileCount}`,
      `첫 파일 URL: ${summary.fileUrl || '-'}`,
      `저장 위치: ${summary.saveLocationLabel}`,
      `저장 위치 URL: ${summary.saveLocationUrl}`,
      `저장 폴더 ID: ${summary.saveLocationId || '(루트)'}`,
    ];
    if (summary.timedOut) {
      lines.push(`시간 제한으로 중단됨: 남은 ${summary.remainingRows}행`);
    }
    ui.alert('글 수집 완료', lines.join('\n'), ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('글 수집 실패', safeErrorMessage_(err), ui.ButtonSet.OK);
    throw err;
  }
}

function menuAnalyzeTopExposure() {
  const ui = SpreadsheetApp.getUi();
  try {
    const summary = runTopExposureAnalysis_();
    const lines = [
      `대상 시트: ${summary.sheetName}`,
      `글 분석 큐 대상 행: ${summary.totalRows}`,
      `분석 완료: ${summary.processedRows}`,
      `성공: ${summary.okRows}`,
      `실패: ${summary.errorRows}`,
      `생성 파일 수: ${summary.fileCount}`,
      `첫 파일 URL: ${summary.fileUrl || '-'}`,
      `저장 위치: ${summary.saveLocationLabel}`,
      `저장 위치 URL: ${summary.saveLocationUrl}`,
      `저장 폴더 ID: ${summary.saveLocationId || '(루트)'}`,
    ];
    if (summary.timedOut) {
      lines.push(`시간 제한으로 중단됨: 남은 ${summary.remainingRows}행`);
    }
    ui.alert('글 분석 완료', lines.join('\n'), ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('글 분석 실패', safeErrorMessage_(err), ui.ButtonSet.OK);
    throw err;
  }
}

function menuRunContentProduction() {
  const ui = SpreadsheetApp.getUi();
  try {
    const summary = runContentProduction_();
    const lines = [
      `대상 시트: ${summary.sheetName}`,
      `제작 큐 대상 행: ${summary.totalRows}`,
      `처리 완료: ${summary.processedRows}`,
      `성공: ${summary.okRows}`,
      `실패: ${summary.errorRows}`,
      `생성 파일 수: ${summary.fileCount}`,
      `첫 파일 URL: ${summary.fileUrl || '-'}`,
    ];
    if (summary.timedOut) {
      lines.push(`시간 제한으로 중단됨: 남은 ${summary.remainingRows}행`);
    }
    ui.alert('제작 실행 완료', lines.join('\n'), ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('제작 실행 실패', safeErrorMessage_(err), ui.ButtonSet.OK);
    throw err;
  }
}
