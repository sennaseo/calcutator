/**
 * 건강 탭: [오늘 | 내 목록]
 * - 오늘: 아침·점심·저녁·자기 전 카드에 그 시간 항목. 누르면 체크(다시 누르면 취소). 한 번 복용 추가.
 * - 내 목록: 영양제 / 약. 누르면 정보, 길게 누르면 고치기, 밀어서 삭제.
 * 정보 화면(HealthInfo)은 App 스택에 자리가 없어서 이 탭 안에서 띄운다(뒤로가기 처리 포함).
 * 데이터·계산은 src/health/store.js, 식약처 검색은 src/health/api.js.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Alert, Animated, BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {C, S, R, T, ACCENT} from '../theme';
import {Icon} from '../ui';
import {Badge, Button, Card, Chip, EmptyState, FadeIn, PressScale, Ring, SectionTitle, Segmented, Sheet, SwipeRow, useReduceMotion} from '../kit';
import {registerSummary, registerQuickAction, notifySummary, onSummaryChange} from '../registry';
import {dayKey, fmtDay, fmtTime} from '../store';
import {
  SLOTS,
  KIND_LABEL,
  slotOf,
  slotLabel,
  loadItems,
  saveItems,
  loadDose,
  saveDose,
  upsertItem,
  removeItem,
  toggleDose,
  addExtra,
  removeExtra,
  isTaken,
  planned,
  countDay,
  buildSummary,
} from '../health/store';
import {hasKey, searchDrugs, searchSupplements} from '../health/api';
import HealthInfo from './HealthInfo';

const A = ACCENT.health;

// ---- registry 연결(App이 import할 때 등록) ----

registerSummary('health', async day => {
  const [items, dose] = await Promise.all([loadItems(), loadDose(day)]);
  return buildSummary(items, dose, new Date().getHours());
});

registerQuickAction({
  id: 'health-dose',
  label: '영양제·약',
  icon: 'pill',
  run: ctx => ctx.openSheet(close => <QuickDose day={ctx.day} close={close} go={ctx.go} />),
});

// 이 화면이 직접 바꾼 알림은 스스로 다시 읽지 않는다(빠른 연타 중 늦은 읽기가 새 체크를 덮지 않게)
let quiet = false;
const notifyQuiet = () => {
  quiet = true;
  notifySummary();
  quiet = false;
};

const saveFail = () => Alert.alert('저장하지 못했어요', '기기 저장 공간을 확인한 뒤 다시 시도해 주세요.');

const SEGS = [
  {key: 'today', label: '오늘'},
  {key: 'mine', label: '내 목록'},
];
const KINDS = [
  {key: 'supplement', label: '영양제'},
  {key: 'medicine', label: '약'},
];
const kindIcon = k => (k === 'medicine' ? 'pill' : 'capsule');
const slotsText = slots => (slots.length ? slots.map(slotLabel).join('·') : '필요할 때');

/** @param {any} props {day, go, push} */
export default function Health({day}) {
  const [seg, setSeg] = useState('today');
  const [items, setItems] = useState([]);
  const [dose, setDose] = useState({extra: []});
  const [loaded, setLoaded] = useState(false);
  const [infoId, setInfoId] = useState(null);
  const [editor, setEditor] = useState(null); // {item?} -- 열려 있으면 객체
  const [extraOpen, setExtraOpen] = useState(false);
  const itemsRef = useRef(items);
  const doseRef = useRef(dose);

  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([loadItems(), loadDose(day)]).then(([i, d]) => {
        if (!alive) return; // 날짜를 빨리 넘기면 늦게 온 이전 날 결과는 버린다
        itemsRef.current = i;
        doseRef.current = d;
        setItems(i);
        setDose(d);
        setLoaded(true);
      });
    setLoaded(false);
    load();
    const off = onSummaryChange(() => !quiet && load()); // + 시트에서 체크했을 때
    return () => {
      alive = false;
      off();
    };
  }, [day]);

  // 정보 화면이 떠 있으면 뒤로가기 = 닫기
  useEffect(() => {
    if (!infoId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setInfoId(null);
      return true;
    });
    return () => sub.remove();
  }, [infoId]);

  const putItems = next => {
    itemsRef.current = next;
    setItems(next);
    saveItems(next).then(ok => (ok ? notifyQuiet() : saveFail()));
  };
  const putDose = next => {
    if (!loaded) return; // 불러오기 전에 저장하면 그날 기록을 덮는다
    doseRef.current = next;
    setDose(next);
    saveDose(day, next).then(ok => (ok ? notifyQuiet() : saveFail()));
  };

  const del = item =>
    Alert.alert('목록에서 지울까요?', `${item.name}\n지난 체크 기록은 그대로 남아요.`, [
      {text: '취소', style: 'cancel'},
      {text: '삭제', style: 'destructive', onPress: () => putItems(removeItem(itemsRef.current, item.id))},
    ]);

  const info = infoId && items.find(i => i.id === infoId);
  if (info) {
    return (
      <HealthInfo
        item={info}
        items={items}
        onBack={() => setInfoId(null)}
        onEdit={() => setEditor({item: info})}
        onInfo={data => putItems(upsertItem(itemsRef.current, {id: info.id, info: data}))}>
        {editor && <ItemSheet item={editor.item} onClose={() => setEditor(null)} onSave={it => putItems(upsertItem(itemsRef.current, it))} />}
      </HealthInfo>
    );
  }

  const c = countDay(items, dose);
  return (
    <View style={st.flex}>
      <View style={st.head}>
        <View style={st.headRow}>
          <View style={st.flex}>
            <Text style={T.h1}>건강</Text>
            <Text style={T.caption}>{day === dayKey() ? `오늘 · ${fmtDay(day)}` : fmtDay(day)}</Text>
          </View>
          {c.planned > 0 && (
            <Ring progress={c.taken / c.planned} size={56} stroke={6}>
              <Text style={st.ringTx} accessibilityLabel={`${c.planned}개 중 ${c.taken}개 챙김`}>
                {c.taken}/{c.planned}
              </Text>
            </Ring>
          )}
        </View>
        <Segmented options={SEGS} value={seg} onChange={setSeg} accent={A} style={st.seg} />
      </View>
      {seg === 'today' ? (
        <TodayView
          items={items}
          dose={dose}
          loaded={loaded}
          onToggle={(id, slot) => putDose(toggleDose(doseRef.current, id, slot))}
          onAdd={() => setEditor({})}
          onExtra={() => setExtraOpen(true)}
          onDelExtra={e =>
            Alert.alert('한 번 복용 기록을 지울까요?', e.name, [
              {text: '취소', style: 'cancel'},
              {text: '삭제', style: 'destructive', onPress: () => putDose(removeExtra(doseRef.current, e.at))},
            ])
          }
        />
      ) : (
        <MineView items={items} onInfo={i => setInfoId(i.id)} onEdit={i => setEditor({item: i})} onAdd={() => setEditor({})} onDelete={del} />
      )}
      {editor && <ItemSheet item={editor.item} onClose={() => setEditor(null)} onSave={it => putItems(upsertItem(itemsRef.current, it))} />}
      {extraOpen && (
        <ExtraSheet items={items} onClose={() => setExtraOpen(false)} onSave={e => putDose(addExtra(doseRef.current, e))} />
      )}
    </View>
  );
}

