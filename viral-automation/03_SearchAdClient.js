/**
 * @param {string[]} queries
 * @returns {Object<string, {pcVolume:(number|string), moVolume:(number|string), totalVolume:(number|string)}>}
 */
function fetchSearchAdVolumesByQueries_(queries) {
  const uniqueQueries = uniqueStrings_(queries.map(normalizeWhitespace_).filter(Boolean));
  if (!uniqueQueries.length) return {};

  const output = {};
  const chunks = chunkArray_(uniqueQueries, PARSER_CFG.SEARCHAD_CHUNK_SIZE);
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    try {
      const chunkMap = fetchSearchAdChunk_(chunk);
      mergeSearchAdMap_(output, chunkMap);
      continue;
    } catch (err) {
      if (!isSearchAdHintKeywordsInvalidError_(err)) throw err;
    }

    // chunk 내 일부 키워드가 SearchAd 형식 검증(11001)에 걸릴 때 개별 fallback 처리.
    for (let c = 0; c < chunk.length; c += 1) {
      const originalQuery = chunk[c];
      const candidates = buildSearchAdKeywordCandidates_(originalQuery);
      let resolved = null;

      for (let ci = 0; ci < candidates.length; ci += 1) {
        const candidate = candidates[ci];
        try {
          const oneMap = fetchSearchAdChunk_([candidate]);
          resolved = pickSearchAdVolume_(oneMap, candidate);
          if (hasSearchAdVolumeValue_(resolved)) break;
        } catch (oneErr) {
          if (!isSearchAdHintKeywordsInvalidError_(oneErr)) throw oneErr;
        }
      }

      output[originalQuery] = resolved || {
        pcVolume: '',
        moVolume: '',
        totalVolume: '',
      };

      const compact = removeAllSpaces_(originalQuery);
      if (compact && !output[compact]) {
        output[compact] = output[originalQuery];
      }
    }
  }
  return output;
}

/**
 * @param {Object<string, {pcVolume:(number|string), moVolume:(number|string), totalVolume:(number|string)}>} volumeMap
 * @param {string} query
 * @returns {{pcVolume:(number|string), moVolume:(number|string), totalVolume:(number|string)}}
 */
function pickSearchAdVolume_(volumeMap, query) {
  const q = normalizeWhitespace_(query);
  if (!q) return { pcVolume: '', moVolume: '', totalVolume: '' };
  if (volumeMap[q]) return volumeMap[q];

  const compact = removeAllSpaces_(q);
  if (compact && volumeMap[compact]) return volumeMap[compact];

  return { pcVolume: '', moVolume: '', totalVolume: '' };
}

/**
 * @param {string[]} hintKeywords
 * @returns {Object<string, {pcVolume:(number|string), moVolume:(number|string), totalVolume:(number|string)}>}
 */
function fetchSearchAdChunk_(hintKeywords) {
  const cleanKeywords = uniqueStrings_(hintKeywords.map(normalizeWhitespace_).filter(Boolean));
  if (!cleanKeywords.length) return {};

  const apiKey = mustGetParserProp_(PARSER_PROP_KEYS.NAVER_SEARCHAD_API_KEY);
  const secretKey = mustGetParserProp_(PARSER_PROP_KEYS.NAVER_SEARCHAD_SECRET_KEY);
  const customerId = mustGetParserProp_(PARSER_PROP_KEYS.NAVER_SEARCHAD_CUSTOMER_ID);
  const timestamp = String(Date.now());

  const queryString = buildQueryString_({
    hintKeywords: cleanKeywords.join(','),
    showDetail: '1',
  });

  const uri = PARSER_CFG.SEARCHAD_URI;
  const url = `${PARSER_CFG.SEARCHAD_ENDPOINT}${uri}?${queryString}`;
  const signature = buildSearchAdSignature_(timestamp, 'GET', uri, secretKey);
  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Timestamp': timestamp,
    'X-API-KEY': apiKey,
    'X-Customer': customerId,
    'X-Signature': signature,
  };

  const bodyText = withRetry_(
    function () {
      const resp = UrlFetchApp.fetch(url, {
        method: 'get',
        headers,
        muteHttpExceptions: true,
      });
      const status = resp.getResponseCode();
      const text = resp.getContentText() || '';

      if (status >= 200 && status < 300) return text;

      const retryable = (status === 429) || (status >= 500);
      throw createHttpError_('SearchAd keywordstool', status, text, retryable);
    },
    PARSER_CFG.MAX_ATTEMPTS,
    PARSER_CFG.RETRY_BASE_DELAY_MS
  );

  const parsed = JSON.parse(bodyText || '{}');
  const keywordList = Array.isArray(parsed.keywordList) ? parsed.keywordList : [];

  const out = {};
  for (let i = 0; i < keywordList.length; i += 1) {
    const item = keywordList[i] || {};
    const keyword = normalizeWhitespace_(item.relKeyword);
    if (!keyword) continue;

    const pcVolume = normalizeVolumeValue_(item.monthlyPcQcCnt);
    const moVolume = normalizeVolumeValue_(item.monthlyMobileQcCnt);
    const value = {
      pcVolume,
      moVolume,
      totalVolume: buildTotalVolume_(pcVolume, moVolume),
    };

    out[keyword] = value;
    const compact = removeAllSpaces_(keyword);
    if (compact && !out[compact]) out[compact] = value;
  }

  return out;
}

/**
 * @param {string} timestamp
 * @param {string} method
 * @param {string} uri
 * @param {string} secretKey
 * @returns {string}
 */
function buildSearchAdSignature_(timestamp, method, uri, secretKey) {
  const message = `${timestamp}.${String(method || '').toUpperCase()}.${uri}`;
  const bytes = Utilities.computeHmacSha256Signature(message, secretKey);
  return Utilities.base64Encode(bytes);
}

/**
 * @param {Object<string, {pcVolume:(number|string), moVolume:(number|string), totalVolume:(number|string)}>} target
 * @param {Object<string, {pcVolume:(number|string), moVolume:(number|string), totalVolume:(number|string)}>} source
 */
function mergeSearchAdMap_(target, source) {
  const src = source || {};
  const keys = Object.keys(src);
  for (let i = 0; i < keys.length; i += 1) {
    target[keys[i]] = src[keys[i]];
  }
}

/**
 * @param {*} err
 * @returns {boolean}
 */
function isSearchAdHintKeywordsInvalidError_(err) {
  const msg = safeErrorMessage_(err);
  return /11001|hintkeywords/i.test(msg);
}

/**
 * @param {string} keyword
 * @returns {string[]}
 */
function buildSearchAdKeywordCandidates_(keyword) {
  const normalized = normalizeWhitespace_(keyword);
  const compact = removeAllSpaces_(keyword);
  return uniqueStrings_([normalized, compact].filter(Boolean));
}

/**
 * @param {{pcVolume:(number|string), moVolume:(number|string), totalVolume:(number|string)}} volume
 * @returns {boolean}
 */
function hasSearchAdVolumeValue_(volume) {
  if (!volume) return false;
  return toComparableString_(volume.pcVolume) !== '' || toComparableString_(volume.moVolume) !== '';
}
