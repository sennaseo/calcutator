/**
 * 오늘: 하루 대시보드. 주인공은 간식 CLICK 카드(가장 크고 가장 빠르게), 그 아래 건강·생활 요약.
 * 건강·생활 카드는 registry의 요약 함수에서 읽는다(없으면 '기록 없음').
 */
import React, {useEffect, useRef, useState} from 'react';
import {Animated, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {C, S, R, T} from '../theme';
import {Icon} from '../ui';
import {Card, Chip, DateNav, IconJelly, Jelly, PressScale, Ring, useNow} from '../kit';
import CatMascot from '../CatMascot';
import {getSummary, onSummaryChange} from '../registry';
import {dayKey, shortDay, total, isSnack, groupSnacks, agoText, quickSnacks, emojiOf, shortName} from '../store';

const CAT = 208; // 마스코트 크기(dp). Pixel 6 카드 안쪽 폭 ~343dp 중 오른쪽 대부분

const greet = h => (h < 5 ? '늦은 밤이에요' : h < 11 ? '좋은 아침이에요' : h < 17 ? '좋은 오후예요' : '편안한 저녁이에요');

// 생활 카드 칸 자리표시(요약이 없을 때도 무엇을 적는 곳인지 보이게)
const LIFE_SLOTS = [
  {icon: 'chair', label: '앉은 시간'},
  {icon: 'bus', label: '출퇴근'},
  {icon: 'drop', label: '물'},
  {icon: 'moon', label: '수면'},
];

/** 같은 날 요약을 읽고, 바뀌었다는 알림이 오면 다시 읽는다. */
function useSummaries(day) {
  const [s, setS] = useState({health: null, life: null});
  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([getSummary('health', day), getSummary('life', day)]).then(
        ([health, life]) => alive && setS({health, life}),
      );
    load();
    const off = onSummaryChange(load);
    return () => {
      alive = false;
      off();
    };
  }, [day]);
  return s;
}

