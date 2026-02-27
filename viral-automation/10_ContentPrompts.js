/**
 * @param {{
 *   keyword:string,
 *   intent:string,
 *   topicTitle:string,
 *   topicNo:number,
 *   topicCount:number,
 *   productProfile:Object<string,string>,
 *   rankResult:string,
 *   smartSummary:QueryResult,
 *   blocks:Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>,
 *   recentHistory:Array<{createdAt:string,title:string}>
 * }} ctx
 * @returns {string}
 */
function buildTitleGenerationPrompt_(ctx) {
  const contextText = buildProductionContextText_(ctx);
  return [
    '당신은 블로그 마케팅 전략가이자 심리 마케팅 전문가입니다.',
    '목표: 클릭 유도형 제목 후보를 20개 생성합니다.',
    '규칙:',
    '- 제목은 최대 46자 미만',
    '- 법적 위험 표현(100% 보장/완치/치료 확정) 금지',
    '- 추상어 남발 금지, 구체성 우선',
    '- 전문가/대표 시점 + 소비자/찐후기 시점을 적절히 섞되 중복 흐름 금지',
    '- 같은 패턴 반복 금지, 20개 모두 다른 심리 자극 사용',
    '- 메인 키워드는 가능한 자연스럽게 포함',
    '',
    '[분석 컨텍스트]',
    contextText,
    '',
    '[출력 형식]',
    '반드시 JSON만 출력:',
    '{"titles":["제목1", "...", "제목20"]}',
  ].join('\n');
}

/**
 * @param {{keyword:string,productProfile:Object<string,string>,intent:string,recentHistory:Array<{createdAt:string,title:string}>}} ctx
 * @param {string[]} titles
 * @returns {string}
 */
function buildTitleScoringPrompt_(ctx, titles) {
  const lines = [];
  const candidates = Array.isArray(titles) ? titles : [];
  for (let i = 0; i < candidates.length; i += 1) {
    lines.push(`${i + 1}. ${candidates[i]}`);
  }

  const recent = (ctx && Array.isArray(ctx.recentHistory) ? ctx.recentHistory : [])
    .map(function (x) { return `- ${x.createdAt || '-'} | ${x.title || '-'}`; })
    .join('\n');

  return [
    '당신은 네이버 상위노출과 CTR 최적화 심사관입니다.',
    '주어진 제목 후보를 채점하고 최종 1개를 선정하세요.',
    '평가 기준(100점):',
    '- 검색의도 적합성 25',
    '- 상위노출/인기주제 구조 적합성 25',
    '- 클릭유도력 20',
    '- 안전성(법/과장 표현 위험 최소) 15',
    '- 최근 이력 대비 신선도 15',
    '',
    `[키워드] ${ctx && ctx.keyword ? ctx.keyword : ''}`,
    `[제품] ${ctx && ctx.productProfile && ctx.productProfile.productName ? ctx.productProfile.productName : ''}`,
    `[작성의도] ${ctx && ctx.intent ? ctx.intent : ''}`,
    '',
    '[최근 생성 제목 이력]',
    recent || '- 없음',
    '',
    '[제목 후보]',
    lines.join('\n'),
    '',
    '[출력 형식]',
    '반드시 JSON만 출력:',
    '{"bestTitle":"...","selectionReason":"...","scores":[{"title":"...","score":88,"reason":"..."}]}',
  ].join('\n');
}

/**
 * @param {{
 *   keyword:string,
 *   intent:string,
 *   productProfile:Object<string,string>,
 *   rankResult:string,
 *   smartSummary:QueryResult,
 *   blocks:Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>,
 *   recentHistory:Array<{createdAt:string,title:string}>
 * }} ctx
 * @param {string} selectedTitle
 * @returns {string}
 */
