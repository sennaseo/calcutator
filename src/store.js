/**
 * 기록 저장 + 음식 검색.
 *
 * 저장은 AsyncStorage에 날짜별 JSON 한 덩어리씩. 서버·계정 없음.
 * 음식 DB는 foods.json을 require로 번들(15,018건 / 1.4MB) -- SQLite를 쓸 만큼
 * 크지 않아서 메모리 filter로 충분하다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import FOODS from './foods.json';

export {FOODS};

/** 'YYYY-MM-DD' (로컬 시간 기준. toISOString은 UTC라 밤에 날짜가 밀린다) */
export function dayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shiftDay(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

/** '2026-09-18' -> '2026년 9월 18일 (금)' */
export function fmtDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일 (${'일월화수목금토'[new Date(y, m - 1, d).getDay()]})`;
}

/** '2026-09-18' -> '9월 18일' */
export function shortDay(key) {
  const [, m, d] = key.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** ms -> '오후 3:12' */
export function fmtTime(ms) {
  const t = new Date(ms);
  const h = t.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')}`;
}

// 띄어쓰기 뺀 이름. 키 입력마다 15,000번 replace하지 않도록 한 번만 만든다.
const NAMES = FOODS.map(f => f.n.replace(/\s/g, ''));

// 같은 음식의 다른 이름. 검색어에 왼쪽이 있으면 오른쪽으로 바꾼 것도 같이 찾는다.
const ALIAS = {
  달걀: '계란',
  공깃밥: '백미밥',
  공기밥: '백미밥',
  쌀밥: '백미밥',
  소세지: '소시지',
  까페: '카페',
};

// 분류와 썸네일 이모지. 칩 순서 그대로. 사진이 없어서 이모지로 대신한다.
export const CATEGORIES = [
  ['한식', '🍲'],
  ['분식', '🍜'],
  ['카페/음료', '☕'],
  ['빵/디저트', '🍰'],
  ['양식', '🍕'],
  ['과일/채소', '🍎'],
  ['고기/계란', '🍗'],
  ['술', '🍺'],
  ['기타', '🍽️'],
];
const EMOJI = Object.fromEntries(CATEGORIES);

// DB 이름은 대개 "분류_이름"(피자_..., 커피_...)이라 앞머리만 보고 나눈다.
// 위에서부터 처음 걸린 규칙. 어디에도 안 걸리면 한식(나머지 대부분이 국·찌개·나물·볶음).
// 모카빵이 카페로 가지 않게 빵이 카페보다 먼저.
const RULES = [
  ['술', /맥주|소주|막걸리|와인|뱅쇼/],
  ['빵/디저트', /케이크|아이스크림|도넛|와플|빙수|마카롱|크로플|빵|비스킷|쿠키|크래커|크로와상|베이글|페이스트리|파이|만주|머핀|프레즐|허니브레드|츄러스|스콘|카스텔라|타르트|^번$|또띠아|치아바타|초콜릿|캔디|젤리|샤베트|약과|웨이퍼|시리얼|토스트|바게트|팝콘|다식|송편|경단|인절미|절편|백설기|시루떡|가래떡|찹쌀떡|떡강정|요구르트\(호상\)|요거트/],
  ['카페/음료', /커피|스무디|라떼|밀크티|버블티|차$|에이드|주스|아이스티|홍차|코코아|미숫가루|식혜|콤부차|음료|카페|모카|아메리카노|콜라|사이다|^물$|쉐이크|요구르트|우유$/],
  ['양식', /피자|버거|닭튀김|치킨|감자튀김|핫도그|샌드위치|스파게티|스테이크|리소토|그라탕|감바스|함박|오므라이스|크로켓|스프$/],
  ['분식', /떡볶이|김밥|라면|순대|어묵|튀김|만두|우동|쫄면|호떡|주먹밥|칼국수|수제비|국수|비빔면|치즈볼|치즈스틱|떡꼬치/],
  ['과일/채소', /샐러드|과일|견과|바나나|사과|포도|딸기|블루베리|오렌지|귤|수박|토마토|아보카도|양배추|브로콜리|파프리카|^오이$|당근|양상추|대파|^고구마$|^감자$|단호박|^옥수수$|아몬드|호두|땅콩|^배$/],
  ['고기/계란', /닭|돼지|소고기|삼겹살|오겹살|갈비|불고기|계란|달걀|오리|곱창|막창|대창|수육|돈가스|족발|보쌈|햄|소시지|소세지|목살|등심|안심|갈매기살|차돌/],
  ['기타', /초밥|월남쌈|훠궈|팟타이|마라탕|나베|샤브샤브|탄탄면|치즈|소스|드레싱|멘보샤|탕수육|짬뽕|자장|짜장|마파두부|고추잡채|카레|볶음면|라멘|소바|낫토|올리브유|연어|참치캔|새우$|두부$|오트밀|^고등어$/],
];

