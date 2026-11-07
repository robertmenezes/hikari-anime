/**
 * MovieBox provider for Nuvio / Hikari.
 * Uses the MovieBox mobile API signing flow and TMDB metadata supplied by Nuvio.
 *
 * The global and IN variants intentionally share stream resolution logic. Their
 * only configured difference is the preferred API host, matching their regional
 * Cloudstream variants without duplicating or fabricating catalogue behavior.
 */

const CryptoJS = require('crypto-js');

const PROVIDER = { name: "MovieBox", apiHosts: ["https://api3.aoneroom.com", "https://api4.aoneroom.com", "https://api5.aoneroom.com", "https://api6.aoneroom.com", "https://api4sg.aoneroom.com", "https://apig.inmoviebox.com"] };

const TOKEN_URL = 'https://apig.inmoviebox.com/wefeed-mobile-bff/tab/ranking-list?tabId=0&categoryType=4516404531735022304&page=1&perPage=1';
const PLAYER_BASE = 'https://movie-box.co';
const PLAYER_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

// The MovieBox mobile client uses two base64-wrapped signing keys.
const KEY_B64_DEFAULT = 'NzZpUmwwN3MweFNOOWpxbUVXQXQ3OUVCSlp1bElRSXNWNjRGWnIyTw==';
const KEY_B64_ALT = 'WHFuMm5uTzQxL0w5Mm8xaXVYaFNMSFRiWHZZNFo1Wlo2Mm04bVNMQQ==';

const PACKAGE_INFO = {
  package_name: 'com.community.mbox.in',
  version_name: '4.0.02.0831.03',
  version_code: 50020126,
  os: 'android',
  os_version: '14'
};

const BRAND_MODELS = {
  samsung: ['SM-S918B', 'SM-A528B', 'SM-M336B'],
  xiaomi: ['2201117TI', 'M2012K11AI', 'Redmi Note 11'],
  oneplus: ['LE2111', 'CPH2449', 'IN2023'],
  google: ['Pixel 6', 'Pixel 7', 'Pixel 8'],
  realme: ['RMX3085', 'RMX3360', 'RMX3551']
};

const API_HOST_POOL = PROVIDER.apiHosts;
const SECRET_KEY_DEFAULT = CryptoJS.enc.Base64.parse(
  CryptoJS.enc.Base64.parse(KEY_B64_DEFAULT).toString(CryptoJS.enc.Utf8)
);
const SECRET_KEY_ALT = CryptoJS.enc.Base64.parse(
  CryptoJS.enc.Base64.parse(KEY_B64_ALT).toString(CryptoJS.enc.Utf8)
);

let deviceId = '';
let selectedBrand = '';
let selectedModel = '';
let bearerToken = '';
let tokenPromise = null;

function randomHex(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 16).toString(16);
  }
  return result;
}

function initializeSession() {
  if (deviceId) return;

  deviceId = randomHex(32);
  const brands = Object.keys(BRAND_MODELS);
  selectedBrand = brands[Math.floor(Math.random() * brands.length)];
  const models = BRAND_MODELS[selectedBrand];
  selectedModel = models[Math.floor(Math.random() * models.length)];
}

function md5Hex(value) {
  return CryptoJS.MD5(value).toString(CryptoJS.enc.Hex);
}

function decodeBase64Text(value) {
  try {
    let normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    while (normalized.length % 4) normalized += '=';
    return CryptoJS.enc.Base64.parse(normalized).toString(CryptoJS.enc.Utf8);
  } catch (_) {
    return '';
  }
}

function decodeJwtExpiry(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return 0;
    const payload = JSON.parse(decodeBase64Text(parts[1]));
    return Number(payload.exp || 0);
  } catch (_) {
    return 0;
  }
}

function isTokenValid(token) {
  if (!token) return false;
  const expiry = decodeJwtExpiry(token);
  return !expiry || expiry > Date.now() / 1000 + 60;
}

function getClientInfo() {
  initializeSession();
  return JSON.stringify({
    ...PACKAGE_INFO,
    device_id: deviceId,
    install_store: 'official',
    gaid: '1b2212c1-dadf-43c3-a0c8-bd6ce48ae22d',
    brand: selectedBrand,
    model: selectedModel,
    system_language: 'en',
    net: 'NETWORK_WIFI',
    region: 'IN',
    timezone: 'Asia/Calcutta',
    sp_code: ''
  });
}

