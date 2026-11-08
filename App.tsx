/**
 * 칼로리 클릭커 — 간식 먹을 때마다, 한 번 클릭. 그리고 하루 생활 기록.
 * - 아래 탭: 오늘(대시보드) · 간식 · 건강 · 생활 · 가계부 (빠른 기록은 오늘 화면 헤더의 '+ 기록')
 * - 탭 위로 쌓이는 화면(검색·통계·설정)은 state의 간단한 스택. 안드로이드 뒤로가기 = 스택 pop → 오늘 탭 → 종료
 * - 기록은 기기에만 저장(AsyncStorage), 서버·계정 없음
 *
 * 네비게이션 라이브러리를 쓰지 않는다 -- 예전 버전에서 보고된 ScreenFragment 크래시를 피한다.
 * 간식 기록 상태(날짜·기록·걸린 간식·최근·내 간식)는 오늘·간식 탭이 같이 쓰므로 여기서 들고 있는다.
 * 건강·생활·가계부 화면과의 약속은 src/registry.js.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, StyleSheet, StatusBar, Alert, AppState, BackHandler} from 'react-native';
import {SafeAreaProvider, SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {C} from './src/theme';
import AddFood from './src/AddFood';
import Settings from './src/Settings';
import Stats from './src/Stats';
import ClickToast from './src/ClickToast';
import HangSheet from './src/HangSheet';
import TabBar from './src/TabBar';
import {FadeIn, Sheet} from './src/kit';
import Today from './src/screens/Today';
import Snacks from './src/screens/Snacks';
import Health from './src/screens/Health';
import Life from './src/screens/Life';
import Budget from './src/screens/Budget';
import QuickAdd from './src/screens/QuickAdd';
import {
  dayKey,
  loadDay,
  saveDay,
  loadGoal,
  saveGoal,
  isSnack,
  catLine,
  mergeRecent,
  loadRecent,
  saveRecent,
  loadCurrent,
  saveCurrent,
  pieceEntry,
  loadMine,
  saveMine,
  upsertMine,
  mineEntry,
  toggleFav,
  removeMine,
  setMineKcal,
} from './src/store';

const todayKey = () => dayKey();

type Tab = 'today' | 'snacks' | 'health' | 'life' | 'money';
type Pushed = {name: 'search'; hang: boolean} | {name: 'stats'} | {name: 'settings'};

export default function App() {
  const [day, setDay] = useState(todayKey);
  const [items, setItems] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false); // items가 지금 day의 저장본인지
  const [goal, setGoal] = useState(0);
  const [tab, setTab] = useState<Tab>('today');
  const [stack, setStack] = useState<Pushed[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]); // 내 간식(diet:mysnacks)
  const [click, setClick] = useState<any>(null); // ClickToast event
  const [undoId, setUndoId] = useState<number | null>(null);
  const [current, setCurrent] = useState<any>(null); // 큰 버튼에 걸린 간식(1개 기준 entry)
  const [sheet, setSheet] = useState<any>(null); // 1개 kcal 정하는 시트에 띄운 entry
  const [quick, setQuick] = useState(false); // 빠른 기록 시트(오늘 화면 '+ 기록')
  const [custom, setCustom] = useState<null | ((close: () => void) => React.ReactNode)>(null); // ctx.openSheet
  const lastToday = useRef(todayKey()); // 마지막으로 앱이 활성일 때의 "오늘"
  // 칩을 연타하면 렌더 사이에 add가 여러 번 불린다. state 클로저 대신 ref로 최신 배열을 이어 붙여야 앞 기록이 안 사라진다.
  const itemsRef = useRef<any[]>([]);
  const recentRef = useRef<any[]>([]);
  const mineRef = useRef<any[]>([]);
  const lastId = useRef(0);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setClick(null);
    setUndoId(null);
    loadDay(day).then(list => {
      if (!alive) return; // 날짜를 빨리 넘기면 늦게 온 이전 날 결과는 버린다
      itemsRef.current = list;
      setItems(list);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [day]);

  useEffect(() => {
    loadRecent().then(list => {
      // 불러오기 전에 이미 클릭했으면 그걸 앞에 두고 저장본을 뒤에 합친다
      const mine0 = recentRef.current;
      const merged = [...mine0, ...list.filter(e => !mine0.some(r => r.name === e.name))].slice(0, 5);
      recentRef.current = merged;
      setRecent(merged);
    });
    loadMine().then(list => {
      // 같은 방식: 불러오기 전에 건·먹은 간식이 있으면 그 값을 살린다
      const early = mineRef.current;
      const merged = [...early, ...list.filter((m: any) => !early.some(e => e.name === m.name))];
      mineRef.current = merged;
      setMine(merged);
      if (early.length) saveMine(merged);
    });
    loadGoal().then(setGoal);
    loadCurrent().then(c => setCurrent((p: any) => p || c)); // 불러오기 전에 이미 걸었으면 그걸 둔다
  }, []);

  // 자정을 넘겨 다시 열었을 때: 오늘을 보고 있었으면 새 오늘로. 지난 날을 보던 중이면 그대로.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      const prev = lastToday.current;
      const now = todayKey();
      lastToday.current = now;
      setDay(d => (d === prev ? now : d));
    });
    return () => sub.remove();
  }, []);

  // 안드로이드 뒤로가기: 스택 pop → 오늘 탭으로 → 기본 동작(앱 종료).
  // 한 번만 등록한다 -- 나중에 등록된 핸들러(AddFood의 양 고르기 뒤로가기)가 항상 먼저 불리게.
  const backRef = useRef<() => boolean>(() => false);
  backRef.current = () => {
    if (stack.length) {
      pop();
      return true;
    }
    if (tab !== 'today') {
      go('today');
      return true;
    }
    return false;
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => backRef.current());
    return () => sub.remove();
  }, []);

  const persist = useCallback(
    (next: any[]) => {
      itemsRef.current = next;
      setItems(next);
      saveDay(day, next).then(ok => {
        if (!ok) Alert.alert('저장하지 못했어요', '기기 저장 공간을 확인한 뒤 다시 시도해 주세요.');
      });
    },
    [day],
  );

  const putMine = (next: any[]) => {
    mineRef.current = next;
    setMine(next);
    saveMine(next);
  };
  const putRecent = (next: any[]) => {
    recentRef.current = next;
    setRecent(next);
    saveRecent(next);
  };

  // 화면 이동: 옛 토스트·되돌리기는 버린다(돌아왔을 때 과거 기록을 지우지 않게).
  // add는 방금 click을 살려야 해서 setStack을 직접 쓴다.
  const leave = () => {
    setClick(null);
    setUndoId(null);
    setRecent(recentRef.current); // 칩 순서는 화면을 옮길 때 반영
  };
  const go = (t: Tab) => {
    leave();
    setStack([]);
    setTab(t);
  };
  const push = (p: Pushed) => {
    leave();
    setStack(s => [...s, p]);
  };
  const pop = () => {
    leave();
    setStack(s => s.slice(0, -1));
  };

  const add = (entry: any) => {
    // 오늘을 보던 채로 자정을 넘겨 포그라운드에서 누르면 어제에 적힌다 -> 오늘로 옮기고 한 번 더 누르게
    const now = todayKey();
    if (day === lastToday.current && now !== day) {
      lastToday.current = now;
      setDay(now);
      Alert.alert('날짜가 바뀌었어요', '오늘로 이동했어요. 한 번 더 눌러 주세요.');
      return false;
    }
    // 불러오기 전에 저장하면 그날 기존 기록을 덮어쓴다
    if (!loaded) {
      Alert.alert('기록을 불러오는 중이에요', '잠시 후 다시 눌러 주세요.');
      return false;
    }
    const id = Math.max(Date.now(), lastId.current + 1); // 같은 ms 연타에도 id가 겹치지 않게
    lastId.current = id;
    const rec = {...entry, kind: entry.kind || 'meal', id, at: id};
    const next = [...itemsRef.current, rec];
    persist(next);
    if (isSnack(rec)) {
      const n = next.filter(isSnack).length;
      setClick({key: id, title: 'CLICK!', kcal: rec.kcal, n, msg: day === now ? catLine(n) : '이 날짜에 기록했어요'});
      const orig = {...entry, kind: 'snack'}; // id·at 없는 원본
      recentRef.current = mergeRecent(recentRef.current, orig);
      // 오늘 화면에서 누를 땐 칩 순서를 그대로 둔다 -- 같은 자리 연타가 같은 간식이 되게. 순서는 화면을 옮길 때 반영(leave)
      if (!(tab === 'today' && !stack.length)) setRecent(recentRef.current);
      saveRecent(recentRef.current);
      putMine(upsertMine(mineRef.current, orig, {ate: true})); // 내 간식은 자리를 안 바꿔서 칩 순서에 영향 없음
    } else {
      setClick({key: id, title: '기록 완료', kcal: rec.kcal});
    }
    setUndoId(id);
    setStack([]);
    return true;
  };

  // 토스트의 되돌리기: 방금 그 기록만 뺀다. 최근 간식 칩·내 간식 횟수는 캐시라 그대로 둔다.
  const undo = () => {
    if (loaded && undoId != null) persist(itemsRef.current.filter(i => i.id !== undoId));
    setUndoId(null);
    setClick(null);
  };

  // 카드의 + : 같은 음식·같은 양·같은 종류를 한 번 더
  const again = ({id: _id, at: _at, ...rest}: any) => add(rest);

  const remove = (item: any, title = '삭제할까요?') =>
    Alert.alert(title, item.name, [
      {text: '취소', style: 'cancel'},
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => loaded && persist(itemsRef.current.filter(i => i.id !== item.id)),
      },
    ]);

  // 버튼에 걸기: 기록은 안 하고, 칩에서 다시 1탭으로 걸 수 있게 최근 간식 맨 앞에 둔다. 내 간식에도 남긴다.
  const setCur = (entry: any) => {
    setCurrent(entry);
    saveCurrent(entry);
    putRecent(mergeRecent(recentRef.current, entry));
    putMine(upsertMine(mineRef.current, entry));
  };

  // 칩: 지금 걸린 칩 = 1개 kcal 고치기, 1개 기준인 칩(piece: 건 적 있는 간식·카탈로그) = 바로 걸기, 그 외 = 시트로 개수 받기
  // (그냥 기록한 간식의 kcal은 1인분 전체라 1개 기준이 아니다)
  const onQuick = (q: any) => {
    const e = recentRef.current.find(r => r.name === q.entry.name) || q.entry;
    if (current && current.name === q.entry.name) setSheet(current);
    else if (e.piece === true) setCur(e);
    else setSheet(e);
  };

  // 내 간식 카드 탭: 오늘 화면으로 가서 버튼에 건다(1개 기준이 아니면 시트로)
  const hangMine = (m: any) => {
    const e = recentRef.current.find(r => r.name === m.name) || mineEntry(m);
    go('today');
    if (current && current.name === m.name) return;
    if (e.piece === true) setCur(e);
    else setSheet(e);
  };

  // 내 간식에서 1개 kcal 고치기: 최근 칩·걸린 버튼도 같은 값으로
  const editMine = (name: string, kcal: number) => {
    putMine(setMineKcal(mineRef.current, name, kcal));
    putRecent(recentRef.current.map(e => (e.name === name ? pieceEntry(e, kcal, 1) : e)));
    if (current && current.name === name) {
      const c = pieceEntry(current, kcal, 1);
      setCurrent(c);
      saveCurrent(c);
    }
  };

  const deleteMine = (name: string) => {
    putMine(removeMine(mineRef.current, name));
    putRecent(recentRef.current.filter(e => e.name !== name));
  };

  const pickSnack = () => push({name: 'search', hang: true});
  const clickSnack = () => (current ? add(current) : pickSnack());

  const hangFromSearch = (entry: any) => {
    go('today');
    setSheet(entry);
    return true;
  };

  // 빠른 기록 타일에 넘기는 ctx (계약은 src/registry.js)
  const ctx = {
    day,
    go,
    push,
    clickSnack,
    pickSnack,
    openSheet: (render: (close: () => void) => React.ReactNode) => setCustom(() => render),
    toast: ({title, msg, kcal}: {title: string; msg?: string; kcal?: number}) => {
      setUndoId(null);
      setClick({key: Date.now(), title, msg, kcal});
    },
  };

  const top = stack[stack.length - 1];
  let screen;
  if (top && top.name === 'search') {
    screen = (
      <AddFood kind="snack" pickOnly={top.hang} onAdd={top.hang ? hangFromSearch : add} onClose={pop} />
    );
  } else if (top && top.name === 'stats') {
    screen = <Stats goal={goal} onBack={pop} />;
  } else if (top && top.name === 'settings') {
    screen = (
      <Settings
        goal={goal}
        onBack={pop}
        onSave={(g: number) => {
          setGoal(g);
          saveGoal(g);
        }}
      />
    );
  }

  let body;
  if (tab === 'snacks') {
    body = (
      <Snacks
        day={day}
        items={items}
        goal={goal}
        mine={mine}
        onAgain={again}
        onRemove={remove}
        onRecord={() => push({name: 'search', hang: false})}
        onGoal={() => push({name: 'settings'})}
        onHangMine={hangMine}
        onFav={(name: string) => putMine(toggleFav(mineRef.current, name))}
        onEditKcal={editMine}
        onDeleteMine={deleteMine}
      />
    );
  } else if (tab === 'health') {
    body = <Health day={day} go={go} push={push} />;
  } else if (tab === 'life') {
    body = <Life day={day} go={go} push={push} />;
  } else if (tab === 'money') {
    body = <Budget day={day} go={go} push={push} />;
  } else {
    body = (
      <Today
        day={day}
        setDay={setDay}
        items={items}
        loaded={loaded}
        recent={recent}
        favs={mine.filter(m => m.fav)}
        current={current}
        pulse={click && click.n != null ? click.key : null}
        onClick={clickSnack}
        onChange={pickSnack}
        onQuick={onQuick}
        go={go}
        push={(name: 'stats' | 'settings') => push({name})}
        onQuickAdd={() => setQuick(true)}
      />
    );
  }

  return (
    <Shell bottomBg={screen ? C.bg : C.card}>
      {screen || (
        <>
          <View style={st.flex}>
            {/* 탭을 바꾸면 새로 그려진다 = 살짝 페이드인 + 오늘 탭 요약 다시 읽기 */}
            <FadeIn key={tab} style={st.flex}>
              {body}
            </FadeIn>
            <ClickToast
              event={click}
              onUndo={undoId != null ? undo : undefined}
              onHide={() => {
                setClick(null);
                setUndoId(null);
              }}
            />
          </View>
          <TabBar tab={tab} onTab={k => go(k as Tab)} />
        </>
      )}
      {quick && (
        <QuickAdd
          onClose={() => setQuick(false)}
          onRun={a => {
            setQuick(false);
            a.run(ctx);
          }}
        />
      )}
      {custom && <Sheet keyboard onClose={() => setCustom(null)}>{custom(() => setCustom(null))}</Sheet>}
      {sheet && (
        <HangSheet
          entry={sheet}
          onConfirm={(e: any) => {
            setCur(e);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </Shell>
  );
}

// 하단 안전영역(제스처 바 자리)은 바로 위 요소 색으로 칠한다(탭바가 보이면 흰색, 스택 화면이면 배경색).
const Shell = ({children, bottomBg = C.bg}: any) => (
  <SafeAreaProvider>
    <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
    <SafeAreaView style={st.shell} edges={['top']}>
      {children}
      <BottomInset color={bottomBg} />
    </SafeAreaView>
  </SafeAreaProvider>
);

function BottomInset({color}: any) {
  const {bottom} = useSafeAreaInsets();
  return <View style={{height: bottom, backgroundColor: color}} />;
}

const st = StyleSheet.create({
  shell: {flex: 1, backgroundColor: C.bg},
  flex: {flex: 1},
});