/** @param {any} props */
export default function Today({day, setDay, items, loaded, recent, favs, current, pulse, onClick, onChange, onQuick, onQuickAdd, go, push}) {
  // 간식 클릭 때 히어로 숫자만 살짝 튄다(1 -> 1.08 -> 1)
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (pulse == null) return;
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {toValue: 1.08, duration: 110, useNativeDriver: true}),
      Animated.timing(scale, {toValue: 1, duration: 110, useNativeDriver: true}),
    ]).start();
  }, [pulse, scale]);

  const [catTouch, setCatTouch] = useState(false);
  const now = useNow(60000); // "마지막 간식 N분 전"이 멈춰 있지 않게
  const sums = useSummaries(day);

  const isToday = day === dayKey();
  const snacks = items.filter(isSnack);
  const groups = groupSnacks(items);
  const chips = quickSnacks(recent, favs);

  return (
    <ScrollView contentContainerStyle={st.in} showsVerticalScrollIndicator={false} scrollEnabled={!catTouch}>
      <View style={st.top}>
        <View style={st.flex}>
          <Text style={T.caption}>{isToday ? greet(new Date(now).getHours()) : '지난 기록'}</Text>
          <Text style={T.h1}>{isToday ? '오늘' : shortDay(day)}</Text>
        </View>
        <Jelly tone="card" h={36} style={st.addBtn} onPress={onQuickAdd} accessibilityLabel="빠른 기록">
          <Icon name="plus" size={16} color={C.text} width={2.4} />
          <Text style={st.addTx}>기록</Text>
        </Jelly>
        <IconJelly plain icon="stats" onPress={() => push('stats')} accessibilityLabel="통계" />
        <IconJelly plain icon="settings" onPress={() => push('settings')} accessibilityLabel="설정" />
      </View>
      <DateNav day={day} onChange={setDay} />

      {/* 간식 CLICK 카드 */}
      <View style={st.snack}>
        <View style={st.hero}>
          <View style={st.flex}>
            <Text style={st.heroLbl}>{isToday ? '오늘 간식' : `${shortDay(day)} 간식`}</Text>
            <View style={st.countRow}>
              <Animated.Text style={[T.hero, {transform: [{scale}]}]} testID="clickCount">
                {snacks.length}
              </Animated.Text>
              <Text style={st.countUnit}>CLICK</Text>
            </View>
          </View>
          {/* 주인공 마스코트: 두드리면 기뻐하고 꾹 누르거나 문지르면 쓰다듬기. 만지는 동안은 화면 스크롤을 잠근다 */}
          <CatMascot size={CAT} press={pulse} onTouch={setCatTouch} style={st.cat} />
        </View>
        <Text style={st.heroSub}>
          {snacks.length
            ? `간식 ${total(snacks).toLocaleString()} kcal${isToday ? ` · 마지막 간식 ${agoText(groups[0].last, now)}` : ''}`
            : isToday
              ? '간식 먹을 때마다, 한 번 클릭.'
              : '간식 기록 없음'}
        </Text>

        {/* 큰 버튼 = 걸린 간식 1개 기록. 로드 전엔 흐리게만 -- 누르면 add의 가드가 알려 준다 */}
        <ClickButton current={current} off={!!current && !loaded} onPress={onClick} />

        <Pressable onPress={onChange} hitSlop={8} accessibilityRole="button" accessibilityLabel="지금 먹는 간식 바꾸기" style={st.changeRow}>
          <Text style={st.quickLbl}>지금 먹는 간식 바꾸기 ›</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
          {chips.map(q => (
            <Chip
              key={q.entry.name}
              emoji={q.emoji}
              label={q.label}
              right={q.entry.kcal}
              selected={!!current && current.name === q.entry.name}
              accessibilityLabel={`${q.label} ${q.entry.kcal} kcal 버튼에 걸기`}
              onPress={() => onQuick(q)}
            />
          ))}
        </ScrollView>
      </View>

      {/* 건강 */}
      <HealthCard s={sums.health} onPress={() => go('health')} />
      {/* 생활 */}
      <LifeCard s={sums.life} onPress={() => go('life')} />
    </ScrollView>
  );
}

/** 큰 CLICK 버튼(전폭 72, 단색 라벤더). 누르면 색이 진해지고 0.98로 살짝 작아진다. */
function ClickButton({current, off, onPress}) {
  const [down, setDown] = useState(false);
  return (
    <PressScale
      scaleTo={0.98}
      onPress={onPress}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      accessibilityLabel={current ? 'CLICK' : '간식 고르기'}
      style={[st.cta, down && st.ctaDown, off && st.off]}>
      {current ? (
        <View style={st.ctaRow}>
          <Text style={st.ctaEmoji}>{emojiOf(current.name)}</Text>
          <View style={st.flex}>
            <Text style={st.ctaName} numberOfLines={1}>
              {shortName(current.name)}
            </Text>
            <Text style={st.ctaSub}>1개 {current.kcal} kcal</Text>
          </View>
          <Text style={st.ctaTx}>CLICK</Text>
        </View>
      ) : (
        <Text style={st.ctaPick}>간식 고르기</Text>
      )}
    </PressScale>
  );
}

function HealthCard({s, onPress}) {
  return (
    <Card title={s?.title || '영양제·약'} onPress={onPress} accessibilityLabel="건강 기록 보기" style={st.dash}>
      <View style={st.healthRow}>
        <Ring progress={s?.progress ?? 0} size={48} stroke={5}>
          <Icon name="check" size={18} color={s?.progress >= 1 ? C.primary : C.faint} width={2.6} />
        </Ring>
        <View style={st.flex}>
          <Text style={[T.h2, !s && st.none]}>{s ? s.value : '기록 없음'}</Text>
          <Text style={T.caption} numberOfLines={2}>
            {s ? s.sub || '' : '먹는 영양제·약을 등록하고 체크해 보세요'}
          </Text>
        </View>
        <Icon name="chev" size={18} color={C.faint} />
      </View>
    </Card>
  );
}

