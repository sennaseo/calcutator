/**
 * 생활 기록(앉은 시간·출퇴근·물·수면) 저장 + 계산. 화면 없는 순수 로직은 여기, 그리기는 screens/Life.js.
 *
 * 저장 키
 *   'life:YYYY-MM-DD' = {sitMin, sitStart?: ms, commute: [{id, dir:'to'|'from', start, end?, mode?}], water, sleep?: {bed, wake, min}}
 *   'life:prefs'      = {waterGoal, cupMl, commuteMode}
 * 타이머는 시작 시각(ms)만 저장하고 경과는 Date.now()로 계산 -- 앱을 껐다 켜도 이어진다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {dayKey, shiftDay} from '../store';

export const MODES = ['대중교통', '자가용', '도보', '자전거'];
export const DEFAULT_PREFS = {waterGoal: 8, cupMl: 250, commuteMode: '대중교통'};
const DAY_MIN = 1440;
const MIN = 60000;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const KEY = d => `life:${d}`;
const PREFS = 'life:prefs';

// ---- 형식 ----

/** 310 -> '5시간 10분', 45 -> '45분', 120 -> '2시간' */
export function fmtMin(m) {
  const v = Math.max(0, Math.round(Number(m) || 0));
  if (v < 60) return `${v}분`;
  return `${Math.floor(v / 60)}시간${v % 60 ? ` ${v % 60}분` : ''}`;
}

/** 경과 ms -> '12:05' 또는 '1:02:05' */
export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = n => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  return h ? `${h}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}` : `${Math.floor(s / 60)}:${p(s % 60)}`;
}

export const hm2min = hm => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
export const min2hm = m => {
  const v = ((Math.round(m) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};
/** '23:30' + 40분 -> '00:10' (자정 넘으면 돈다) */
export const shiftHM = (hm, delta) => min2hm(hm2min(hm) + delta);

/** 잠든 시각 -> 깬 시각 분. 자정을 넘기면 다음 날로 본다. sleepMin('23:30','07:00') = 450 */
export const sleepMin = (bed, wake) => (hm2min(wake) - hm2min(bed) + DAY_MIN) % DAY_MIN;

/** 0~13시 시작 = 출근, 14시~ = 퇴근 */
export const dirByHour = h => (h < 14 ? 'to' : 'from');
export const DIR = {to: '출근', from: '퇴근'};

// ---- 정리(깨진 저장값에도 안 죽게) ----

const int = (v, max) => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) && x > 0 ? Math.min(x, max) : 0;
};

export const emptyDay = () => ({sitMin: 0, commute: [], water: 0});

export function clean(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const d = {
    sitMin: int(o.sitMin, DAY_MIN),
    commute: (Array.isArray(o.commute) ? o.commute : [])
      .filter(t => t && Number(t.start) > 0)
      .map(t => {
        const trip = {id: String(t.id ?? t.start), dir: t.dir === 'from' ? 'from' : 'to', start: Number(t.start)};
        if (Number(t.end) >= trip.start) trip.end = Number(t.end);
        if (MODES.includes(t.mode)) trip.mode = t.mode;
        return trip;
      }),
    water: int(o.water, 99),
  };
  if (Number(o.sitStart) > 0) d.sitStart = Number(o.sitStart);
  const s = o.sleep;
  if (s && HM.test(s.bed) && HM.test(s.wake)) d.sleep = {bed: s.bed, wake: s.wake, min: sleepMin(s.bed, s.wake)};
  return d;
}

export function cleanPrefs(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  return {
    waterGoal: int(o.waterGoal, 30) || DEFAULT_PREFS.waterGoal,
    cupMl: int(o.cupMl, 2000) || DEFAULT_PREFS.cupMl,
    commuteMode: MODES.includes(o.commuteMode) ? o.commuteMode : DEFAULT_PREFS.commuteMode,
  };
}

export const isEmpty = d => !d.sitMin && !d.sitStart && !d.commute.length && !d.water && !d.sleep;

// ---- 저장 ----