// ---- 오늘 ----

function TodayView({items, dose, loaded, onToggle, onAdd, onExtra, onDelExtra}) {
  const all = planned(items);
  const now = slotOf();
  const extra = dose.extra || [];
  if (!items.length && !extra.length) {
    return (
      <ScrollView contentContainerStyle={st.in}>
        <EmptyState
          title="영양제·약을 등록해 보세요"
          sub="먹는 시간을 정해 두면 하루에 챙긴 걸 체크할 수 있어요"
          action={{label: '+ 추가', onPress: onAdd}}
        />
        <Pressable onPress={onExtra} accessibilityRole="button" style={st.extraLink}>
          <Text style={st.extraLinkTx}>한 번 복용 추가</Text>
        </Pressable>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={st.in}>
      {SLOTS.map((s, i) => {
        const rows = all.filter(p => p.slot === s.key);
        if (!rows.length) return null;
        const left = rows.filter(p => !isTaken(dose, p.item.id, s.key)).length;
        return (
          <FadeIn key={s.key} index={i} style={st.gap}>
            <Card title={s.label} icon={s.icon} accent={A}>
              <View style={st.slotHint}>
                {s.key === now && <Badge label="지금" accent={A} />}
                <Text style={T.tiny}>{left ? `${left}개 남음` : '다 챙겼어요'}</Text>
              </View>
              {rows.map(({item}) => (
                <DoseRow
                  key={item.id}
                  item={item}
                  at={dose[item.id]?.[s.key]}
                  slot={s.label}
                  disabled={!loaded}
                  onPress={() => onToggle(item.id, s.key)}
                />
              ))}
            </Card>
          </FadeIn>
        );
      })}
      {!all.length && <Text style={[T.caption, st.note]}>시간을 정한 항목이 없어요. 내 목록에서 길게 눌러 시간을 골라 보세요.</Text>}
      {extra.length > 0 && (
        <Card title="한 번 복용" icon="plus" accent={A} style={st.gap}>
          {extra.map(e => (
            <SwipeRow key={e.at} onDelete={() => onDelExtra(e)} deleteLabel={`${e.name} 기록 삭제`} style={st.extraSwipe}>
              <View style={st.extraRow} accessible accessibilityLabel={`${e.name} ${e.dose || ''} ${fmtTime(e.at)}`}>
                <Icon name={kindIcon(e.kind)} size={18} color={C.sub} />
                <Text style={[T.body, st.flex]} numberOfLines={1}>
                  {e.name}
                  {!!e.dose && <Text style={T.caption}>{`  ${e.dose}`}</Text>}
                </Text>
                <Text style={T.tiny}>{fmtTime(e.at)}</Text>
              </View>
            </SwipeRow>
          ))}
        </Card>
      )}
      <Pressable onPress={onExtra} accessibilityRole="button" style={st.extraLink}>
        <Text style={st.extraLinkTx}>한 번 복용 추가</Text>
      </Pressable>
    </ScrollView>
  );
}

/** 체크 줄: 누르면 동그라미가 톡 차오르고 줄이 옅게 물든다. */
function DoseRow({item, at, slot, onPress, disabled, compact}) {
  const reduce = useReduceMotion();
  const taken = !!at;
  const tint = useRef(new Animated.Value(taken ? 1 : 0)).current; // 배경색(JS 드라이버)
  const pop = useRef(new Animated.Value(taken ? 1 : 0)).current; // 체크 크기(네이티브)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) {
      tint.setValue(taken ? 1 : 0);
      pop.setValue(taken ? 1 : 0);
      return;
    }
    Animated.timing(tint, {toValue: taken ? 1 : 0, duration: 220, useNativeDriver: false}).start();
    if (taken) {
      pop.setValue(0.3);
      Animated.spring(pop, {toValue: 1, useNativeDriver: true, speed: 14, bounciness: 16}).start();
    } else {
      Animated.timing(pop, {toValue: 0, duration: 140, useNativeDriver: true}).start();
    }
  }, [taken, reduce, tint, pop]);
  const bg = tint.interpolate({inputRange: [0, 1], outputRange: [C.card, C.tint]});
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{checked: taken}}
      accessibilityLabel={`${slot} ${item.name} ${item.dose || ''}`}
      accessibilityHint={taken ? '누르면 체크를 취소해요' : '누르면 먹음으로 체크해요'}
      style={st.rowWrap}>
      <Animated.View style={[st.row, compact && st.rowCompact, {backgroundColor: bg}]}>
        <View style={[st.box, taken && {borderColor: C.primary}]}>
          <Animated.View style={[st.boxFill, {opacity: pop, transform: [{scale: pop}]}]}>
            <Icon name="check" size={18} color={C.white} width={3} />
          </Animated.View>
        </View>
        <View style={st.flex}>
          <Text style={[T.body, st.bold, taken && {color: C.primaryDark}]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={T.tiny} numberOfLines={1}>
            {[item.dose, taken ? `${fmtTime(at)}에 챙김` : ''].filter(Boolean).join(' · ') || KIND_LABEL[item.kind]}
          </Text>
        </View>
        <Icon name={kindIcon(item.kind)} size={18} color={taken ? C.primary : C.faint} />
      </Animated.View>
    </PressScale>
  );
}

