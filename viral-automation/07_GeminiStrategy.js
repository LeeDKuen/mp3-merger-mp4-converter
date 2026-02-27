var GEMINI_DISABLE_REASON_ = '';

/**
 * @param {string} keyword
 * @param {QueryResult} smartSummary
 * @param {Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>} blocks
 * @returns {string}
 */
function generateTopExposureStrategy_(keyword, smartSummary, blocks) {
  const observedContext = buildObservedContextText_(keyword, smartSummary, blocks);

  const prompt = [
    '당신은 네이버 상위노출 실무 전문가입니다.',
    '목표: 키워드별 인기글/인기주제 블록에서 상위노출 로직을 분석해 제작 가능한 보고서를 작성합니다.',
    '문체: 실무 보고서 형태, 간결하고 구조적으로 작성합니다.',
    '',
    '[실측 데이터]',
    observedContext,
    '',
    '[지시사항]',
    '1) 검색 의도를 1~2개로 요약하세요.',
    '2) 인기글 블록의 상위노출 로직(콘텐츠 유형, 제목 패턴, 본문 구조, 태그 활용)을 분석하세요.',
    '3) 인기주제 블록의 상위노출 로직을 주제명별로 분석하세요.',
    '4) 실제 실행 전략을 블록별로 체크리스트 형태로 작성하세요.',
    '5) 추측과 사실을 구분해서 작성하세요. (표기: [분석근거], [결과근거], [가설])',
    '6) 카페/쇼핑/광고 전략은 제외하고 블로그 기준으로만 작성하세요.',
    '',
    '[출력 형식]',
    '## 1) 키워드 검색 의도 요약',
    '- ...',
    '## 2) 섹션별 상위노출 패턴',
    '- 인기글: ...',
    '- 인기주제(주제명별): ...',
    '## 3) 제작용 인사이트',
    '- 훅/제목 패턴: ...',
    '- 본문 전개 구조: ...',
    '- 신뢰요소/증거: ...',
    '- 태그/키워드 운용: ...',
    '## 4) 제작 체크리스트',
    '- ...',
    '## 5) 리스크/주의사항',
    '- ...',
  ].join('\n');

  return generateGeminiText_(prompt);
}

/**
 * @param {string} keyword
 * @param {{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}} block
 * @returns {string}
 */
function generateTopExposureStrategyForBlock_(keyword, block) {
  const observedLines = [
    `- 키워드: ${keyword}`,
    `- 블록유형: ${block.blockType}`,
    `- 주제명: ${block.blockTitle || '(제목없음)'}`,
    `- 섹션순번: ${block.blockIndex}번째`,
  ];

  const posts = Array.isArray(block.posts) ? block.posts : [];
  if (!posts.length) {
    observedLines.push('- 샘플 글 없음');
  } else {
    for (let i = 0; i < posts.length; i += 1) {
      const post = posts[i];
      observedLines.push(`- 샘플${i + 1} 제목: ${post.title || '-'}`);
      observedLines.push(`  URL: ${post.url || '-'}`);
      observedLines.push(`  태그: ${post.tags || '-'}`);
      observedLines.push(`  원고: ${post.body || '-'}`);
    }
  }

  const prompt = [
    '당신은 네이버 상위노출 실무 전문가입니다.',
    '목표: 특정 주제 블록 1개에 대해 블로그 상위노출 로직을 추론하고 제작용 보고서를 작성합니다.',
    '문체: 실무 보고서 형태, 간결하고 구조적으로 작성합니다.',
    '',
    '[해당 주제 실측 데이터]',
    observedLines.join('\n'),
    '',
    '[지시사항]',
    '1) 이 주제 블록의 검색 의도를 1개로 요약하세요.',
    '2) 상위 노출 글의 공통점(제목, 본문 구조, 태그, 신뢰요소)을 분석하세요.',
    '3) 실제 실행 체크리스트 5개를 제시하세요.',
    '4) 추측과 사실을 구분하세요. ([분석근거], [결과근거], [가설])',
    '',
    '[출력 형식]',
    '## 1) 주제 검색의도',
    '- ...',
    '## 2) 상위노출 로직',
    '- ...',
    '## 3) 제작 포인트',
    '- 제목/도입 훅: ...',
    '- 본문 구성: ...',
    '- 신뢰요소: ...',
    '- 태그/키워드: ...',
    '## 4) 실행 체크리스트',
    '- ...',
  ].join('\n');

  return generateGeminiText_(prompt);
}

/**
 * @param {string} keyword
 * @param {QueryResult} smartSummary
 * @param {Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>} blocks
 * @returns {string}
 */
function buildObservedContextText_(keyword, smartSummary, blocks) {
  const lines = [
    `- 키워드: ${keyword}`,
    `- 스마트블록 여부: ${smartSummary.smartblockFlag}`,
    `- 인기글명: ${smartSummary.popularArticleTitles || '-'}`,
    `- 인기주제명들: ${smartSummary.popularTopicTitles || '-'}`,
    `- 스마트블록 섹션순번: ${smartSummary.sectionIndexesRaw || '-'}`,
  ];

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    lines.push(``);
    lines.push(`[블록 ${i + 1}] ${block.blockType} | ${block.blockTitle || '(제목없음)'} | ${block.blockIndex}번째`);
    if (!block.posts.length) {
      lines.push('- 샘플 글 없음');
      continue;
    }

    for (let p = 0; p < block.posts.length; p += 1) {
      const post = block.posts[p];
      lines.push(`- 샘플${p + 1} 제목: ${post.title || '-'}`);
      lines.push(`  URL: ${post.url}`);
      lines.push(`  태그: ${post.tags || '-'}`);
      lines.push(`  원고: ${post.body || '-'}`);
    }
  }
  return lines.join('\n');
}