function canonicalizeUrl(url) {
  const parsed = new URL(url);
  const keys = Array.from(new Set(Array.from(parsed.searchParams.keys()))).sort();
  const query = [];

  for (const key of keys) {
    for (const value of parsed.searchParams.getAll(key)) {
      query.push(`${key}=${value}`);
    }
  }

  return query.length ? `${parsed.pathname}?${query.join('&')}` : parsed.pathname;
}

function signRequest(method, url, body, timestamp, accept, contentType, useAltKey) {
  const bodyText = body == null ? '' : String(body);
  let bodyHash = '';
  let bodyLength = '';

  if (bodyText) {
    const bodyBytes = CryptoJS.enc.Utf8.parse(bodyText);
    bodyLength = String(bodyBytes.sigBytes);
    bodyHash = md5Hex(bodyBytes);
  }

  const canonical = [
    String(method || 'GET').toUpperCase(),
    accept || 'application/json',
    contentType || 'application/json',
    bodyLength,
    String(timestamp),
    bodyHash,
    canonicalizeUrl(url)
  ].join('\n');

  const key = useAltKey ? SECRET_KEY_ALT : SECRET_KEY_DEFAULT;
  const signature = CryptoJS.HmacMD5(canonical, key).toString(CryptoJS.enc.Base64);
  const timestampText = String(timestamp);
  const clientToken = `${timestampText},${md5Hex(timestampText.split('').reverse().join(''))}`;

  return {
    'x-client-token': clientToken,
    'x-tr-signature': `${timestampText}|2|${signature}`
  };
}

function extractTokenFromResponse(response) {
  try {
    const raw = response && response.headers && response.headers.get
      ? response.headers.get('x-user')
      : null;
    if (!raw) return '';

    let parsed = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch (_) { parsed = raw; }
    }

    const token = typeof parsed === 'string'
      ? parsed
      : (parsed && (parsed.token || parsed.accessToken || parsed.access_token));

    return typeof token === 'string' ? token : '';
  } catch (_) {
    return '';
  }
}

function updateBearerToken(response) {
  const candidate = extractTokenFromResponse(response);
  if (candidate && isTokenValid(candidate)) {
    bearerToken = candidate;
  }
}

function getRequestHosts(url) {
  const parsed = new URL(url);
  const hosts = API_HOST_POOL.map((host) => new URL(host).host);
  if (!hosts.includes(parsed.host)) return [parsed.host];
  return [parsed.host, ...hosts.filter((host) => host !== parsed.host)];
}