function buildPlanningPrompt_(ctx, selectedTitle) {
  const contextText = buildProductionContextText_(ctx);
  return [
    'Role: 네이버 블로그 고전환 카피라이팅 전문가',
    '목표: 선택된 제목을 바탕으로 전환율 높은 기획안 3세트를 만들고, 최종 1세트를 자동 선택합니다.',
    '요구사항:',
    '- 설득 패턴(A~M) 중 맥락에 맞는 패턴을 세트별로 선택',
    '- 세트마다 6~7개 섹션 개요',
    '- 단순 나열 금지, 기승전결 흐름 필수',
    '- 동일한 관점 반복 금지',
    '',
    `[선정 제목] ${selectedTitle || ''}`,
    '',
    '[분석 컨텍스트]',
    contextText,
    '',
    '[출력 형식]',
    '반드시 JSON만 출력:',
    '{"selectedPlanIndex":1,"selectionReason":"...","plans":[{"pattern":"A","planName":"...","outline":["섹션1","섹션2"],"why":"..."}]}',
  ].join('\n');
}

/**
 * @param {{
 *   keyword:string,
 *   intent:string,
 *   productProfile:Object<string,string>,
 *   rankResult:string,
 *   smartSummary:QueryResult,
 *   blocks:Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>
 * }} ctx
 * @param {string} selectedTitle
 * @param {{pattern:string,planName:string,outline:string[],why:string}} selectedPlan
 * @returns {string}
 */
function buildDraftPart1Prompt_(ctx, selectedTitle, selectedPlan) {
  const outlineText = (selectedPlan && Array.isArray(selectedPlan.outline) ? selectedPlan.outline : [])
    .map(function (x, i) { return `${i + 1}. ${x}`; })
    .join('\n');

  return [
    '역할: 찐 소비자 톤의 블로그 작가',
    '목표: 아래 개요로 원고 PART 1만 작성합니다.',
    '규칙:',
    '- 이모지(😀🔥 등) 금지',
    '- 텍스트 이모티콘(ㅠㅠ, ㅋㅋ)은 자연스럽게 허용',
    '- 문단 2~3줄 단위, 모바일 가독성 유지',
    '- 제품은 갑자기 등장시키지 말고 탐색 서사(The Hunt)를 반드시 포함',
    '- 고유 사용루틴이 있다면 행동 장면으로 묘사',
    '- 사진 가이드 파트는 이번 작성에서 제외',
    '- 마지막 한 줄은 PART 2로 이어지는 행동 직전 문장으로 마무리',
    '',
    `[제목] ${selectedTitle || ''}`,
    `[메인키워드] ${ctx && ctx.keyword ? ctx.keyword : ''}`,
    `[작성의도] ${ctx && ctx.intent ? ctx.intent : ''}`,
    `[제품명] ${ctx && ctx.productProfile ? ctx.productProfile.productName : ''}`,
    `[제품카테고리] ${ctx && ctx.productProfile ? ctx.productProfile.category : ''}`,
    `[핵심문제] ${ctx && ctx.productProfile ? ctx.productProfile.pain : ''}`,
    `[잘못된해결책] ${ctx && ctx.productProfile ? ctx.productProfile.wrongSolution : ''}`,
    `[근본원인] ${ctx && ctx.productProfile ? ctx.productProfile.enemy : ''}`,
    `[핵심USP] ${ctx && ctx.productProfile ? ctx.productProfile.usp : ''}`,
    `[특화루틴] ${ctx && ctx.productProfile ? ctx.productProfile.routine : ''}`,
    '',
    '[기획 개요]',
    outlineText || '-',
    '',
    '[출력]',
    'PART 1 원고 본문만 출력',
  ].join('\n');
}

/**
 * @param {{
 *   keyword:string,
 *   intent:string,
 *   productProfile:Object<string,string>
 * }} ctx
 * @param {string} selectedTitle
 * @param {{pattern:string,planName:string,outline:string[],why:string}} selectedPlan
 * @param {string} part1
 * @returns {string}
 */
