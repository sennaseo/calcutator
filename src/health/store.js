/**
 * 건강(영양제·약) 저장과 계산. 화면 없이 테스트할 수 있게 순수 함수 위주.
 *
 * 저장 키
 *   'health:items'      내 목록 [{id, kind:'supplement'|'medicine', name, dose, slots, memo?, info?, source?, active}]
 *   'health:YYYY-MM-DD' 그날 체크 {[itemId]: {[slot]: takenAtMs}, extra: [{name, kind, at, dose}]}
 * 목록은 날짜와 상관없이 하나(지난 날도 지금 목록 기준으로 보여 준다).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SLOTS = [
  {key: 'morning', label: '아침', icon: 'sun'},
  {key: 'noon', label: '점심', icon: 'sun'},
  {key: 'evening', label: '저녁', icon: 'moon'},
  {key: 'bedtime', label: '자기 전', icon: 'moon'},
];
const SLOT_KEYS = SLOTS.map(s => s.key);
export const slotLabel = k => SLOTS.find(s => s.key === k)?.label || '';
export const KIND_LABEL = {supplement: '영양제', medicine: '약'};

/** 시각으로 지금 끼니: 11시 전 아침, 15시 전 점심, 20시 전 저녁, 그 뒤 자기 전 */
export const slotOf = (h = new Date().getHours()) => (h < 11 ? 'morning' : h < 15 ? 'noon' : h < 20 ? 'evening' : 'bedtime');

const ITEMS = 'health:items';
const DAY = d => `health:${d}`;

// ---- 정리(깨진 저장본 방어) ----

/** 저장본 → 쓸 수 있는 항목만. id 없거나 겹치면 새로 매긴다. */
export function normItems(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object' || typeof x.name !== 'string' || !x.name.trim()) continue;
    let id = typeof x.id === 'string' && x.id ? x.id : '';
    while (!id || seen.has(id)) id = newId(out);
    seen.add(id);
    out.push({
      ...x,
      id,
      kind: x.kind === 'medicine' ? 'medicine' : 'supplement',
      dose: typeof x.dose === 'string' ? x.dose : '',
      slots: Array.isArray(x.slots) ? SLOT_KEYS.filter(k => x.slots.includes(k)) : [],
      active: x.active !== false,
    });
  }
  return out;
}

/** 저장본 → {[id]: {[slot]: ms}, extra: [...]} */
export function normDose(raw) {
  const out = {extra: []};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'extra') {
      if (Array.isArray(v)) out.extra = v.filter(e => e && typeof e.name === 'string' && Number(e.at));
    } else if (v && typeof v === 'object') {
      const slots = {};
      for (const s of SLOT_KEYS) if (Number(v[s])) slots[s] = Number(v[s]);
      if (Object.keys(slots).length) out[k] = slots;
    }
  }
  return out;
}

// ---- 저장 ----

async function read(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // 깨진 JSON도 빈 것으로
  }
}
async function write(key, v) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

export const loadItems = async () => normItems(await read(ITEMS));
export const saveItems = list => write(ITEMS, list);
export const loadDose = async day => normDose(await read(DAY(day)));
export const saveDose = (day, dose) => write(DAY(day), dose);

// ---- 목록 ----

let seq = 0;
/** 목록 안에서 겹치지 않는 id */
export function newId(list = []) {
  let id;
  do id = `h${Date.now().toString(36)}${(seq++).toString(36)}`;
  while (list.some(x => x.id === id));
  return id;
}

/** id가 있으면 그 자리 교체, 없으면 새 id로 끝에 추가 */
export function upsertItem(list, item) {
  if (item.id && list.some(x => x.id === item.id)) return list.map(x => (x.id === item.id ? {...x, ...item} : x));
  return [...list, {active: true, ...item, id: newId(list)}];
}
export const removeItem = (list, id) => list.filter(x => x.id !== id);

// ---- 하루 체크 ----

export const isTaken = (dose, id, slot) => !!dose[id]?.[slot];

/** 먹음 ↔ 안 먹음 */
export function toggleDose(dose, id, slot, now = Date.now()) {
  const cur = {...(dose[id] || {})};
  if (cur[slot]) delete cur[slot];
  else cur[slot] = now;
  const next = {...dose, extra: dose.extra || []};
  if (Object.keys(cur).length) next[id] = cur;
  else delete next[id];
  return next;
}

export const addExtra = (dose, e, now = Date.now()) => ({...dose, extra: [...(dose.extra || []), {...e, at: now}]});
export const removeExtra = (dose, at) => ({...dose, extra: (dose.extra || []).filter(e => e.at !== at)});

/** 계획된 칸들 [{item, slot}] (쓰는 항목 × 고른 시간) */
export const planned = items => items.filter(i => i.active !== false).flatMap(item => item.slots.map(slot => ({item, slot})));

/** {planned, taken, left: {[slot]: n}} -- 목록에서 빠진 칸의 옛 체크는 세지 않는다 */
export function countDay(items, dose) {
  const left = {};
  let taken = 0;
  const all = planned(items);
  for (const {item, slot} of all) {
    if (isTaken(dose, item.id, slot)) taken++;
    else left[slot] = (left[slot] || 0) + 1;
  }
  return {planned: all.length, taken, left};
}

/**
 * 오늘 화면 카드(registry Summary). 계획도 한 번 복용도 없으면 null.
 * 남은 게 있으면 지금 끼니부터 순서대로 먼저 남은 칸을 알려 준다.
 */
export function buildSummary(items, dose, hour = new Date().getHours()) {
  const c = countDay(items, dose);
  const extra = (dose.extra || []).length;
  if (!c.planned && !extra) return null;
  const extraTx = extra ? `한 번 복용 ${extra}번` : '';
  if (!c.planned) return {title: '영양제·약', value: `${extra}번`, sub: extraTx};
  let sub;
  if (c.taken >= c.planned) sub = '오늘 다 챙겼어요';
  else {
    const i = SLOT_KEYS.indexOf(slotOf(hour));
    const order = [...SLOT_KEYS.slice(i), ...SLOT_KEYS.slice(0, i)];
    const s = order.find(k => c.left[k]);
    sub = `${slotLabel(s)} ${c.left[s]}개 남음`;
  }
  return {
    title: '영양제·약',
    value: `${c.taken} / ${c.planned}`,
    sub: extraTx ? `${sub} · ${extraTx}` : sub,
    progress: c.taken / c.planned,
  };
}