async function requestJson(url, options = {}) {
  initializeSession();

  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body == null ? null : String(options.body);
  const customHeaders = options.headers || {};
  const accept = customHeaders.Accept || customHeaders.accept || 'application/json';
  const contentType = customHeaders['Content-Type'] || customHeaders['content-type'] ||
    (body ? 'application/json; charset=utf-8' : 'application/json');
  const timestamp = Date.now();
  const signatureHeaders = signRequest(method, url, body, timestamp, accept, contentType, !!options.useAltKey);

  const headers = {
    Accept: accept,
    'Content-Type': contentType,
    'User-Agent': `${PACKAGE_INFO.package_name}/${PACKAGE_INFO.version_code} (Linux; U; Android 14; en_IN; ${selectedModel}; Build/UD1A.230803.041; Cronet/145.0.7582.0)`,
    'x-client-info': getClientInfo(),
    'x-client-status': '0',
    ...signatureHeaders,
    ...customHeaders
  };

  if (!options.skipAuth) {
    const token = await getAnonymousToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const originalUrl = new URL(url);
  const hosts = getRequestHosts(url);
  const attempts = Math.min(4, hosts.length);
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const requestUrl = new URL(originalUrl.toString());
    requestUrl.host = hosts[attempt];

    try {
      const fetchOptions = { method, headers };
      if (body != null) fetchOptions.body = body;
      const response = await fetch(requestUrl.toString(), fetchOptions);
      updateBearerToken(response);

      const responseText = await response.text();
      let parsed;
      try { parsed = responseText ? JSON.parse(responseText) : null; }
      catch (_) { parsed = responseText; }

      if (!response.ok) {
        const error = new Error(`MovieBox respondeu HTTP ${response.status}`);
        error.status = response.status;
        error.body = String(responseText || '').slice(0, 300);

        if ([403, 429, 500, 502, 503, 504].includes(response.status) && attempt + 1 < attempts) {
          lastError = error;
          continue;
        }
        throw error;
      }

      return { data: parsed, headers: response.headers, status: response.status, url: response.url || requestUrl.toString() };
    } catch (error) {
      lastError = error;
      if (error && error.status && ![403, 429, 500, 502, 503, 504].includes(error.status)) throw error;
      if (attempt + 1 >= attempts) break;
    }
  }

  throw lastError || new Error('Não foi possível consultar a API MovieBox.');
}
async function getAnonymousToken() {
  if (bearerToken && isTokenValid(bearerToken)) return bearerToken;
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      const response = await requestJson(TOKEN_URL, { skipAuth: true });
      updateBearerToken(response);
      if (bearerToken) return bearerToken;

      const payload = response && response.data;
      const candidate = payload && (
        payload.token || payload.accessToken || payload.access_token ||
        (payload.data && (payload.data.token || payload.data.accessToken || payload.data.access_token))
      );
      if (typeof candidate === 'string' && isTokenValid(candidate)) {
        bearerToken = candidate;
          }
      return bearerToken || '';
    } catch (error) {
      console.log(`[${PROVIDER.name}] Não foi possível obter token anônimo: ${error.message || error}`);
      return bearerToken || '';
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

function buildApiUrl(path) {
  return `${PROVIDER.apiHosts[0]}${path.startsWith('/') ? path : `/${path}`}`;
}

async function fetchTmdbDetails(tmdbId, mediaType) {
  const apiKey = (typeof globalThis !== 'undefined' && globalThis.TMDB_API_KEY)
    ? String(globalThis.TMDB_API_KEY)
    : '';
  if (!apiKey) {
    console.log(`[${PROVIDER.name}] A chave do TMDB não foi disponibilizada pelo Nuvio.`);
    return null;
  }

  const url = `https://api.themoviedb.org/3/${mediaType}/${encodeURIComponent(tmdbId)}?api_key=${encodeURIComponent(apiKey)}&append_to_response=external_ids`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
    }
  });

  if (!response.ok) throw new Error(`TMDB respondeu HTTP ${response.status}`);
  return response.json();
}

function normalizeTitle(value) {
  if (!value) return '';
  let text = String(value);
  try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}

  return text
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\((?:19|20)\d{2}\)/g, ' ')
    .replace(/\b(?:dubbed|dub|subbed|hindi|tamil|telugu|dual audio|4k|hd)\b/g, ' ')
    .replace(/[.,!?;:()[\]{}"'’`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an)\s+/, '');
}

function levenshteinSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const rows = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) rows[i] = [i];
  for (let j = 0; j <= a.length; j++) rows[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1)
      );
    }
  }
  return 1 - rows[b.length][a.length] / Math.max(a.length, b.length);
}

function subjectMatchesType(subject, mediaType) {
  const value = subject && (subject.subjectType ?? subject.mediaType ?? subject.type);
  if (value == null) return true;
  const normalized = String(value).toLowerCase();
  if (mediaType === 'movie') return normalized === '1' || normalized === 'movie' || normalized === 'film';
  return normalized === '2' || normalized === 'tv' || normalized === 'series' || normalized === 'tvseries';
}

function scoreSubject(subject, targetTitle, targetYear, mediaType) {
  if (!subject || !subjectMatchesType(subject, mediaType)) return -1;
  const candidate = normalizeTitle(subject.title || subject.name || subject.originalTitle || '');
  const target = normalizeTitle(targetTitle);
  if (!candidate || !target) return -1;

  let score = 0;
  if (candidate === target) score = 100;
  else if (candidate.includes(target) || target.includes(candidate)) score = 76;
  else score = Math.round(levenshteinSimilarity(candidate, target) * 70);

  const candidateYear = String(subject.year || subject.releaseDate || subject.release_date || '').slice(0, 4);
  if (targetYear && candidateYear) {
    if (String(targetYear) === candidateYear) score += 25;
    else score -= 35;
  }

  return score;
}

function flattenSearchResults(payload) {
  const groups = payload && payload.data && payload.data.results;
  if (!Array.isArray(groups)) return [];
  const subjects = [];
  for (const group of groups) {
    if (group && Array.isArray(group.subjects)) subjects.push(...group.subjects);
  }
  return subjects;
}

async function searchMovieBox(keyword) {
  if (!keyword) return [];
  const url = buildApiUrl('/wefeed-mobile-bff/subject-api/search/v2');
  const body = JSON.stringify({ page: 1, perPage: 20, keyword, restrictKid: 1 });
  const response = await requestJson(url, { method: 'POST', body });
  return flattenSearchResults(response && response.data);
}