// ---- 내 목록 ----

function MineView({items, onInfo, onEdit, onAdd, onDelete}) {
  if (!items.length) {
    return (
      <ScrollView contentContainerStyle={st.in}>
        <EmptyState title="아직 등록한 게 없어요" sub="먹고 있는 영양제나 약을 추가해 보세요" action={{label: '+ 추가', onPress: onAdd}} />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={st.in}>
      <Button label="+ 추가" accent={A} onPress={onAdd} />
      {KINDS.map(k => {
        const list = items.filter(i => i.kind === k.key);
        if (!list.length) return null;
        return (
          <View key={k.key}>
            <SectionTitle title={k.label} hint={`${list.length}개 · 길게 눌러 고치기`} />
            {list.map((it, i) => (
              <FadeIn key={it.id} index={i}>
                <SwipeRow onDelete={() => onDelete(it)} deleteLabel={`${it.name} 삭제`}>
                  <PressScale
                    style={st.mine}
                    scaleTo={0.98}
                    onPress={() => onInfo(it)}
                    onLongPress={() => onEdit(it)}
                    accessibilityLabel={`${it.name}, ${it.dose || ''} ${slotsText(it.slots)}`}
                    accessibilityHint="누르면 정보, 길게 누르면 고치기">
                    <View style={st.mineIn}>
                      <Icon name={kindIcon(it.kind)} size={20} color={C.sub} />
                      <View style={st.flex}>
                        <Text style={[T.body, st.bold]} numberOfLines={1}>
                          {it.name}
                        </Text>
                        <Text style={T.tiny} numberOfLines={1}>
                          {[it.dose, slotsText(it.slots), it.memo].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Icon name="chev" size={18} color={C.faint} />
                    </View>
                  </PressScale>
                </SwipeRow>
              </FadeIn>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ---- 추가·고치기 ----

/** 이름으로 식약처 검색(400ms 기다렸다가, 2글자부터). skip이면 쉰다. */
function useSearch(api, q, skip) {
  const [s, setS] = useState({status: 'idle', list: []});
  useEffect(() => {
    const query = q.trim();
    if (skip || query.length < 2 || !hasKey(api)) {
      setS({status: 'idle', list: []});
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      setS(p => ({status: 'loading', list: p.list}));
      (api === 'drug' ? searchDrugs : searchSupplements)(query).then(
        list => alive && setS({status: 'done', list: list.slice(0, 20)}),
        e => alive && setS({status: 'error', list: [], error: e.message}),
      );
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [api, q, skip]);
  return s;
}

function ItemSheet({item, onSave, onClose}) {
  const [kind, setKind] = useState(item?.kind || 'supplement');
  const [name, setName] = useState(item?.name || '');
  const [link, setLink] = useState(item?.source ? {name: item.name, source: item.source, info: item.info} : null);
  const [manual, setManual] = useState(!!item);
  const [dose, setDose] = useState(item?.dose || '');
  const [slots, setSlots] = useState(item?.slots || [slotOf()]);
  const [memo, setMemo] = useState(item?.memo || '');
  const api = kind === 'medicine' ? 'drug' : 'supplement';
  const linked = link && link.name === name;
  const search = useSearch(api, name, manual || !!linked);
  const pick = r => {
    Keyboard.dismiss();
    setName(r.name);
    setLink({name: r.name, source: {api: r.api, id: r.id}, info: {raw: r.raw, fetchedAt: Date.now()}});
  };
  const save = () => {
    const n = name.trim();
    if (!n) return;
    onSave({
      ...(item || {}),
      kind,
      name: n,
      dose: dose.trim(),
      slots: SLOTS.map(s => s.key).filter(k => slots.includes(k)),
      memo: memo.trim(),
      source: linked ? link.source : undefined,
      info: linked ? link.info : undefined,
    });
    onClose(); // 코드로 닫기 = 부모가 안 그리기(kit Sheet 약속)
  };

  return (
    <Sheet title={item ? '고치기' : '영양제·약 추가'} onClose={onClose} keyboard>
      <ScrollView style={st.sheetBody} keyboardShouldPersistTaps="handled">
        <Segmented
          options={KINDS}
          value={kind}
          accent={A}
          onChange={k => {
            setKind(k);
            setLink(null);
            setManual(false);
          }}
        />
        <Text style={st.label}>이름</Text>
        <View style={st.searchBox}>
          <Icon name="search" size={18} color={C.faint} />
          <TextInput
            style={st.searchIn}
            value={name}
            onChangeText={t => {
              setName(t);
              setManual(false);
            }}
            placeholder={kind === 'medicine' ? '예: 타이레놀' : '예: 비타민D'}
            placeholderTextColor={C.hint}
            accessibilityLabel="이름 검색"
            returnKeyType="search"
          />
          {!!name && (
            <Pressable onPress={() => setName('')} hitSlop={10} style={st.clear} accessibilityRole="button" accessibilityLabel="이름 지우기">
              <Icon name="close" size={18} color={C.faint} />
            </Pressable>
          )}
        </View>
        {!hasKey(api) && <Text style={[T.caption, st.note]}>정보 검색 키가 설정되지 않았어요. 이름을 직접 적어 주세요.</Text>}
        {linked && <Badge label="식약처 정보 연결됨" accent={A} style={st.linked} />}
        {!linked && !manual && hasKey(api) && name.trim().length >= 2 && (
          <View style={st.results}>
            {search.status === 'loading' && !search.list.length && <Text style={[T.caption, st.note]}>찾는 중…</Text>}
            {search.status === 'error' && <Text style={[T.caption, st.note]}>{search.error}</Text>}
            {search.status === 'done' && !search.list.length && (
              <Text style={[T.caption, st.note]}>
                {kind === 'medicine' ? '검색 결과가 없어요. 전문의약품은 없을 수 있어요.' : '검색 결과가 없어요.'}
              </Text>
            )}
            {search.list.map(r => (
              <PressScale key={`${r.id}-${r.name}`} style={st.result} onPress={() => pick(r)} accessibilityLabel={`${r.name}, ${r.company}`}>
                <Text style={[T.body, st.bold]} numberOfLines={2}>
                  {r.name}
                </Text>
                {!!r.company && <Text style={T.tiny}>{r.company}</Text>}
              </PressScale>
            ))}
            <PressScale
              style={st.result}
              onPress={() => {
                Keyboard.dismiss();
                setManual(true);
              }}
              accessibilityLabel={`${name.trim()} 직접 입력`}>
              <Text style={[T.body, {color: A.dark}]}>{`‘${name.trim()}’ 직접 입력`}</Text>
            </PressScale>
          </View>
        )}
        <Text style={st.label}>한 번에 먹는 양</Text>
        <TextInput
          style={st.input}
          value={dose}
          onChangeText={setDose}
          placeholder="예: 1정, 2캡슐"
          placeholderTextColor={C.hint}
          accessibilityLabel="한 번에 먹는 양"
        />
        <Text style={st.label}>먹는 시간</Text>
        <View style={st.chips}>
          {SLOTS.map(s => (
            <Chip
              key={s.key}
              label={s.label}
              selected={slots.includes(s.key)}
              accent={A}
              onPress={() => setSlots(v => (v.includes(s.key) ? v.filter(x => x !== s.key) : [...v, s.key]))}
            />
          ))}
        </View>
        {!slots.length && <Text style={[T.tiny, st.note]}>시간을 안 고르면 ‘필요할 때’로 둬요(오늘 체크엔 안 나와요).</Text>}
        <Text style={st.label}>메모</Text>
        <TextInput
          style={st.input}
          value={memo}
          onChangeText={setMemo}
          placeholder="예: 식후에"
          placeholderTextColor={C.hint}
          accessibilityLabel="메모"
        />
        <Button label="저장" accent={A} onPress={save} disabled={!name.trim()} style={st.save} />
      </ScrollView>
    </Sheet>
  );
}

/** 목록에 없는 약을 한 번 먹었을 때(예: 진통제). 내 목록 항목을 눌러 채울 수도 있다. */
function ExtraSheet({items, onSave, onClose}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('medicine');
  const [dose, setDose] = useState('');
  const save = () => {
    if (!name.trim()) return;
    onSave({name: name.trim(), kind, dose: dose.trim()});
    onClose();
  };
  return (
    <Sheet title="한 번 복용 추가" onClose={onClose} keyboard>
      <ScrollView style={st.sheetBody} keyboardShouldPersistTaps="handled">
        {items.length > 0 && (
          <>
            <Text style={st.label}>내 목록에서</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipsRow}>
              {items.map(i => (
                <Chip
                  key={i.id}
                  label={i.name}
                  icon={kindIcon(i.kind)}
                  accent={A}
                  selected={name === i.name}
                  onPress={() => {
                    setName(i.name);
                    setKind(i.kind);
                    setDose(i.dose || '');
                  }}
                />
              ))}
            </ScrollView>
          </>
        )}
        <Segmented options={KINDS} value={kind} onChange={setKind} accent={A} style={st.gapTop} />
        <Text style={st.label}>이름</Text>
        <TextInput
          style={st.input}
          value={name}
          onChangeText={setName}
          placeholder="예: 진통제"
          placeholderTextColor={C.hint}
          accessibilityLabel="이름"
        />
        <Text style={st.label}>양</Text>
        <TextInput
          style={st.input}
          value={dose}
          onChangeText={setDose}
          placeholder="예: 1정"
          placeholderTextColor={C.hint}
          accessibilityLabel="양"
        />
        <Button label="지금 먹었어요" accent={A} onPress={save} disabled={!name.trim()} style={st.save} />
      </ScrollView>
    </Sheet>
  );
}

// ---- + 버튼 시트 ----

/** 지금 끼니에서 아직 안 챙긴 항목(연 순간 기준)을 한 번에 체크. */
function QuickDose({day, close, go}) {
  const [data, setData] = useState(null);
  const doseRef = useRef(null);
  const slot = slotOf();
  useEffect(() => {
    let alive = true;
    Promise.all([loadItems(), loadDose(day)]).then(([items, dose]) => {
      if (!alive) return;
      doseRef.current = dose;
      // 연 순간 안 챙긴 것만. 체크해도 줄은 남겨 둬서 바로 취소할 수 있게.
      const rows = planned(items).filter(p => p.slot === slot && !isTaken(dose, p.item.id, slot));
      setData({items, dose, rows});
    });
    return () => {
      alive = false;
    };
  }, [day, slot]);

  const toggle = id => {
    const next = toggleDose(doseRef.current, id, slot);
    doseRef.current = next;
    setData(d => ({...d, dose: next}));
    saveDose(day, next).then(ok => (ok ? notifySummary() : saveFail()));
  };

  return (
    <View>
      <Text style={[T.h2, st.qTitle]}>{`${slotLabel(slot)} 영양제·약`}</Text>
      {!data ? (
        <Text style={[T.caption, st.note]}>불러오는 중…</Text>
      ) : !data.items.length ? (
        <Text style={[T.caption, st.note]}>아직 등록한 영양제·약이 없어요.</Text>
      ) : !data.rows.length ? (
        <Text style={[T.caption, st.note]}>{`${slotLabel(slot)}에 챙길 게 더 없어요.`}</Text>
      ) : (
        <ScrollView style={st.qList}>
          {data.rows.map(({item}) => (
            <DoseRow key={item.id} item={item} at={data.dose[item.id]?.[slot]} slot={slotLabel(slot)} onPress={() => toggle(item.id)} compact />
          ))}
        </ScrollView>
      )}
      <Button
        label="건강 탭 열기"
        tone="soft"
        accent={A}
        onPress={() => {
          close();
          go('health');
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  flex: {flex: 1},
  extraLink: {minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: S.sm},
  extraLinkTx: {fontSize: 14, fontWeight: '600', color: C.primary},
  bold: {fontWeight: '700'},
  head: {paddingHorizontal: S.md, paddingTop: S.sm},
  headRow: {flexDirection: 'row', alignItems: 'center', gap: S.sm},
  ringTx: {fontSize: 14, fontWeight: '800', color: A.dark},
  seg: {marginTop: S.sm, backgroundColor: C.fillPressed}, // 회색 페이지 위라 한 단계 진한 회색 틀
  in: {padding: S.md, paddingBottom: S.xl * 2},
  gap: {marginBottom: S.sm},
  gapTop: {marginTop: S.sm},
  note: {marginTop: S.xs, lineHeight: 18},
  slotHint: {flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: -S.xs, marginBottom: S.xs},

  rowWrap: {marginTop: S.xxs},
  row: {flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 56, paddingHorizontal: S.sm, borderRadius: R.md},
  rowCompact: {minHeight: 52},
  box: {width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center'},
  boxFill: {position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, margin: -2, borderRadius: 15, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center'},

  extraSwipe: {marginBottom: 0},
  extraRow: {flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 48, backgroundColor: C.card},

  mine: {backgroundColor: C.card, borderRadius: R.lg},
  mineIn: {flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 64, paddingHorizontal: S.md},

  sheetBody: {maxHeight: 560},
  label: {...T.label, marginTop: S.md, marginBottom: S.xs},
  searchBox: {flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: C.fill, borderRadius: R.md, paddingLeft: 14, height: 48},
  searchIn: {flex: 1, fontSize: 16, color: C.text, paddingVertical: 0},
  clear: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  linked: {marginTop: S.xs},
  results: {marginTop: S.xs},
  result: {minHeight: 48, paddingVertical: S.xs, borderBottomWidth: 1, borderBottomColor: C.border, justifyContent: 'center'},
  input: {backgroundColor: C.fill, borderRadius: R.md, height: 48, paddingHorizontal: 14, paddingVertical: 0, fontSize: 16, color: C.text},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: S.xs},
  chipsRow: {flexDirection: 'row', gap: S.xs},
  save: {marginTop: S.lg},

  qTitle: {marginBottom: S.sm},
  qList: {maxHeight: 360},
});