/**
 * @returns {string}
 */
function getGeminiApiKey_() {
  const direct = String(getParserProp_(PARSER_PROP_KEYS.PARSER_GEMINI_API_KEY, '') || '').trim();
  if (direct) return direct;

  const legacy = String(getParserProp_('GEMINI_API_KEY', '') || '').trim();
  if (legacy) return legacy;

  throw new Error(`Missing Script Property: ${PARSER_PROP_KEYS.PARSER_GEMINI_API_KEY} (or GEMINI_API_KEY)`);
}

/**
 * @returns {string}
 */
function getGeminiModel_() {
  const raw = String(getParserProp_(PARSER_PROP_KEYS.PARSER_GEMINI_MODEL, '') || '').trim();
  return raw || PARSER_CFG.GEMINI_DEFAULT_MODEL;
}

/**
 * @param {string} prompt
 * @returns {string}
 */
function generateGeminiText_(prompt) {
  if (GEMINI_DISABLE_REASON_) {
    throw new Error(`Gemini disabled for this run: ${GEMINI_DISABLE_REASON_}`);
  }

  const apiKey = getGeminiApiKey_();
  const model = getGeminiModel_();
  const url = `${PARSER_CFG.GEMINI_API_ENDPOINT}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const basePrompt = String(prompt || '');
  const first = extractGeminiResult_(callGeminiGenerate_(url, buildGeminiPayload_(basePrompt)));
  if (!first.text) throw new Error('Gemini response did not contain text.');

  let output = first.text;
  let finishReason = first.finishReason;

  // max token으로 잘린 경우 이어쓰기 호출을 추가로 수행
  const maxContinueTurns = 3;
  for (let turn = 0; turn < maxContinueTurns; turn += 1) {
    if (String(finishReason || '').toUpperCase() !== 'MAX_TOKENS') break;

    const tail = output.slice(-2500);
    const continuePrompt = [
      basePrompt,
      '',
      '[직전 응답 마지막 부분]',
      tail || '-',
      '',
      '위 응답의 마지막 문장 바로 다음부터 이어서 작성하세요.',
      '이미 쓴 내용은 반복하지 말고 이어쓰기만 출력하세요.',
    ].join('\n');

    const next = extractGeminiResult_(callGeminiGenerate_(url, buildGeminiPayload_(continuePrompt)));
    if (!next.text) break;
    output = `${output}\n${next.text}`.trim();
    finishReason = next.finishReason;
  }

  return output;
}

/**
 * @param {string} prompt
 * @returns {{contents:Array<Object<string,*>>, generationConfig:Object<string,*>}}
 */
function buildGeminiPayload_(prompt) {
  return {
    contents: [
      {
        role: 'user',
        parts: [{ text: String(prompt || '') }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: PARSER_CFG.GEMINI_MAX_OUTPUT_TOKENS,
    },
  };
}

/**
 * @param {string} url
 * @param {{contents:Array<Object<string,*>>, generationConfig:Object<string,*>}} payload
 * @returns {*}
 */
function callGeminiGenerate_(url, payload) {
  const bodyText = withRetry_(
    function () {
      const resp = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json; charset=UTF-8',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      const status = resp.getResponseCode();
      const text = resp.getContentText() || '';
      if (status >= 200 && status < 300) return text;

      const quotaExceeded = status === 429 && isGeminiQuotaExceededBody_(text);
      if (quotaExceeded) {
        GEMINI_DISABLE_REASON_ = 'quota exceeded (429)';
        throw createHttpError_('Gemini generateContent', status, text, false);
      }

      const retryable = status === 429 || status >= 500;
      throw createHttpError_('Gemini generateContent', status, text, retryable);
    },
    PARSER_CFG.MAX_ATTEMPTS,
    PARSER_CFG.RETRY_BASE_DELAY_MS
  );

  return JSON.parse(bodyText || '{}');
}

/**
 * @param {string} bodyText
 * @returns {boolean}
 */
function isGeminiQuotaExceededBody_(bodyText) {
  const text = String(bodyText || '');
  return /exceeded your current quota|check your plan and billing details/i.test(text);
}

/**
 * @param {*} response
 * @returns {{text:string, finishReason:string}}
 */
function extractGeminiResult_(response) {
  const candidates = response && Array.isArray(response.candidates) ? response.candidates : [];
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i] || {};
    const parts = c.content && Array.isArray(c.content.parts) ? c.content.parts : [];
    const texts = [];
    for (let p = 0; p < parts.length; p += 1) {
      const t = String(parts[p] && parts[p].text ? parts[p].text : '').trim();
      if (t) texts.push(t);
    }
    if (texts.length) {
      return {
        text: texts.join('\n\n').trim(),
        finishReason: String(c.finishReason || ''),
      };
    }
  }
  return {
    text: '',
    finishReason: '',
  };
}
