/**
 * MovieBox IN — MovieBox provider for Nuvio / Hikari.
 *
 * Independent JavaScript implementation for the Nuvio plugin runtime.
 * Uses the mobile API when available and the MovieBox H5 Web Player as a
 * second discovery/playback route. All result headers are returned in the
 * PluginRuntimeResult shape understood by Nuvio.
 */

const CryptoJS = require('crypto-js');

const PROVIDER_NAME = 'MovieBox IN';
const REGION = 'IN';
const PACKAGE_NAME = 'com.community.mbox.in';
const LOCALE = 'en_IN';
const API_HOSTS = ["https://apig.inmoviebox.com","https://api.inmoviebox.com","https://api3.aoneroom.com","https://api4.aoneroom.com"];
const H5_ORIGIN = 'https://movie-box.co';
const H5_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36';
const MOBILE_VERSION = '4.0.02';
const MOBILE_VERSION_CODE = 50020126;

const KEY_B64_DEFAULT = 'NzZpUmwwN3MweFNOOWpxbUVXQXQ3OUVCSlp1bElRSXNWNjRGWnIyTw==';
const KEY_B64_ALT = 'WHFuMm5uTzQxL0w5Mm8xaXVYaFNMSFRiWHZZNFo1Wlo2Mm04bVNMQQ==';
const SECRET_KEY_DEFAULT = CryptoJS.enc.Base64.parse(
  CryptoJS.enc.Base64.parse(KEY_B64_DEFAULT).toString(CryptoJS.enc.Utf8)
);
const SECRET_KEY_ALT = CryptoJS.enc.Base64.parse(
  CryptoJS.enc.Base64.parse(KEY_B64_ALT).toString(CryptoJS.enc.Utf8)
);

const BRAND_MODELS = {
  Google: ['Pixel 6', 'Pixel 7', 'Pixel 8'],
  Samsung: ['SM-S918B', 'SM-A528B', 'SM-M336B'],
  Xiaomi: ['2201117TI', 'Redmi Note 11'],
  OnePlus: ['LE2111', 'CPH2449'],
  Realme: ['RMX3085', 'RMX3360']
};

const DEVICE_ID = randomHex(32);
const DEVICE_MODEL = chooseBrandModel();
let mobileToken = '';
let mobileTokenPromise = null;
let h5Token = '';
let h5TokenPromise = null;

function randomHex(length) {
  let result = '';
  const chars = '0123456789abcdef';
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function chooseBrandModel() {
  const brands = Object.keys(BRAND_MODELS);
  const brand = brands[Math.floor(Math.random() * brands.length)];
  const models = BRAND_MODELS[brand];
  return { brand, model: models[Math.floor(Math.random() * models.length)] };
}

function md5Hex(value) {
  return CryptoJS.MD5(value).toString(CryptoJS.enc.Hex);
}

function hmacMd5Base64(value, key) {
  return CryptoJS.HmacMD5(value, key).toString(CryptoJS.enc.Base64);
}

function safeJson(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '')); } catch (_) { return null; }
}

function responseToken(response) {
  try {
    const raw = response && response.headers && response.headers.get
      ? response.headers.get('x-user')
      : null;
    if (!raw) return '';
    const parsed = safeJson(raw) || raw;
    if (typeof parsed === 'string') return parsed;
    return parsed && (parsed.token || parsed.accessToken || parsed.access_token) || '';
  } catch (_) {
    return '';
  }
}

function unwrapData(value) {
  let current = value;
  for (let i = 0; i < 3; i++) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) break;
    if (current.data && typeof current.data === 'object') current = current.data;
    else break;
  }
  return current;
}

function encodeQuery(params) {
  return Object.keys(params || {}).sort().map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key]));
  }).join('&');
}

function canonicalQuery(params) {
  return Object.keys(params || {}).sort().map(function (key) {
    return key + '=' + String(params[key]);
  }).join('&');
}

function mobileClientInfo() {
  return JSON.stringify({
    package_name: PACKAGE_NAME,
    version_name: MOBILE_VERSION,
    version_code: MOBILE_VERSION_CODE,
    os: 'android',
    os_version: '14',
    device_id: DEVICE_ID,
    install_ch: 'ps',
    install_store: 'ps',
    gaid: '',
    brand: DEVICE_MODEL.brand,
    model: DEVICE_MODEL.model,
    system_language: 'en',
    net: 'NETWORK_WIFI',
    region: REGION,
    timezone: 'Asia/Calcutta',
    sp_code: ''
  });
}

function mobileHeaders(host, timestamp, key, options) {
  const opts = options || {};
  const clientTimestamp = String(timestamp);
  const mobileUa = PACKAGE_NAME + '/' + MOBILE_VERSION_CODE +
    ' (Linux; U; Android 14; ' + LOCALE + '; ' + DEVICE_MODEL.model +
    '; Build/UP1A.231005.007; Cronet/145.0.7582.0)';

  const headers = {
    'User-Agent': mobileUa,
    Accept: opts.accept !== undefined ? opts.accept : 'application/json',
    'Content-Type': opts.contentType !== undefined ? opts.contentType : 'application/json;charset=UTF-8',
    'X-M-Version': MOBILE_VERSION,
    'X-Sign-Version': '2.0',
    'X-Play-Mode': '2',
    appid: '4U01pxRu278GqCZKY9',
    region: REGION,
    lang: 'en',
    os: 'android',
    'X-Timestamp': clientTimestamp,
    'X-Client-Token': clientTimestamp + ',' + md5Hex(clientTimestamp.split('').reverse().join('')),
    'X-Client-Info': mobileClientInfo(),
    'X-Client-Status': mobileToken && !opts.skipAuth ? '0' : '1',
    'x-tr-signature': opts.signature,
    Referer: host + '/'
  };

  if (mobileToken && !opts.skipAuth) headers.Authorization = 'Bearer ' + mobileToken;
  if (opts.extraHeaders) {
    Object.keys(opts.extraHeaders).forEach(function (key) {
      headers[key] = opts.extraHeaders[key];
    });
  }
  return headers;
}

/**
 * Signs mobile API requests with the canonical path/query. Each host is
 * signed independently because the host parameter participates in signing.
 * The alternate signing key and guest-token refresh are bounded fallbacks.
 */