async function findMovieBoxMatches(details, mediaType) {
  const title = mediaType === 'movie'
    ? (details.title || details.original_title)
    : (details.name || details.original_name);
  const originalTitle = mediaType === 'movie'
    ? (details.original_title || details.title)
    : (details.original_name || details.name);
  const year = String(details.release_date || details.first_air_date || '').slice(0, 4);
  const queries = Array.from(new Set([title, originalTitle].filter(Boolean)));
  const collected = new Map();

  for (const query of queries) {
    const results = await searchMovieBox(query);
    for (const subject of results) {
      const subjectId = subject && (subject.subjectId || subject.subject_id || subject.id);
      if (!subjectId) continue;
      const score = scoreSubject(subject, query, year, mediaType);
      if (score < 70) continue;

      const previous = collected.get(String(subjectId));
      if (!previous || score > previous.score) collected.set(String(subjectId), { subject, score });
    }
    if (collected.size) break;
  }

  return Array.from(collected.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.subject);
}

function getSubjectId(subject) {
  return subject && (subject.subjectId || subject.subject_id || subject.id);
}

function getResponseData(response) {
  const root = response && response.data;
  if (!root || typeof root !== 'object') return null;
  return root.data && typeof root.data === 'object' ? root.data : root;
}

async function getSubjectDetails(subjectId) {
  const url = buildApiUrl(`/wefeed-mobile-bff/subject-api/get?subjectId=${encodeURIComponent(subjectId)}`);
  const response = await requestJson(url);
  return getResponseData(response);
}

function getDetailPath(subjectData, variant) {
  const candidates = [
    variant && variant.detailPath,
    variant && variant.detail_path,
    subjectData && subjectData.detailPath,
    subjectData && subjectData.detail_path,
    subjectData && subjectData.path,
    subjectData && subjectData.slug
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim()) || '';
}