/** 음식 이름 -> 분류. 직접 입력한 이름에도 그대로 쓴다. */
export function categoryOf(name = '') {
  const i = name.indexOf('_');
  const head = i < 0 ? name : name.slice(0, i);
  const r = RULES.find(([, re]) => re.test(head));
  return r ? r[0] : '한식';
}

// 간식 썸네일용 키워드 우선 규칙(전체 이름 기준, 첫 매치). 없으면 분류 이모지. 카페라떼는 라떼보다 카페가 먼저라 ☕.
const EMOJI_RULES = [
  [/커피|아메리카노|에스프레소|카페/, '☕'],
  [/버블티|밀크티/, '🧋'],
  [/쿠키|비스킷|과자|크래커|스낵|감자칩|초코파이/, '🍪'],
  [/초콜릿/, '🍫'],
  [/사탕|캔디|캐러멜|젤리/, '🍬'],
  [/아이스크림|샤베트|빙수|젤라또/, '🍦'],
  [/콜라|사이다|에이드|탄산|주스/, '🥤'],
  [/우유|라떼|요거트|요구르트/, '🥛'],
  [/견과|아몬드|호두|땅콩/, '🥜'],
  [/찹쌀떡|인절미|송편|경단/, '🍡'],
  [/케이크/, '🍰'],
  [/빵/, '🍞'],
];

export const emojiOf = (name = '') =>
  (EMOJI_RULES.find(([re]) => re.test(name)) || [])[1] || EMOJI[categoryOf(name)];

// 검색마다 15,000번 정규식을 돌리지 않도록 로드할 때 한 번만 나눠 둔다
const CATS = FOODS.map(f => categoryOf(f.n));

const byBasicThenShort = (a, b) => (b.b || 0) - (a.b || 0) || a.n.length - b.n.length;

/**
 * 검색: 기본 음식(b=1)이 항상 위. 그 다음 이름 앞쪽에 걸린 것, 짧은 이름 순.
 * cat을 주면 그 분류 안에서만. 검색어 없이 분류만 고르면 그 분류 목록(기본 음식 먼저).
 */
export function search(query, limit = 40, cat = null) {
  const q = query.trim().replace(/\s/g, '');
  if (!q) {
    if (!cat) return [];
    return FOODS.filter((f, i) => CATS[i] === cat)
      .sort(byBasicThenShort)
      .slice(0, limit);
  }
  const q2 = Object.keys(ALIAS).reduce((s, k) => s.replace(k, ALIAS[k]), q);
  const hits = [];
  FOODS.forEach((f, i) => {
    if (cat && CATS[i] !== cat) return;
    let idx = NAMES[i].indexOf(q);
    if (idx < 0 && q2 !== q) idx = NAMES[i].indexOf(q2);
    if (idx >= 0) hits.push({f, idx});
  });
  hits.sort(
    (a, b) =>
      (b.f.b || 0) - (a.f.b || 0) || a.idx - b.idx || a.f.n.length - b.f.n.length,
  );
  return hits.slice(0, limit).map(h => h.f);
}

/** 100g 기준 kcal과 섭취량(g)으로 실제 칼로리. 표시는 항상 정수. */
export function kcalFor(food, grams) {
  return Math.round((food.k * grams) / 100);
}

/** 100g 기준 탄·단·지(c/p/f)를 섭취량에 맞춰 g 단위로. 소수 첫째 자리까지. */
export function macrosFor(food, grams) {
  const r = v => Math.round(((Number(v) || 0) * grams) / 10) / 10;
  return {c: r(food.c), p: r(food.p), f: r(food.f)};
}

