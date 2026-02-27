/**
 * @param {string} query
 * @returns {QueryResult}
 */
function fetchSerpQueryResult_(query) {
  const html = fetchMobileSerpHtml_(query);
  const sections = parseSerpSectionsFromHtml_(html);
  return summarizeSmartblocks_(sections);
}

/**
 * @param {string} query
 * @returns {string}
 */
function fetchMobileSerpHtml_(query) {
  const q = normalizeWhitespace_(query);
  if (!q) throw new Error('SERP query is empty.');

  const url = `${PARSER_CFG.MOBILE_SERP_ENDPOINT}?${buildQueryString_({ query: q })}`;
  return withRetry_(
    function () {
      const resp = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: {
          'User-Agent': PARSER_CFG.MOBILE_USER_AGENT,
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
          'Cache-Control': 'no-cache',
        },
        muteHttpExceptions: true,
        followRedirects: true,
      });

      const status = resp.getResponseCode();
      const text = resp.getContentText() || '';
      if (status >= 200 && status < 300 && text) return text;

      const retryable = status === 429 || status >= 500;
      throw createHttpError_('Mobile SERP fetch', status, text, retryable);
    },
    PARSER_CFG.MAX_ATTEMPTS,
    PARSER_CFG.RETRY_BASE_DELAY_MS
  );
}

/**
 * @param {string} html
 * @returns {SerpSection[]}
 */
function parseSerpSectionsFromHtml_(html) {
  const source = String(html || '');
  const marker = 'data-fender-root="true"';
  const sections = [];
  let cursor = 0;

  while (true) {
    const markerIdx = source.indexOf(marker, cursor);
    if (markerIdx === -1) break;

    const nextMarkerIdx = source.indexOf(marker, markerIdx + marker.length);
    const endIdx = nextMarkerIdx === -1 ? source.length : nextMarkerIdx;

    let startIdx = source.lastIndexOf('<div', markerIdx);
    if (startIdx === -1) startIdx = Math.max(0, markerIdx - 400);
    if (startIdx >= endIdx) startIdx = Math.max(0, markerIdx - 400);

    const segment = source.substring(startIdx, endIdx);
    const blockIdMatch = segment.match(/data-block-id="([^"]+)"/i);

    const blockId = blockIdMatch ? String(blockIdMatch[1] || '').trim() : '';
    const title = extractSectionTitle_(segment, blockId);

    sections.push({
      index: sections.length + 1,
      blockId,
      title,
      segment,
    });

    cursor = markerIdx + marker.length;
  }

  return sections;
}

/**
 * @param {SerpSection[]} sections
 * @returns {QueryResult}
 */
function summarizeSmartblocks_(sections) {
  const articleTitles = [];
  const articleIndexes = [];
  const topicTitles = [];
  const topicIndexes = [];

  for (let i = 0; i < sections.length; i += 1) {
    const sec = sections[i];
    const title = normalizeWhitespace_(sec.title);

    if (title && title.indexOf('인기글') !== -1) {
      articleTitles.push(title);
      articleIndexes.push(sec.index);
      continue;
    }

    if (isPopularTopicSection_(sec)) {
      topicTitles.push(title);
      topicIndexes.push(sec.index);
    }
  }

  const uniqueArticleTitles = uniqueStrings_(articleTitles);
  const uniqueTopicTitles = uniqueStrings_(topicTitles);

  const smartblockFlag = buildSmartblockFlag_(
    uniqueArticleTitles.length > 0,
    uniqueTopicTitles.length > 0
  );

  const sectionIndexParts = [];
  if (articleIndexes.length) {
    sectionIndexParts.push(`인기글:${formatSectionOrdinalList_(articleIndexes)}`);
  }
  if (topicIndexes.length) {
    sectionIndexParts.push(`인기주제:${formatSectionOrdinalList_(topicIndexes)}`);
  }

  return {
    pcVolume: '',
    moVolume: '',
    totalVolume: '',
    smartblockFlag,
    popularArticleTitles: uniqueArticleTitles.join('|'),
    popularTopicTitles: uniqueTopicTitles.join(','),
    sectionIndexesRaw: sectionIndexParts.join(';'),
  };
}

/**
 * @param {SerpSection} section
 * @returns {boolean}
 */
function isPopularTopicSection_(section) {
  const blockId = String(section.blockId || '');
  const title = normalizeWhitespace_(section.title);
  if (!title) return false;
  if (!isPopularTopicBlockId_(blockId)) return false;
  if (title.indexOf('인기글') !== -1) return false;
  if (title.indexOf('브랜드 콘텐츠') !== -1) return false;
  if (title.indexOf('관련 브랜드 콘텐츠') !== -1) return false;
  return true;
}

/**
 * @param {string} blockId
 * @returns {boolean}
 */
function isPopularTopicBlockId_(blockId) {
  const id = String(blockId || '');
  if (/^ugc\/prs_template_v2_ugc_/i.test(id)) return true;
  if (/^ugc\/prs_template_ugc_influencer_participation_/i.test(id)) return true;
  return false;
}

/**
 * @param {boolean} hasPopularArticle
 * @param {boolean} hasPopularTopic
 * @returns {string}
 */
function buildSmartblockFlag_(hasPopularArticle, hasPopularTopic) {
  if (hasPopularArticle && hasPopularTopic) return '인기글|인기주제';
  if (hasPopularArticle) return '인기글';
  if (hasPopularTopic) return '인기주제';
  return '없음';
}

/**
 * @param {number[]} indexes
 * @returns {string}
 */
function formatSectionOrdinalList_(indexes) {
  const seen = {};
  const out = [];
  const list = Array.isArray(indexes) ? indexes : [];
  for (let i = 0; i < list.length; i += 1) {
    const n = Number(list[i]);
    if (!isFinite(n)) continue;
    const key = String(n);
    if (seen[key]) continue;
    seen[key] = true;
    out.push(`${n}번째`);
  }
  return out.join(',');
}

/**
 * @param {string} segment
 * @param {string} blockId
 * @returns {string}
 */
function extractSectionTitle_(segment, blockId) {
  const html = String(segment || '');
  const id = String(blockId || '');
  if (!html) return '';

  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2Match) {
    const fromH2 = normalizeWhitespace_(decodeHtmlEntities_(stripHtmlTags_(h2Match[1] || '')));
    if (fromH2) return fromH2;
  }

  const headerSpanMatch = html.match(/sds-comps-header-left[\s\S]{0,300}<span[^>]*>([\s\S]*?)<\/span>/i);
  if (headerSpanMatch) {
    const fromSpan = normalizeWhitespace_(decodeHtmlEntities_(stripHtmlTags_(headerSpanMatch[1] || '')));
    if (fromSpan) return fromSpan;
  }

  const influencerTitleMatch = html.match(/([가-힣A-Za-z0-9\s]{1,60}인플루언서(?:\s*참여)?\s*콘텐츠)/i);
  if (influencerTitleMatch) {
    const fromInfluencer = normalizeWhitespace_(decodeHtmlEntities_(influencerTitleMatch[1] || ''));
    if (fromInfluencer) return fromInfluencer;
  }

  if (/^ugc\/prs_template_ugc_influencer_participation_/i.test(id)) {
    return '인플루언서 콘텐츠';
  }
  return '';
}
