/**
 * 가계부: 지출 기록 · 나갈 예정 · 예산/잔고 설정 저장 + 계산. 그리기는 screens/Budget.js.
 *
 * 저장 키
 *   'budget:tx'       = Tx[]    {id, at, day, amount, cat, memo} 지출 기록(전 기간 한 덩어리)
 *   'budget:plan'     = Plan[]  {id, amount, cat, memo, day(다음 지급 예정일), every?: 'month', dom?: 1..31} 미지급만
 *   'budget:settings' = {monthly, balance, balanceAt, payday}  monthly 0 = 예산 없음, balanceAt 0 = 잔고 없음
 * ponytail: 전 기간 한 키 — 수천 건 넘으면 'budget:tx:YYYY-MM'로 쪼갠다
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {dayKey} from '../store';

export const CATS = [
  ['식비', '🍚'],
  ['카페·간식', '☕'],
  ['교통', '🚌'],
  ['쇼핑', '🛍️'],
  ['생활', '🧴'],
  ['주거·통신', '🏠'],
  ['의료', '💊'],
  ['문화·여가', '🎬'],
  ['기타', '💳'],
];
export const catEmoji = cat => (CATS.find(([c]) => c === cat) || CATS[CATS.length - 1])[1];
const isCat = cat => CATS.some(([c]) => c === cat);

export const DEFAULT_SETTINGS = {monthly: 0, balance: 0, balanceAt: 0, payday: 25};
const TX = 'budget:tx';
const PLAN = 'budget:plan';
const SETTINGS = 'budget:settings';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const p2 = n => String(n).padStart(2, '0');

// ---- 형식 ----

/** 1235000 -> '1,235,000' (음수 -> '-1,000') */
export const fmtNum = n => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
/** 1235000 -> '1,235,000원' */
export const fmtWon = n => `${fmtNum(n)}원`;
/** 30000 -> '3만원', 1235000 -> '123.5만원', 9500 -> '9,500원'. ponytail: 억 단위 미지원(12,345만원으로 보인다) */
export function fmtWonShort(n) {
  const v = Math.round(Number(n) || 0);
  const a = Math.abs(v);
  if (a < 10000) return fmtWon(v);
  const t = Math.round(a / 1000); // 0.1만 단위로 반올림(19,960 -> 2만)
  return `${v < 0 ? '-' : ''}${fmtNum(Math.floor(t / 10))}${t % 10 ? `.${t % 10}` : ''}만원`;
}

export const monthKey = day => day.slice(0, 7);
/** '2026-11' -> '2026년 11월' */
export const fmtMonth = ym => `${Number(ym.slice(0, 4))}년 ${Number(ym.slice(5, 7))}월`;
export function shiftMonth(ym, delta) {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + delta, 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}
/** m = 1..12 */
export const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
/** ('2026-02', 31) -> '2026-02-28' */
export const clampDom = (ym, dom) => `${ym}-${p2(Math.min(dom, daysInMonth(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)))))}`;
const local = k => new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
/** b - a (일). 로컬 날짜로 — UTC로 자르면 한국 시간 오전에 하루 밀린다. round = 서머타임 23/25시간 날 보정 */
export const daysBetween = (a, b) => Math.round((local(b) - local(a)) / 86400000);

// ---- 월급날·반복 ----

/** today 기준 dom이 다음에 오는 날. inclusive면 오늘이 그 날이면 오늘. 월말은 깎는다(31 -> 2월 28). */
export function nextDom(today, dom, {inclusive = false} = {}) {
  const ym = monthKey(today);
  const here = clampDom(ym, dom);
  const ok = inclusive ? today <= here : today < here;
  return ok ? here : clampDom(shiftMonth(ym, 1), dom);
}
/** 월급날 당일 = 'D-0'(오늘까지), 다음 날부터 다음 달 */
export const nextPayday = (today, payday) => nextDom(today, payday, {inclusive: true});
/** 반복 항목을 지급 처리한 뒤 다음 예정일(오늘보다 뒤 첫 날, 밀린 달은 건너뛴다). 일회성 = null */
export const nextDue = (plan, today) => (plan.every ? nextDom(today, plan.dom, {inclusive: false}) : null);