function buildDraftPart2Prompt_(ctx, selectedTitle, selectedPlan, part1) {
  const outlineText = (selectedPlan && Array.isArray(selectedPlan.outline) ? selectedPlan.outline : [])
    .map(function (x, i) { return `${i + 1}. ${x}`; })
    .join('\n');

  const part1Tail = String(part1 || '').slice(-1800);
  return [
    '역할: 찐 소비자 톤의 블로그 작가',
    '목표: PART 1 다음 내용을 이어서 PART 2를 작성합니다.',
    '규칙:',
    '- 앞 문장 반복 금지, 자연스럽게 이어쓰기',
    '- 해결/변화/주변반응/최종 제안까지 완결',
    '- 과장/위법 표현 금지',
    '- 사진 가이드 파트 제외',
    '',
    `[제목] ${selectedTitle || ''}`,
    `[메인키워드] ${ctx && ctx.keyword ? ctx.keyword : ''}`,
    `[작성의도] ${ctx && ctx.intent ? ctx.intent : ''}`,
    `[제품명] ${ctx && ctx.productProfile ? ctx.productProfile.productName : ''}`,
    `[핵심USP] ${ctx && ctx.productProfile ? ctx.productProfile.usp : ''}`,
    `[특화루틴] ${ctx && ctx.productProfile ? ctx.productProfile.routine : ''}`,
    '',
    '[기획 개요]',
    outlineText || '-',
    '',
    '[PART 1 마지막 부분]',
    part1Tail || '-',
    '',
    '[출력]',
    'PART 2 원고 본문만 출력',
  ].join('\n');
}

/**
 * @param {{
 *   keyword:string,
 *   productProfile:Object<string,string>,
 *   intent:string,
 *   smartSummary:QueryResult,
 *   rankResult:string
 * }} ctx
 * @param {string} selectedTitle
 * @param {string} draftBody
 * @returns {string}
 */
function buildReviewPrompt_(ctx, selectedTitle, draftBody) {
  return [
    'Role: 네이버 SEO 알고리즘 분석가 + 바이럴 편집장',
    '아래 원고를 냉철하게 검수하세요.',
    '',
    `[검색 키워드] ${ctx && ctx.keyword ? ctx.keyword : ''}`,
    `[타겟 제품명] ${ctx && ctx.productProfile ? ctx.productProfile.targetKeyword || ctx.productProfile.productName : ''}`,
    `[제목] ${selectedTitle || ''}`,
    `[작성의도] ${ctx && ctx.intent ? ctx.intent : ''}`,
    `[순위수집결과] ${ctx && ctx.rankResult ? ctx.rankResult : '-'}`,
    `[스마트블록] ${ctx && ctx.smartSummary ? ctx.smartSummary.smartblockFlag : '-'}`,
    '',
    '[원고]',
    draftBody || '',
    '',
    '[요구 출력 섹션]',
    '## 0. 글 유형 진단',
    '## 1. SEO & 알고리즘 정밀 진단',
    '## 2. [AI 티 내기] 문장 교정 리포트',
    '## 3. 바이럴 각인 & 흐름 진단',
    '## 4. [위험 요소] vs [안전한 대안] 수정표',
    '## 5. 디테일 & 체크리스트',
  ].join('\n');
}

/**
 * @param {{
 *   keyword:string,
 *   productProfile:Object<string,string>,
 *   intent:string
 * }} ctx
 * @param {string} selectedTitle
 * @param {string} draftBody
 * @param {string} reviewText
 * @returns {string}
 */
