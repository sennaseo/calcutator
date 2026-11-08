/**
 * 식약처 공공데이터 API (공공데이터포털)
 * - e약은요(일반의약품): DrbEasyDrugInfoService/getDrbEasyDrugList
 * - 건강기능식품정보:   HtfsInfoService03/getHtfsItem01
 * 응답이 JSON이 아닐 수 있다(키 오류는 XML) → text로 받아 '{'일 때만 JSON.parse.
 * 파싱은 전부 순수 함수로 export(테스트는 fetch 목으로).
 */
import {DRUG_API_KEY, SUPPLEMENT_API_KEY} from '../secrets';

const BASE = 'https://apis.data.go.kr/1471000/';
export const URLS = {
  drug: BASE + 'DrbEasyDrugInfoService/getDrbEasyDrugList',
  supplement: BASE + 'HtfsInfoService03/getHtfsItem01',
};
const KEYS = {drug: DRUG_API_KEY, supplement: SUPPLEMENT_API_KEY};
export const hasKey = api => !!KEYS[api];

export const SOURCE_LINE = '출처: 식품의약품안전처 (공공데이터포털)';

// ---- 순수 파싱 ----

/** HTML 태그·엔티티 제거, 줄바꿈은 살리고 공백 정리. 문자열이 아니면 '' */
export function clean(s) {
  if (s == null || typeof s === 'object') return '';
  return String(s)
    .replace(/<br\s*\/?>|<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const tag = (xml, name) => (xml.match(new RegExp(`<${name}>([^<]*)</${name}>`)) || [])[1] || '';

/** 공공데이터포털 오류 코드 → 쉬운 말 */
export function errorText(code = '', msg = '') {
  const s = `${code} ${msg}`;
  if (/NOT_REGISTERED/.test(s)) return '인증키가 아직 등록 전이에요. 발급 뒤 최대 1시간 걸릴 수 있어요.';
  if (/LIMITED/.test(s) || code === '22') return '오늘 검색 한도를 넘었어요. 내일 다시 해 주세요.';
  if (/KEY|AUTH/i.test(s) || ['30', '31', '32', '33'].includes(code)) return '인증키 오류예요. 키를 확인해 주세요.';
  return '정보를 불러오지 못했어요. 잠시 후 다시 해 주세요.';
}

const toArr = v => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : []);

/**
 * 응답 본문(text) → {ok:true, items, total} | {ok:false, error}
 * items 모양: [..] / {..} / {item: [..]} / [{item: {..}}] 모두 받는다.
 */
export function parseResponse(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('{')) {
    const code = tag(t, 'returnReasonCode') || tag(t, 'resultCode');
    const msg = tag(t, 'returnAuthMsg') || tag(t, 'errMsg') || tag(t, 'resultMsg') || t.slice(0, 80);
    return {ok: false, error: errorText(code, msg)};
  }
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    return {ok: false, error: errorText()};
  }
  const header = j.header ?? j.response?.header;
  const body = j.body ?? j.response?.body;
  if (header && header.resultCode != null && String(header.resultCode) !== '00') {
    return {ok: false, error: errorText(String(header.resultCode), header.resultMsg)};
  }
  if (!body) return {ok: false, error: errorText()};
  let items = body.items;
  if (items && !Array.isArray(items) && items.item) items = items.item;
  const list = toArr(items)
    .map(x => (x && x.item ? x.item : x))
    .filter(x => x && typeof x === 'object');
  return {ok: true, items: list, total: Number(body.totalCount) || list.length};
}

/** 원본 한 건 → 모든 문자열 필드를 clean한 객체 */
const cleanAll = raw => {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const c = clean(v);
    if (c) out[k] = c;
  }
  return out;
};

/** 검색 결과 한 건 → {api, id, name, company, raw} */
export function normalize(api, raw) {
  const r = cleanAll(raw);
  return api === 'drug'
    ? {api, id: r.itemSeq || '', name: r.itemName || '', company: r.entpName || '', raw: r}
    : {api, id: r.STTEMNT_NO || '', name: r.PRDUCT || '', company: r.ENTRPS || '', raw: r};
}

export const DRUG_FIELDS = [
  ['efcyQesitm', '효능'],
  ['useMethodQesitm', '사용법'],
  ['atpnWarnQesitm', '주의사항 경고'],
  ['atpnQesitm', '주의사항'],
  ['intrcQesitm', '상호작용'],
  ['seQesitm', '부작용'],
  ['depositMethodQesitm', '보관법'],
];
// 실호출 확인(2026-11-05) 필드: ENTRPS,PRDUCT,STTEMNT_NO,REGIST_DT,DISTB_PD,SUNGSANG,SRV_USE,PRSRV_PD,INTAKE_HINT1,MAIN_FNCTN,BASE_STANDARD
export const SUPP_FIELDS = [
  ['MAIN_FNCTN', '주된 기능성'],
  ['SRV_USE', '섭취 방법'],
  ['INTAKE_HINT1', '섭취 시 주의사항'],
  ['PRSRV_PD', '보관 방법'],
];
// 나머지는 '기타 정보'로. 모르는 키는 그대로 보여 준다.
const SUPP_EXTRA_LABELS = {
  BASE_STANDARD: '기준·규격',
  DISTB_PD: '유통기한',
  SUNGSANG: '성상',
  PRDT_SHAP_CD_NM: '제품 형태',
};
// 화면 맨 위에 따로 쓰거나 보여 줄 필요 없는 필드
const SKIP = new Set(['PRDUCT', 'ENTRPS', 'STTEMNT_NO', 'REGIST_DT', 'LAST_UPDT_DTM', 'itemName', 'entpName', 'itemSeq', 'itemImage', 'updateDe', 'openDe', 'bizrno']);

