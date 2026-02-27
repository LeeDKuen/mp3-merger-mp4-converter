/**
 * @typedef {Object} KeywordRow
 * @property {number} rowIndex
 * @property {string} keyword
 * @property {string} query
 */

/**
 * @typedef {Object} QueryResult
 * @property {(number|string)} pcVolume
 * @property {(number|string)} moVolume
 * @property {(number|string)} totalVolume
 * @property {string} smartblockFlag
 * @property {string} popularArticleTitles
 * @property {string} popularTopicTitles
 * @property {string} sectionIndexesRaw
 */

/**
 * @typedef {Object} SerpSection
 * @property {number} index
 * @property {string} blockId
 * @property {string} title
 * @property {string} segment
 */

const PARSER_CFG = {
  DEFAULT_SHEET_NAME: 'KEYWORDS',
  BLOG_ID_SHEET_NAME: 'BLOG_IDS',
  PRODUCT_SHEET_NAME: 'PRODUCTS',
  CONTENT_HISTORY_SHEET_NAME: 'CONTENT_HISTORY',
  HEADER_ROW: 1,
  MAX_RUNTIME_MS: 5 * 60 * 1000,
  RANK_COLLECT_MAX_RUNTIME_MS: 5 * 60 * 1000,
  POST_COLLECT_MAX_RUNTIME_MS: 5 * 60 * 1000,
  ANALYSIS_MAX_RUNTIME_MS: 5 * 60 * 1000,
  PRODUCE_MAX_RUNTIME_MS: 5 * 60 * 1000,
  MAX_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 1000,
  SEARCHAD_ENDPOINT: 'https://api.searchad.naver.com',
  SEARCHAD_URI: '/keywordstool',
  SEARCHAD_CHUNK_SIZE: 5,
  ANALYSIS_MAX_POSTS_PER_BLOCK: 3,
  MOBILE_SERP_ENDPOINT: 'https://m.search.naver.com/search.naver',
  MOBILE_USER_AGENT: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  DATETIME_FORMAT: 'yyyy-MM-dd HH:mm:ss',
  GEMINI_API_ENDPOINT: 'https://generativelanguage.googleapis.com/v1beta',
  GEMINI_DEFAULT_MODEL: 'gemini-3-flash-preview',
  GEMINI_MAX_OUTPUT_TOKENS: 8192,
};

const PARSER_PROP_KEYS = {
  NAVER_SEARCHAD_API_KEY: 'NAVER_SEARCHAD_API_KEY',
  NAVER_SEARCHAD_SECRET_KEY: 'NAVER_SEARCHAD_SECRET_KEY',
  NAVER_SEARCHAD_CUSTOMER_ID: 'NAVER_SEARCHAD_CUSTOMER_ID',
  PARSER_TARGET_SHEET_NAME: 'PARSER_TARGET_SHEET_NAME',
  PARSER_TIMEZONE: 'PARSER_TIMEZONE',
  PARSER_GEMINI_API_KEY: 'PARSER_GEMINI_API_KEY',
  PARSER_GEMINI_MODEL: 'PARSER_GEMINI_MODEL',
  PARSER_ANALYSIS_DRIVE_FOLDER_ID: 'PARSER_ANALYSIS_DRIVE_FOLDER_ID',
};

const COL = {
  KEYWORD: 1,
  PC: 2,
  MO: 3,
  TOTAL: 4,
  SMARTBLOCK_FLAG: 5,
  POPULAR_ARTICLE_TITLES: 6,
  POPULAR_TOPIC_TITLES: 7,
  SECTION_INDEXES: 8,
  RANK_COLLECT_QUEUE: 9,
  KEY_COLLECT_QUEUE: 10,
  POST_COLLECT_QUEUE: 11,
  POST_ANALYSIS_QUEUE: 12,
  PRODUCE_QUEUE: 13,
  RANK_RESULT: 14,
  KEYWORD_COLLECTED_AT: 15,
  RANK_COLLECTED_AT: 16,
  STATUS: 17,
  ERROR: 18,
  PRODUCE_PRODUCT: 19,
  PRODUCE_INTENT: 20,
  PRODUCE_TITLE: 21,
  PRODUCE_FILE_URL: 22,
  PRODUCE_AT: 23,
  PRODUCE_STATUS: 24,
  PRODUCE_ERROR: 25,
  // Legacy alias
  COLLECTED_AT: 15,
};

const SHEET_HEADERS = [
  '키워드',
  'PC검색량',
  'MO검색량',
  '합검색량',
  '스마트블록여부',
  '인기글명',
  '인기주제명들',
  '스마트블록섹션순번',
  '순위 수집',
  '키 수집',
  '글 수집',
  '글 분석',
  '제작',
  '순위결과',
  '키워드 수집날짜',
  '순위 수집날짜',
  '상태',
  '에러',
  '제작제품',
  '작성의도',
  '제작제목',
  '제작파일URL',
  '제작일시',
  '제작상태',
  '제작에러',
];

const BLOG_ID_HEADERS = [
  '활성',
  '블로그ID',
];

const PRODUCT_HEADERS = [
  '제품명',
  '타겟제품키워드',
  '제품카테고리',
  '핵심문제',
  '잘못된해결책',
  '근본원인',
  '핵심성분USP',
  '특화사용루틴',
  '제품지식요약',
  '컴플라이언스메모',
];

const CONTENT_HISTORY_HEADERS = [
  '생성시각',
  '키워드',
  '제품명',
  '선정제목',
  '초안해시',
  '수정본해시',
  '파일URL',
];

const RESULT_STATUS = {
  OK: 'OK',
  ERROR: 'ERROR',
};