function buildRewritePrompt_(ctx, selectedTitle, draftBody, reviewText) {
  return [
    '역할: 바이럴 에디터',
    '목표: 검수 리포트를 반영해 원고를 고칩니다.',
    '규칙:',
    '- 제목은 유지',
    '- 법적/과장 리스크 문장 우선 수정',
    '- AI 티 나는 번역투/작위문장 제거',
    '- 후기형이면 사람 말투, 전문가형이면 단호한 논리 톤으로 맞춤',
    '- 본문 길이는 원고 대비 ±20% 이내',
    '',
    `[제목] ${selectedTitle || ''}`,
    `[키워드] ${ctx && ctx.keyword ? ctx.keyword : ''}`,
    `[제품] ${ctx && ctx.productProfile ? ctx.productProfile.productName : ''}`,
    `[작성의도] ${ctx && ctx.intent ? ctx.intent : ''}`,
    '',
    '[원고]',
    draftBody || '',
    '',
    '[검수 리포트]',
    reviewText || '',
    '',
    '[출력]',
    '수정된 본문만 출력',
  ].join('\n');
}

/**
 * @param {{
 *   keyword:string,
 *   intent:string,
 *   productProfile:Object<string,string>,
 *   rankResult:string,
 *   smartSummary:QueryResult,
 *   blocks:Array<{blockType:string, blockTitle:string, blockIndex:number, posts:Array<{url:string,title:string,body:string,tags:string}>}>,
 *   recentHistory:Array<{createdAt:string,title:string}>
 * }} ctx
 * @returns {string}
 */
function buildProductionContextText_(ctx) {
  const blocks = ctx && Array.isArray(ctx.blocks) ? ctx.blocks : [];
  const blockLines = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    const postTitles = (Array.isArray(b.posts) ? b.posts : [])
      .map(function (p) { return normalizeWhitespace_(p.title || '-'); })
      .filter(Boolean)
      .slice(0, 3)
      .join(' | ');
    blockLines.push(
      `- ${b.blockType} | ${b.blockTitle || '-'} | ${b.blockIndex}번째 | 샘플제목: ${postTitles || '-'}`
    );
  }

  const recentLines = (ctx && Array.isArray(ctx.recentHistory) ? ctx.recentHistory : [])
    .map(function (x) { return `- ${x.createdAt || '-'} | ${x.title || '-'}`; })
    .join('\n');

  return [
    `키워드: ${ctx && ctx.keyword ? ctx.keyword : ''}`,
    `작성의도: ${ctx && ctx.intent ? ctx.intent : ''}`,
    `타겟주제: ${ctx && ctx.topicTitle ? ctx.topicTitle : '-'}`,
    `주제진행순번: ${ctx && ctx.topicNo ? ctx.topicNo : '-'} / ${ctx && ctx.topicCount ? ctx.topicCount : '-'}`,
    `제품명: ${ctx && ctx.productProfile ? ctx.productProfile.productName : ''}`,
    `제품카테고리: ${ctx && ctx.productProfile ? ctx.productProfile.category : ''}`,
    `핵심문제: ${ctx && ctx.productProfile ? ctx.productProfile.pain : ''}`,
    `잘못된해결책: ${ctx && ctx.productProfile ? ctx.productProfile.wrongSolution : ''}`,
    `근본원인: ${ctx && ctx.productProfile ? ctx.productProfile.enemy : ''}`,
    `핵심USP: ${ctx && ctx.productProfile ? ctx.productProfile.usp : ''}`,
    `특화루틴: ${ctx && ctx.productProfile ? ctx.productProfile.routine : ''}`,
    `순위수집결과: ${ctx && ctx.rankResult ? ctx.rankResult : '-'}`,
    `스마트블록: ${ctx && ctx.smartSummary ? ctx.smartSummary.smartblockFlag : '-'}`,
    `인기글명: ${ctx && ctx.smartSummary ? ctx.smartSummary.popularArticleTitles : '-'}`,
    `인기주제명들: ${ctx && ctx.smartSummary ? ctx.smartSummary.popularTopicTitles : '-'}`,
    `섹션순번: ${ctx && ctx.smartSummary ? ctx.smartSummary.sectionIndexesRaw : '-'}`,
    '[블록 샘플]',
    blockLines.join('\n') || '- 없음',
    '[최근 이력]',
    recentLines || '- 없음',
  ].join('\n');
}

