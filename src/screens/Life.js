/**
 * 생활 탭: 앉은 시간 · 출퇴근 · 물 · 수면. 카드 4장을 세로로.
 * 로직·저장은 src/life/store.js, 오늘 화면 요약·+ 시트 연결은 이 파일 맨 위(registry 계약).
 * 동기화: 모든 변경 뒤 notifySummary() -> 오늘 화면과 이 화면(onSummaryChange)이 다시 읽는다.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, ScrollView, StyleSheet, Text, View} from 'react-native';
import {C, S, R, T, ACCENT} from '../theme';
import {Icon} from '../ui';
import {Button, Card, Chip, FadeIn, Jelly, PressScale, Segmented, Sheet, Stepper, SwipeRow, useNow, useReduceMotion} from '../kit';
import {registerSummary, registerQuickAction, notifySummary, onSummaryChange} from '../registry';
import {dayKey, shortDay, fmtTime} from '../store';
import {
  MODES,
  DIR,
  DEFAULT_PREFS,
  clean,
  emptyDay,
  fmtMin,
  fmtClock,
  shiftHM,
  sleepMin,
  loadLife,
  loadPrefs,
  savePrefs,
  loadWeek,
  update,
  findRunning,
  toggleSitNow,
  toggleTripNow,
  sitTotal,
  addSit,
  sitAvg,
  tripAvg,
  tripMin,
  commuteSummary,
  patchTrip,
  removeTrip,
  lifeSummary,
} from '../life/store';

const A = ACCENT.life;
const W = ACCENT.water;
const Z = ACCENT.sleep;

// ---- registry 연결 ----

registerSummary('life', async day => {
  const [d, prefs] = await Promise.all([loadLife(day), loadPrefs()]);
  return lifeSummary(d, prefs, Date.now());
});

const onlyToday = ctx => {
  if (ctx.day === dayKey()) return true;
  ctx.toast({title: '타이머는 오늘 날짜에서만 쓸 수 있어요'});
  return false;
};
const safe = fn => ctx => fn(ctx).catch(() => ctx.toast({title: '저장하지 못했어요'}));

registerQuickAction({
  id: 'life-sit',
  label: '앉은 시간',
  icon: 'chair',
  run: safe(async ctx => {
    if (!onlyToday(ctx)) return;
    const r = await toggleSitNow();
    notifySummary();
    ctx.toast({title: r.started ? '앉기 시작했어요' : `앉은 시간 +${r.added}분`});
  }),
});
registerQuickAction({
  id: 'life-commute',
  label: '출퇴근',
  icon: 'bus',
  run: safe(async ctx => {
    if (!onlyToday(ctx)) return;
    const r = await toggleTripNow();
    notifySummary();
    ctx.toast(
      r.started ? {title: `${DIR[r.started.dir]} 시작했어요`} : {title: `${DIR[r.ended.dir]} 도착`, msg: fmtMin(r.min)},
    );
  }),
});
registerQuickAction({
  id: 'life-water',
  label: '물 한 잔',
  icon: 'drop',
  run: safe(async ctx => {
    const [d, p] = await Promise.all([update(ctx.day, x => ({...x, water: x.water + 1})), loadPrefs()]);
    notifySummary();
    ctx.toast({title: `${d.water}잔째`, msg: `${d.water * p.cupMl}ml`});
  }),
});
registerQuickAction({
  id: 'life-sleep',
  label: '수면',
  icon: 'moon',
  run: ctx => ctx.openSheet(close => <SleepForm day={ctx.day} onDone={close} heading />),
});

// ---- 화면 ----

/** @param {any} props {day, go, push} */
export default function Life({day}) {
  const isToday = day === dayKey();
  const [data, setData] = useState(emptyDay);
  const [week, setWeek] = useState([]);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [run, setRun] = useState({sit: null, trip: null});
  const [sheet, setSheet] = useState(null); // 'sleep' | 'water' | {trip}
  const pending = useRef(0);

  const load = useCallback(async () => {
    const [d, w, p, r] = await Promise.all([
      loadLife(day),
      loadWeek(day),
      loadPrefs(),
      day === dayKey() ? findRunning(day) : {sit: null, trip: null},
    ]);
    if (pending.current) return; // 쓰는 중이면 낙관적으로 그린 값을 덮지 않는다(끝나면 다시 읽는다)
    setData(d);
    setWeek(w);
    setPrefs(p);
    setRun(r);
  }, [day]);

  useEffect(() => {
    load();
    return onSummaryChange(() => pending.current === 0 && load());
  }, [load]);

  /** 쓰기 하나. 다 끝나면 알림 -> 오늘 화면·이 화면이 다시 읽는다. */
  const write = p => {
    pending.current++;
    return Promise.resolve(p)
      .catch(() => {})
      .finally(() => {
        if (--pending.current === 0) notifySummary();
      });
  };
  /** 보고 있는 날 기록 고치기(화면 먼저, 저장은 뒤에) */
  const edit = fn => {
    setData(x => clean(fn(x)));
    write(update(day, fn));
  };
  const setPref = patch => {
    const next = {...prefs, ...patch};
    setPrefs(next);
    write(savePrefs(next));
  };

  const running = !!(run.sit || run.trip);
  const now = useNow(running ? 1000 : 30000);

  return (
    <View style={st.flex}>
      <ScrollView contentContainerStyle={st.in} showsVerticalScrollIndicator={false}>
        <View style={st.head}>
          <Text style={T.h1}>생활</Text>
          <Text style={T.caption}>{isToday ? '오늘' : `${shortDay(day)} 기록`}</Text>
        </View>

        <FadeIn index={0}>
          <SitCard
            day={day}
            isToday={isToday}
            data={data}
            week={week}
            run={run.sit}
            now={now}
            onToggle={() => write(toggleSitNow(day))}
            onSet={v => edit(d => ({...d, sitMin: v}))}
            onAdd={m => edit(d => addSit(d, m))}
          />
        </FadeIn>
        <FadeIn index={1}>
          <CommuteCard
            day={day}
            isToday={isToday}
            data={data}
            week={week}
            run={run.trip}
            prefs={prefs}
            now={now}
            onStart={dir => write(toggleTripNow(day, {dir, mode: prefs.commuteMode}))}
            onArrive={() => write(toggleTripNow(day))}
            onMode={m => {
              setPref({commuteMode: m});
              if (run.trip) write(update(run.trip.day, d => patchTrip(d, run.trip.trip.id, {mode: m})));
            }}
            onDelete={id => edit(d => removeTrip(d, id))}
            onOpen={trip => setSheet({trip})}
          />
        </FadeIn>
        <FadeIn index={2}>
          <WaterCard
            water={data.water}
            prefs={prefs}
            onAdd={n => edit(d => ({...d, water: Math.max(0, d.water + n)}))}
            onGoal={() => setSheet('water')}
          />
        </FadeIn>
        <FadeIn index={3}>
          <SleepCard sleep={data.sleep} onOpen={() => setSheet('sleep')} />
        </FadeIn>
      </ScrollView>

      {sheet === 'sleep' && (
        <Sheet title="수면" onClose={() => setSheet(null)}>
          <SleepForm day={day} onDone={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet === 'water' && (
        <Sheet title="물 목표" onClose={() => setSheet(null)}>
          <View style={st.form}>
            <Text style={T.label}>하루 목표</Text>
            <Stepper value={prefs.waterGoal} onChange={v => setPref({waterGoal: v})} min={1} max={30} unit="잔" label="물 목표" accent={W} />
            <Text style={T.label}>한 잔</Text>
            <Stepper value={prefs.cupMl} onChange={v => setPref({cupMl: v})} step={50} min={50} max={1000} unit="ml" label="한 잔 양" accent={W} />
            <Button label="닫기" accent={W} onPress={() => setSheet(null)} />
          </View>
        </Sheet>
      )}
      {sheet?.trip && (
        <Sheet title="이동 시간 고치기" onClose={() => setSheet(null)}>
          <TripEdit
            trip={sheet.trip}
            onSave={patch => {
              edit(d => patchTrip(d, sheet.trip.id, patch));
              setSheet(null);
            }}
            onDelete={() => {
              edit(d => removeTrip(d, sheet.trip.id));
              setSheet(null);
            }}
          />
        </Sheet>
      )}
    </View>
  );
}

// ---- 앉은 시간 ----

function SitCard({day, isToday, data, week, run, now, onToggle, onSet, onAdd}) {
  const total = sitTotal(data, now);
  const fromYesterday = run && run.day !== day;
  // 막대는 보고 있는 날만 화면 값(data)으로 -- 방금 고친 게 바로 보이게
  const live = week.map(w => (w.day === day ? {day, d: data} : w));
  const bars = live.map(w => ({day: w.day, m: sitTotal(w.d, now)}));
  const avg = sitAvg(live, now);
  return (
    <Card title="앉은 시간" icon="chair" accent={A} style={st.card}>
      <Text style={st.big} accessibilityLabel={`앉은 시간 ${fmtMin(total)}`}>
        {fmtMin(total)}
      </Text>

      {isToday && (
        <Jelly
          accent={A}
          tone={run ? 'solid' : 'soft'}
          style={st.toggle}
          onPress={onToggle}
          accessibilityLabel={run ? '일어났어요, 앉기 타이머 멈추기' : '앉기 시작, 타이머 켜기'}>
          <View style={st.toggleIn}>
            {run ? <PulseDot color={C.white} /> : <Icon name="timer" size={20} color={C.text} />}
            <Text style={[st.toggleTx, {color: run ? C.white : C.text}]}>{run ? '일어났어요' : '앉기 시작'}</Text>
            {run && <Text style={st.clock}>{fmtClock(now - run.start)}</Text>}
          </View>
        </Jelly>
      )}
      {fromYesterday && <Text style={[T.caption, st.mt]}>어제 시작한 타이머예요. 멈추면 어제 기록에 들어가요.</Text>}

      <View style={st.mt}>
        <Stepper value={data.sitMin} onChange={onSet} step={10} max={1440} unit="분" label="앉은 시간" accent={A} />
      </View>
      <View style={st.chips}>
        <Chip label="+30분" soft accent={A} onPress={() => onAdd(30)} accessibilityLabel="앉은 시간 30분 더하기" />
        <Chip label="+1시간" soft accent={A} onPress={() => onAdd(60)} accessibilityLabel="앉은 시간 1시간 더하기" />
      </View>

      {bars.length === 7 && avg != null && <WeekBars bars={bars} day={day} />}
      <Text style={[T.caption, st.center, st.mt]}>{avg != null ? `최근 7일 평균 ${fmtMin(avg)}` : '최근 7일 기록 없음'}</Text>
    </Card>
  );
}

const WD = '일월화수목금토';
const wd = k => {
  const [y, m, d] = k.split('-').map(Number);
  return WD[new Date(y, m - 1, d).getDay()];
};

function WeekBars({bars, day}) {
  const max = Math.max(60, ...bars.map(b => b.m));
  return (
    <View
      style={st.week}
      accessible
      accessibilityLabel={`최근 7일 앉은 시간: ${bars.map(b => `${wd(b.day)} ${fmtMin(b.m)}`).join(', ')}`}>
      {bars.map(b => {
        const on = b.day === day;
        return (
          <View key={b.day} style={st.barCol}>
            <View style={st.barTrack}>
              <View style={[st.bar, {height: `${Math.max(4, (b.m / max) * 100)}%`, backgroundColor: on ? C.primary : C.border}]} />
            </View>
            <Text style={[T.tiny, on && st.barOn]}>{wd(b.day)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function PulseDot({color}) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {toValue: 0.25, duration: 700, useNativeDriver: true}),
        Animated.timing(v, {toValue: 1, duration: 700, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return <Animated.View style={[st.dot, {backgroundColor: color, opacity: v}]} />;
}

// ---- 출퇴근 ----

function CommuteCard({day, isToday, data, week, run, prefs, now, onStart, onArrive, onMode, onDelete, onOpen}) {
  const trips = [...data.commute].sort((a, b) => a.start - b.start);
  const sum = commuteSummary(trips, now);
  const avg = tripAvg(week.map(w => (w.day === day ? {d: data} : w)));
  const mode = run?.trip.mode || prefs.commuteMode;
  return (
    <Card title="출퇴근" icon="bus" accent={A} style={st.card}>
      {run ? (
        <View style={st.live}>
          <View style={st.row}>
            <PulseDot color={A.main} />
            <Text style={[T.label, {color: A.dark}]}>{`${DIR[run.trip.dir]} 중 · ${run.trip.mode || mode}`}</Text>
          </View>
          <Text style={st.liveClock} accessibilityLabel={`${DIR[run.trip.dir]} ${fmtMin(tripMin(run.trip, now))} 지남`}>
            {fmtClock(now - run.trip.start)}
          </Text>
          <Text style={T.caption}>{`${fmtTime(run.trip.start)} 출발${run.day !== day ? ' (어제)' : ''}`}</Text>
          <Button label="도착" accent={A} onPress={onArrive} accessibilityLabel={`${DIR[run.trip.dir]} 도착`} />
        </View>
      ) : isToday ? (
        <View style={st.row}>
          {['to', 'from'].map(dir => (
            <Jelly key={dir} tone="soft" h={52} style={st.startBtn} onPress={() => onStart(dir)} accessibilityLabel={`${DIR[dir]} 시작`}>
              <View style={st.startIn}>
                <Icon name={dir === 'to' ? 'sun' : 'moon'} size={18} color={C.text} />
                <Text style={st.startTx}>{`${DIR[dir]} 시작`}</Text>
              </View>
            </Jelly>
          ))}
        </View>
      ) : null}

      {(isToday || run) && (
        <View style={st.chips}>
          {MODES.map(m => (
            <Chip key={m} label={m} accent={A} selected={m === mode} onPress={() => onMode(m)} accessibilityLabel={`이동 수단 ${m}`} />
          ))}
        </View>
      )}

      <View style={st.mt}>
        {trips.map(t => (
          <SwipeRow key={t.id} onDelete={() => onDelete(t.id)} deleteLabel={`${DIR[t.dir]} 기록 삭제`}>
            <PressScale
              style={st.trip}
              scaleTo={0.98}
              onPress={() => onOpen(t)}
              accessibilityLabel={`${DIR[t.dir]} ${fmtMin(tripMin(t, now))}, 시간 고치기`}>
              <View style={st.row}>
                <Icon name="bus" size={18} color={C.sub} />
                <View style={st.flex}>
                  <Text style={T.title}>{`${DIR[t.dir]}${t.mode ? ` · ${t.mode}` : ''}`}</Text>
                  <Text style={T.caption}>{`${fmtTime(t.start)} → ${t.end ? fmtTime(t.end) : '이동 중'}`}</Text>
                </View>
                <Text style={st.tripMin}>{fmtMin(tripMin(t, now))}</Text>
              </View>
            </PressScale>
          </SwipeRow>
        ))}
      </View>

      <Text style={T.body}>
        {trips.length ? `${isToday ? '오늘' : shortDay(day)} 출퇴근 ${fmtMin(sum.total)}` : '이동 기록 없음'}
      </Text>
      <Text style={T.caption}>
        {`최근 7일 평균 출근 ${avg.to != null ? fmtMin(avg.to) : '—'} · 퇴근 ${avg.from != null ? fmtMin(avg.from) : '—'}`}
      </Text>
    </Card>
  );
}

/** 시각 하나를 −큰 −작은 [값] +작은 +큰 버튼으로 옮긴다(시간 고르기 라이브러리 없이). */
function Shift({label, text, steps, onShift}) {
  const [a, b] = steps;
  const name = m => (m >= 60 ? `${m / 60}시간` : `${m}분`);
  const btn = d => (
    <PressScale
      key={d}
      style={st.shiftBtn}
      onPress={() => onShift(d)}
      accessibilityLabel={`${label} ${name(Math.abs(d))} ${d < 0 ? '앞으로' : '뒤로'}`}>
      <Text style={st.shiftTx}>{`${d < 0 ? '−' : '+'}${name(Math.abs(d))}`}</Text>
    </PressScale>
  );
  return (
    <View style={st.mt}>
      <Text style={[T.label, st.center]}>{label}</Text>
      <View style={st.shift}>
        {btn(-b)}
        {btn(-a)}
        <Text style={st.shiftV} accessibilityLabel={`${label} ${text}`}>
          {text}
        </Text>
        {btn(a)}
        {btn(b)}
      </View>
    </View>
  );
}

function TripEdit({trip, onSave, onDelete}) {
  const [t, setT] = useState(trip);
  const M = 60000;
  const moveStart = d => setT(x => ({...x, start: Math.min(x.start + d * M, x.end ?? Date.now())}));
  const moveEnd = d => setT(x => ({...x, end: Math.max(x.start, Math.min(Date.now(), x.end + d * M))}));
  return (
    <View style={st.form}>
      <Segmented
        options={[
          {key: 'to', label: '출근'},
          {key: 'from', label: '퇴근'},
        ]}
        value={t.dir}
        onChange={dir => setT(x => ({...x, dir}))}
        accent={A}
      />
      <Shift label="출발" text={fmtTime(t.start)} steps={[1, 10]} onShift={moveStart} />
      {t.end != null && <Shift label="도착" text={fmtTime(t.end)} steps={[1, 10]} onShift={moveEnd} />}
      <Text style={[T.title, st.center, st.mt]}>{t.end != null ? `걸린 시간 ${fmtMin(tripMin(t))}` : '아직 이동 중'}</Text>
      <Button label="저장" accent={A} onPress={() => onSave({dir: t.dir, start: t.start, ...(t.end != null ? {end: t.end} : {})})} />
      <Button label="이 기록 지우기" tone="soft" accent={A} onPress={onDelete} />
    </View>
  );
}

// ---- 물 ----

function Glass({full}) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(full ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) v.setValue(full ? 1 : 0);
    else Animated.spring(v, {toValue: full ? 1 : 0, useNativeDriver: true, speed: 14, bounciness: 6}).start();
  }, [full, reduce, v]);
  return (
    <View style={[st.glass, {borderColor: full ? W.main : C.border}]}>
      <Animated.View style={[st.water, {backgroundColor: W.main, transform: [{scaleY: v}]}]} />
    </View>
  );
}

function WaterCard({water, prefs, onAdd, onGoal}) {
  const n = Math.min(30, Math.max(prefs.waterGoal, water));
  return (
    <Card title="물" icon="drop" accent={W} style={st.card} action={{label: '목표 바꾸기', onPress: onGoal}}>
      <Text style={st.big}>
        {`${water}잔`}
        <Text style={st.bigUnit}>{` / ${prefs.waterGoal}잔 · ${(water * prefs.cupMl).toLocaleString()}ml`}</Text>
      </Text>
      <View style={st.glasses} accessible accessibilityLabel={`물 ${water}잔, 목표 ${prefs.waterGoal}잔`}>
        {Array.from({length: n}, (_, i) => (
          <Glass key={i} full={i < water} />
        ))}
      </View>
      <View style={st.waterBtns}>
        <Jelly tone="soft" h={52} w={52} onPress={() => onAdd(-1)} disabled={!water} accessibilityLabel="물 한 잔 빼기">
          <Icon name="minus" size={24} color={C.text} width={2.4} />
        </Jelly>
        <Jelly accent={W} h={52} w={52} onPress={() => onAdd(1)} accessibilityLabel="물 한 잔 더하기">
          <Icon name="plus" size={24} color={C.white} width={2.8} />
        </Jelly>
      </View>
    </Card>
  );
}

// ---- 수면 ----

function SleepCard({sleep, onOpen}) {
  return (
    <Card title="수면" icon="moon" accent={Z} style={st.card} action={sleep ? {label: '고치기', onPress: onOpen} : undefined}>
      {sleep ? (
        <PressScale onPress={onOpen} scaleTo={0.98} accessibilityLabel={`수면 ${fmtMin(sleep.min)}, 고치기`}>
          <Text style={st.big}>{fmtMin(sleep.min)}</Text>
          <Text style={T.caption}>{`${sleep.bed} 잠듦 → ${sleep.wake} 기상`}</Text>
        </PressScale>
      ) : (
        <>
          <Text style={T.caption}>지난밤 잠든 시각과 일어난 시각을 적어 보세요</Text>
          <Button label="수면 기록" accent={Z} onPress={onOpen} />
        </>
      )}
    </Card>
  );
}

/** 수면 입력. 이 화면 시트와 + 시트(ctx.openSheet) 둘 다 쓴다. 저장은 그 날(=일어난 날) 기록에. */
export function SleepForm({day, onDone, heading}) {
  const [s, setS] = useState({bed: '23:30', wake: '07:00'});
  const [had, setHad] = useState(false);
  useEffect(() => {
    let alive = true;
    loadLife(day).then(d => {
      if (alive && d.sleep) {
        setS({bed: d.sleep.bed, wake: d.sleep.wake});
        setHad(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [day]);
  const save = sleep =>
    update(day, d => ({...d, sleep}))
      .catch(() => {})
      .then(() => {
        notifySummary();
        onDone();
      });
  const min = sleepMin(s.bed, s.wake);
  return (
    <View style={st.form}>
      {heading && <Text style={T.h2}>수면</Text>}
      <Shift label="잠든 시각" text={s.bed} steps={[10, 60]} onShift={d => setS(x => ({...x, bed: shiftHM(x.bed, d)}))} />
      <Shift label="일어난 시각" text={s.wake} steps={[10, 60]} onShift={d => setS(x => ({...x, wake: shiftHM(x.wake, d)}))} />
      <Text style={[st.big, st.center]}>{fmtMin(min)}</Text>
      <Button label="저장" accent={Z} onPress={() => save({...s, min})} />
      {had && <Button label="수면 기록 지우기" tone="soft" accent={Z} onPress={() => save(undefined)} />}
    </View>
  );
}

const st = StyleSheet.create({
  flex: {flex: 1},
  in: {paddingHorizontal: S.md, paddingBottom: S.lg},
  head: {paddingTop: S.sm, paddingBottom: S.xs},
  card: {marginTop: S.sm},
  center: {textAlign: 'center'},
  mt: {marginTop: S.sm},
  row: {flexDirection: 'row', alignItems: 'center', gap: S.xs},
  bigUnit: {fontSize: 14, fontWeight: '600', color: C.sub}, // 큰 숫자 안 글자: lineHeight 없이(있으면 줄이 잘린다)
  big: {fontSize: 32, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums']},
  form: {gap: S.xs, paddingBottom: S.sm},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginTop: S.sm},

  toggle: {marginTop: S.sm},
  toggleIn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingHorizontal: S.md},
  toggleTx: {fontSize: 16, fontWeight: '700'},
  clock: {fontSize: 16, fontWeight: '700', color: C.white, fontVariant: ['tabular-nums']},
  dot: {width: 10, height: 10, borderRadius: 5},

  week: {flexDirection: 'row', gap: S.xs, height: 84, marginTop: S.md, marginBottom: S.xs},
  barCol: {flex: 1, alignItems: 'center', gap: 4},
  barTrack: {flex: 1, width: '70%', justifyContent: 'flex-end'},
  bar: {width: '100%', borderRadius: 4},
  barOn: {color: C.text, fontWeight: '700'},

  live: {borderRadius: R.lg, padding: S.md, alignItems: 'center', gap: 2, backgroundColor: C.tint},
  liveClock: {fontSize: 40, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums']},
  startBtn: {flex: 1},
  startIn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6},
  startTx: {fontSize: 16, fontWeight: '700', color: C.text},
  trip: {backgroundColor: C.fill, borderRadius: R.md, padding: S.sm, minHeight: 56},
  tripMin: {fontSize: 15, fontWeight: '700', color: C.text},

  shift: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xxs, marginTop: S.xxs},
  shiftBtn: {minWidth: 52, minHeight: 44, borderRadius: R.md, paddingHorizontal: S.xxs, backgroundColor: C.fill},
  shiftTx: {fontSize: 13, fontWeight: '700', textAlign: 'center', color: C.text},
  shiftV: {minWidth: 84, textAlign: 'center', fontSize: 20, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums']},

  glasses: {flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginTop: S.sm},
  glass: {width: 26, height: 36, borderWidth: 2, borderRadius: 6, borderTopLeftRadius: 2, borderTopRightRadius: 2, overflow: 'hidden', justifyContent: 'flex-end'},
  water: {position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, transformOrigin: 'bottom'},
  waterBtns: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: S.lg, marginTop: S.md},
});