async function mobileRequest(path, method, params, body, options) {
  const opts = options || {};
  const verb = String(method || 'GET').toUpperCase();
  const bodyText = body == null ? '' : String(body);
  let lastError = null;

  for (let hostIndex = 0; hostIndex < API_HOSTS.length; hostIndex++) {
    const host = API_HOSTS[hostIndex].replace(/\/+$/, '');
    const hostName = host.replace(/^https?:\/\//i, '');
    const requestParams = Object.assign({}, params || {}, { host: hostName });
    const query = encodeQuery(requestParams);
    const signedQuery = canonicalQuery(requestParams);
    const requestUrl = host + path + (query ? '?' + query : '');
    const canonicalUrl = path + (signedQuery ? '?' + signedQuery : '');
    const timestamp = Date.now();
    const bodyBytes = bodyText ? CryptoJS.enc.Utf8.parse(bodyText) : null;
    const bodyLength = bodyBytes ? String(bodyBytes.sigBytes) : '';
    const bodyHash = bodyBytes ? md5Hex(bodyBytes) : '';
    const accept = opts.accept !== undefined ? opts.accept : 'application/json';
    const contentType = opts.contentType !== undefined ? opts.contentType : 'application/json;charset=UTF-8';
    const canonical = [
      verb,
      accept,
      contentType,
      bodyLength,
      String(timestamp),
      bodyHash,
      canonicalUrl
    ].join('\n');

    for (let keyIndex = 0; keyIndex < 2; keyIndex++) {
      const key = keyIndex === 0 ? SECRET_KEY_DEFAULT : SECRET_KEY_ALT;
      const signature = hmacMd5Base64(canonical, key);
      const headers = mobileHeaders(host, timestamp, key, {
        accept,
        contentType,
        signature: String(timestamp) + '|2|' + signature,
        skipAuth: !!opts.skipAuth,
        extraHeaders: opts.extraHeaders
      });
      const fetchOptions = { method: verb, headers };
      if (bodyText) fetchOptions.body = bodyText;

      try {
        const response = await fetch(requestUrl, fetchOptions);
        const receivedToken = responseToken(response);
        if (receivedToken) mobileToken = String(receivedToken);

        if (response.status === 401 && mobileToken && !opts.skipAuth && !opts.authRetried) {
          mobileToken = '';
          await bootstrapMobileToken();
          if (mobileToken) {
            return mobileRequest(path, verb, params, bodyText, Object.assign({}, opts, { authRetried: true }));
          }
        }

        const raw = await response.text();
        const payload = raw ? (safeJson(raw) || raw) : null;

        if (!response.ok) {
          const error = new Error('MovieBox HTTP ' + response.status + ' em ' + path);
          error.status = response.status;
          error.responseBody = String(raw || '').slice(0, 250);
          lastError = error;

          if (response.status === 401 && !opts.skipAuth && !opts.authRetried && !mobileToken) {
            await bootstrapMobileToken();
            if (mobileToken) {
              return mobileRequest(path, verb, params, bodyText, Object.assign({}, opts, { authRetried: true }));
            }
          }

          if ([400, 404, 405, 422].includes(response.status)) break;
          continue;
        }

        return {
          data: payload,
          headers: response.headers,
          host: host,
          url: response.url || requestUrl
        };
      } catch (error) {
        lastError = error;
        if (error && error.status && [400, 404, 405, 422].includes(error.status)) break;
      }
    }
  }

  throw lastError || new Error('Não foi possível consultar a API móvel MovieBox.');
}

async function bootstrapMobileToken() {
  if (mobileToken) return mobileToken;
  if (mobileTokenPromise) return mobileTokenPromise;

  mobileTokenPromise = (async function () {
    try {
      const path = '/wefeed-mobile-bff/tab/ranking-list';
      const response = await mobileRequest(path, 'GET', {
        tabId: '0',
        categoryType: '4516404531735022304',
        page: '1',
        perPage: '1'
      }, null, { skipAuth: true, noRefresh: true });
      if (!mobileToken) {
        const data = unwrapData(response.data);
        const token = data && (data.token || data.accessToken || data.access_token);
        if (token) mobileToken = String(token);
      }
      return mobileToken;
    } catch (error) {
      console.log('[' + PROVIDER_NAME + '] bootstrap móvel falhou: ' + (error.message || error));
      return '';
    } finally {
      mobileTokenPromise = null;
    }
  })();

  return mobileTokenPromise;
}

function h5ClientToken() {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return timestamp + ',' + md5Hex(timestamp.split('').reverse().join(''));
}

function absorbH5Token(response) {
  const token = responseToken(response);
  if (token) h5Token = String(token);
}

async function h5Request(url, method, body, referer, origin) {
  const verb = String(method || 'GET').toUpperCase();
  const headers = {
    Accept: 'application/json',
    'User-Agent': H5_UA,
    Origin: origin || H5_ORIGIN,
    Referer: referer || (origin || H5_ORIGIN) + '/',
    'x-client-info': '{"timezone":"Asia/Calcutta"}',
    'x-request-lang': 'en'
  };
  if (body != null) headers['Content-Type'] = 'application/json';
  if (h5Token) headers.Authorization = 'Bearer ' + h5Token;
  else headers['X-Client-Token'] = h5ClientToken();

  try {
    const response = await fetch(url, {
      method: verb,
      headers: headers,
      body: body == null ? undefined : String(body)
    });
    absorbH5Token(response);
    if (!response.ok) throw new Error('MovieBox Web HTTP ' + response.status);
    const payload = await response.json();
    return unwrapData(payload);
  } catch (error) {
    if (error && error.message) throw error;
    throw new Error('Falha na consulta Web Player MovieBox.');
  }
}

async function bootstrapH5Token() {
  if (h5Token) return h5Token;
  if (h5TokenPromise) return h5TokenPromise;

  h5TokenPromise = (async function () {
    try {
      await h5Request(H5_ORIGIN + '/wefeed-h5api-bff/country-code', 'GET', null, H5_ORIGIN + '/', H5_ORIGIN);
    } catch (_) {
      // The H5 search route can still work with its timestamp client token.
    } finally {
      h5TokenPromise = null;
    }
    return h5Token;
  })();

  return h5TokenPromise;
}

async function fetchTmdbDetails(tmdbId, mediaType) {
  const apiKey = typeof globalThis !== 'undefined' && globalThis.TMDB_API_KEY
    ? String(globalThis.TMDB_API_KEY)
    : '';
  if (!apiKey) throw new Error('Nuvio não disponibilizou a chave do TMDB.');

  const type = String(mediaType || 'movie').toLowerCase() === 'movie' ? 'movie' : 'tv';
  let url;

  if (/^tt\d+$/i.test(String(tmdbId))) {
    url = 'https://api.themoviedb.org/3/find/' + encodeURIComponent(tmdbId) +
      '?api_key=' + encodeURIComponent(apiKey) + '&external_source=imdb_id';
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('TMDB HTTP ' + response.status);
    const found = await response.json();
    const list = type === 'movie' ? found.movie_results : found.tv_results;
    if (!Array.isArray(list) || !list.length) return null;
    const first = list[0];
    const detailUrl = 'https://api.themoviedb.org/3/' + type + '/' + first.id +
      '?api_key=' + encodeURIComponent(apiKey) + '&append_to_response=external_ids,alternative_titles';
    const detailResponse = await fetch(detailUrl, { headers: { Accept: 'application/json' } });
    if (!detailResponse.ok) throw new Error('TMDB HTTP ' + detailResponse.status);
    return detailResponse.json();
  }

  url = 'https://api.themoviedb.org/3/' + type + '/' + encodeURIComponent(tmdbId) +
    '?api_key=' + encodeURIComponent(apiKey) + '&append_to_response=external_ids,alternative_titles';
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('TMDB HTTP ' + response.status);
  return response.json();
}

function titleForMeta(meta, mediaType) {
  return mediaType === 'movie'
    ? (meta.title || meta.original_title || '')
    : (meta.name || meta.original_name || '');
}

function titleVariants(meta, mediaType) {
  const values = mediaType === 'movie'
    ? [meta.title, meta.original_title]
    : [meta.name, meta.original_name];
  const alt = meta.alternative_titles;
  if (alt && Array.isArray(alt.titles)) {
    alt.titles.forEach(function (item) {
      if (item && item.title) values.push(item.title);
    });
  }
  if (alt && Array.isArray(alt.results)) {
    alt.results.forEach(function (item) {
      if (item && item.title) values.push(item.title);
    });
  }

  const unique = [];
  const seen = new Set();
  values.forEach(function (value) {
    const text = String(value || '').trim();
    const key = normalizeTitle(text);
    if (text && key && !seen.has(key)) {
      seen.add(key);
      unique.push(text);
    }
  });
  return unique.slice(0, 5);
}

function normalizeTitle(value) {
  let text = String(value || '');
  try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
  return text.toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\((?:19|20)\d{2}\)/g, ' ')
    .replace(/\s+s\d+(?:\s*-\s*s?\d+)?$/i, ' ')
    .replace(/\b(?:dubbed|dub|subbed|dual audio|4k|uhd|hd)\b/g, ' ')
    .replace(/[^\w\u3400-\u9fff\uac00-\ud7af]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an)\s+/, '');
}

