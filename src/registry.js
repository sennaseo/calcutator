/**
 * 화면 사이 약속(계약) -- 건강·생활 화면을 만드는 쪽은 이 파일만 보고 붙이면 된다.
 *
 * ━━ 1. 오늘 화면 요약 카드: registerSummary(domain, fn) ━━
 *   domain: 'health' | 'life'  (오늘 화면이 이 둘을 카드로 그린다)
 *   fn(dayKey: 'YYYY-MM-DD') => Promise<Summary | null>
 *     Summary = {
 *       title: string,          카드 제목. 예: '영양제·약'
 *       value: string,          큰 글자. 예: '2 / 3'
 *       sub?: string,           작은 설명. 예: '저녁 약 1개 남음'
 *       progress?: number,      0~1. 주면 링을 그린다(건강 카드: 먹은 수/계획 수)
 *       rows?: Array<{icon: string, label: string, value: string}>,
 *                               생활 카드용 칸들. 예: [{icon:'chair', label:'앉은 시간', value:'5시간 10분'}]
 *                               icon은 src/ui.js 아이콘 이름(chair·bus·drop·moon·pill·capsule·clock·timer…)
 *     }
 *   - 기록이 없으면 null. 오늘 화면이 '기록 없음' 자리표시를 그린다.
 *   - fn이 throw하거나 reject해도 화면은 안 죽는다(null로 본다).
 *   - 등록 위치: src/screens/Health.js · Life.js 모듈 맨 위(App이 import하므로 시작할 때 등록된다).
 *   - 데이터를 바꿨으면 notifySummary()를 불러 오늘 화면을 새로 그리게 한다.
 *     (오늘 탭으로 돌아오거나 날짜를 바꿀 때도 다시 읽는다)
 *   - 금지: 양·횟수 평가 문구('너무 많아요!' 등), 고양이 말투('~냥'). 사실만 짧게.
 *
 * ━━ 2. + 버튼(빠른 기록) 시트: registerQuickAction(action) ━━
 *   action = {
 *     id: string,               같은 id로 다시 등록하면 그 자리에서 교체(순서 유지)
 *     label: string,            타일 글자. 짧게(6자 안팎)
 *     icon: string,             src/ui.js 아이콘 이름
 * *     run(ctx): void,           타일을 누르면 시트가 닫히고 불린다
 *   }
 *   ctx = {
 *     day: string,                  지금 보고 있는 날짜 키
 *     go(tab),                      'today' | 'snacks' | 'health' | 'life' | 'money' 탭으로
 *     openSheet(render),            kit의 Sheet를 연다. render(close) => ReactNode
 *     toast({title, msg?, kcal?}),  아래쪽 짧은 알림(되돌리기 없음)
 *     clickSnack(),                 걸린 간식 1개 기록(없으면 간식 고르기)
 *     pickSnack(),                  버튼에 걸 간식 고르기(검색)
 *   }
 *   - 아래 기본 등록 중 health-*, life-* 는 자리만 잡아 둔 것(탭 이동). 같은 id로 덮어써서 연결한다:
 *     health-dose(영양제·약 체크), life-sit(앉은 시간), life-commute(출퇴근 타이머),
 *     life-water(물 한 잔), life-sleep(수면)
 *
 * ━━ 3. 저장 키 규칙 ━━
 *   AsyncStorage 키는 영역별 접두사: 'health:…', 'life:…', 'budget:…'. 간식 기록 'diet:YYYY-MM-DD' 형식은 건드리지 않는다.
 *
 * ━━ 4. UI ━━
 *   src/kit.js(Card·PressScale·Sheet·Ring·Stepper·Segmented·SwipeRow·Chip·EmptyState·SectionTitle·Badge·Button·FadeIn·useNow)
 *   와 theme.js 토큰(C·ACCENT·S·R·T)을 쓴다. 건강 = ACCENT.health, 생활 = ACCENT.life.
 */

const summaries = new Map();
const listeners = new Set();

/** 요약 함수 등록. 같은 domain은 교체. 반환값을 부르면 등록 해제. */
export function registerSummary(domain, fn) {
  summaries.set(domain, fn);
  notifySummary();
  return () => {
    if (summaries.get(domain) === fn) summaries.delete(domain);
  };
}

/** 그 날의 요약. 등록이 없거나 실패하면 null. */
export async function getSummary(domain, day) {
  const fn = summaries.get(domain);
  if (!fn) return null;
  try {
    return (await fn(day)) || null;
  } catch {
    return null;
  }
}

/** 요약이 바뀌었다고 알린다(오늘 화면이 다시 읽는다). */
export function notifySummary() {
  listeners.forEach(l => l());
}

/** 요약 변경 구독. 반환값 = 구독 해제. */
export function onSummaryChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const actions = [];

/** 빠른 기록 타일 등록. 같은 id면 그 자리에서 교체. */
export function registerQuickAction(a) {
  const i = actions.findIndex(x => x.id === a.id);
  if (i >= 0) actions[i] = a;
  else actions.push(a);
}

/** 지금 등록된 타일들(등록 순). */
export const quickActions = () => [...actions];

// 기본 타일. 간식 둘은 진짜, 나머지는 다른 화면이 같은 id로 덮어쓸 자리.
[
  {id: 'snack-click', label: '간식 1개', icon: 'candy', run: ctx => ctx.clickSnack()},
  {id: 'snack-pick', label: '간식 고르기', icon: 'search', run: ctx => ctx.pickSnack()},
  {id: 'health-dose', label: '영양제·약', icon: 'pill', run: ctx => ctx.go('health')},
  {id: 'life-sit', label: '앉은 시간', icon: 'chair', run: ctx => ctx.go('life')},
  {id: 'life-commute', label: '출퇴근', icon: 'bus', run: ctx => ctx.go('life')},
  {id: 'life-water', label: '물 한 잔', icon: 'drop', run: ctx => ctx.go('life')},
  {id: 'life-sleep', label: '수면', icon: 'moon', run: ctx => ctx.go('life')},
].forEach(registerQuickAction);