function getPlaybackPage(subjectData, variant, subjectId) {
  let webBase = PLAYER_BASE;
  let detailPath = getDetailPath(subjectData, variant);

  const domains = [
    subjectData && subjectData.detailDomain,
    subjectData && subjectData.webDomain,
    subjectData && subjectData.webUrl,
    subjectData && subjectData.detailUrl,
    subjectData && subjectData.shareUrl
  ];

  for (const value of domains) {
    if (typeof value !== 'string' || !value.trim()) continue;
    try {
      const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
      if (!parsed.hostname.endsWith('aoneroom.com')) webBase = parsed.origin;
      if (!detailPath && parsed.pathname && parsed.pathname !== '/') detailPath = parsed.pathname;
      break;
    } catch (_) {}
  }

  if (!detailPath) return { webBase, detailPath: '', referer: `${webBase}/` };
  detailPath = detailPath.replace(/^\/+/, '').replace(/^movies\//, '');

  const page = new URL(`/movies/${detailPath}`, `${webBase}/`);
  page.searchParams.set('id', String(subjectId));
  page.searchParams.set('type', '/movie/detail');
  page.searchParams.set('detailSe', '');
  page.searchParams.set('detailEp', '');
  page.searchParams.set('lang', 'en');

  return { webBase, detailPath, referer: page.toString() };
}

function makePlayInfoUrl(subjectId, season, episode, detailPath) {
  const params = [
    `subjectId=${encodeURIComponent(subjectId)}`,
    `se=${encodeURIComponent(season)}`,
    `ep=${encodeURIComponent(episode)}`,
    'streamSignType=1',
    'supportCodecs%5Bhevc%5D=1',
    'supportCodecs%5Bh264%5D=1'
  ];
  if (detailPath) params.push(`detailPath=${encodeURIComponent(detailPath)}`);
  return buildApiUrl(`/wefeed-mobile-bff/subject-api/play-info?${params.join('&')}`);
}

function looksLikeUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function collectStreams(playData) {
  if (!playData || typeof playData !== 'object') return [];
  const streams = [];

  function append(value, format) {
    if (!value) return;
    if (typeof value === 'string') {
      if (looksLikeUrl(value)) streams.push({ url: value, format });
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) append(item, format);
      return;
    }
    if (typeof value !== 'object') return;

    const directUrl = value.url || value.playUrl || value.resourceLink || value.streamUrl || value.fileUrl || value.src;
    if (looksLikeUrl(directUrl)) {
      streams.push({ ...value, url: directUrl, format: value.format || format });
      return;
    }

    for (const [resolution, item] of Object.entries(value)) {
      if (looksLikeUrl(item)) {
        streams.push({ url: item, resolution, format });
      } else if (item && typeof item === 'object') {
        append({ ...item, resolution: item.resolution || resolution }, format);
      }
    }
  }

  append(playData.streams, '');
  append(playData.netDash || (playData.data && playData.data.netDash), 'DASH');
  append(playData.netHls || (playData.data && playData.data.netHls), 'HLS');
  append(playData.netMp4 || (playData.data && playData.data.netMp4), 'MP4');

  const seen = new Set();
  return streams.filter((stream) => {
    const key = stream.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function parseQualityNumber(value) {
  const text = Array.isArray(value) ? value.join(' ') : String(value || '');
  const numbers = [];
  if (/\b4k\b/i.test(text)) numbers.push(2160);
  if (/\b8k\b/i.test(text)) numbers.push(4320);

  const directMatches = text.matchAll(/(?:^|\D)(\d{3,4})(?:p|\b)/gi);
  for (const match of directMatches) numbers.push(Number(match[1]));
  const dimensionMatches = text.matchAll(/\d+x(\d{3,4})/gi);
  for (const match of dimensionMatches) numbers.push(Number(match[1]));

  return numbers.length ? Math.max(...numbers) : 0;
}

function formatQuality(stream) {
  const values = [
    stream && stream.quality,
    stream && stream.definition,
    stream && stream.resolutions,
    stream && stream.resolution,
    stream && stream.videoQuality,
    stream && stream.label,
    stream && stream.profile
  ].filter((value) => value != null && value !== '');
  if (stream && stream.width && stream.height) values.push(`${stream.width}x${stream.height}`);
  if (stream && stream.video && stream.video.width && stream.video.height) {
    values.push(`${stream.video.width}x${stream.video.height}`);
  }

  const numbers = values.map(parseQualityNumber).filter((value) => value > 0);
  if (numbers.length) return `${Math.max(...numbers)}p`;
  return 'Auto';
}

function qualityRank(value) {
  const number = parseQualityNumber(value);
  if (number) return number;
  return String(value || '').toLowerCase() === 'auto' ? 1 : 0;
}

function getFormatType(url, declaredFormat) {
  const declared = String(declaredFormat || '').toUpperCase();
  if (['DASH', 'HLS', 'MP4', 'MKV'].includes(declared)) return declared;
  const value = String(url || '').toLowerCase();
  if (value.includes('.mpd')) return 'DASH';
  if (value.includes('.m3u8')) return 'HLS';
  if (value.includes('.mkv')) return 'MKV';
  if (value.includes('.mp4')) return 'MP4';
  return 'DIRECT';
}

function decodePolicyValue(value) {
  const decoded = decodeBase64Text(value);
  return decoded.replace(/\/+$/, '');
}

function extractPolicyResource(signCookie) {
  if (typeof signCookie !== 'string' || !signCookie) return '';

  const edgeMatch = signCookie.match(/Edge-Cache-Cookie=urlprefix=([^;:\s]+)/i);
  if (edgeMatch) {
    const resource = decodePolicyValue(edgeMatch[1]);
    if (resource) return `${resource}/index.mpd`;
  }

  const cloudFrontMatch = signCookie.match(/CloudFront-Policy=([^;]+)/i);
  if (cloudFrontMatch) {
    try {
      let encoded = cloudFrontMatch[1]
        .replace(/-/g, '+')
        .replace(/~/g, '/')
        .replace(/_/g, '=');
      while (encoded.length % 4) encoded += '=';
      const policy = JSON.parse(CryptoJS.enc.Base64.parse(encoded).toString(CryptoJS.enc.Utf8));
      const resource = policy && policy.Statement && policy.Statement[0] && policy.Statement[0].Resource;
      if (typeof resource === 'string' && resource) {
        const cleaned = resource.replace(/[*/]+$/, '');
        return /\.mpd$/i.test(cleaned) ? cleaned : `${cleaned}/index.mpd`;
      }
    } catch (_) {}
  }

  return '';
}

function normalizeLanguage(value) {
  if (!value) return '';
  return String(value).trim().replace(/_/g, '-');
}

function displayLanguage(value) {
  const raw = normalizeLanguage(value);
  if (!raw) return '';
  const normalized = raw.toLowerCase().replace(/\s+audio$/i, '').trim();
  const labels = {
    'pt-br': 'Português (BR)', 'pt': 'Português', 'pt-pt': 'Português', 'por': 'Português',
    'portuguese': 'Português', 'portuguese (brazil)': 'Português (BR)', 'brazilian portuguese': 'Português (BR)',
    'es-419': 'Espanhol (Latino)', 'es': 'Espanhol', 'spa': 'Espanhol', 'spanish': 'Espanhol',
    'en': 'Inglês', 'eng': 'Inglês', 'english': 'Inglês',
    'ja': 'Japonês', 'jpn': 'Japonês', 'japanese': 'Japonês',
    'ko': 'Coreano', 'kor': 'Coreano', 'korean': 'Coreano',
    'zh': 'Chinês', 'zho': 'Chinês', 'chi': 'Chinês', 'chinese': 'Chinês',
    'hi': 'Hindi', 'hin': 'Hindi', 'hindi': 'Hindi',
    'ar': 'Árabe', 'ara': 'Árabe', 'arabic': 'Árabe', 'bn': 'Bengali',
    'de': 'Alemão', 'deu': 'Alemão', 'ger': 'Alemão', 'german': 'Alemão',
    'fr': 'Francês', 'fra': 'Francês', 'fre': 'Francês', 'french': 'Francês',
    'it': 'Italiano', 'ita': 'Italiano', 'italian': 'Italiano', 'ru': 'Russo', 'rus': 'Russo',
    'russian': 'Russo', 'tr': 'Turco', 'tur': 'Turco', 'turkish': 'Turco',
    'id': 'Indonésio', 'ind': 'Indonésio', 'indonesian': 'Indonésio',
    'ta': 'Tâmil', 'tam': 'Tâmil', 'tamil': 'Tâmil', 'te': 'Telugu', 'tel': 'Telugu',
    'ml': 'Malaiala', 'malayalam': 'Malaiala', 'th': 'Tailandês', 'tha': 'Tailandês',
    'thai': 'Tailandês', 'vi': 'Vietnamita', 'vie': 'Vietnamita', 'vietnamese': 'Vietnamita'
  };
  if (labels[normalized]) return labels[normalized];

  const code = normalized.match(/^([a-z]{2,3})(?:-|$)/);
  if (code && labels[code[1]]) return labels[code[1]];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function collectAudioLanguages(stream, fallbackLanguage) {
  const values = [];
  const tracks = Array.isArray(stream && stream.audioTracks) ? stream.audioTracks : [];
  for (const track of tracks) {
    if (typeof track === 'string') values.push(track);
    else if (track && typeof track === 'object') {
      values.push(track.languageName || track.lanName || track.language || track.lan || track.name);
    }
  }
  if (!values.length) {
    values.push(
      stream && (stream.languageName || stream.lanName || stream.language || stream.lan),
      fallbackLanguage
    );
  }

  const seen = new Set();
  return values.map(normalizeLanguage).filter((value) => {
    if (!value) return false;
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortAudioLanguages(languages, originalLanguage) {
  const original = normalizeLanguage(originalLanguage).toLowerCase();
  return languages.slice().sort((a, b) => {
    const rank = (value) => {
      const lower = value.toLowerCase();
      if (original && lower === original) return 0;
      if (lower === 'pt-br' || lower === 'pt' || lower === 'por') return 1;
      if (lower === 'es-419' || lower === 'es' || lower === 'spa') return 2;
      return 3;
    };
    return rank(a) - rank(b);
  });
}

function summarizeLanguages(values, max = 3) {
  const labels = values.map(displayLanguage).filter(Boolean);
  if (!labels.length) return 'Não identificado';
  const visible = labels.slice(0, max);
  const extra = labels.length - visible.length;
  return extra > 0 ? `${visible.join(', ')}, +${extra} ${extra === 1 ? 'idioma' : 'idiomas'}` : visible.join(', ');
}

function getCaptionsArray(response) {
  const data = getResponseData(response);
  if (!data) return [];
  if (Array.isArray(data.extCaptions)) return data.extCaptions;
  if (Array.isArray(data.captions)) return data.captions;
  return [];
}

async function fetchSubtitles(subjectId, streamId, episode) {
  const subtitles = [];
  const requests = [
    `/wefeed-mobile-bff/subject-api/get-stream-captions?subjectId=${encodeURIComponent(subjectId)}&streamId=${encodeURIComponent(streamId)}`,
    `/wefeed-mobile-bff/subject-api/get-ext-captions?subjectId=${encodeURIComponent(subjectId)}&resourceId=${encodeURIComponent(streamId)}&episode=${encodeURIComponent(episode || 0)}`
  ];

  const responses = await Promise.all(requests.map(async (path) => {
    try { return await requestJson(buildApiUrl(path)); }
    catch (_) { return null; }
  }));

  for (const response of responses) {
    for (const caption of getCaptionsArray(response)) {
      if (!caption || !looksLikeUrl(caption.url)) continue;
      const language = normalizeLanguage(caption.language || caption.lan || caption.lanName || 'und');
      subtitles.push({
        url: caption.url,
        language,
        name: caption.lanName || caption.name || displayLanguage(language) || 'Legenda',
        headers: { Referer: PLAYER_BASE }
      });
    }
  }

  const seen = new Set();
  return subtitles.filter((subtitle) => {
    const key = `${subtitle.url}|${subtitle.language.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resourceDetectorStreams(playData, subjectData, season, episode) {
  const detectors = Array.isArray(playData && playData.resourceDetectors)
    ? playData.resourceDetectors
    : (Array.isArray(subjectData && subjectData.resourceDetectors) ? subjectData.resourceDetectors : []);
  const output = [];

  for (const detector of detectors) {
    const list = Array.isArray(detector && detector.resolutionList) ? detector.resolutionList : [];
    for (const item of list) {
      if (!item || !looksLikeUrl(item.resourceLink)) continue;
      const se = item.se == null ? 0 : Number(item.se);
      const ep = item.ep == null ? 0 : Number(item.ep);
      if ((season > 0 || episode > 0) && (se !== Number(season) || ep !== Number(episode))) continue;
      output.push({
        url: item.resourceLink,
        resolution: item.resolution,
        format: item.format || '',
        id: item.id || item.streamId || ''
      });
    }
  }
  return output;
}

function buildPlaybackHeaders(playbackPage) {
  return {
    Origin: playbackPage.webBase,
    Referer: playbackPage.referer,
    'User-Agent': PLAYER_USER_AGENT,
    'x-request-lang': 'en',
    'x-vip-restrict': '0',
    'x-no-high-risk-restrict': '0',
    'X-Play-Mode': '1'
  };
}

function buildStreamResult(stream, variant, playbackHeaders, title, mediaType, season, episode, subtitles, subjectData) {
  const rawUrl = stream.url || stream.playUrl || stream.resourceLink || stream.streamUrl || stream.fileUrl || stream.src || '';
  const signCookie = stream.signCookie || stream.sign_cookie || stream.cookie || '';
  const policyUrl = extractPolicyResource(signCookie);
  const finalUrl = policyUrl || rawUrl;
  if (!looksLikeUrl(finalUrl)) return null;

  const format = getFormatType(finalUrl, stream.format || stream.type);
  const quality = formatQuality(stream);
  const audioLanguages = sortAudioLanguages(
    collectAudioLanguages(stream, variant.language || (subjectData && subjectData.originalLanguageName)),
    (subjectData && (subjectData.originalLanguage || subjectData.originalLanguageName)) || ''
  );
  const subtitleLanguages = Array.from(new Set(subtitles.map((item) => item.language).filter(Boolean)));
  const episodeLabel = mediaType === 'movie'
    ? title
    : `${title} - S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
  const audioSummary = summarizeLanguages(audioLanguages);
  const subtitleSummary = subtitleLanguages.length ? ` | Legendas: ${summarizeLanguages(subtitleLanguages.sort((a, b) => {
    const rank = (value) => /^pt(?:-|$)/i.test(value) || /^por$/i.test(value) ? 0 : /^es(?:-|$)/i.test(value) || /^spa$/i.test(value) ? 1 : 2;
    return rank(a) - rank(b);
  }))}` : '';

  const headers = { ...playbackHeaders, ...(stream.headers || {}) };
  const signHeaderKey = stream.signHeaderKey || stream.sign_header_key || 'Cookie';
  if (signCookie) headers[signHeaderKey] = signCookie;

  const name = `[Hikari] ${quality} • ${PROVIDER.name}`;

  return {
    name,
    title: episodeLabel,
    url: finalUrl,
    type: format.toLowerCase(),
    language: `Áudio: ${audioSummary}${subtitleSummary}`,
    provider: PROVIDER.name,
    headers,
    subtitles
  };
}

async function getVariantStreams(variant, subjectData, title, mediaType, season, episode, playbackPage) {
  const subjectId = variant.id;
  const url = makePlayInfoUrl(subjectId, season, episode, playbackPage.detailPath || '');
  const response = await requestJson(url, { headers: buildPlaybackHeaders(playbackPage) });
  const playData = getResponseData(response);
  if (!playData) return [];

  let streams = collectStreams(playData);
  if (!streams.length) streams = resourceDetectorStreams(playData, subjectData, season, episode);

  const results = await Promise.all(streams.map(async (stream) => {
    const streamId = stream.id || stream.streamId || stream.stream_id || stream.resourceId || `${subjectId}|${season}|${episode}`;
    const subtitles = await fetchSubtitles(subjectId, streamId, episode);
    return buildStreamResult(stream, variant, buildPlaybackHeaders(playbackPage), title, mediaType, season, episode, subtitles, subjectData);
  }));

  return results.filter(Boolean);
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = 1, episodeNum = 1) {
  try {
    const type = String(mediaType || 'movie').toLowerCase() === 'movie' ? 'movie' : 'tv';
    const season = type === 'tv' ? Math.max(1, Number(seasonNum) || 1) : 0;
    const episode = type === 'tv' ? Math.max(1, Number(episodeNum) || 1) : 0;

    const tmdbData = await fetchTmdbDetails(tmdbId, type);
    if (!tmdbData) return [];

    const title = type === 'movie'
      ? (tmdbData.title || tmdbData.original_title)
      : (tmdbData.name || tmdbData.original_name);
    if (!title) return [];

    const matches = await findMovieBoxMatches(tmdbData, type);
    if (!matches.length) {
      console.log(`[${PROVIDER.name}] Nenhum título correspondente encontrado para ${title}.`);
      return [];
    }

    const output = [];
    for (const subject of matches) {
      const subjectId = getSubjectId(subject);
      if (!subjectId) continue;

      try {
        const subjectData = await getSubjectDetails(subjectId);
        if (!subjectData) continue;

        const playbackPage = getPlaybackPage(subjectData, null, subjectId);
        const dubs = Array.isArray(subjectData.dubs) ? subjectData.dubs : [];
        const variants = [];
        const originalDub = dubs.find((dub) => String(dub.subjectId || dub.id) === String(subjectId));
        variants.push({
          id: String(subjectId),
          language: (originalDub && (originalDub.lanName || originalDub.language)) ||
            subjectData.originalLanguageName || subjectData.originalLanguage || 'Original',
          detailPath: getDetailPath(subjectData, originalDub)
        });

        for (const dub of dubs) {
          const id = dub && (dub.subjectId || dub.subject_id || dub.id);
          if (!id || String(id) === String(subjectId)) continue;
          variants.push({
            id: String(id),
            language: dub.lanName || dub.language || dub.lan || 'Unknown',
            detailPath: getDetailPath(subjectData, dub)
          });
        }

        const uniqueVariants = [];
        const seenVariants = new Set();
        for (const variant of variants) {
          if (seenVariants.has(variant.id)) continue;
          seenVariants.add(variant.id);
          uniqueVariants.push(variant);
        }

        const variantResults = await Promise.all(uniqueVariants.slice(0, 12).map(async (variant) => {
          try {
            const page = variant.detailPath
              ? getPlaybackPage(subjectData, variant, variant.id)
              : playbackPage;
            return await getVariantStreams(variant, subjectData, title, type, season, episode, page);
          } catch (error) {
            console.log(`[${PROVIDER.name}] Falha ao resolver variante ${variant.id}: ${error.message || error}`);
            return [];
          }
        }));

        output.push(...variantResults.flat());
        // Prefer the best title match; only try another candidate if this one has no streams.
        if (output.length) break;
      } catch (error) {
        console.log(`[${PROVIDER.name}] Falha ao consultar título ${subjectId}: ${error.message || error}`);
      }
    }

    const seenUrls = new Set();
    const uniqueStreams = output.filter((stream) => {
      const key = stream.url;
      if (!key || seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    });

    uniqueStreams.sort((a, b) => qualityRank(b.name) - qualityRank(a.name));
    return uniqueStreams;
  } catch (error) {
    console.log(`[${PROVIDER.name}] ${error.message || error}`);
    return [];
  }
}

module.exports = { getStreams };
