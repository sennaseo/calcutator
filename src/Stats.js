/**
 * 통계 탭: 간식(횟수·시간대·종류)이 주인공, 칼로리 그래프는 맨 아래 조연.
 *
 * 막대는 svg 없이 View 높이로 그린다(7개뿐이라 충분). 저장소를 직접 읽으므로
 * 탭을 열 때마다 새로 불러온다 -- 방금 추가한 기록도 바로 반영된다.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import CatMascot from './CatMascot';
import { C, S, R } from './theme';
import { weekStats, dayKey, periodLabel, shortName } from './store';
import { Header, Thumb } from './ui';

const H = 130; // 그래프 높이
const HH = 96; // 시간대 막대 높이
const WH = 110; // 요일별 간식 횟수 막대 높이
const DOW = '일월화수목금토';
// 'YYYY-MM-DD' -> '월'. 문자열 Date 파싱은 Hermes에서 보장되지 않아 숫자로 만든다
const dowOf = day => {
  const [y, m, d] = day.split('-').map(Number);
  return DOW[new Date(y, m - 1, d).getDay()];
};

function DayLabels({ days, today }) {
  return (
    <View style={st.labels}>
      {days.map(d => {
        const isToday = d.day === today;
        return (
          <Text key={d.day} style={[st.lbl, isToday && st.lblToday]}>
            {isToday ? '오늘' : dowOf(d.day)}
          </Text>
        );
      })}
    </View>
  );
}

/** @param {{goal: number, onBack?: () => void}} props */
export default function Stats({ goal, onBack }) {
  const [w, setW] = useState(null);

  useEffect(() => {
    let alive = true;
    weekStats().then(r => alive && setW(r));
    return () => {
      alive = false;
    };
  }, []);

  if (!w) return <View style={st.wrap} />;

  const today = dayKey();
  // 목표선이 그래프 밖으로 나가지 않게 목표와 최대값 중 큰 쪽 기준, 위에 숫자 들어갈 여유 25%
  const sn = w.snack;
  const smax = Math.max(...w.days.map(d => d.snackN), 1) * 1.25;
  const max = Math.max(goal || 0, ...w.days.map(d => d.kcal), 1) * 1.25;

  return (
    <ScrollView style={st.wrap} contentContainerStyle={st.in}>
      <Header title="통계" onBack={onBack} />

      <View style={st.card}>
        <Text style={st.cardTitle}>이번 주 간식</Text>
        <View style={st.trio}>
          <View style={st.cell}>
            <Text style={st.hero}>{sn.n.toLocaleString()}회</Text>
            <Text style={st.note}>횟수</Text>
          </View>
          <View style={st.cell}>
            <Text style={st.mid}>{sn.kcal.toLocaleString()} kcal</Text>
            <Text style={st.note}>칼로리</Text>
          </View>
          <View style={st.cell}>
            <Text style={st.mid}>{sn.avgPerDay.toLocaleString()}회</Text>
            <Text style={st.note}>하루 평균</Text>
          </View>
        </View>
        <Text style={[st.note, st.foot]}>최근 7일 · 기록한 날 기준 평균</Text>
      </View>

      <View
        style={st.card}
        accessible
        accessibilityLabel={
          sn.peak
            ? `시간대별 간식, ${periodLabel(
                sn.peak.from,
                sn.peak.to,
              )}가 가장 많음`
            : '시간대별 간식, 아직 기록 없음'
        }
      >
        <Text style={st.cardTitle}>시간대별 간식</Text>
        <Text style={st.insight}>
          {sn.peak
            ? `${periodLabel(
                sn.peak.from,
                sn.peak.to,
              )}에 간식 기록이 가장 많아요`
            : '간식을 기록하면 시간대 패턴이 보여요'}
        </Text>
        <View style={st.hChart}>
          {sn.byHour.map((n, i) => (
            <View
              key={i}
              style={[
                st.hBar,
                n > 0
                  ? { height: Math.max(6, (n / sn.peak.n) * HH) }
                  : st.hZero,
                n > 0 && n === sn.peak.n && st.hBarPeak,
              ]}
            />
          ))}
        </View>
        <View style={st.hAxis}>
          {[0, 6, 12, 18, 24].map(h => (
            <Text key={h} style={st.lbl2}>
              {h}
            </Text>
          ))}
        </View>
      </View>

      {sn.top.length > 0 && (
        <View style={st.card}>
          <Text style={st.cardTitle}>많이 먹은 간식</Text>
          {sn.top.map((t, i) => (
            <View key={t.name} style={st.row}>
              <Text style={st.rank}>{i + 1}</Text>
              <Thumb name={t.name} size={36} />
              <Text style={st.rowName} numberOfLines={1}>
                {shortName(t.name)}
              </Text>
              <View style={st.rowR}>
                <Text style={st.rowN}>{t.n.toLocaleString()}회</Text>
                <Text style={st.note}>{t.kcal.toLocaleString()} kcal</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View
        style={st.card}
        accessible
        accessibilityLabel={`요일별 간식 횟수, ${w.days
          .map(
            d =>
              `${
                d.day === today
                  ? '오늘'
                  : dowOf(d.day) + '요일'
              } ${d.snackN}회`,
          )
          .join(', ')}`}
      >
        <Text style={st.cardTitle}>요일별 간식 횟수</Text>
        <View style={[st.chart, { height: WH }]}>
          {w.days.map(d => (
            <View key={d.day} style={st.col}>
              {d.snackN > 0 && (
                <Text style={st.val}>{d.snackN.toLocaleString()}</Text>
              )}
              <View
                style={[
                  st.bar,
                  {
                    height: Math.max(
                      d.snackN > 0 ? 4 : 0,
                      (d.snackN / smax) * WH,
                    ),
                  },
                  d.day === today && st.barToday,
                ]}
              />
            </View>
          ))}
        </View>
        <DayLabels days={w.days} today={today} />
      </View>

      <View style={st.card}>
        <Text style={st.cardTitle}>최근 7일 섭취 칼로리</Text>
        <View style={st.chart}>
          {goal > 0 && (
            <View style={[st.goalLine, { bottom: (goal / max) * H }]}>
              <Text style={st.goalTx}>목표 {goal.toLocaleString()}</Text>
            </View>
          )}
          {w.days.map(d => {
            const isToday = d.day === today;
            return (
              <View key={d.day} style={st.col}>
                {d.kcal > 0 && (
                  <Text style={st.val}>{d.kcal.toLocaleString()}</Text>
                )}
                <View
                  style={[
                    st.bar,
                    {
                      height: Math.max(d.kcal > 0 ? 4 : 0, (d.kcal / max) * H),
                    },
                    isToday && st.barToday,
                    goal > 0 && d.kcal > goal && st.barOver,
                  ]}
                />
              </View>
            );
          })}
        </View>
        <DayLabels days={w.days} today={today} />
      </View>

      <View style={st.pair}>
        <View style={[st.card, st.half]}>
          <Text style={st.cardTitle}>주간 평균</Text>
          <Text style={st.big}>
            {w.avg.toLocaleString()} <Text style={st.bigUnit}>kcal</Text>
          </Text>
          <Text style={st.note}>기록한 날 기준</Text>
        </View>
        <View style={[st.card, st.half]}>
          <Text style={st.cardTitle}>기록한 날</Text>
          <Text style={st.big}>
            {w.recorded} <Text style={st.bigUnit}>/ 7일</Text>
          </Text>
          <Text style={st.note}>최근 7일 중</Text>
        </View>
      </View>

      <CatMascot size={100} style={st.cat} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  in: { paddingHorizontal: S.md, paddingBottom: S.lg + 40 },
  card: {
    backgroundColor: C.card,
    borderRadius: R.xl,
    padding: 20,
    marginTop: S.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  chart: {
    height: H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: S.lg,
  },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  val: { fontSize: 10, color: C.sub, marginBottom: 2 },
  bar: { width: 22, borderRadius: 4, backgroundColor: C.border },
  barToday: { backgroundColor: C.primary },
  barOver: { backgroundColor: C.danger },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.sub,
  },
  goalTx: {
    position: 'absolute',
    right: 0,
    top: -16,
    fontSize: 10,
    color: C.sub,
  },
  labels: { flexDirection: 'row', marginTop: S.xs },
  lbl: { flex: 1, textAlign: 'center', fontSize: 12, color: C.sub },
  lblToday: { color: C.text, fontWeight: '700' },
  trio: { flexDirection: 'row', alignItems: 'flex-end', marginTop: S.md },
  cell: { flex: 1 },
  hero: { fontSize: 32, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },
  mid: { fontSize: 16, fontWeight: '700', color: C.text },
  foot: { marginTop: S.sm },
  insight: { fontSize: 15, fontWeight: '700', color: C.text, marginTop: S.xs },
  hChart: {
    height: HH,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginTop: S.md,
  },
  hZero: { height: 3, backgroundColor: C.border },
  hBar: { flex: 1, backgroundColor: C.border, borderRadius: 4 },
  hBarPeak: { backgroundColor: C.primary },
  hAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: S.xs,
  },
  lbl2: { fontSize: 11, color: C.sub },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    marginTop: S.sm,
  },
  rank: {
    width: 18,
    fontSize: 15,
    fontWeight: '800',
    color: C.primary,
    textAlign: 'center',
  },
  rowName: { flex: 1, fontSize: 15, color: C.text },
  rowR: { alignItems: 'flex-end' },
  rowN: { fontSize: 15, fontWeight: '700', color: C.text },
  pair: { flexDirection: 'row', gap: S.sm },
  half: { flex: 1 },
  big: { fontSize: 24, fontWeight: '800', color: C.text, marginTop: S.xs },
  bigUnit: { fontSize: 14, fontWeight: '600', color: C.sub },
  note: { fontSize: 12, color: C.faint, marginTop: 2 },
  cat: { width: 100, height: 100, alignSelf: 'center', marginTop: S.lg },
});