function yearFromValue(value) {
  const match = String(value || '').match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : 0;
}

function subjectMediaType(subject) {
  const raw = subject && (subject.subjectType != null
    ? subject.subjectType
    : (subject.mediaType != null ? subject.mediaType : subject.type));
  if (raw == null) return '';
  const value = String(raw).toLowerCase();
  if (value === '1' || value === 'movie' || value === 'film') return 'movie';
  if (value === '2' || value === 'tv' || value === 'series' || value === 'tvseries') return 'tv';
  return '';
}

function titleScore(candidateTitle, targets) {
  const candidate = normalizeTitle(candidateTitle);
  if (!candidate) return 0;
  let best = 0;
  targets.forEach(function (target) {
    const normalized = normalizeTitle(target);
    if (!normalized) return;
    if (candidate === normalized) best = Math.max(best, 100);
    else if (candidate.includes(normalized) || normalized.includes(candidate)) best = Math.max(best, 82);
    else {
      const left = candidate.split(' ');
      const right = normalized.split(' ');
      const overlap = left.filter(function (word) { return right.includes(word); }).length;
      const ratio = overlap / Math.max(left.length, right.length);
      if (ratio >= 0.8) best = Math.max(best, Math.round(ratio * 75));
    }
  });
  return best;
}

function subjectMatches(subject, meta, mediaType, titles) {
  if (!subject || !subject.title) return false;
  const type = subjectMediaType(subject);
  if (type && type !== mediaType) return false;
  if (titleScore(subject.title, titles) < 80) return false;

  const wantedYear = yearFromValue(mediaType === 'movie' ? meta.release_date : meta.first_air_date);
  const foundYear = yearFromValue(subject.year || subject.releaseDate || subject.release_date);
  if (wantedYear && foundYear) {
    if (mediaType === 'movie' && Math.abs(foundYear - wantedYear) > 1) return false;
    if (mediaType === 'tv' && Math.abs(foundYear - wantedYear) > 3) return false;
  }
  return true;
}

function extractSubjects(payload) {
  const data = unwrapData(payload);
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.subjects)) return data.subjects;
  if (Array.isArray(data.results)) {
    const output = [];
    data.results.forEach(function (group) {
      if (group && Array.isArray(group.subjects)) output.push.apply(output, group.subjects);
      else if (group && group.subjectId) output.push(group);
    });
    return output;
  }
  if (Array.isArray(data.list)) return data.list;
  return [];
}

function subjectIdOf(subject) {
  return subject && (subject.subjectId || subject.subject_id || subject.id);
}

async function mobileSearch(keyword, mediaType) {
  const v1Body = JSON.stringify({
    keyword: keyword,
    q: keyword,
    page: 1,
    pageSize: 20,
    type: 0
  });

  try {
    const response = await mobileRequest(
      '/wefeed-mobile-bff/subject-api/search',
      'POST',
      {},
      v1Body
    );
    const items = extractSubjects(response.data);
    if (items.length) return items;
  } catch (error) {
    console.log('[' + PROVIDER_NAME + '] busca móvel v1 falhou: ' + (error.message || error));
  }

  try {
    const v2Body = JSON.stringify({
      page: 1,
      perPage: 20,
      keyword: keyword,
      restrictKid: 1
    });
    const response = await mobileRequest(
      '/wefeed-mobile-bff/subject-api/search/v2',
      'POST',
      {},
      v2Body,
      { contentType: 'application/json; charset=utf-8' }
    );
    return extractSubjects(response.data);
  } catch (error) {
    console.log('[' + PROVIDER_NAME + '] busca móvel v2 falhou: ' + (error.message || error));
    return [];
  }
}

async function findMobileMatches(meta, mediaType, titles) {
  const collected = new Map();
  const queries = titles;

  for (let i = 0; i < queries.length; i++) {
    const items = await mobileSearch(queries[i], mediaType);
    items.forEach(function (subject) {
      const id = subjectIdOf(subject);
      if (!id || !subjectMatches(subject, meta, mediaType, titles)) return;
      const key = String(id);
      const previous = collected.get(key);
      const score = titleScore(subject.title, titles);
      if (!previous || score > previous.score) {
        collected.set(key, { subject: subject, score: score });
      }
    });
  }

  return Array.from(collected.values())
    .sort(function (a, b) { return b.score - a.score; })
    .map(function (entry) { return entry.subject; });
}

function getSubjectData(response) {
  return unwrapData(response && response.data);
}

async function getMobileSubjectDetails(subjectId) {
  const response = await mobileRequest(
    '/wefeed-mobile-bff/subject-api/get',
    'GET',
    { subjectId: String(subjectId) },
    null
  );
  return getSubjectData(response);
}

function dubRawLabel(dub) {
  if (!dub || typeof dub !== 'object') return '';
  return String(
    dub.sourceName || dub.source_name || dub.audioName || dub.audio_name ||
    dub.dubName || dub.dub_name || dub.lanName || dub.language || dub.lan ||
    dub.name || dub.title || ''
  ).trim();
}