/**
 * @param {string} raw
 * @param {string} keyword
 * @param {number=} expectedCount
 * @returns {string[]}
 */
function normalizeGeneratedTitles_(raw, keyword, expectedCount) {
  const expected = Math.max(1, Number(expectedCount || 20));
  const parsed = parseJsonObjectFromText_(raw);
  let titles = [];

  if (parsed && Array.isArray(parsed.titles)) {
    titles = parsed.titles;
  } else {
    titles = extractCandidateLinesFromText_(raw);
  }

  const normalized = [];
  const seen = {};
  for (let i = 0; i < titles.length; i += 1) {
    let t = normalizeWhitespace_(titles[i]);
    if (!t) continue;
    if (t.length > 46) t = t.substring(0, 45).trim();
    const key = t.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    normalized.push(t);
    if (normalized.length >= expected) break;
  }

  for (let i = normalized.length; i < expected; i += 1) {
    normalized.push(`${keyword} 핵심 포인트 ${i + 1}`);
  }
  return normalized.slice(0, expected);
}

/**
 * @param {string} raw
 * @param {string[]} candidates
 * @returns {{bestTitle:string,selectionReason:string,scores:Array<{title:string,score:number,reason:string}>}}
 */
function normalizeTitleScoreResult_(raw, candidates) {
  const parsed = parseJsonObjectFromText_(raw) || {};
  const list = Array.isArray(candidates) ? candidates : [];
  const scores = [];

  if (Array.isArray(parsed.scores)) {
    for (let i = 0; i < parsed.scores.length; i += 1) {
      const it = parsed.scores[i] || {};
      const title = pickClosestCandidateTitle_(it.title, list);
      if (!title) continue;
      scores.push({
        title: title,
        score: Math.max(0, Math.min(100, Number(it.score || 0))),
        reason: normalizeWhitespace_(it.reason || ''),
      });
    }
  }

  if (!scores.length) {
    for (let i = 0; i < list.length; i += 1) {
      scores.push({
        title: list[i],
        score: Math.max(0, 80 - i),
        reason: '파싱 실패 fallback 점수',
      });
    }
  }

  scores.sort(function (a, b) { return b.score - a.score; });
  const bestByModel = pickClosestCandidateTitle_(parsed.bestTitle, list);
  const bestTitle = bestByModel || (scores.length ? scores[0].title : (list[0] || ''));

  return {
    bestTitle: bestTitle,
    selectionReason: normalizeWhitespace_(parsed.selectionReason || '') || '최고 점수 제목 자동 선택',
    scores: scores,
  };
}

/**
 * @param {string} raw
 * @param {string} selectedTitle
 * @returns {{selectedPlanIndex:number,selectionReason:string,plans:Array<{pattern:string,planName:string,outline:string[],why:string}>}}
 */
function normalizePlanResult_(raw, selectedTitle) {
  const parsed = parseJsonObjectFromText_(raw) || {};
  let plans = [];

  if (Array.isArray(parsed.plans)) {
    for (let i = 0; i < parsed.plans.length; i += 1) {
      const p = parsed.plans[i] || {};
      const outlineRaw = Array.isArray(p.outline) ? p.outline : extractCandidateLinesFromText_(String(p.outline || ''));
      const outline = [];
      for (let j = 0; j < outlineRaw.length; j += 1) {
        const item = normalizeWhitespace_(outlineRaw[j]);
        if (!item) continue;
        outline.push(item);
      }

      plans.push({
        pattern: normalizeWhitespace_(p.pattern || ''),
        planName: normalizeWhitespace_(p.planName || `기획안 ${i + 1}`),
        outline: outline.slice(0, 7),
        why: normalizeWhitespace_(p.why || ''),
      });
    }
  }

  if (plans.length < 3) {
    plans = buildFallbackPlans_(selectedTitle);
  }

  let selectedPlanIndex = Number(parsed.selectedPlanIndex);
  if (!isFinite(selectedPlanIndex)) selectedPlanIndex = 1;
  selectedPlanIndex = Math.max(1, Math.min(plans.length, selectedPlanIndex));

  return {
    selectedPlanIndex: selectedPlanIndex,
    selectionReason: normalizeWhitespace_(parsed.selectionReason || '') || 'SERP 적합도 기준 자동 선택',
    plans: plans,
  };
}

