/**
 * 간식 탭: [오늘 기록 | 내 간식]
 * - 오늘 기록: 그날 kcal 합계·탄단지, 간식 묶음(×N, 밀어서 1개 삭제, + 한 개 더), 식사
 * - 내 간식: 건 적 있거나 먹은 간식 모음(diet:mysnacks). 탭 = 버튼에 걸기, 별 = 즐겨찾기, 길게 = 고치기
 */
import React, {useRef, useState} from 'react';
import {Alert, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {C, S, R, T, ACCENT} from '../theme';
import {Icon, Thumb} from '../ui';
import {Badge, Button, Card, Chip, EmptyState, FadeIn, Jelly, PressScale, SectionTitle, Segmented, Sheet, Stepper, SwipeRow} from '../kit';
import CatMascot from '../CatMascot';
import {dayKey, shortDay, total, macroSum, isSnack, timeOf, groupSnacks, shortName, fmtTime, filterMine} from '../store';

const CAT = 160; // 간식 카드 오른쪽 3D 고양이(dp). 150 이상이어야 3D(WebView)로 뜬다

const SEGS = [
  {key: 'today', label: '오늘 기록'},
  {key: 'mine', label: '내 간식'},
];

/** @param {any} props */
export default function Snacks(props) {
  const [seg, setSeg] = useState('today');
  return (
    <View style={st.flex}>
      <View style={st.head}>
        <Text style={T.h1}>간식</Text>
        <Segmented options={SEGS} value={seg} onChange={setSeg} style={st.seg} />
      </View>
      {seg === 'today' ? <DayList {...props} /> : <Mine {...props} />}
    </View>
  );
}

function DayList({day, items, goal, onAgain, onRemove, onRecord, onGoal}) {
  const isToday = day === dayKey();
  const eaten = total(items);
  const left = goal - eaten; // goal > 0 일 때만 쓴다
  const over = goal > 0 && left < 0;
  const macros = macroSum(items);
  const groups = groupSnacks(items); // 같은 간식 N번 = 한 줄 "×N"
  const meals = items.filter(it => !isSnack(it)).sort((a, b) => timeOf(b) - timeOf(a));
  const [catTouch, setCatTouch] = useState(false); // 고양이를 만지는 동안 스크롤 잠금

  return (
    <ScrollView contentContainerStyle={st.in} scrollEnabled={!catTouch}>
      <Card style={st.total}>
        <View style={st.totalRow}>
          <View style={st.flex}>
            <Text style={T.label}>{isToday ? '오늘 전체' : `${shortDay(day)} 전체`}</Text>
            <Text style={st.totalV}>
              {`${eaten.toLocaleString()} kcal`}
              {goal > 0 && <Text style={st.totalGoal}>{` / ${goal.toLocaleString()} kcal`}</Text>}
            </Text>
            {goal > 0 ? (
              <>
                <View style={st.barBg}>
                  <View style={[st.barFill, {width: `${Math.min(100, (eaten / goal) * 100)}%`}, over && st.barOver]} />
                </View>
                <Text style={st.left}>
                  {over ? <Text style={st.over}>{Math.abs(left).toLocaleString()} kcal 초과</Text> : `남은 칼로리 ${left.toLocaleString()} kcal`}
                </Text>
              </>
            ) : (
              <Pressable onPress={onGoal} hitSlop={8} accessibilityRole="button" accessibilityLabel="목표 칼로리 설정하기" style={st.goalBtn}>
                <Text style={st.setGoal}>목표 칼로리 설정하기</Text>
              </Pressable>
            )}
          </View>
          {/* 먹은 게 있으면 쿠키를 냠냠 먹는 고양이(없을 땐 아래 빈 화면 고양이가 대신) */}
          {!!items.length && <CatMascot size={CAT} mode="eat" onTouch={setCatTouch} style={st.cat} />}
        </View>
        {macros && (
          <View style={st.macros}>
            {[
              ['탄수화물', macros.c],
              ['단백질', macros.p],
              ['지방', macros.f],
            ].map(([label, v]) => (
              <View key={label} style={st.macro}>
                <Text style={st.macroV}>{v}g</Text>
                <Text style={T.tiny}>{label}</Text>
              </View>
            ))}
          </View>
        )}
        <Button label="＋ 검색해서 기록" accessibilityLabel="간식 기록" onPress={onRecord} tone="soft" style={st.record} />
      </Card>

      {!items.length && <EmptyState title="아직 기록이 없어요" sub={'오늘 화면에서 간식을 고르고,\n먹을 때마다 CLICK을 눌러 주세요'} size={80} />}

      {!!groups.length && <SectionTitle title="간식" hint="왼쪽으로 밀거나 길게 눌러 삭제" />}
      {groups.map((g, i) => (
        <FadeIn key={`g:${g.name}`} index={i}>
          {/* 간식 묶음: + = 한 개 더, 밀기·길게 = 가장 최근 1개만 삭제 */}
          <SwipeRow onDelete={() => onRemove(g.items[0], '1개 삭제할까요?')} deleteLabel={`${shortName(g.name)} 1개 삭제`}>
            <Row
              name={g.name}
              title={`${shortName(g.name)} ×${g.n}`}
              sub={`${g.kcal.toLocaleString()} kcal · 마지막 ${fmtTime(g.last)}`}
              onLongPress={() => onRemove(g.items[0], '1개 삭제할까요?')}
              onAgain={() => onAgain(g.items[0])}
            />
          </SwipeRow>
        </FadeIn>
      ))}

      {!!meals.length && <SectionTitle title="식사" />}
      {meals.map((m, i) => (
        <FadeIn key={String(m.id)} index={i}>
          <SwipeRow onDelete={() => onRemove(m)} deleteLabel={`${shortName(m.name)} 삭제`}>
            <Row
              name={m.name}
              title={shortName(m.name)}
              sub={`${fmtTime(timeOf(m))} · ${m.grams ? `${m.grams}g · ` : ''}${(m.kcal || 0).toLocaleString()} kcal`}
              onLongPress={() => onRemove(m)}
              onAgain={() => onAgain(m)}
            />
          </SwipeRow>
        </FadeIn>
      ))}
    </ScrollView>
  );
}

function Row({name, title, sub, onLongPress, onAgain}) {
  return (
    <Pressable style={st.row} onLongPress={onLongPress} accessibilityLabel={`${title}, ${sub}`}>
      <Thumb name={name} size={44} />
      <View style={st.flex}>
        <Text style={st.rowName} numberOfLines={1}>
          {title}
        </Text>
        <Text style={st.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Jelly tone="soft" h={36} w={36} onPress={onAgain} hitSlop={8} accessibilityLabel={`${shortName(name)} 한 번 더 기록`}>
        <Icon name="plus" size={18} color={C.text} width={2.4} />
      </Jelly>
    </Pressable>
  );
}

// ---- 내 간식 ----

const FILTERS = [
  ['all', '전체'],
  ['fav', '즐겨찾기'],
  ['often', '자주 먹은'],
];

function Mine({mine, onHangMine, onFav, onEditKcal, onDeleteMine}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [edit, setEdit] = useState(null);
  const list = filterMine(mine, q, filter);

  return (
    <View style={st.flex}>
      <ScrollView contentContainerStyle={st.in} keyboardShouldPersistTaps="handled">
        <View style={st.search}>
          <Icon name="search" size={18} color={C.faint} />
          <TextInput
            style={st.searchIn}
            value={q}
            onChangeText={setQ}
            placeholder="내 간식에서 찾기"
            placeholderTextColor={C.hint}
            accessibilityLabel="내 간식 검색"
          />
          {!!q && (
            <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="검색어 지우기">
              <Icon name="close" size={18} color={C.faint} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filters}>
          {FILTERS.map(([k, label]) => (
            <Chip key={k} label={label} selected={filter === k} onPress={() => setFilter(k)} style={filter !== k && st.chipOnBg} />
          ))}
        </ScrollView>

        {!mine.length ? (
          <EmptyState title="아직 모인 간식이 없어요" sub={'간식을 버튼에 걸거나 기록하면\n여기에 차곡차곡 모여요'} size={80} />
        ) : !list.length ? (
          <EmptyState
            title={filter === 'fav' && !q ? '즐겨찾기한 간식이 없어요' : '찾는 간식이 없어요'}
            sub={filter === 'fav' && !q ? '별을 누르면 오늘 화면 칩 맨 앞에 와요' : undefined}
            size={72}
          />
        ) : (
          <>
            <Text style={[T.tiny, st.tip]}>누르면 버튼에 걸려요 · 길게 누르면 고치기</Text>
            <View style={st.grid}>
              {list.map((m, i) => (
                <FadeIn key={m.name} index={i} style={st.cellWrap}>
                  <PressScale
                    style={st.cell}
                    onPress={() => onHangMine(m)}
                    onLongPress={() => setEdit(m)}
                    accessibilityLabel={`${shortName(m.name)} ${m.kcal} kcal 버튼에 걸기`}
                    accessibilityHint="길게 누르면 칼로리를 고치거나 지울 수 있어요">
                    <View style={st.cellTop}>
                      <View style={st.emoji}>
                        <Text style={st.emojiTx}>{m.emoji}</Text>
                      </View>
                      <FavStar on={m.fav} onPress={() => onFav(m.name)} name={shortName(m.name)} />
                    </View>
                    <Text style={st.cellName} numberOfLines={2}>
                      {shortName(m.name)}
                    </Text>
                    <Text style={st.cellKcal}>{`${m.piece ? '1개' : '1회'} ${m.kcal.toLocaleString()} kcal`}</Text>
                    {m.count > 0 && <Badge label={`${m.count.toLocaleString()}번 먹음`} style={st.badge} />}
                  </PressScale>
                </FadeIn>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      {edit && (
        <EditSheet
          m={edit}
          onClose={() => setEdit(null)}
          onSave={kcal => {
            onEditKcal(edit.name, kcal);
            setEdit(null);
          }}
          onHang={kcal => {
            const changed = kcal !== edit.kcal;
            if (changed) onEditKcal(edit.name, kcal);
            setEdit(null);
            onHangMine(changed ? {...edit, kcal, piece: true} : edit);
          }}
          onDelete={() =>
            Alert.alert('내 간식에서 지울까요?', `${shortName(edit.name)}\n지난 기록은 그대로 남아요.`, [
              {text: '취소', style: 'cancel'},
              {
                text: '지우기',
                style: 'destructive',
                onPress: () => {
                  onDeleteMine(edit.name);
                  setEdit(null);
                },
              },
            ])
          }
        />
      )}
    </View>
  );
}

/** 즐겨찾기 별: 누르면 통 튄다 */
function FavStar({on, onPress, name}) {
  const s = useRef(new Animated.Value(1)).current;
  const press = () => {
    s.setValue(0.6);
    Animated.spring(s, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 18,
    }).start();
    onPress();
  };
  return (
    <Pressable
      onPress={press}
      hitSlop={6}
      style={st.star}
      accessibilityRole="button"
      accessibilityLabel={`${name} 즐겨찾기`}
      accessibilityState={{selected: !!on}}>
      <Animated.View style={{transform: [{scale: s}]}}>
        <Icon name="star" size={22} color={on ? C.star : C.faint} fill={on ? C.star : 'none'} />
      </Animated.View>
    </Pressable>
  );
}

function EditSheet({m, onClose, onSave, onHang, onDelete}) {
  const [kcal, setKcal] = useState(m.kcal);
  return (
    <Sheet title={shortName(m.name)} onClose={onClose}>
      <Text style={[T.label, st.center]}>1개 칼로리</Text>
      <View style={st.stepWrap}>
        <Stepper value={kcal} onChange={setKcal} step={5} min={0} max={5000} unit="kcal" label="1개 칼로리" />
      </View>
      <View style={st.sheetRow}>
        <Button label="지우기" tone="soft" accent={ACCENT.danger} onPress={onDelete} style={st.flex} />
        <Button label="저장" tone="soft" onPress={() => onSave(kcal)} style={st.flex} />
      </View>
      <Button label="저장하고 버튼에 걸기" accessibilityLabel="버튼에 걸기" onPress={() => onHang(kcal)} />
    </Sheet>
  );
}

const st = StyleSheet.create({
  flex: {flex: 1},
  center: {textAlign: 'center'},
  head: {paddingHorizontal: S.md, paddingTop: S.sm, gap: S.sm},
  seg: {marginBottom: S.xs, backgroundColor: C.fillPressed}, // 회색 페이지 위라 한 단계 진한 회색 틀
  in: {paddingHorizontal: S.md, paddingTop: S.sm, paddingBottom: S.lg},

  total: {marginTop: S.xs},
  totalRow: {flexDirection: 'row', alignItems: 'center'},
  cat: {marginVertical: -S.sm, marginRight: -S.xs}, // 카드 여백 안쪽으로 살짝 붙여 크게 보이게
  totalV: {
    fontSize: 28,
    fontWeight: '800',
    color: C.text,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  totalGoal: {fontSize: 13, fontWeight: '400', color: C.sub}, // 큰 숫자 안 글자: lineHeight 없이
  goalBtn: {minHeight: 36, justifyContent: 'center'},
  setGoal: {fontSize: 14, color: C.primary, fontWeight: '600'},
  barBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: C.fill,
    marginTop: S.sm,
    overflow: 'hidden',
  },
  barFill: {height: 8, borderRadius: 4, backgroundColor: C.primary},
  barOver: {backgroundColor: C.danger},
  left: {fontSize: 13, color: C.sub, marginTop: S.xs},
  over: {color: C.danger, fontWeight: '700'},
  macros: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: S.sm,
    marginTop: S.sm,
  },
  macro: {flex: 1, alignItems: 'center'},
  macroV: {fontSize: 15, fontWeight: '700', color: C.text},
  record: {marginTop: S.sm},

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.sm,
  },
  rowName: {fontSize: 16, color: C.text, fontWeight: '600'},
  rowSub: {...T.caption, marginTop: 2},

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    backgroundColor: C.card,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    height: 48,
  },
  searchIn: {flex: 1, fontSize: 15, color: C.text, paddingVertical: 0},
  filters: {gap: S.xs, paddingVertical: S.sm},
  chipOnBg: {backgroundColor: C.card}, // 회색 페이지 위 칩은 흰 바탕(AddFood 분류 칩과 같은 규칙)
  tip: {marginBottom: S.xs},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: S.sm,
  },
  cellWrap: {width: '48.5%'},
  cell: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.sm,
    minHeight: 140,
  },
  cellTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  emoji: {
    width: 48,
    height: 48,
    borderRadius: R.md,
    backgroundColor: C.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiTx: {fontSize: 26},
  star: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
    marginRight: -6,
  },
  cellName: {fontSize: 15, fontWeight: '700', color: C.text, marginTop: S.xs},
  cellKcal: {...T.caption, marginTop: 2},
  badge: {marginTop: S.xs},

  stepWrap: {paddingVertical: S.md},
  sheetRow: {flexDirection: 'row', gap: S.sm},
});
