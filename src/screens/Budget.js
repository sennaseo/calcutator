/**
 * 가계부 탭: 이번 달 얼마 썼나 · 어디에 썼나 · 나갈 예정 · 지출 내역. 기록 전에 "이걸 쓰면 얼마나 위태로운지" 미리보기.
 * 로직·저장은 src/budget/store.js, + 시트 '지출' 타일 연결은 이 파일 맨 위(registry 계약).
 * 동기화: 쓰기 뒤 notifySummary() -> 이 화면과 열린 폼(onSummaryChange)이 다시 읽는다.
 * 고치기는 없다 — 밀어서 삭제 후 다시 기록.
 */
import React, {useEffect, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {C, S, R, T, ACCENT} from '../theme';
import {Icon} from '../ui';
import {Badge, Button, Card, Chip, DateNav, EmptyState, IconJelly, PressScale, SectionTitle, Sheet, Stepper, SwipeRow} from '../kit';
import {registerQuickAction, notifySummary, onSummaryChange} from '../registry';
import {dayKey, shiftDay, fmtDay, shortDay} from '../store';
import {
  CATS,
  catEmoji,
  DEFAULT_SETTINGS,
  fmtNum,
  fmtWon,
  monthKey,
  fmtMonth,
  shiftMonth,
  nextDom,
  monthTx,
  monthSpent,
  byCategory,
  byDay,
  upcoming,
  used,
  plannedThisMonth,
  balanceNow,
  assess,
  addTx,
  removeTx,
  addPlan,
  removePlan,
  payPlan,
  loadTx,
  saveTx,
  loadPlan,
  savePlan,
  loadSettings,
  saveSettings,
  updateTx,
  updatePlan,
} from '../budget/store';

const A = ACCENT.money;
const LEVEL = {
  safe: {label: '안전', accent: ACCENT.safe},
  warn: {label: '주의', accent: ACCENT.caution},
  danger: {label: '위험', accent: ACCENT.danger},
};
// 예산 막대 색은 예산 %만 따른다(전체 위험도는 Badge가 보여 준다)
const levelOfPct = p => (p > 100 ? 'danger' : p >= 80 ? 'warn' : 'safe');

/** 쓰기 하나: 성공하면 알림 -> 화면들이 다시 읽는다. 실패하면 알리고 false. */
const write = p =>
  p.then(
    () => {
      notifySummary();
      return true;
    },
    () => {
      Alert.alert('저장하지 못했어요', '기기 저장 공간을 확인한 뒤 다시 시도해 주세요.');
      return false;
    },
  );

// ---- registry 연결 ----

registerQuickAction({
  id: 'budget-spend',
  label: '지출',
  icon: 'wallet',
  run: ctx => ctx.openSheet(close => <SpendForm day={ctx.day} onDone={close} heading toast={ctx.toast} />),
});

/** 세 키를 읽고, 다른 곳에서 쓰면 다시 읽는다(+ 시트에서 기록해도 즉시 반영). */
function useBudget() {
  const [d, setD] = useState({tx: [], plan: [], settings: DEFAULT_SETTINGS});
  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([loadTx(), loadPlan(), loadSettings()]).then(([tx, plan, settings]) => alive && setD({tx, plan, settings}));
    load();
    const off = onSummaryChange(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return d;
}

// ---- 화면 ----

/** @param {any} _props {day, go, push} — 지금은 안 쓴다(가계부는 오늘 기준) */
export default function Budget(_props) {
  const today = dayKey();
  const thisYm = monthKey(today);
  const [ym, setYm] = useState(thisYm);
  const [sheet, setSheet] = useState(null); // 'spend' | 'plan' | 'settings' | {plan}
  const {tx, plan, settings} = useBudget();
  const isThis = ym === thisYm;
  const close = () => setSheet(null);

  const spent = monthSpent(tx, ym);
  const risk = assess({settings, tx, plan, today});
  const u = used(tx, plan, ym, today);
  const pct = settings.monthly > 0 ? Math.round((u / settings.monthly) * 100) : 0;
  const left = settings.monthly - u;
  const withPlan = isThis && plannedThisMonth(plan, ym) > 0; // %에는 예정이 들어가고 큰 숫자는 쓴 돈만
  const cats = byCategory(tx, ym);
  const plans = upcoming(plan);
  const list = monthTx(tx, ym);
  const bal = balanceNow(settings, tx);

  return (
    <View style={st.flex}>
      <ScrollView contentContainerStyle={st.in} showsVerticalScrollIndicator={false}>
        <View style={st.head}>
          <View style={st.flex}>
            <Text style={T.h1}>가계부</Text>
          </View>
          <IconJelly plain icon="settings" onPress={() => setSheet('settings')} accessibilityLabel="가계부 설정" />
        </View>

        <View style={st.monthRow}>
          <Pressable onPress={() => setYm(shiftMonth(ym, -1))} style={st.navBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="이전 달">
            <Icon name="back" size={20} color={C.text} />
          </Pressable>
          <View style={st.monthMid}>
            <Text style={T.title}>{fmtMonth(ym)}</Text>
            {!isThis && (
              <Pressable onPress={() => setYm(thisYm)} hitSlop={10} accessibilityRole="button" accessibilityLabel="이번 달로">
                <Text style={st.toThis}>이번 달로</Text>
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => !isThis && setYm(shiftMonth(ym, 1))}
            style={[st.navBtn, ym >= thisYm && st.navOff]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="다음 달"
            accessibilityState={{disabled: ym >= thisYm}}>
            <Icon name="chev" size={20} color={C.text} />
          </Pressable>
        </View>

        <Card
          title={isThis ? '이번 달' : fmtMonth(ym)}
          icon="wallet"
          accent={A}
          action={settings.monthly ? undefined : {label: '예산 정하기', onPress: () => setSheet('settings')}}>
          <Text style={st.big} accessibilityLabel={`${fmtWon(spent)} 지출`}>
            {fmtWon(spent)}
            <Text style={st.bigUnit}> 지출</Text>
          </Text>
          {settings.monthly > 0 ? (
            <>
              <View style={st.track}>
                <View style={[st.fillBar, {width: `${Math.min(100, pct)}%`, backgroundColor: LEVEL[levelOfPct(pct)].accent.main}]} />
              </View>
              <Text style={T.caption}>
                {`예산 ${fmtWon(settings.monthly)} 중 ${pct}%${withPlan ? '(예정 포함)' : ''} · ${left >= 0 ? `${fmtWon(left)} 남음` : `${fmtWon(-left)} 초과`}`}
              </Text>
            </>
          ) : (
            <Text style={[T.caption, st.mt]}>월 예산을 정하면 얼마나 남았는지 보여드려요</Text>
          )}
          {isThis && (
            <View style={[st.row, st.mt]}>
              {risk.payday ? (
                <View style={st.balBox}>
                  <Text style={[T.label, st.balTx]}>
                    {`잔고 ${fmtWon(bal)} · 월급날 ${risk.payday.dom}일 D-${risk.payday.days}`}
                  </Text>
                  <Text style={[T.caption, risk.payday.before < 0 && st.neg]}>{`예정 지출 빼면 ${fmtWon(risk.payday.before)}`}</Text>
                </View>
              ) : (
                <Pressable style={st.flex} onPress={() => setSheet('settings')} hitSlop={8} accessibilityRole="button" accessibilityLabel="잔고·월급날 넣기">
                  <Text style={st.link}>잔고·월급날 넣기</Text>
                </Pressable>
              )}
              {risk.level && <Badge label={LEVEL[risk.level].label} accent={LEVEL[risk.level].accent} style={st.badge} />}
            </View>
          )}
          {isThis && <Button label="지출 기록" accent={A} onPress={() => setSheet('spend')} />}
        </Card>

        <Card title="어디에 썼나" icon="list" accent={A} style={st.card}>
          {cats.length ? (
            cats.map(c => (
              <View key={c.cat} style={st.catRow} accessible accessibilityLabel={`${c.cat} ${fmtWon(c.amount)}, ${c.pct}%`}>
                <View style={st.row}>
                  <Text style={st.emoji}>{catEmoji(c.cat)}</Text>
                  <Text style={[T.title, st.flex]}>{c.cat}</Text>
                  <Text style={T.title}>{fmtWon(c.amount)}</Text>
                  <Text style={[T.tiny, st.pct]}>{`${c.pct}%`}</Text>
                </View>
                <View style={st.catTrack}>
                  <View style={[st.catBar, {width: `${(c.amount / cats[0].amount) * 100}%`}]} />
                </View>
              </View>
            ))
          ) : (
            <Text style={T.caption}>이번 달 지출 없음</Text>
          )}
        </Card>

        <Card title="나갈 예정" icon="clock" accent={A} style={st.card} action={{label: '+ 추가', onPress: () => setSheet('plan')}}>
          {plans.length ? (
            <>
              {plans.map(p => {
                const late = p.day < today;
                return (
                  <SwipeRow key={p.id} onDelete={() => write(updatePlan(l => removePlan(l, p.id)))} deleteLabel={`${p.memo || p.cat} 예정 삭제`}>
                    <PressScale style={st.line} scaleTo={0.98} onPress={() => setSheet({plan: p})} accessibilityLabel={`${p.memo || p.cat} ${fmtWon(p.amount)}, ${shortDay(p.day)}`}>
                      <View style={st.row}>
                        <Text style={st.dotEmoji}>{catEmoji(p.cat)}</Text>
                        <View style={st.flex}>
                          <Text style={T.title} numberOfLines={1}>
                            {p.memo || p.cat}
                          </Text>
                          <Text style={[T.caption, late && st.neg]}>{`${late ? '지났어요 · ' : ''}${shortDay(p.day)}${p.every ? ' · 매달' : ''}`}</Text>
                        </View>
                        <Text style={st.amt}>{fmtWon(p.amount)}</Text>
                      </View>
                    </PressScale>
                  </SwipeRow>
                );
              })}
              <Text style={T.caption}>{`합계 ${fmtWon(plans.reduce((a, p) => a + p.amount, 0))}`}</Text>
            </>
          ) : (
            <Text style={T.caption}>예정된 지출이 없어요. 월세·구독처럼 매달 나가는 돈을 넣어 두세요.</Text>
          )}
        </Card>

        <SectionTitle title="지출 내역" hint={`${list.length}건`} />
        {list.length ? (
          byDay(list).map(g => (
            <View key={g.day}>
              <Text style={[T.label, st.dayHead]}>{`${fmtDay(g.day)} · ${fmtWon(g.total)}`}</Text>
              {g.items.map(t => (
                <SwipeRow key={t.id} onDelete={() => write(updateTx(l => removeTx(l, t.id)))} deleteLabel={`${t.memo || t.cat} 지출 삭제`}>
                  <View style={[st.line, st.lineOnBg]} accessible accessibilityLabel={`${t.memo || t.cat} ${fmtWon(t.amount)}`}>
                    <View style={st.row}>
                      <Text style={st.dotEmoji}>{catEmoji(t.cat)}</Text>
                      <View style={st.flex}>
                        <Text style={T.title} numberOfLines={1}>
                          {t.memo || t.cat}
                        </Text>
                        {!!t.memo && <Text style={T.caption}>{t.cat}</Text>}
                      </View>
                      <Text style={st.amt}>{fmtWon(t.amount)}</Text>
                    </View>
                  </View>
                </SwipeRow>
              ))}
            </View>
          ))
        ) : (
          <EmptyState
            title="아직 기록이 없어요"
            sub="쓸 때마다 금액만 적어도 충분해요"
            accent={A}
            action={isThis ? {label: '지출 기록', onPress: () => setSheet('spend')} : undefined}
          />
        )}
      </ScrollView>

      {sheet === 'spend' && (
        <Sheet title="지출 기록" keyboard onClose={close}>
          <SpendForm day={today} onDone={close} />
        </Sheet>
      )}
      {sheet === 'plan' && (
        <Sheet title="나갈 예정 추가" keyboard onClose={close}>
          <PlanForm onDone={close} />
        </Sheet>
      )}
      {sheet === 'settings' && (
        <Sheet title="가계부 설정" keyboard onClose={close}>
          <SettingsForm settings={settings} current={bal} onDone={close} />
        </Sheet>
      )}
      {sheet?.plan && (
        <Sheet title={sheet.plan.memo || sheet.plan.cat} onClose={close}>
          <PlanDetail p={sheet.plan} onDone={close} />
        </Sheet>
      )}
    </View>
  );
}

// ---- 입력 조각 ----

const ADDS = [
  [1000, '1천', '1,000원'],
  [5000, '5천', '5,000원'],
  [10000, '1만', '10,000원'],
  [50000, '5만', '50,000원'],
];

/** 금액 칸. value = 숫자 또는 ''(빈칸). 숫자만 받는다(음수 불가). */
function WonInput({value, onChange, label, autoFocus}) {
  const num = value === '' || value == null ? '' : Number(value);
  return (
    <View>
      <View style={st.wonRow}>
        <TextInput
          style={[st.input, st.flex]}
          value={num === '' ? '' : fmtNum(num)}
          onChangeText={t => {
            const d = t.replace(/[^0-9]/g, '').slice(0, 10);
            onChange(d ? Number(d) : '');
          }}
          keyboardType="number-pad"
          autoFocus={autoFocus}
          placeholder="0"
          placeholderTextColor={C.hint}
          accessibilityLabel={label}
        />
        <Text style={T.label}>원</Text>
      </View>
      <View style={st.chips}>
        {ADDS.map(([v, short, long]) => (
          <Chip key={v} label={`+${short}`} soft accent={A} onPress={() => onChange((Number(num) || 0) + v)} accessibilityLabel={`${long} 더하기`} />
        ))}
      </View>
    </View>
  );
}

function CatChips({value, onChange}) {
  return (
    <View style={st.chips}>
      {CATS.map(([c, e]) => (
        <Chip key={c} label={c} emoji={e} selected={c === value} accent={A} onPress={() => onChange(c)} accessibilityLabel={`분류 ${c}`} />
      ))}
    </View>
  );
}

function RiskPreview({risk}) {
  if (!risk.level) {
    return (
      <View style={[st.risk, {backgroundColor: C.fill}]}>
        <Text style={T.caption}>설정에서 월 예산·잔고를 넣으면 얼마나 위태로운지 미리 보여드려요</Text>
      </View>
    );
  }
  const L = LEVEL[risk.level];
  const last = risk.lines.length - 1;
  return (
    <View style={[st.risk, st.row, {backgroundColor: L.accent.soft}]} accessible accessibilityLabel={`${L.label}. ${risk.lines.join('. ')}`}>
      <Badge label={L.label} accent={{...L.accent, soft: C.card}} style={st.riskBadge} />
      <View style={st.flex}>
        {risk.lines.map((l, i) => (
          <Text key={i} style={[T.body, i === last && risk.payday && risk.payday.after < 0 && st.neg]}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ---- 시트들 ----

/** 지출 기록. 화면 시트와 + 시트(ctx.openSheet) 둘 다 쓴다 — 그래서 데이터를 스스로 읽는다. */
function SpendForm({day, onDone, heading, toast}) {
  const data = useBudget();
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('식비');
  const [memo, setMemo] = useState('');
  const [d, setD] = useState(() => (day && day <= dayKey() ? day : dayKey()));
  const [busy, setBusy] = useState(false);
  const n = Number(amount) || 0;
  const risk = assess({...data, add: n > 0 ? {amount: n, day: d, kind: 'spend'} : undefined});
  const save = () => {
    setBusy(true);
    write(updateTx(l => addTx(l, {amount: n, cat, memo: memo.trim(), day: d}, Date.now()))).then(ok => {
      setBusy(false);
      if (!ok) return;
      toast?.({title: '지출 기록', msg: `${fmtWon(n)} · ${cat}`});
      onDone();
    });
  };
  return (
    <ScrollView style={st.sheetBody} keyboardShouldPersistTaps="handled">
      <View style={st.form}>
        {heading && <Text style={T.h2}>지출 기록</Text>}
        <WonInput value={amount} onChange={setAmount} label="금액" autoFocus />
        <CatChips value={cat} onChange={setCat} />
        <TextInput style={[st.input, st.memo]} value={memo} onChangeText={setMemo} placeholder="메모 (선택)" placeholderTextColor={C.hint} maxLength={40} accessibilityLabel="메모" />
        <DateNav day={d} onChange={setD} accent={A} />
        <RiskPreview risk={risk} />
        <Button label="기록" accent={A} disabled={n <= 0 || busy} onPress={save} />
      </View>
    </ScrollView>
  );
}

function PlanForm({onDone}) {
  const data = useBudget();
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('식비');
  const [memo, setMemo] = useState('');
  const [d, setD] = useState(dayKey);
  const [every, setEvery] = useState(false);
  const [busy, setBusy] = useState(false);
  const n = Number(amount) || 0;
  const risk = assess({...data, add: n > 0 ? {amount: n, day: d, kind: 'plan'} : undefined});
  const save = () => {
    setBusy(true);
    write(updatePlan(l => addPlan(l, {amount: n, cat, memo: memo.trim(), day: d, every: every ? 'month' : undefined}, Date.now()))).then(ok => {
      setBusy(false);
      if (ok) onDone();
    });
  };
  return (
    <ScrollView style={st.sheetBody} keyboardShouldPersistTaps="handled">
      <View style={st.form}>
        <WonInput value={amount} onChange={setAmount} label="금액" autoFocus />
        <CatChips value={cat} onChange={setCat} />
        <TextInput
          style={[st.input, st.memo]}
          value={memo}
          onChangeText={setMemo}
          placeholder="무엇에 쓰는 돈인가요 (예: 월세)"
          placeholderTextColor={C.hint}
          maxLength={40}
          accessibilityLabel="메모"
        />
        <DateNav day={d} onChange={setD} accent={A} max={null} />
        <View style={st.chips}>
          <Chip label="+1주" soft accent={A} onPress={() => setD(shiftDay(d, 7))} accessibilityLabel="예정일 1주 뒤로" />
          <Chip label="+1달" soft accent={A} onPress={() => setD(nextDom(d, Number(d.slice(8))))} accessibilityLabel="예정일 1달 뒤로" />
          <Chip label="매달 반복" icon="clock" selected={every} accent={A} onPress={() => setEvery(v => !v)} />
        </View>
        <RiskPreview risk={risk} />
        <Button label="예정 추가" accent={A} disabled={n <= 0 || busy} onPress={save} />
      </View>
    </ScrollView>
  );
}

/** current = 지금 계산된 잔고(적은 값 - 그 뒤 지출). 손대지 않고 저장하면 적은 시점을 그대로 둔다. */
function SettingsForm({settings, current, onDone}) {
  // 계산 잔고가 음수면 0으로 채우고 실제 값은 캡션으로 보여 준다. 손대지 않고 저장하면 same -> 적은 시점 유지
  const shown = current != null ? Math.max(0, current) : '';
  const [monthly, setMonthly] = useState(settings.monthly || '');
  const [balance, setBalance] = useState(shown);
  const [payday, setPayday] = useState(settings.payday);
  const save = () => {
    const unset = balance === '';
    const same = settings.balanceAt > 0 && balance === shown;
    write(
      saveSettings({
        monthly: Number(monthly) || 0,
        payday,
        ...(unset
          ? {balance: 0, balanceAt: 0}
          : same
          ? {balance: settings.balance, balanceAt: settings.balanceAt}
          : {balance, balanceAt: Date.now()}),
      }).then(ok => {
        if (!ok) throw new Error('저장 실패');
      }),
    ).then(ok => ok && onDone());
  };
  return (
    <ScrollView style={st.sheetBody} keyboardShouldPersistTaps="handled">
      <View style={st.form}>
        <Text style={T.label}>월 예산</Text>
        <WonInput value={monthly} onChange={setMonthly} label="월 예산" />
        <Text style={T.caption}>0 = 안 씀</Text>
        <Text style={[T.label, st.mt]}>지금 통장 잔고</Text>
        <WonInput value={balance} onChange={setBalance} label="지금 통장 잔고" />
        {current != null && current < 0 && <Text style={[T.caption, st.neg]}>{`지금 계산 잔고 -${fmtWon(-current)}`}</Text>}
        <Text style={T.caption}>잔고를 적은 뒤 기록하는 지출만 여기서 빼요</Text>
        <Text style={[T.label, st.mt]}>월급날</Text>
        <Stepper value={payday} onChange={setPayday} min={1} max={31} unit="일" label="월급날" accent={A} />
        <Button label="저장" accent={A} onPress={save} />
      </View>
    </ScrollView>
  );
}

function PlanDetail({p, onDone}) {
  // 예정 -> 지출은 두 키를 함께 바꾼다. update 체인은 키 하나씩이라 이 경로만 직접 읽고 쓴다(동시에 겹칠 일은 사람 손 한 번).
  const pay = () =>
    write(
      Promise.all([loadPlan(), loadTx()]).then(async ([pl, t]) => {
        const r = payPlan(pl, t, p.id, dayKey(), Date.now());
        const ok = await Promise.all([savePlan(r.plan), saveTx(r.tx)]);
        if (!ok.every(Boolean)) throw new Error('저장 실패');
      }),
    ).then(ok => ok && onDone());
  const del = () => write(updatePlan(l => removePlan(l, p.id))).then(ok => ok && onDone());
  return (
    <View style={st.form}>
      <Text style={[T.h2, st.center]}>{fmtWon(p.amount)}</Text>
      <Text style={[T.caption, st.center]}>{`${fmtDay(p.day)}${p.every ? ` · 매달 ${p.dom}일` : ''}`}</Text>
      {!!p.every && <Text style={[T.caption, st.center]}>{`기록하면 다음 달 ${p.dom}일로 넘어가요`}</Text>}
      <Button label="오늘 지출로 기록" accent={A} onPress={pay} />
      <Button label="삭제" tone="soft" accent={A} onPress={del} />
    </View>
  );
}

const st = StyleSheet.create({
  flex: {flex: 1},
  in: {paddingHorizontal: S.md, paddingBottom: S.lg},
  head: {flexDirection: 'row', alignItems: 'center', paddingTop: S.sm, paddingBottom: S.xs},
  card: {marginTop: S.sm},
  center: {textAlign: 'center'},
  mt: {marginTop: S.sm},
  row: {flexDirection: 'row', alignItems: 'center', gap: S.xs},
  bigUnit: {fontSize: 14, fontWeight: '600', color: C.sub}, // 큰 숫자 안 글자: lineHeight 없이(있으면 줄이 잘린다)
  big: {fontSize: 32, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums']},
  link: {fontSize: 14, fontWeight: '600', color: C.primary},
  neg: {color: C.danger},
  form: {gap: S.xs, paddingBottom: S.sm},
  sheetBody: {maxHeight: 560},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginTop: S.xs},

  monthRow: {flexDirection: 'row', alignItems: 'center', marginBottom: S.xs},
  monthMid: {flex: 1, alignItems: 'center'},
  toThis: {fontSize: 13, fontWeight: '600', color: C.primary, marginTop: 2},
  navBtn: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  navOff: {opacity: 0.25},

  track: {height: 8, borderRadius: 4, backgroundColor: C.fill, overflow: 'hidden', marginTop: S.sm, marginBottom: S.xxs},
  fillBar: {height: 8, borderRadius: 4},
  balBox: {flex: 1, borderRadius: R.md, padding: S.sm, gap: 2, backgroundColor: C.fill},
  balTx: {color: C.text},
  badge: {alignSelf: 'center'},

  catRow: {marginBottom: S.sm},
  emoji: {fontSize: 18},
  pct: {minWidth: 30, textAlign: 'right'},
  catTrack: {height: 6, borderRadius: 3, overflow: 'hidden', marginTop: S.xxs, backgroundColor: C.fill},
  catBar: {height: 6, borderRadius: 3, backgroundColor: C.primary},

  line: {backgroundColor: C.fill, borderRadius: R.md, padding: S.sm, minHeight: 56, justifyContent: 'center'},
  // 지출 내역은 카드 밖(회색 페이지) -> 회색 행은 안 보여서 흰 행
  lineOnBg: {backgroundColor: C.card},
  dotEmoji: {fontSize: 20, width: 28, textAlign: 'center'},
  amt: {fontSize: 15, fontWeight: '700', color: C.text},
  dayHead: {marginTop: S.sm, marginBottom: S.xs},

  wonRow: {flexDirection: 'row', alignItems: 'center', gap: S.xs},
  input: {borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 0, paddingVertical: S.xs, fontSize: 32, fontWeight: '800', color: C.text},
  memo: {fontSize: 16, fontWeight: '500'},
  risk: {borderRadius: R.lg, padding: S.sm, marginTop: S.xxs},
  riskBadge: {alignSelf: 'flex-start', marginTop: 2},
});
