/**
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
function getParserProp_(key, defaultValue) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  return value == null ? defaultValue : value;
}

/**
 * @param {string} key
 * @returns {string}
 */
function mustGetParserProp_(key) {
  const value = String(getParserProp_(key, '') || '').trim();
  if (!value) throw new Error(`Missing Script Property: ${key}`);
  return value;
}

/**
 * @param {*} value
 * @returns {string}
 */
function normalizeWhitespace_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

/**
 * Queue enabled values:
 * - checkbox TRUE
 * - backward compatibility: Y / YES / TRUE / 1 / RUN
 * @param {*} value
 * @returns {boolean}
 */
function isQueueMarked_(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;

  const v = normalizeWhitespace_(value).toUpperCase();
  if (!v) return false;
  return (
    v === 'Y'
    || v === 'YES'
    || v === 'TRUE'
    || v === '1'
    || v === 'RUN'
  );
}

/**
 * @param {string} value
 * @returns {string}
 */
function removeAllSpaces_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, '').trim();
}

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function uniqueStrings_(values) {
  const seen = {};
  const out = [];
  const list = Array.isArray(values) ? values : [];
  for (let i = 0; i < list.length; i += 1) {
    const v = String(list[i] || '').trim();
    if (!v || seen[v]) continue;
    seen[v] = true;
    out.push(v);
  }
  return out;
}

/**
 * @template T
 * @param {T[]} arr
 * @param {number} size
 * @returns {T[][]}
 */
function chunkArray_(arr, size) {
  const list = Array.isArray(arr) ? arr : [];
  const chunkSize = Math.max(1, Number(size || 1));
  const out = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    out.push(list.slice(i, i + chunkSize));
  }
  return out;
}

/**
 * @param {Object<string, *>} params
 * @returns {string}
 */
function buildQueryString_(params) {
  const keys = Object.keys(params || {});
  const parts = [];
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const value = params[key];
    if (value == null) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.join('&');
}

/**
 * @returns {string}
 */
function formatNowForSheet_() {
  return Utilities.formatDate(
    new Date(),
    getParserTimezone_(),
    PARSER_CFG.DATETIME_FORMAT
  );
}

/**
 * @param {*} value
 * @returns {string}
 */
function toComparableString_(value) {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * @param {*} value
 * @returns {(number|string)}
 */
function normalizeVolumeValue_(value) {
  if (value == null) return '';
  if (typeof value === 'number') return value;

  const s = String(value).trim();
  if (!s) return '';
  if (/^-?\d+$/.test(s)) return Number(s);
  return s;
}

/**
 * @param {(number|string)} pcVolume
 * @param {(number|string)} moVolume
 * @returns {(number|string)}
 */
function buildTotalVolume_(pcVolume, moVolume) {
  if (typeof pcVolume === 'number' && typeof moVolume === 'number') {
    return pcVolume + moVolume;
  }
  return '';
}

/**
 * @param {string} html
 * @returns {string}
 */
function stripHtmlTags_(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ');
}

/**
 * @param {string} text
 * @returns {string}
 */
function decodeHtmlEntities_(text) {
  const raw = String(text || '');
  const namedMap = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    '#39': "'",
    nbsp: ' ',
  };

  return raw.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (_, entity) {
    const lower = String(entity || '').toLowerCase();
    if (namedMap[lower] != null) return namedMap[lower];
    if (lower.charAt(0) === '#') {
      const isHex = lower.charAt(1) === 'x';
      const num = parseInt(lower.substring(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!isNaN(num)) return String.fromCharCode(num);
    }
    return _;
  });
}

/**
 * @param {string} scope
 * @param {number} status
 * @param {string} body
 * @param {boolean} retryable
 * @returns {Error}
 */
function createHttpError_(scope, status, body, retryable) {
  const snippet = truncateText_(String(body || '').replace(/\s+/g, ' ').trim(), 240);
  const msg = `${scope} failed (${status})${snippet ? `: ${snippet}` : ''}`;
  const err = new Error(msg);
  err.retryable = !!retryable;
  err.httpStatus = status;
  return err;
}

/**
 * @param {Function} fn
 * @param {number} maxAttempts
 * @param {number} baseDelayMs
 * @returns {*}
 */
function withRetry_(fn, maxAttempts, baseDelayMs) {
  const attempts = Math.max(1, Number(maxAttempts || 1));
  const base = Math.max(1, Number(baseDelayMs || 1));
  let lastErr = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return fn(attempt);
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableError_(err);
      if (!retryable || attempt >= attempts) throw err;
      const delay = base * Math.pow(2, attempt - 1);
      Utilities.sleep(delay);
    }
  }
  throw lastErr || new Error('Unknown retry failure');
}

/**
 * @param {*} err
 * @returns {boolean}
 */
function isRetryableError_(err) {
  if (!err) return false;
  if (err.retryable === true) return true;
  if (err.retryable === false) return false;

  const msg = String(err && err.message ? err.message : err);
  return /timed out|timeout|temporarily|connection|429|5\d\d|rate limit/i.test(msg);
}

/**
 * @param {*} err
 * @returns {string}
 */
function safeErrorMessage_(err) {
  if (!err) return 'Unknown error';
  if (err.stack) return truncateText_(String(err.stack), 2000);
  if (err.message) return truncateText_(String(err.message), 2000);
  return truncateText_(String(err), 2000);
}

/**
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function truncateText_(text, maxLen) {
  const s = String(text || '');
  const n = Math.max(1, Number(maxLen || 1));
  if (s.length <= n) return s;
  return s.substring(0, n) + '...';
}