function dubLanguageOf(dub) {
  const raw = dubRawLabel(dub);
  if (!raw) return '';
  let candidate = raw.replace(/^.*?moviebox\s+/i, '').replace(/\s+audio\s*$/i, '').trim();
  const key = candidate.toLowerCase().replace(/[_\s-]+/g, '');
  if (/^(ptbr|porbr|brazilianportuguese|portuguesebrazil)$/.test(key)) return 'pt-BR';
  if (/^(esla|es419|latinspanish|spanishlatinamerica)$/.test(key)) return 'es-419';
  if (/^(original|originalaudio)$/.test(key)) return 'Original Audio';
  return candidate;
}

function dubSourceLabel(dub, language) {
  const raw = dubRawLabel(dub);
  if (/moviebox/i.test(raw)) return raw;
  if (/\baudio\s*$/i.test(raw)) return 'MovieBox ' + raw;
  return language ? 'MovieBox ' + language + ' Audio' : '';
}

function getDubs(subjectData, originalSubjectId, originalSubject) {
  const dubs = Array.isArray(subjectData && subjectData.dubs) ? subjectData.dubs : [];
  const original = dubs.find(function (dub) {
    return String(dub.subjectId || dub.subject_id || dub.id || '') === String(originalSubjectId);
  });
  const parentLanguage = dubLanguageOf(originalSubject) ||
    dubLanguageOf(original) ||
    dubLanguageOf({
      language: subjectData && (subjectData.originalLanguageName || subjectData.originalLanguage)
    });
  const parentExplicitOriginal = /^(original|original audio)$/i.test(parentLanguage);

  const output = [{
    id: String(originalSubjectId),
    language: parentLanguage,
    sourceLabel: dubSourceLabel(original || originalSubject, parentLanguage),
    detailPath: '',
    isOriginal: parentExplicitOriginal
  }];

  dubs.forEach(function (dub) {
    const id = dub && (dub.subjectId || dub.subject_id || dub.id);
    if (!id || String(id) === String(originalSubjectId)) return;
    const language = dubLanguageOf(dub);
    output.push({
      id: String(id),
      language: language,
      sourceLabel: dubSourceLabel(dub, language),
      detailPath: dub.detailPath || dub.detail_path || '',
      isOriginal: /^(original|original audio)$/i.test(language)
    });
  });

  const seen = new Set();
  return output.filter(function (item) {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function formatOfUrl(url, declared) {
  const type = String(declared || '').toLowerCase();
  if (type === 'dash' || type === 'mpd') return 'dash';
  if (type === 'hls' || type === 'm3u8') return 'hls';
  if (type === 'mkv') return 'mkv';
  if (type === 'mp4' || type === 'video') return 'mp4';
  const lower = String(url || '').toLowerCase();
  if (/\.mpd(?:$|[?#])/.test(lower)) return 'dash';
  if (/\.m3u8(?:$|[?#])/.test(lower)) return 'hls';
  if (/\.mkv(?:$|[?#])/.test(lower)) return 'mkv';
  if (/\.mp4(?:$|[?#])/.test(lower)) return 'mp4';
  return 'direct';
}

function parseQuality(value) {
  const text = Array.isArray(value) ? value.join(' ') : String(value || '');
  if (/\b8k\b/i.test(text)) return '4320p';
  if (/\b4k\b|2160/i.test(text)) return '2160p';
  const dimension = text.match(/\d{3,4}\s*x\s*(\d{3,4})/i);
  if (dimension) return dimension[1] + 'p';
  const match = text.match(/(?:^|\D)(\d{3,4})\s*p?\b/i);
  if (match) {
    const height = Number(match[1]);
    if (height >= 240 && height <= 4320) return height + 'p';
  }
  return 'Auto';
}

function qualityRank(value) {
  const match = String(value || '').match(/(\d{3,4})/);
  return match ? Number(match[1]) : 0;
}

function languageLabel(value) {
  const raw = String(value || '').trim().replace(/_/g, '-');
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/\s+audio$/i, '').trim();
  const labels = {
    'original': 'Áudio original',
    'original audio': 'Áudio original',
    'pt-br': 'Português (BR)',
    'ptbr': 'Português (BR)',
    'por-br': 'Português (BR)',
    'portuguese (brazil)': 'Português (BR)',
    'brazilian portuguese': 'Português (BR)',
    'pt': 'Português',
    'pt-pt': 'Português',
    'por': 'Português',
    'portuguese': 'Português',
    'es-419': 'Espanhol (Latino)',
    'es-la': 'Espanhol (Latino)',
    'es': 'Espanhol',
    'spa': 'Espanhol',
    'spanish': 'Espanhol',
    'en': 'Inglês',
    'eng': 'Inglês',
    'english': 'Inglês',
    'ja': 'Japonês',
    'jpn': 'Japonês',
    'japanese': 'Japonês',
    'ko': 'Coreano',
    'kor': 'Coreano',
    'korean': 'Coreano',
    'zh': 'Chinês',
    'zho': 'Chinês',
    'chi': 'Chinês',
    'chinese': 'Chinês',
    'hi': 'Hindi',
    'hin': 'Hindi',
    'hindi': 'Hindi',
    'ar': 'Árabe',
    'ara': 'Árabe',
    'arabic': 'Árabe',
    'de': 'Alemão',
    'deu': 'Alemão',
    'ger': 'Alemão',
    'german': 'Alemão',
    'fr': 'Francês',
    'fra': 'Francês',
    'fre': 'Francês',
    'french': 'Francês',
    'it': 'Italiano',
    'ita': 'Italiano',
    'italian': 'Italiano',
    'ru': 'Russo',
    'rus': 'Russo',
    'russian': 'Russo',
    'tr': 'Turco',
    'tur': 'Turco',
    'turkish': 'Turco',
    'id': 'Indonésio',
    'ind': 'Indonésio',
    'indonesian': 'Indonésio',
    'ta': 'Tâmil',
    'tam': 'Tâmil',
    'tamil': 'Tâmil',
    'te': 'Telugu',
    'tel': 'Telugu',
    'ml': 'Malaiala',
    'mal': 'Malaiala',
    'th': 'Tailandês',
    'tha': 'Tailandês',
    'thai': 'Tailandês',
    'vi': 'Vietnamita',
    'vie': 'Vietnamita',
    'vietnamese': 'Vietnamita'
  };
  if (labels[key]) return labels[key];
  const code = key.match(/^([a-z]{2,3})(?:-|$)/);
  if (code && labels[code[1]]) return labels[code[1]];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function languagePriority(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'original' || key.indexOf('original') >= 0) return 0;
  if (key === 'pt-br' || key === 'ptbr' || key === 'pt' || key === 'por') return 1;
  if (key === 'es-419' || key === 'es' || key === 'spa') return 2;
  return 3;
}

function summarizeLanguages(values, max) {
  const unique = [];
  const seen = new Set();
  (values || []).forEach(function (value) {
    const text = languageLabel(value);
    if (text && !seen.has(text)) {
      seen.add(text);
      unique.push({ raw: String(value), label: text });
    }
  });
  unique.sort(function (a, b) {
    return languagePriority(a.raw) - languagePriority(b.raw);
  });
  if (!unique.length) return 'Não identificado';
  const limit = max || 3;
  const visible = unique.slice(0, limit).map(function (item) { return item.label; });
  const extra = unique.length - visible.length;
  return visible.join(', ') + (extra > 0 ? ', +' + extra + (extra === 1 ? ' idioma' : ' idiomas') : '');
}

function collectAudioLanguages(stream, fallbackLanguage, subjectData) {
  const values = [];
  const tracks = Array.isArray(stream && stream.audioTracks) ? stream.audioTracks : [];
  tracks.forEach(function (track) {
    if (typeof track === 'string') values.push(track);
    else if (track && typeof track === 'object') {
      values.push(track.languageName || track.lanName || track.language || track.lan || track.name);
    }
  });
  if (Array.isArray(stream && stream.audioLanguages)) {
    values.push.apply(values, stream.audioLanguages);
  }
  values.push(
    stream && (stream.languageName || stream.lanName || stream.language || stream.lan || stream.audioLanguage)
  );

  const hasTrackLanguage = values.some(function (value) {
    return value && String(value).trim() && String(value).toLowerCase() !== 'unknown';
  });
  if (!hasTrackLanguage) {
    if (fallbackLanguage && String(fallbackLanguage).toLowerCase() !== 'unknown') {
      values.push(fallbackLanguage);
    }
  }

  const output = [];
  const seen = new Set();
  values.forEach(function (value) {
    if (!value) return;
    const key = String(value).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      output.push(String(value));
    }
  });
  return output;
}
function parseSubtitleItems(source, headers) {
  const output = [];
  const values = Array.isArray(source) ? source : (source && typeof source === 'object' ? [source] : []);
  values.forEach(function (item) {
    if (!item) return;
    if (typeof item === 'string') {
      if (/^https?:\/\//i.test(item)) {
        output.push({ url: item, language: 'und', name: 'Legenda', headers: headers || undefined });
      }
      return;
    }
    const url = item.url || item.fileUrl || item.subtitleUrl || item.src;
    if (!url || !/^https?:\/\//i.test(String(url))) return;
    const language = item.language || item.lan || item.lanName || item.lang || item.languageCode || 'und';
    output.push({
      url: String(url),
      language: String(language),
      name: item.lanName || item.name || languageLabel(language) || 'Legenda',
      headers: item.headers || headers || undefined
    });
  });
  return output;
}

function normalizeSubtitleList(items) {
  const result = [];
  const seen = new Set();
  (items || []).forEach(function (item) {
    if (!item || !item.url) return;
    const key = item.url + '|' + item.language;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  });
  return result;
}

function captionsFromPayload(payload) {
  const data = unwrapData(payload);
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.extCaptions)) return data.extCaptions;
  if (Array.isArray(data.captions)) return data.captions;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.list)) return data.list;
  return [];
}

const captionCache = new Map();

async function getExternalCaptions(subjectId, streamId, episode) {
  const key = String(subjectId) + '|' + String(streamId || '');
  if (captionCache.has(key)) return captionCache.get(key);

  const pending = (async function () {
    const headers = { 'x-request-lang': 'en' };
    let responseData = null;

    try {
      const response = await mobileRequest(
        '/wefeed-mobile-bff/subject-api/get-stream-captions',
        'GET',
        { subjectId: String(subjectId), streamId: String(streamId || '') },
        null,
        { accept: '', contentType: '', extraHeaders: headers }
      );
      responseData = response.data;
    } catch (_) {}

    let captions = captionsFromPayload(responseData);
    if (!captions.length) {
      try {
        const response = await mobileRequest(
          '/wefeed-mobile-bff/subject-api/get-ext-captions',
          'GET',
          {
            subjectId: String(subjectId),
            resourceId: String(streamId || ''),
            episode: String(episode || 0)
          },
          null
        );
        captions = captionsFromPayload(response.data);
      } catch (_) {}
    }

    return normalizeSubtitleList(parseSubtitleItems(captions, {
      Referer: API_HOSTS[0] + '/'
    }));
  })();

  captionCache.set(key, pending);
  return pending;
}

function decodeBase64Text(value) {
  try {
    return CryptoJS.enc.Base64.parse(String(value || '').replace(/-/g, '+').replace(/_/g, '/'))
      .toString(CryptoJS.enc.Utf8);
  } catch (_) {
    return '';
  }
}

function dashUrlFromSignCookie(signCookie) {
  if (!signCookie) return '';
  const edge = String(signCookie).match(/Edge-Cache-Cookie=urlprefix=([^:;\s]+)/i);
  if (edge) {
    const prefix = decodeBase64Text(edge[1]).replace(/\/+$/, '');
    if (prefix) return prefix + '/index.mpd';
  }

  const cloudFront = String(signCookie).match(/CloudFront-Policy=([^;]+)/i);
  if (cloudFront) {
    const raw = cloudFront[1];
    const candidates = [
      raw.replace(/-/g, '+').replace(/~/g, '/').replace(/_/g, '='),
      raw.replace(/-/g, '+').replace(/_/g, '/')
    ];
    for (let i = 0; i < candidates.length; i++) {
      try {
        const decoded = CryptoJS.enc.Base64.parse(candidates[i]).toString(CryptoJS.enc.Utf8);
        const policy = JSON.parse(decoded);
        const resource = policy && policy.Statement && policy.Statement[0] && policy.Statement[0].Resource;
        if (resource) {
          const clean = String(resource).replace(/[*/]+$/, '');
          return /\.mpd$/i.test(clean) ? clean : clean + '/index.mpd';
        }
      } catch (_) {}
    }
  }
  return '';
}

function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.indexOf('//') === 0) return 'https:' + raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return '';
}

function isPromotionalUrl(url) {
  const value = String(url || '').toLowerCase();
  return value.indexOf('movieboxdownload.com') >= 0 ||
    value.indexOf('moviebox.download') >= 0 ||
    /\/(?:install|download-app|app-download)(?:\/|\.|$)/i.test(value);
}

function appendStream(streams, value, declaredFormat, sharedCookie) {
  if (!value) return;
  if (typeof value === 'string') {
    const url = normalizeUrl(value);
    if (url) streams.push({ url: url, format: declaredFormat || '' });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(function (item) { appendStream(streams, item, declaredFormat, sharedCookie); });
    return;
  }
  if (typeof value !== 'object') return;

  const rawUrl = value.url || value.playUrl || value.resourceLink || value.streamUrl ||
    value.fileUrl || value.videoUrl || value.link || value.src;
  if (rawUrl) {
    const url = normalizeUrl(rawUrl);
    if (!url) return;
    streams.push(Object.assign({}, value, {
      url: url,
      format: value.format || value.type || declaredFormat || '',
      signCookie: value.signCookie || value.sign_cookie || value.cookie || sharedCookie || ''
    }));
    return;
  }

  Object.keys(value).forEach(function (key) {
    const item = value[key];
    if (typeof item === 'string' && /^https?:\/\//i.test(item)) {
      streams.push({ url: item, resolution: key, format: declaredFormat || '', signCookie: sharedCookie || '' });
    } else if (item && typeof item === 'object') {
      appendStream(streams, Object.assign({}, item, { resolution: item.resolution || key }), declaredFormat, sharedCookie);
    }
  });
}

function collectMobileStreams(playPayload, subjectData, season, episode) {
  const playData = unwrapData(playPayload) || {};
  const sharedCookie = playData.signCookie || playData.sign_cookie || '';
  const streams = [];
  appendStream(streams, playData.streams || playData.streamList, '', sharedCookie);
  appendStream(streams, playData.netDash || playData.dash, 'DASH', sharedCookie);
  appendStream(streams, playData.netHls || playData.hls, 'HLS', sharedCookie);
  appendStream(streams, playData.netMp4 || playData.mp4, 'MP4', sharedCookie);

  const detectorSources = [];
  if (Array.isArray(playData.resourceDetectors)) detectorSources.push.apply(detectorSources, playData.resourceDetectors);
  if (Array.isArray(subjectData && subjectData.resourceDetectors)) detectorSources.push.apply(detectorSources, subjectData.resourceDetectors);

  detectorSources.forEach(function (detector) {
    const list = Array.isArray(detector && detector.resolutionList) ? detector.resolutionList : [];
    list.forEach(function (item) {
      if (!item) return;
      const itemSeason = Number(item.se || item.season || 0);
      const itemEpisode = Number(item.ep || item.episode || 0);
      if (season > 0 && itemSeason > 0 && itemSeason !== Number(season)) return;
      if (episode > 0 && itemEpisode > 0 && itemEpisode !== Number(episode)) return;
      const url = normalizeUrl(item.resourceLink || item.url || item.playUrl);
      if (!url) return;
      streams.push({
        url: url,
        format: item.format || detector.format || '',
        resolution: item.resolution || item.quality || '',
        quality: item.quality || '',
        id: item.id || item.streamId || item.resourceId || '',
        signCookie: item.signCookie || item.sign_cookie || '',
        signHeaderKey: item.signHeaderKey || item.sign_header_key || ''
      });
    });
  });

  const seen = new Set();
  return streams.filter(function (stream) {
    const key = [
      stream.url,
      stream.format,
      stream.resolution || stream.quality || '',
      stream.id || '',
      stream.signCookie || ''
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectH5Streams(playPayload) {
  const playData = unwrapData(playPayload) || {};
  const sharedCookie = playData.signCookie || playData.sign_cookie || '';
  const streams = [];
  appendStream(streams, playData.dash, 'DASH', sharedCookie);
  appendStream(streams, playData.hls, 'HLS', sharedCookie);
  appendStream(streams, playData.streams || playData.streamList, '', sharedCookie);

  const seen = new Set();
  return streams.filter(function (stream) {
    const key = [
      stream.url,
      stream.format,
      stream.resolution || stream.quality || '',
      stream.signCookie || ''
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function streamIdOf(stream, fallback) {
  return String(stream && (
    stream.id || stream.streamId || stream.stream_id || stream.resourceId
  ) || fallback || '');
}

function buildPlaybackHeaders(stream, mode, route) {
  const headers = {};
  if (mode === 'h5') {
    const origin = route && route.origin ? route.origin : H5_ORIGIN;
    const detailPath = route && route.detailPath ? route.detailPath : '';
    const subjectId = route && route.subjectId ? route.subjectId : '';
    headers.Origin = origin;
    headers.Referer = origin + '/movies/' + encodeURIComponent(detailPath) +
      '?id=' + encodeURIComponent(subjectId) + '&type=/movie/detail&detailSe=&detailEp=&lang=en';
    headers['User-Agent'] = H5_UA;
    headers.Accept = '*/*';
  } else {
    headers.Referer = API_HOSTS[0] + '/';
    headers['User-Agent'] = H5_UA;
    headers.Accept = '*/*';
  }

  const cookie = stream && (stream.signCookie || stream.sign_cookie || stream.cookie);
  const headerKey = stream && (stream.signHeaderKey || stream.sign_header_key) || 'Cookie';
  if (cookie) {
    headers[headerKey] = String(cookie);
    headers.Cookie = String(cookie);
  }

  if (stream && stream.headers && typeof stream.headers === 'object') {
    Object.keys(stream.headers).forEach(function (key) {
      const value = stream.headers[key];
      if (value != null && String(value).trim()) headers[key] = String(value);
    });
  }
  return headers;
}

function streamLanguages(stream, variant, subjectData) {
  // MovieBox returns one subject ID per dub. The variant label is authoritative:
  // HLS/DASH may report "Multi" for the container even though this source is
  // a single-language dub.
  const variantLanguage = variant && String(variant.language || '').trim();
  if (variantLanguage && !/^(multi|multiple|unknown|und|n\/?a)$/i.test(variantLanguage)) {
    return languageLabel(variantLanguage);
  }

  const audio = collectAudioLanguages(stream, '', null)
    .filter(function (value) {
      return !/^(multi|multiple|unknown|und|n\/?a)$/i.test(String(value || '').trim());
    });
  return audio.length ? summarizeLanguages(audio, 4) : 'Não identificado';
}

function subtitleSummary(subtitles) {
  const languages = (subtitles || []).map(function (item) { return item.language; }).filter(Boolean);
  return languages.length ? summarizeLanguages(languages, 3) : '';
}

function buildResult(stream, variant, subjectData, meta, mediaType, season, episode, mode, route, subtitles) {
  if (!stream || !stream.url) return null;

  const signCookie = stream.signCookie || stream.sign_cookie || stream.cookie || '';
  const streamFormat = formatOfUrl(stream.url, stream.format || stream.type);
  let finalUrl = stream.url;

  if (streamFormat === 'dash' && signCookie) {
    const reconstructed = dashUrlFromSignCookie(signCookie);
    if (reconstructed) finalUrl = reconstructed;
  }

  finalUrl = normalizeUrl(finalUrl);
  if (!finalUrl || isPromotionalUrl(finalUrl)) return null;
  if (stream.isPreview || stream.preview || stream.isTrailer || stream.trailer) return null;
  const duration = Number(stream.duration || stream.durationSeconds || 0);
  if (duration > 0 && duration < 180) return null;

  const quality = parseQuality(
    stream.resolutions || stream.resolution || stream.quality ||
    stream.definition || stream.videoQuality || stream.label ||
    (stream.width && stream.height ? stream.width + 'x' + stream.height : '')
  );
  const audio = streamLanguages(stream, variant, subjectData);
  const audioDisplay = variant && variant.isOriginal
    ? 'Áudio original'
    : audio;
  const subtitlesList = normalizeSubtitleList(
    parseSubtitleItems(stream.subtitles || stream.captions || stream.extCaptions)
      .concat(subtitles || [])
  );
  const subs = subtitleSummary(subtitlesList);
  const contentTitle = titleForMeta(meta, mediaType);
  const title = mediaType === 'movie'
    ? contentTitle
    : contentTitle + ' - S' + String(season).padStart(2, '0') + 'E' + String(episode).padStart(2, '0');
  const name = '[Hikari] ' + quality + ' • ' + PROVIDER_NAME;
  const sourceLabel = variant && variant.sourceLabel
    ? variant.sourceLabel
    : (audioDisplay === 'Áudio original' ? 'MovieBox Original Audio' :
      (audioDisplay !== 'Não identificado' ? 'MovieBox ' + audioDisplay + ' Audio' : 'MovieBox áudio não identificado'));
  const manifestAudio = collectAudioLanguages(stream, '', null);
  const manifestAudioText = manifestAudio.length
    ? summarizeLanguages(manifestAudio, 4)
    : 'Não identificado';
  const languageText = '| ' + sourceLabel + '\nAudio: ' + manifestAudioText +
    (subs ? ' | Subs: ' + subs : '');
  const headers = buildPlaybackHeaders(
    Object.assign({}, stream, { signCookie: signCookie }),
    mode,
    Object.assign({}, route || {}, { subjectId: variant && variant.id })
  );

  return {
    name: name,
    title: title,
    url: finalUrl,
    quality: quality,
    language: languageText,
    provider: PROVIDER_NAME,
    type: streamFormat === 'direct' ? undefined : streamFormat,
    headers: headers,
    subtitles: subtitlesList
  };
}

async function getMobileVariantStreams(variant, meta, mediaType, season, episode) {
  let subjectData = null;
  try {
    subjectData = await getMobileSubjectDetails(variant.id);
  } catch (_) {}

  let playResponse;
  try {
    playResponse = await mobileRequest(
      '/wefeed-mobile-bff/subject-api/play-info',
      'GET',
      {
        subjectId: String(variant.id),
        se: String(mediaType === 'movie' ? 0 : season),
        ep: String(mediaType === 'movie' ? 0 : episode)
      },
      null
    );
  } catch (error) {
    console.log('[' + PROVIDER_NAME + '] play-info falhou para ' + variant.id + ': ' + (error.message || error));
    return [];
  }

  const streams = collectMobileStreams(playResponse.data, subjectData, season, episode);
  const results = await Promise.all(streams.map(async function (stream) {
    const streamId = streamIdOf(stream, variant.id + '|' + season + '|' + episode);
    const captions = await getExternalCaptions(variant.id, streamId, episode);
    return buildResult(
      stream,
      variant,
      subjectData,
      meta,
      mediaType,
      season,
      episode,
      'mobile',
      { origin: API_HOSTS[0], detailPath: '', subjectId: variant.id },
      captions
    );
  }));

  return results.filter(Boolean);
}

async function getMobileStreams(meta, mediaType, season, episode, titles) {
  await bootstrapMobileToken();
  const matches = await findMobileMatches(meta, mediaType, titles);
  if (!matches.length) return [];

  const allResults = [];
  for (let i = 0; i < matches.length; i++) {
    const originalId = subjectIdOf(matches[i]);
    if (!originalId) continue;

    let subjectData = null;
    try {
      subjectData = await getMobileSubjectDetails(originalId);
    } catch (error) {
      console.log('[' + PROVIDER_NAME + '] detalhes falharam: ' + (error.message || error));
    }

    const variants = getDubs(subjectData || {}, originalId, matches[i]);
    const variantResults = await Promise.all(variants.map(function (variant) {
      return getMobileVariantStreams(variant, meta, mediaType, season, episode)
        .catch(function (error) {
          console.log('[' + PROVIDER_NAME + '] variante falhou: ' + (error.message || error));
          return [];
        });
    }));

    allResults.push.apply(allResults, variantResults.flat());
  }

  return allResults;
}

function h5RouteFromItem(item) {
  const rawPath = String(item && (item.detailPath || item.detail_path || item.path) || '');
  const rawUrl = String(item && (item.detailUrl || item.detail_url || item.url) || '');
  let origin = H5_ORIGIN;
  let detailPath = rawPath;

  try {
    if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
      const parsed = new URL(rawUrl);
      origin = parsed.origin;
      if (!detailPath) detailPath = parsed.pathname.split('/').filter(Boolean).pop() || '';
    }
  } catch (_) {}

  if (detailPath && /^https?:\/\//i.test(detailPath)) {
    try {
      const parsed = new URL(detailPath);
      origin = parsed.origin;
      detailPath = parsed.pathname.split('/').filter(Boolean).pop() || '';
    } catch (_) {}
  }

  detailPath = String(detailPath || '').replace(/^\/+/, '').split(/[?#]/)[0];
  return detailPath ? { origin: origin, detailPath: detailPath } : null;
}

function h5BaseTitle(value) {
  return String(value || '').split('[')[0].trim().replace(/\s+S\d+(?:\s*-\s*S?\d+)?$/i, '');
}

function h5ItemSeason(item) {
  const explicit = Number(item && item.season || 0);
  if (explicit > 0) return explicit;
  const match = String(item && item.title || '').match(/\s+S(\d+)(?:\s*-\s*S?\d+)?$/i);
  return match ? Number(match[1]) : 0;
}

function h5ItemYear(item) {
  return yearFromValue(item && (item.year || item.releaseDate || item.release_date));
}

function h5Matches(item, meta, mediaType, titles) {
  if (!item || !subjectIdOf(item) || !item.title) return false;
  const route = h5RouteFromItem(item);
  if (!route) return false;
  if (titleScore(h5BaseTitle(item.title), titles) < 80) return false;

  const wantedYear = yearFromValue(mediaType === 'movie' ? meta.release_date : meta.first_air_date);
  const foundYear = h5ItemYear(item);
  if (wantedYear && foundYear) {
    if (mediaType === 'movie' && Math.abs(foundYear - wantedYear) > 1) return false;
    if (mediaType === 'tv') {
      const itemSeason = h5ItemSeason(item) || 1;
      if (Math.abs(foundYear - (itemSeason - 1) - wantedYear) > 2) return false;
    }
  }
  return true;
}

function extractH5Items(payload) {
  const data = unwrapData(payload);
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.subjects)) return data.subjects;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

async function h5Search(keyword, mediaType) {
  const typeNumber = mediaType === 'movie' ? 1 : 2;
  const probes = [
    { keyword: keyword, page: 1, perPage: 20, subjectType: 0 },
    { keyword: keyword, page: 1, perPage: 20, subjectType: typeNumber },
    { keyword: keyword, page: 2, perPage: 20, subjectType: typeNumber }
  ];
  const pooled = [];
  const seen = new Set();

  for (let i = 0; i < probes.length; i++) {
    try {
      const response = await h5Request(
        H5_ORIGIN + '/wefeed-h5api-bff/subject/search',
        'POST',
        JSON.stringify(probes[i]),
        H5_ORIGIN + '/',
        H5_ORIGIN
      );
      const items = extractH5Items(response);
      items.forEach(function (item) {
        const id = subjectIdOf(item);
        const route = h5RouteFromItem(item);
        const key = String(id || '') + '|' + String(route && route.detailPath || '');
        if (id && route && !seen.has(key)) {
          seen.add(key);
          pooled.push(item);
        }
      });
    } catch (error) {
      console.log('[' + PROVIDER_NAME + '] busca Web Player falhou: ' + (error.message || error));
    }

  }

  return pooled;
}

let currentH5Meta = null;
let currentH5MediaType = 'movie';
let currentH5Titles = [];

async function playH5Subject(subject, meta, mediaType, season, episode) {
  const route = h5RouteFromItem(subject);
  if (!route) return [];

  const subjectId = String(subjectIdOf(subject));
  const referer = route.origin + '/movies/' + encodeURIComponent(route.detailPath) +
    '?id=' + encodeURIComponent(subjectId) + '&type=/movie/detail&detailSe=&detailEp=&lang=en';
  const query = {
    subjectId: subjectId,
    se: String(mediaType === 'movie' ? 0 : season),
    ep: String(mediaType === 'movie' ? 0 : episode),
    detailPath: route.detailPath,
    streamSignType: '1'
  };

  let playData = null;
  try {
    const qs = encodeQuery(query);
    playData = await h5Request(
      route.origin + '/wefeed-h5api-bff/subject/play?' + qs +
        '&supportCodecs%5Bhevc%5D=1&supportCodecs%5Bh264%5D=1',
      'GET',
      null,
      referer,
      route.origin
    );
  } catch (error) {
    console.log('[' + PROVIDER_NAME + '] reprodução Web Player falhou: ' + (error.message || error));
  }

  let streams = collectH5Streams(playData);
  if (!streams.length) {
    // Some H5 deployments require the detail endpoint to establish a page session.
    try {
      await h5Request(
        route.origin + '/wefeed-h5api-bff/detail?detailPath=' + encodeURIComponent(route.detailPath),
        'GET',
        null,
        route.origin + '/',
        route.origin
      );
      const qs = encodeQuery(query);
      playData = await h5Request(
        route.origin + '/wefeed-h5api-bff/subject/play?' + qs +
          '&supportCodecs%5Bhevc%5D=1&supportCodecs%5Bh264%5D=1',
        'GET',
        null,
        referer,
        route.origin
      );
      streams = collectH5Streams(playData);
    } catch (_) {}
  }

  const candidateLanguage = subject.language || subject.lanName || subject.lang ||
    subject.audioLanguage || subject.audio_language || subject.dubName || subject.dub_name || '';
  const isOriginal = /^(original|original audio)$/i.test(String(candidateLanguage || '').trim());
  const variant = {
    id: subjectId,
    language: candidateLanguage,
    isOriginal: isOriginal
  };
  const results = streams.map(function (stream) {
    return buildResult(
      stream,
      variant,
      null,
      meta,
      mediaType,
      season,
      episode,
      'h5',
      { origin: route.origin, detailPath: route.detailPath, subjectId: subjectId },
      []
    );
  }).filter(Boolean);

  return results;
}

async function getH5Streams(meta, mediaType, season, episode, titles) {
  currentH5Meta = meta;
  currentH5MediaType = mediaType;
  currentH5Titles = titles;

  await bootstrapH5Token();
  const pooled = [];
  const queries = titles;

  for (let i = 0; i < queries.length; i++) {
    const items = await h5Search(queries[i], mediaType);
    items.forEach(function (item) {
      if (h5Matches(item, meta, mediaType, titles)) pooled.push(item);
    });
  }

  const subjects = [];
  const seen = new Set();
  pooled.forEach(function (item) {
    const id = String(subjectIdOf(item) || '');
    const route = h5RouteFromItem(item);
    const key = id + '|' + String(route && route.detailPath || '');
    if (id && route && !seen.has(key)) {
      seen.add(key);
      subjects.push(item);
    }
  });

  if (!subjects.length) return [];
  const selected = subjects;
  const groups = await Promise.all(selected.map(function (subject) {
    return playH5Subject(subject, meta, mediaType, season, episode)
      .catch(function (error) {
        console.log('[' + PROVIDER_NAME + '] falha ao resolver resultado Web: ' + (error.message || error));
        return [];
      });
  }));

  return groups.flat();
}

function resultLanguagePriority(result) {
  const value = String(result && (result.name || '') || '');
  if (/original|áudio original/i.test(value)) return 0;
  if (/portugu[eê]s|portuguese/i.test(value)) return 1;
  if (/espanhol|spanish/i.test(value)) return 2;
  return 3;
}

function streamDedupeKey(stream) {
  const headers = stream.headers || {};
  return [
    stream.url,
    stream.language || '',
    stream.quality || '',
    headers.Cookie || headers['X-MB-Token'] || ''
  ].join('|');
}

function dedupeResults(results) {
  const output = [];
  const seen = new Set();
  results.forEach(function (result) {
    if (!result || !result.url) return;
    const key = streamDedupeKey(result);
    if (!seen.has(key)) {
      seen.add(key);
      output.push(result);
    }
  });
  return output;
}

async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  try {
    const type = String(mediaType || 'movie').toLowerCase() === 'movie' ? 'movie' : 'tv';
    const season = type === 'tv' ? Math.max(1, Number(seasonNum) || 1) : 0;
    const episode = type === 'tv' ? Math.max(1, Number(episodeNum) || 1) : 0;
    const meta = await fetchTmdbDetails(tmdbId, type);
    if (!meta) return [];

    const titles = titleVariants(meta, type);
    if (!titles.length) return [];

    captionCache.clear();

    // Query both fronts: the app API often has regional dubs that the H5
    // catalogue does not expose, while H5 can still resolve playback when
    // the mobile gateway or one of its signed hosts refuses the request.
    const results = await Promise.all([
      getMobileStreams(meta, type, season, episode, titles).catch(function (error) {
        console.log('[' + PROVIDER_NAME + '] fluxo móvel falhou: ' + (error.message || error));
        return [];
      }),
      getH5Streams(meta, type, season, episode, titles).catch(function (error) {
        console.log('[' + PROVIDER_NAME + '] fluxo Web Player falhou: ' + (error.message || error));
        return [];
      })
    ]);

    const merged = dedupeResults(results[0].concat(results[1]));
    merged.sort(function (a, b) {
      const qualityDifference = qualityRank(b.quality) - qualityRank(a.quality);
      if (qualityDifference) return qualityDifference;
      return resultLanguagePriority(a) - resultLanguagePriority(b);
    });

    return merged.slice(0, 100);
  } catch (error) {
    console.log('[' + PROVIDER_NAME + '] ' + (error.message || error));
    return [];
  }
}

module.exports = { getStreams };