function LifeCard({s, onPress}) {
  const rows = s?.rows?.length ? s.rows : LIFE_SLOTS.map(x => ({...x, value: '기록 없음'}));
  return (
    <Card title={s?.title || '생활'} onPress={onPress} accessibilityLabel="생활 기록 보기" style={st.dash}>
      {!!s?.value && <Text style={[T.h2, st.lifeV]}>{s.value}</Text>}
      <View style={st.grid}>
        {rows.map(r => (
          <View key={r.label} style={st.cell}>
            <Icon name={r.icon} size={18} color={C.sub} />
            <View style={st.flex}>
              <Text style={T.tiny}>{r.label}</Text>
              <Text style={[st.cellV, r.value === '기록 없음' && st.none]} numberOfLines={1}>
                {r.value}
              </Text>
            </View>
          </View>
        ))}
      </View>
      {!!s?.sub && <Text style={[T.caption, st.lifeSub]}>{s.sub}</Text>}
    </Card>
  );
}

const st = StyleSheet.create({
  flex: {flex: 1},
  off: {opacity: 0.4},
  none: {color: C.faint},
  in: {paddingHorizontal: S.md, paddingBottom: S.lg},

  top: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: S.sm, paddingBottom: S.xs},
  addBtn: {paddingHorizontal: S.sm, gap: 4, marginRight: 4},
  addTx: {fontSize: 14, fontWeight: '700', color: C.text},

  snack: {backgroundColor: C.card, borderRadius: R.xl, padding: 20, marginTop: S.sm},
  hero: {flexDirection: 'row', alignItems: 'center'},
  heroLbl: {fontSize: 14, color: C.sub, fontWeight: '600', marginBottom: 2},
  countRow: {flexDirection: 'row', alignItems: 'baseline', gap: S.xs, marginBottom: 4},
  countUnit: {fontSize: 14, fontWeight: '700', color: C.sub, letterSpacing: 1},
  heroSub: {...T.caption, marginTop: -6},
  // 스프라이트 칸 위쪽은 콩 뛰기용 여백 -> 위로 끌어올려 카드 윗부분이 비지 않게(뛰는 머리는 카드 패딩 안에 남는다). 아래는 안 당긴다 -- 긴 부제(kcal·마지막 간식)가 발에 닿는다
  cat: {marginRight: -6, marginTop: -40},

  cta: {marginTop: S.md, height: 72, borderRadius: R.lg, backgroundColor: C.primary, justifyContent: 'center', paddingHorizontal: 20},
  ctaDown: {backgroundColor: C.primaryPressed},
  ctaRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  ctaEmoji: {fontSize: 26},
  ctaName: {fontSize: 16, fontWeight: '700', color: C.white},
  ctaSub: {fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2},
  ctaTx: {fontSize: 22, fontWeight: '800', color: C.white, letterSpacing: 1},
  ctaPick: {fontSize: 17, fontWeight: '700', color: C.white, textAlign: 'center'},

  changeRow: {minHeight: 44, justifyContent: 'center', marginTop: S.xs},
  quickLbl: {fontSize: 14, color: C.sub, fontWeight: '600'},
  chips: {gap: S.xs, paddingRight: S.md},

  dash: {marginTop: S.sm},
  healthRow: {flexDirection: 'row', alignItems: 'center', gap: S.md},
  lifeV: {marginBottom: S.sm},
  lifeSub: {marginTop: S.sm},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: S.xs},
  cell: {flexDirection: 'row', alignItems: 'center', gap: S.xs, width: '48.5%', borderRadius: R.md, padding: S.sm, backgroundColor: C.fill},
  cellV: {fontSize: 15, fontWeight: '700', color: C.text},
});