/** 그 음식의 기본 섭취량: 1회분량이 있으면 그걸, 없으면 100g. */
export function defaultGrams(food) {
  return food.w && food.w > 0 ? food.w : 100;
}

/** 목록·상세에 쓰는 분량 글자: 기본 음식은 "1개 (50g)", 나머지는 "기본 170g". */
export function servingText(food) {
  return food.s ? `${food.s} (${food.w}g)` : `기본 ${defaultGrams(food)}g`;
}

const KEY = d => `diet:${d}`;
const GOAL = 'diet:goal';

export async function loadDay(day) {
  try {
    const raw = await AsyncStorage.getItem(KEY(day));
    const list = raw ? JSON.parse(raw) : [];
    // 깨진 항목(null 등)은 버린다 -- 목록 렌더링에서 터지지 않게
    return Array.isArray(list) ? list.filter(it => it && typeof it === 'object') : [];
  } catch {
    return []; // 저장소가 깨져도 앱은 떠야 한다
  }
}

export async function saveDay(day, items) {
  try {
    await AsyncStorage.setItem(KEY(day), JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export async function loadGoal() {
  try {
    const v = Number(await AsyncStorage.getItem(GOAL));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export async function saveGoal(kcal) {
  try {
    await AsyncStorage.setItem(GOAL, String(kcal));
    return true;
  } catch {
    return false;
  }
}

export const total = items =>
  items.reduce((s, it) => s + (Number(it.kcal) || 0), 0);

/**
 * 탄·단·지 합계. 영양 정보가 있는 항목(검색으로 고른 음식)만 더한다.
 * 직접 입력·예전 기록뿐이면 null -- 0g으로 보여주면 거짓말이 되니 줄 자체를 숨긴다.
 */
export function macroSum(items) {
  const m = items.filter(it => typeof it.c === 'number');
  if (!m.length) return null;
  const s = k => Math.round(m.reduce((a, it) => a + (Number(it[k]) || 0), 0) * 10) / 10;
  return {c: s('c'), p: s('p'), f: s('f')};
}

// ---- 간식 클릭 ----

/** 간식 기록인가. kind 없는 옛 기록은 식사로 본다(추론하지 않는다). */
export const isSnack = it => !!it && it.kind === 'snack';

/** 기록 시각(ms). 옛 기록은 at이 없어 id(=Date.now())로 대신한다. */
export const timeOf = it => Number(it.at) || Number(it.id) || 0;

// ponytail: 분류 앞머리만 보는 휴리스틱 -- 틀리면 사용자가 토글로 고친다
const SNACK_CATS = ['빵/디저트', '카페/음료', '과일/채소'];
export const defaultKind = name => (SNACK_CATS.includes(categoryOf(name)) ? 'snack' : 'meal');

/** 토스트 한 줄. 첫 기록과 5의 배수에만(매번 나오면 잔소리). 양·횟수를 평가하지 않는다. */
export const catLine = n =>
  n <= 1 ? '오늘 첫 간식 기록' : n % 5 === 0 ? `오늘 ${n}번째 간식 기록` : '';

/** 칩에 쓰는 짧은 이름: "분류_" 앞머리만 뗀다. */
// 괄호(ICED/HOT 등)는 남긴다 -- 떼면 다른 음식이 같은 칩 이름이 된다. 말줄임은 화면에서.
export function shortName(name = '') {
  return String(name).replace(/^[^_]*_/, '').replace(/_/g, ' ').trim() || String(name);
}

/** 음식 + 섭취량(g) -> 간식 entry. 영양소가 null이면 필드를 생략한다 -- 0g으로 적으면 거짓말이 되니까. */
export function entryOf(food, g) {
  const entry = {name: food.n, kcal: kcalFor(food, g), grams: g};
  const m = macrosFor(food, g);
  ['c', 'p', 'f'].forEach(k => {
    if (food[k] != null) {
      entry[k] = m[k];
    }
  });
  return {...entry, custom: false, kind: 'snack'};
}

// 간식 카탈로그: 처음부터 1개 기준이라 칩 1탭으로 바로 걸린다(piece).
// 브랜드는 라벨 값을 확인할 수 없어 일반명 + 흔한 어림값만. 다르면 걸린 칩을 다시 눌러 고친다.
// 이모지는 emojiOf(name)과 같게 -- 칩과 큰 버튼 그림이 어긋나지 않게.
export const SNACK_CATALOG = [
  ['과자', '감자칩', '한 줌', 80],
  ['과자', '쿠키', '1개', 50],
  ['과자', '초코파이류', '1개', 170],
  ['초콜릿·사탕·젤리', '초콜릿', '1조각', 55],
  ['초콜릿·사탕·젤리', '사탕', '1알', 20],
  ['초콜릿·사탕·젤리', '젤리', '1개', 10],
  ['초콜릿·사탕·젤리', '캐러멜', '1알', 20],
  ['아이스크림', '아이스크림 바', '1개', 150],
  ['음료', '아메리카노', '1잔', 10],
  ['음료', '카페라떼', '1잔', 180],
  ['음료', '탄산음료', '1캔', 140],
  ['빵·떡', '빵', '1개', 250],
  ['빵·떡', '찹쌀떡', '1개', 120],
  ['과일·견과', '바나나', '1개', 110],
  ['과일·견과', '견과', '한 줌', 150],
  ['과일·견과', '요거트', '1개', 100],
].map(([cat, label, unit, kcal]) => {
  const name = `${label} (${unit})`;
  return {cat, label, emoji: emojiOf(name), unit, entry: {name, kcal, kind: 'snack', piece: true}};
});

// ---- 버튼에 건 간식 ----

/** 봉지 전체 kcal ÷ 개수 = 1개 kcal. 개수가 1 미만이면 계산 불가(null). */
export const pieceKcal = (pack, n) => (n >= 1 ? Math.round(pack / n) : null);

/**
 * entry를 1개 기준으로. 봉지 kcal은 제품 라벨 값이라 DB 밀도와 안 맞을 수 있다 --
 * kcal이 그대로면 g·탄단지를 두고, 바뀌면 비율로 늘려 봐야 지어낸 값이니 지운다.
 * piece: 이미 1개 기준이라는 표시(칩 1탭 걸기 판단용).
 */
export function pieceEntry(entry, pack, n) {
  const kcal = pieceKcal(pack, n);
  const out = {...entry, kcal, piece: true};
  if (kcal !== entry.kcal) ['grams', 'c', 'p', 'f'].forEach(k => delete out[k]);
  return out;
}

const CURRENT = 'diet:current';
// ponytail: pack 원값 미저장, 수정 시 pack=kcal,n=1 프리필

export async function loadCurrent() {
  try {
    const c = JSON.parse(await AsyncStorage.getItem(CURRENT));
    // 깨진 값이면 걸린 간식 없음으로 -- 버튼이 엉뚱한 걸 기록하지 않게
    return c && typeof c.name === 'string' && c.name && typeof c.kcal === 'number' ? {...c, kind: 'snack'} : null;
  } catch {
    return null;
  }
}

export async function saveCurrent(entry) {
  try {
    await (entry ? AsyncStorage.setItem(CURRENT, JSON.stringify(entry)) : AsyncStorage.removeItem(CURRENT));
    return true;
  } catch {
    return false;
  }
}

/** 최근 간식 목록에 entry를 맨 앞으로(같은 이름은 제거), max개까지. 입력은 안 건드린다. */
export const mergeRecent = (list, entry, max = 5) =>
  [entry, ...list.filter(e => e.name !== entry.name)].slice(0, max);

const RECENT = 'diet:recent';

export async function loadRecent() {
  try {
    const raw = await AsyncStorage.getItem(RECENT);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(it => it && typeof it === 'object' && typeof it.name === 'string' && it.name) : [];
  } catch {
    return [];
  }
}

export async function saveRecent(list) {
  try {
    await AsyncStorage.setItem(RECENT, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * 빠른 기록 칩: 즐겨찾기(favs, 내 간식 순서) -> 최근 간식 -> 이름이 안 겹치는 카탈로그.
 * 카탈로그를 최근에 먹었으면 카탈로그 라벨 그대로. 즐겨찾기가 최근에도 있으면 최근 entry(탄단지 포함)를 쓴다.
 */
export const quickSnacks = (recent, favs = []) => {
  const top = [
    ...favs.map(f => recent.find(e => e.name === f.name) || mineEntry(f)),
    ...recent.filter(e => !favs.some(f => f.name === e.name)),
  ];
  return [
    ...top.map(e => {
      const p = SNACK_CATALOG.find(x => x.entry.name === e.name);
      return p ? {...p, entry: e} : {label: shortName(e.name), emoji: emojiOf(e.name), entry: e};
    }),
    ...SNACK_CATALOG.filter(p => !top.some(e => e.name === p.entry.name)),
  ];
};

// ---- 내 간식(저장된 간식 모음) ----
// diet:mysnacks = [{name, kcal, piece, emoji, count, lastAt, fav}]
// 최근 간식(diet:recent)은 5개 캐시라 금방 밀려난다 -- 건 적 있거나 먹은 간식은 전부 여기 남긴다.
// 순서는 처음 들어온 순(새 것이 앞). 기록해도 자리를 안 바꾼다 -- 즐겨찾기 칩 순서가 홈에서 흔들리지 않게.

const MINE = 'diet:mysnacks';

/** 내 간식 한 줄 -> 버튼에 걸 수 있는 간식 entry */
export const mineEntry = m => ({name: m.name, kcal: m.kcal, kind: 'snack', ...(m.piece ? {piece: true} : {})});

/**
 * 건 간식·먹은 간식을 모음에 넣는다. 있으면 kcal·piece를 최신값으로(자리는 그대로), 없으면 맨 앞에.
 * ate: 실제로 먹어서 기록했으면 count +1. 입력 배열은 안 건드린다.
 */
export function upsertMine(list, entry, {ate = false, now = Date.now()} = {}) {
  const i = list.findIndex(m => m.name === entry.name);
  const prev = i >= 0 ? list[i] : {name: entry.name, count: 0, fav: false};
  const next = {
    ...prev,
    kcal: Number(entry.kcal) || 0,
    piece: entry.piece === true,
    emoji: emojiOf(entry.name),
    count: prev.count + (ate ? 1 : 0),
    lastAt: now,
  };
  return i >= 0 ? list.map((m, k) => (k === i ? next : m)) : [next, ...list];
}

/** 처음 한 번: 최근 간식으로 모음을 채운다(먹은 횟수는 모르니 0). */
export const seedMine = recent => recent.reduceRight((l, e) => upsertMine(l, e, {now: 0}), []);

export const toggleFav = (list, name) => list.map(m => (m.name === name ? {...m, fav: !m.fav} : m));
export const removeMine = (list, name) => list.filter(m => m.name !== name);
/** 1개 kcal을 손으로 고침 = 이제 1개 기준(piece) */
export const setMineKcal = (list, name, kcal) =>
  list.map(m => (m.name === name ? {...m, kcal: Math.max(0, Math.round(kcal)), piece: true} : m));

/**
 * 내 간식 화면 목록. filter: 'all'(즐겨찾기 먼저, 최근 순) | 'fav' | 'often'(먹은 횟수 많은 순, 0번 제외).
 * q는 띄어쓰기 무시하고 이름에서 찾는다.
 */
export function filterMine(list, q = '', filter = 'all') {
  const k = q.replace(/\s/g, '');
  let out = k ? list.filter(m => m.name.replace(/\s/g, '').includes(k)) : [...list];
  if (filter === 'fav') out = out.filter(m => m.fav);
  if (filter === 'often') return out.filter(m => m.count > 0).sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
  return out.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || b.lastAt - a.lastAt);
}

const validMine = m => m && typeof m === 'object' && typeof m.name === 'string' && m.name && typeof m.kcal === 'number';

/** 저장된 모음. 아직 없으면(첫 실행·업데이트 직후) 최근 간식으로 채워 저장한다. */
export async function loadMine() {
  try {
    const raw = await AsyncStorage.getItem(MINE);
    if (raw == null) {
      const seeded = seedMine(await loadRecent());
      await saveMine(seeded);
      return seeded;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter(validMine).map(m => ({count: 0, fav: false, lastAt: 0, emoji: emojiOf(m.name), ...m}))
      : [];
  } catch {
    return [];
  }
}

export async function saveMine(list) {
  try {
    await AsyncStorage.setItem(MINE, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** 오늘 간식을 이름별로 묶는다. 최근에 먹은 묶음이 위. last = 마지막 기록 시각, items = 그 묶음 기록(최신순). */
export function groupSnacks(items) {
  const m = new Map();
  [...items].filter(isSnack).sort((a, b) => timeOf(b) - timeOf(a)).forEach(it => {
    const g = m.get(it.name) || {name: it.name, n: 0, kcal: 0, last: timeOf(it), items: []};
    g.n += 1;
    g.kcal += Number(it.kcal) || 0;
    g.items.push(it);
    m.set(it.name, g);
  });
  return [...m.values()];
}

/** 마지막 간식부터 지난 시간. 1분 미만 '방금', 1시간 미만 'N분 전', 그 이상 'N시간 M분 전'. */
export function agoText(ms, now = Date.now()) {
  const min = Math.max(0, Math.floor((now - ms) / 60000));
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''} 전`;
}

/** 시간대 이름 + 시작~끝 시각. (16,18) -> '오후 4~6시' */
export function periodLabel(from, to) {
  const part = from < 6 ? '새벽' : from < 12 ? '오전' : from < 18 ? '오후' : '밤';
  const h = v => (v % 12 === 0 && v !== 0 ? 12 : v % 12);
  return `${part} ${from === 0 ? 0 : h(from)}~${h(to)}시`;
}

/** 간식만 모아 횟수·kcal·2시간 버킷 분포·최다 시간대·자주 먹은 Top5. */
export function snackSummary(items) {
  const sn = items.filter(isSnack);
  const byHour = Array(12).fill(0);
  const byName = new Map();
  sn.forEach(it => {
    byHour[Math.floor(new Date(timeOf(it)).getHours() / 2)] += 1;
    const t = byName.get(it.name) || {name: it.name, n: 0, kcal: 0};
    t.n += 1;
    t.kcal += Number(it.kcal) || 0;
    byName.set(it.name, t);
  });
  const max = Math.max(...byHour);
  const at = byHour.indexOf(max); // 동률이면 이른 시간
  return {
    n: sn.length,
    kcal: total(sn),
    byHour,
    peak: max > 0 ? {from: at * 2, to: at * 2 + 2, n: max} : null,
    top: [...byName.values()].sort((a, b) => b.n - a.n || b.kcal - a.kcal).slice(0, 5),
  };
}

/**
 * 통계 탭: today 포함 최근 7일(오래된 날부터). 평균은 기록이 있는 날만으로 낸다 --
 * 안 적은 날을 0kcal로 치면 평균이 엉터리로 낮아진다.
 */
export async function weekStats(today = dayKey()) {
  const keys = Array.from({length: 7}, (_, i) => shiftDay(today, i - 6));
  const lists = await Promise.all(keys.map(loadDay));
  const days = keys.map((day, i) => {
    const sn = lists[i].filter(isSnack);
    return {day, kcal: total(lists[i]), n: lists[i].length, snackN: sn.length, snackKcal: total(sn)};
  });
  const rec = days.filter(d => d.n > 0);
  const avg = rec.length ? Math.round(rec.reduce((s, d) => s + d.kcal, 0) / rec.length) : 0;
  const snack = snackSummary(lists.flat());
  const avgPerDay = rec.length ? Math.round((snack.n / rec.length) * 10) / 10 : 0;
  return {days, recorded: rec.length, avg, snack: {...snack, avgPerDay}};
}

/**
 * Mifflin-St Jeor. 기존 계산기에서 살려온 로직 -- 목표 칼로리 기본값을 채우는
 * 용도로만 남긴다(기존 사용자가 계산기를 잃지 않도록).
 */
export function recommendKcal({sex, age, height, weight, activity = 1.55, cut = 0.8}) {
  const bmr =
    10 * weight + 6.25 * height - 5 * age + (sex === 'female' ? -161 : 5);
  return Math.round(bmr * activity * cut);
}