// ---- 정리(깨진 저장값에도 안 죽게) ----

const posInt = v => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) && x > 0 ? x : 0;
};
const item = o => ({
  amount: posInt(o.amount),
  cat: isCat(o.cat) ? o.cat : '기타',
  memo: typeof o.memo === 'string' ? o.memo.slice(0, 40) : '',
  day: o.day,
});
const okDay = o => o && typeof o === 'object' && DAY.test(o.day) && posInt(o.amount) > 0;

export function cleanTx(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(t => okDay(t) && posInt(t.at) > 0)
    .map(t => ({id: String(t.id ?? t.at), at: posInt(t.at), ...item(t)}));
}

export function cleanPlan(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(p => okDay(p) && posInt(p.id) > 0)
    .map(p => {
      const out = {id: String(p.id), ...item(p)};
      if (p.every === 'month') {
        const dom = posInt(p.dom);
        out.every = 'month';
        out.dom = dom >= 1 && dom <= 31 ? dom : Number(p.day.slice(8));
      }
      return out;
    });
}

export function cleanSettings(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const bal = Math.round(Number(o.balance));
  const pay = Math.round(Number(o.payday));
  return {
    monthly: posInt(o.monthly),
    balance: Number.isFinite(bal) ? bal : 0,
    balanceAt: posInt(o.balanceAt),
    payday: pay >= 1 && pay <= 31 ? pay : DEFAULT_SETTINGS.payday,
  };
}

// ---- 집계 ----

const sum = xs => xs.reduce((a, x) => a + x.amount, 0);

/** 그 달 기록, 최신(at) 순 */
export const monthTx = (tx, ym) => tx.filter(t => monthKey(t.day) === ym).sort((a, b) => b.at - a.at);
export const monthSpent = (tx, ym) => sum(monthTx(tx, ym));

/** [{cat, amount, pct}] 금액 내림차순. 합계 0이면 [] */
export function byCategory(tx, ym) {
  const m = monthTx(tx, ym);
  const total = sum(m);
  if (!total) return [];
  const by = {};
  m.forEach(t => (by[t.cat] = (by[t.cat] || 0) + t.amount));
  return Object.entries(by)
    .map(([cat, amount]) => ({cat, amount, pct: Math.round((amount / total) * 100)}))
    .sort((a, b) => b.amount - a.amount);
}

/** [{day, total, items}] 날짜 내림차순(목록 섹션) */
export function byDay(list) {
  const by = {};
  list.forEach(t => (by[t.day] = by[t.day] || []).push(t));
  return Object.keys(by)
    .sort()
    .reverse()
    .map(day => ({day, total: sum(by[day]), items: by[day]}));
}

/** 전부, day 오름차순(지난 것 포함 — 화면에서 '지났어요') */
export const upcoming = plan => [...plan].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

/** 그 달 말일까지 나갈 예정 합계(지난 달 미지급도 이번 달 부담) */
export const plannedThisMonth = (plan, ym) => sum(plan.filter(p => p.day <= clampDom(ym, 31)));

/** 예산 %의 분자: 쓴 돈 + (이번 달이면) 나갈 예정 */
export const used = (tx, plan, ym, today) => monthSpent(tx, ym) + (ym === monthKey(today) ? plannedThisMonth(plan, ym) : 0);

/** 잔고를 적은 뒤에 기록한 지출만 뺀다(그 전 기록은 이미 반영된 잔고로 본다). 잔고 없음 = null */
export const balanceNow = (settings, tx) =>
  settings.balanceAt ? settings.balance - sum(tx.filter(t => t.at > settings.balanceAt)) : null;

// ---- 위험도 ----

/**
 * add 없이 부르면 현재 상태, add = {amount, day, kind: 'spend'|'plan'}를 주면 "이걸 더하면" 미리보기.
 * ponytail: 80/100/10% 고정 임계값 — 사용자 설정 요구 생기면 settings로
 */