/**
 * @param {string} selectedTitle
 * @returns {Array<{pattern:string,planName:string,outline:string[],why:string}>}
 */
function buildFallbackPlans_(selectedTitle) {
  return [
    {
      pattern: 'D',
      planName: '비교 분석형',
      outline: [
        `문제 제기: ${selectedTitle}`,
        '검색자 상황 공감',
        '기존 해결법 한계',
        '비교 기준 3가지',
        '제품/해결책 선택 이유',
        '실행 루틴 정리',
        '결론 및 행동 제안',
      ],
      why: '합리적 비교 니즈 대응',
    },
    {
      pattern: 'A',
      planName: '경고형',
      outline: [
        `후킹: ${selectedTitle}`,
        '하지 말아야 할 행동',
        '문제 악화 메커니즘',
        '근본 원인 설명',
        '해결책 발견 과정',
        '사용 루틴 및 변화',
        '안전한 실행 체크리스트',
      ],
      why: '손실회피 심리 대응',
    },
    {
      pattern: 'I',
      planName: '의심 해제형',
      outline: [
        `후킹: ${selectedTitle}`,
        '광고 피로 공감',
        '직접 검증 과정',
        '의외의 발견 포인트',
        '루틴 적용 장면',
        '변화 체감 결과',
        '추천/비추천 기준',
      ],
      why: '냉소형 독자 장벽 해제',
    },
  ];
}

/**
 * @param {string} rawTitle
 * @param {string[]} candidates
 * @returns {string}
 */
function pickClosestCandidateTitle_(rawTitle, candidates) {
  const src = normalizeWhitespace_(rawTitle);
  const list = Array.isArray(candidates) ? candidates : [];
  if (!src) return list.length ? list[0] : '';

  const srcLower = src.toLowerCase();
  for (let i = 0; i < list.length; i += 1) {
    if (normalizeWhitespace_(list[i]).toLowerCase() === srcLower) return list[i];
  }
  for (let i = 0; i < list.length; i += 1) {
    const c = normalizeWhitespace_(list[i]).toLowerCase();
    if (!c) continue;
    if (c.indexOf(srcLower) !== -1 || srcLower.indexOf(c) !== -1) return list[i];
  }
  return list.length ? list[0] : '';
}

/**
 * @param {string} text
 * @returns {Object<string,*>|null}
 */
function parseJsonObjectFromText_(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {}

  const codeBlock = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  if (codeBlock && codeBlock[1]) {
    try {
      return JSON.parse(codeBlock[1].trim());
    } catch (_) {}
  }

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = raw.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (_) {}
  }
  return null;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractCandidateLinesFromText_(text) {
  const raw = String(text || '');
  const lines = raw.split(/\r?\n/);
  const out = [];
  const seen = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = normalizeWhitespace_(lines[i]);
    if (!line) continue;
    if (/^[\[\]{}]/.test(line)) continue;
    if (/^(A|B)\.\s*/i.test(line)) continue;
    if (/^[-*]\s*$/.test(line)) continue;
    if (/^(title|titles|output|출력|json)\s*[:：]/i.test(line)) continue;

    const cleaned = line
      .replace(/^\d+\s*[\.\)]\s*/, '')
      .replace(/^[-*]\s*/, '')
      .trim();
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(cleaned);
  }
  return out;
}