/** 'INTAKE_HINT1' 같은 모르는 키 → 'Intake hint1' */
export const humanize = k => SUPP_EXTRA_LABELS[k] || k.toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/**
 * 정보 화면 섹션 [{key, label, text, extra?}]. 빈 필드는 뺀다.
 * 영양제는 알려진 두 필드 뒤에 나머지 문자열 필드를 '기타 정보'(extra:true)로.
 */
export function infoSections(api, raw = {}) {
  const known = api === 'drug' ? DRUG_FIELDS : SUPP_FIELDS;
  const out = known.filter(([k]) => raw[k]).map(([key, label]) => ({key, label, text: raw[key]}));
  if (api !== 'drug') {
    const used = new Set(known.map(([k]) => k));
    for (const [key, text] of Object.entries(raw)) {
      if (used.has(key) || SKIP.has(key) || typeof text !== 'string' || !text) continue;
      out.push({key, label: humanize(key), text, extra: true});
    }
  }
  return out;
}

/** 'YYYYMMDD' 또는 'YYYY-MM-DD…' → 'YYYY.MM.DD' */
export function fmtDate(s = '') {
  const d = String(s).replace(/\D/g, '');
  return d.length >= 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : '';
}

/** 원본에서 갱신일 */
export const updatedOf = (api, raw = {}) => fmtDate(api === 'drug' ? raw.updateDe || raw.openDe : raw.LAST_UPDT_DTM || raw.REGIST_DT);

// ---- 요청 ----

/** 디코딩 키 기준. 인코딩 키(%xx)를 넣어도 두 번 인코딩되지 않게 한 번 풀어 준다. */
const encKey = k => {
  try {
    return encodeURIComponent(k.includes('%') ? decodeURIComponent(k) : k);
  } catch {
    return encodeURIComponent(k);
  }
};

/**
 * 한 번 요청 → {items, total}. 실패하면 한국어 메시지로 throw.
 * @param {'drug'|'supplement'} api
 * @param {Record<string, string|number>} params
 * @param {{key?: string, fetchImpl?: typeof fetch, timeout?: number}} [opt]
 */
export async function request(api, params, opt = {}) {
  const key = opt.key ?? KEYS[api];
  if (!key) throw new Error('정보 검색 키가 설정되지 않았어요');
  const f = opt.fetchImpl || fetch;
  const qs = Object.entries({type: 'json', pageNo: 1, numOfRows: 20, ...params})
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opt.timeout ?? 8000);
  let text;
  let status = 200;
  try {
    const res = await f(`${URLS[api]}?serviceKey=${encKey(key)}&${qs}`, {signal: ctrl.signal});
    status = res.status;
    text = await res.text();
  } catch (e) {
    throw new Error(e && e.name === 'AbortError' ? '응답이 늦어요. 네트워크를 확인해 주세요' : '네트워크를 확인해 주세요');
  } finally {
    clearTimeout(timer);
  }
  const r = parseResponse(text);
  if (!r.ok) throw new Error(status === 401 || status === 403 ? errorText('KEY') : r.error);
  return r;
}

/** 일반의약품 이름 검색 */
export async function searchDrugs(q, opt) {
  const r = await request('drug', {itemName: q.trim()}, opt);
  return r.items.map(x => normalize('drug', x)).filter(x => x.name);
}

/** 건강기능식품 제품명 검색. 실호출 확인(2026-11-05): Prduct만 필터로 먹고, PRDUCT는 무시돼 전체(4만여 건)가 온다. */
export async function searchSupplements(q, opt) {
  const query = q.trim();
  const r = await request('supplement', {Prduct: query}, opt);
  return r.items.map(x => normalize('supplement', x)).filter(x => x.name);
}

/**
 * 저장된 항목의 상세(원본)를 다시 받는다: 이름으로 찾고 id가 같은 것(없으면 이름이 같은 것).
 * @returns {Promise<Record<string,string>|null>}
 */
export async function fetchDetail(source, name, opt) {
  const list = source.api === 'drug' ? await searchDrugs(name, opt) : await searchSupplements(name, opt);
  const hit = list.find(x => source.id && x.id === source.id) || list.find(x => x.name === name);
  return hit ? hit.raw : null;
}