export function assess({settings, tx, plan, today = dayKey(), add}) {
  const ym = monthKey(today);
  const {monthly} = settings;
  const pct = x => Math.round((x / monthly) * 100);
  let budget = null;
  let payday = null;
  if (monthly > 0) {
    const u = used(tx, plan, ym, today);
    // 예정은 그 달 말일까지(지난 날짜 포함), 지출은 이번 달 날짜일 때만 이번 달 %에 든다
    const inMonth = add && (add.kind === 'plan' ? add.day <= clampDom(ym, 31) : monthKey(add.day) === ym);
    const after = u + (inMonth ? add.amount : 0);
    budget = {before: pct(u), after: pct(after), remaining: monthly - after};
  }
  if (settings.balanceAt > 0) {
    const date = nextPayday(today, settings.payday);
    const before = balanceNow(settings, tx) - sum(plan.filter(p => p.day <= date));
    const hits = add && (add.kind === 'spend' || add.day <= date);
    payday = {date, dom: Number(date.slice(8)), days: daysBetween(today, date), before, after: before - (hits ? add.amount : 0)};
  }
  if (!budget && !payday) return {level: null, budget, payday, lines: []};
  let level = 'safe';
  if ((budget && budget.after > 100) || (payday && payday.after < 0)) level = 'danger';
  else if ((budget && budget.after >= 80) || (monthly > 0 && payday && payday.after < monthly * 0.1)) level = 'warn';
  const lines = [];
  if (budget) {
    const r = budget.remaining;
    lines.push(
      `예산 ${add ? `${budget.before}% → ` : ''}${budget.after}% · ${r >= 0 ? `${fmtWonShort(r)} 남음` : `${fmtWonShort(-r)} 초과`}`,
    );
  }
  if (payday) lines.push(`월급날(${payday.dom}일, D-${payday.days})까지 잔고 ${fmtWonShort(payday.after)} 예상`);
  return {level, budget, payday, lines};
}

// ---- 상태 바꾸기(순수) ----

export const addTx = (tx, {amount, cat, memo, day}, now) => [...tx, {id: String(now), at: now, day, amount, cat, memo}];
export const removeTx = (tx, id) => tx.filter(t => t.id !== id);
export const addPlan = (plan, {amount, cat, memo, day, every}, now) => [
  ...plan,
  {id: String(now), amount, cat, memo, day, ...(every === 'month' ? {every, dom: Number(day.slice(8))} : {})},
];
export const removePlan = (plan, id) => plan.filter(p => p.id !== id);

/** 예정 항목을 오늘 지출로. 일회성은 목록에서 빠지고, 반복은 다음 예정일로 넘어간다. -> {plan, tx} */
export function payPlan(plan, tx, id, today, now) {
  const p = plan.find(x => x.id === id);
  if (!p) return {plan, tx};
  return {
    tx: addTx(tx, {amount: p.amount, cat: p.cat, memo: p.memo, day: today}, now),
    plan: p.every ? plan.map(x => (x.id === id ? {...x, day: nextDue(x, today)} : x)) : removePlan(plan, id),
  };
}

// ---- 저장 ----

const load = (key, clean) => async () => {
  try {
    return clean(JSON.parse((await AsyncStorage.getItem(key)) || 'null'));
  } catch {
    return clean(null);
  }
};
const save = (key, clean) => async v => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(clean(v)));
    return true;
  } catch {
    return false;
  }
};
export const loadTx = load(TX, cleanTx);
export const saveTx = save(TX, cleanTx);
export const loadPlan = load(PLAN, cleanPlan);
export const savePlan = save(PLAN, cleanPlan);
export const loadSettings = load(SETTINGS, cleanSettings);
export const saveSettings = save(SETTINGS, cleanSettings);

// 읽고-고치고-쓰기를 한 줄로 세운다 — + 시트와 화면이 겹쳐도 덮어쓰지 않게. 저장 실패면 reject.
let chain = Promise.resolve();
const updater = (ld, sv, clean) => fn => {
  const run = chain.then(async () => {
    const next = clean(fn(await ld()));
    if (!(await sv(next))) throw new Error('저장 실패');
    return next;
  });
  chain = run.catch(() => {});
  return run;
};
export const updateTx = updater(loadTx, saveTx, cleanTx);
export const updatePlan = updater(loadPlan, savePlan, cleanPlan);