export async function loadLife(day) {
  try {
    const raw = await AsyncStorage.getItem(KEY(day));
    return clean(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyDay();
  }
}

export async function saveLife(day, d) {
  try {
    await AsyncStorage.setItem(KEY(day), JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export async function loadPrefs() {
  try {
    return cleanPrefs(JSON.parse((await AsyncStorage.getItem(PREFS)) || 'null'));
  } catch {
    return cleanPrefs(null);
  }
}

export async function savePrefs(p) {
  try {
    await AsyncStorage.setItem(PREFS, JSON.stringify(cleanPrefs(p)));
    return true;
  } catch {
    return false;
  }
}

// 읽고-고치고-쓰기를 한 줄로 세운다 -- 화면 버튼과 + 시트 빠른 기록이 겹쳐도 덮어쓰지 않게
let chain = Promise.resolve();
/** fn(그 날 기록) => 새 기록. 저장한 새 기록을 돌려준다. */
export function update(day, fn) {
  const run = chain.then(async () => {
    const next = clean(fn(await loadLife(day)));
    await saveLife(day, next);
    return next;
  });
  chain = run.catch(() => {});
  return run;
}

// ---- 앉은 시간 ----

const elapsedMin = (start, now) => Math.max(0, Math.round((now - start) / MIN));

/** 기록된 분 + 재고 있는 타이머 경과(하루 1440분까지) */
export const sitTotal = (d, now) => Math.min(DAY_MIN, d.sitMin + (d.sitStart ? elapsedMin(d.sitStart, now) : 0));

/** 타이머 시작/멈춤. 멈추면 경과 분을 sitMin에 더한다. */
export function toggleSit(d, now) {
  if (!d.sitStart) return {...d, sitStart: now};
  const {sitStart, ...rest} = d;
  return {...rest, sitMin: sitTotal(d, now)};
}

/** ±분 직접 조정(0~1440) */
export const addSit = (d, delta) => ({...d, sitMin: Math.max(0, Math.min(DAY_MIN, d.sitMin + delta))});

// ---- 출퇴근 ----

export const startTrip = (d, {dir, mode, now}) => ({
  ...d,
  commute: [...d.commute, {id: String(now), dir, start: now, ...(mode ? {mode} : {})}],
});
export const endTrip = (d, id, now) => ({
  ...d,
  commute: d.commute.map(t => (t.id === id && !t.end ? {...t, end: Math.max(now, t.start)} : t)),
});
export const patchTrip = (d, id, patch) => ({...d, commute: d.commute.map(t => (t.id === id ? {...t, ...patch} : t))});
export const removeTrip = (d, id) => ({...d, commute: d.commute.filter(t => t.id !== id)});

/** 걸린 분. 아직 도착 안 했으면 지금까지. */
export const tripMin = (t, now) => elapsedMin(t.start, t.end ?? now);

/** 하루 합계 {total, to, from} (분) */
export function commuteSummary(trips, now) {
  const s = {total: 0, to: 0, from: 0};
  trips.forEach(t => {
    const m = tripMin(t, now);
    s.total += m;
    s[t.dir] += m;
  });
  return s;
}

// ---- 여러 날 ----

/** day로 끝나는 7일 [{day, d}] (오래된 날 먼저) */
export async function loadWeek(day) {
  const days = Array.from({length: 7}, (_, i) => shiftDay(day, i - 6));
  const ds = await Promise.all(days.map(loadLife));
  return days.map((k, i) => ({day: k, d: ds[i]}));
}

const avg = xs => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** 기록 있는 날만의 평균 앉은 분(없으면 null) */
export const sitAvg = (week, now) => avg(week.map(w => sitTotal(w.d, now)).filter(m => m > 0));

/** 도착까지 끝난 이동만의 방향별 평균 분 {to, from} (없으면 null) */
export function tripAvg(week) {
  const done = week.flatMap(w => w.d.commute).filter(t => t.end);
  const of = dir => avg(done.filter(t => t.dir === dir).map(t => tripMin(t)));
  return {to: of('to'), from: of('from')};
}

/**
 * 오늘 돌고 있는 타이머 찾기(오늘·어제 기록).
 * ponytail: 자정을 넘긴 타이머는 시작한 날 기록에 남는다 -- 멈추면 경과 전부가 시작한 날로 간다(하루 1440분 상한).
 * 이틀 넘게 켜 둔 타이머는 못 찾는다; 필요해지면 'life:running' 포인터 키를 둔다.
 */
export async function findRunning(today = dayKey()) {
  const days = [today, shiftDay(today, -1)];
  const ds = await Promise.all(days.map(loadLife));
  const i = ds.findIndex(d => d.sitStart);
  const j = ds.findIndex(d => d.commute.some(t => !t.end));
  return {
    sit: i >= 0 ? {day: days[i], start: ds[i].sitStart} : null,
    trip: j >= 0 ? {day: days[j], trip: ds[j].commute.find(t => !t.end)} : null,
  };
}

/** 앉기 타이머 토글(오늘 기준). {started: true} | {started: false, added: 분} */
export async function toggleSitNow(today = dayKey(), now = Date.now()) {
  const r = await findRunning(today);
  if (!r.sit) {
    await update(today, d => toggleSit(d, now));
    return {started: true};
  }
  let added = 0;
  await update(r.sit.day, d => {
    const next = toggleSit(d, now);
    added = next.sitMin - d.sitMin;
    return next;
  });
  return {started: false, added};
}

/** 출퇴근 토글: 돌고 있으면 도착, 아니면 시작(dir 없으면 시각으로). {started: trip} | {ended: trip, min} */
export async function toggleTripNow(today = dayKey(), {dir, mode} = {}, now = Date.now()) {
  const r = await findRunning(today);
  if (r.trip) {
    const d = await update(r.trip.day, x => endTrip(x, r.trip.trip.id, now));
    const t = d.commute.find(x => x.id === r.trip.trip.id);
    return {ended: t, min: tripMin(t)};
  }
  const m = mode || (await loadPrefs()).commuteMode;
  const d = await update(today, x => startTrip(x, {dir: dir || dirByHour(new Date(now).getHours()), mode: m, now}));
  return {started: d.commute[d.commute.length - 1]};
}

// ---- 오늘 화면 요약(registry 계약) ----

export function lifeSummary(d, prefs, now) {
  if (isEmpty(d)) return null;
  const sit = sitTotal(d, now);
  const com = commuteSummary(d.commute, now).total;
  const rows = [
    {icon: 'chair', label: '앉은 시간', short: '앉은', value: sit || d.sitStart ? fmtMin(sit) : '—'},
    {icon: 'bus', label: '출퇴근', short: '출퇴근', value: d.commute.length ? fmtMin(com) : '—'},
    {icon: 'drop', label: '물', short: '물', value: d.water ? `${d.water}/${prefs.waterGoal}잔` : '—'},
    {icon: 'moon', label: '수면', short: '수면', value: d.sleep ? fmtMin(d.sleep.min) : '—'},
  ];
  const lead = rows.find(r => r.value !== '—');
  // 타이머가 돌고 있으면 숫자가 0분이어도 '앉는 중'이 먼저 보이게
  return {
    title: '생활',
    value: d.sitStart ? `앉는 중 · ${fmtMin(sit)}` : `${lead.short} ${lead.value}`,
    rows: rows.map(({icon, label, value}) => ({icon, label, value})),
  };
}
