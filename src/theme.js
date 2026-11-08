// 앱 컬러/스타일 토큰 (토스식 플랫: 흰 섹션 / 회색 페이지 / 그림자 0 / 라벤더 단일 악센트)
export const C = {
  primary: '#8B7CF6', // 라벤더 (주요 버튼·선택·핵심 숫자만)
  primaryPressed: '#7466E0', // 주요 버튼 눌림
  primaryDark: '#5B4BC4', // 옅은 바탕 위 라벤더 글자
  primaryLight: '#C9C2FA', // 통계 비강조 막대 (Stats만)
  tint: '#EFEDFD', // 라벤더 옅은 바탕 (선택 상태 전용)
  bg: '#F2F4F6', // 페이지 바탕 (회색)
  card: '#FFFFFF', // 섹션·카드·탭바·시트
  fill: '#F2F4F6', // 회색 채움 (보조 버튼·칩·입력칸·썸네일·링 트랙)
  fillPressed: '#E5E8EB', // 회색 채움 눌림
  text: '#191F28',
  sub: '#4E5968',
  faint: '#8B95A1', // 비활성 아이콘·탭 비선택
  hint: '#B0B8C1', // placeholder·극소 글자
  border: '#E5E8EB', // 헤어라인(탭바 위선·구분선·입력 밑줄)
  line: '#E5E8EB', // (별칭 유지)
  soft: '#F2F4F6', // (별칭: 옛 코드 호환 = fill)
  white: '#FFFFFF',
  danger: '#E5484D', // 위험 (채도 낮춤)
  warn: '#D98A1B', // 주의
  safe: '#2BA37E', // 안전 (가계부 예산 막대·배지 전용)
  star: '#F2B33D',
  dim: 'rgba(0,0,0,0.4)', // 시트 뒤 (무채색)
  toast: '#333D4B', // 토스트 바탕
};

// 영역별 강조: 전부 라벤더로 통일(토스식 단일 악센트). 위험도 셋만 색 유지.
const LAV = {main: C.primary, soft: C.tint, dark: C.primaryDark};
export const ACCENT = {
  snack: LAV,
  health: LAV,
  life: LAV,
  sleep: LAV,
  water: LAV,
  money: LAV,
  safe: {main: C.safe, soft: '#E6F6EF', dark: '#1B7F60'},
  caution: {main: C.warn, soft: '#FDF3E1', dark: '#8F5A0C'},
  danger: {main: C.danger, soft: '#FDECEC', dark: '#B3363B'},
};

export const S = {xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32};
export const R = {sm: 8, md: 12, lg: 16, xl: 20, pill: 999};

// 글자 크기 단계. 색까지 넣어 두어 style={T.title}만으로 쓴다(필요하면 덮어쓰기).
export const T = {
  display: {fontSize: 44, lineHeight: 52, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums']},
  hero: {fontSize: 44, lineHeight: 52, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums']}, // 별칭
  h1: {fontSize: 26, lineHeight: 34, fontWeight: '800', color: C.text},
  h2: {fontSize: 22, lineHeight: 30, fontWeight: '700', color: C.text},
  title: {fontSize: 17, lineHeight: 24, fontWeight: '700', color: C.text},
  body: {fontSize: 15, lineHeight: 22, fontWeight: '400', color: C.text},
  label: {fontSize: 14, lineHeight: 20, fontWeight: '600', color: C.sub},
  caption: {fontSize: 13, lineHeight: 18, fontWeight: '400', color: C.sub},
  tiny: {fontSize: 12, lineHeight: 16, fontWeight: '400', color: C.faint},
};
