/**
 * 음식 추가: 검색 -> 양 고르기 -> 기록.
 *
 * 검색에 없으면 직접 입력으로 빠진다. 기록 직전 kcal을 손으로 고칠 수 있는데,
 * 이게 DB의 레시피 편차와 분량 추정 오차를 모두 흡수하는 안전밸브다.
 * 분류 칩으로 검색어 없이도 훑을 수 있다(분류는 store.js가 이름으로 나눈다).
 */
import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Keyboard,
  ScrollView,
  Alert,
  BackHandler,
} from 'react-native';
import {C, S, R} from './theme';
import CatMascot from './CatMascot';
import {search, entryOf, kcalFor, defaultGrams, macrosFor, servingText, CATEGORIES, defaultKind} from './store';
import {Icon, Thumb, Header} from './ui';

const MULTIPLIERS = [0.5, 1, 1.5, 2];
const CHIPS = ['전체', ...CATEGORIES.map(([c]) => c)];

/**
 * pickOnly: 큰 버튼에 걸 간식만 고른다 -- 양 고르기 없이 1회분 entry를 바로 넘긴다(1개 kcal은 홈 시트에서).
 * @param {{onAdd: (e: any) => boolean, onClose: () => void, kind?: 'snack' | null, pickOnly?: boolean}} props
 */
export default function AddFood({onAdd, onClose, kind: kindProp = null, pickOnly = false}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('전체');
  const [picked, setPicked] = useState(null);
  const [grams, setGrams] = useState('100');
  const [kcalEdit, setKcalEdit] = useState('');
  const [manual, setManual] = useState(false);
  const [kindSel, setKindSel] = useState(null); // 사용자가 토글을 누른 값. null이면 기본값을 따른다

  const results = useMemo(() => search(q, 60, cat === '전체' ? null : cat), [q, cat]);
  const g = Number(grams) || 0;
  const name = picked ? picked.n : q.trim();
  const kind = kindSel || kindProp || defaultKind(name);

  const choose = food => {
    Keyboard.dismiss();
    if (pickOnly) return onAdd(entryOf(food, defaultGrams(food)));
    setKindSel(null);
    const dg = defaultGrams(food);
    setPicked(food);
    setGrams(String(dg));
    setKcalEdit(String(kcalFor(food, dg)));
  };

  // 직접 입력: 고르기 모드면 이름만 넘기고 kcal은 시트에서 봉지·개수로 받는다
  const goManual = () =>
    pickOnly ? q.trim() && onAdd({name: q.trim(), kcal: 0, custom: true, kind: 'snack'}) : setManual(true);

  const setAmount = newG => {
    setGrams(String(newG));
    if (picked) setKcalEdit(String(kcalFor(picked, newG)));
  };

  const back = () => {
    setPicked(null);
    setManual(false);
    setKindSel(null);
  };

  // 양 고르기 화면에선 하드웨어 뒤로가기가 검색으로. 나중에 등록된 핸들러가 먼저 불려
  // App의 "홈으로" 핸들러보다 앞선다.
  useEffect(() => {
    if (!picked && !manual) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [picked, manual]);

  const commit = () => {
    const kcal = Math.max(0, Math.round(Number(kcalEdit) || 0));
    if (!name) {
      Alert.alert('음식 이름을 입력해 주세요');
      return;
    }
    // 고른 음식은 0kcal(물 등)도 기록 가능. 직접 입력은 kcal이 있어야 의미가 있다.
    if (!picked && kcal < 1) {
      Alert.alert('칼로리를 입력해 주세요', '1kcal 이상으로 적어 주세요.');
      return;
    }
    // 고른 음식은 탄·단지도 g 기준으로 같이 남긴다(kcal을 손으로 고쳤어도 g 기준 그대로)
    onAdd(
      picked
        ? {name, kcal, grams: g || null, ...macrosFor(picked, g), custom: false, kind}
        : {name, kcal, grams: null, custom: true, kind},
    );
  };

  // --- 양 고르기 화면 ---------------------------------------------------
  if (picked || manual) {
    const title = picked ? picked.n : q.trim() || '직접 입력';
    return (
      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollIn}
        keyboardShouldPersistTaps="handled">
        <Header title={title} onBack={back} />
        <View style={st.hero}>
          <Thumb name={title} size={96} />
          {picked && (
            <>
              <Text style={st.serving}>
                {servingText(picked)} · {kcalFor(picked, defaultGrams(picked))} kcal
              </Text>
              <Text style={st.sub}>100g당 {picked.k}kcal</Text>
            </>
          )}
        </View>

        {picked && (
          <>
            <View style={st.row}>
              {MULTIPLIERS.map(m => {
                const target = Math.round(defaultGrams(picked) * m);
                const on = g === target;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setAmount(target)}
                    style={[st.chip, on && st.chipOn]}>
                    <Text style={[st.chipTx, on && st.chipTxOn]}>×{m}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={st.card}>
              <Text style={st.label}>섭취량 직접 입력</Text>
              <View style={st.inputRow}>
                <TextInput
                  style={st.input}
                  value={grams}
                  onChangeText={t => setAmount(Number(t.replace(/[^0-9]/g, '')) || 0)}
                  keyboardType="number-pad"
                />
                <Text style={st.unit}>g</Text>
              </View>
            </View>
          </>
        )}

        <View style={st.card}>
          <Text style={st.label}>직접 칼로리 수정하기</Text>
          <View style={st.inputRow}>
            <TextInput
              style={[st.input, st.kcalInput]}
              value={kcalEdit}
              onChangeText={t => setKcalEdit(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="직접 입력"
              placeholderTextColor={C.hint}
            />
            <Text style={st.unit}>kcal</Text>
            <Icon name="pencil" size={18} color={C.faint} />
          </View>
          <Text style={st.hint}>실제와 다르면 직접 고치세요</Text>
        </View>

        <View style={st.kindRow}>
          {[
            ['snack', '간식'],
            ['meal', '식사'],
          ].map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setKindSel(k)}
              accessibilityRole="button"
              accessibilityState={{selected: kind === k}}
              style={[st.kindBtn, kind === k && st.kindBtnOn]}>
              <Text style={[st.kindTx, kind === k && st.kindTxOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={st.primary} onPress={commit}>
          <Text style={st.primaryTx}>{kind === 'snack' ? '간식 기록하기' : '식사 기록하기'}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // --- 검색 화면 --------------------------------------------------------
  return (
    <View style={st.wrap}>
      <Header title={pickOnly ? '지금 먹는 간식 고르기' : kindProp === 'snack' ? '간식 검색' : '음식 검색'} onBack={onClose} />
      <View style={st.searchBar}>
        <Icon name="search" size={20} color={C.faint} />
        <TextInput
          style={st.search}
          value={q}
          onChangeText={setQ}
          placeholder={kindProp === 'snack' ? '간식 이름 검색' : '음식 이름 검색'}
          placeholderTextColor={C.hint}
          autoFocus
        />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={8} style={st.clear}>
            <Icon name="close" size={18} color={C.faint} />
          </Pressable>
        ) : null}
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={st.cats}>
          {CHIPS.map(c => (
            <Pressable key={c} onPress={() => setCat(c)} style={[st.cat, cat === c && st.catOn]}>
              <Text style={[st.catTx, cat === c && st.catTxOn]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={results}
        keyExtractor={item => String(item.i)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={st.listIn}
        ListEmptyComponent={
          q.trim() ? (
            <Pressable style={st.empty} onPress={goManual}>
              <Text style={st.emptyTx}>"{q.trim()}" 직접 입력하기</Text>
            </Pressable>
          ) : (
            <View style={st.empty}>
              <CatMascot size={110} style={st.catImg} />
              <Text style={st.emptyHint}>음식 이름을 검색하거나{'\n'}위에서 분류를 골라 보세요</Text>
            </View>
          )
        }
        ListFooterComponent={
          q.trim() && results.length > 0 ? (
            <Pressable style={st.footer} onPress={goManual}>
              <Text style={st.footerTx}>찾는 게 없나요? 직접 입력</Text>
            </Pressable>
          ) : null
        }
        renderItem={({item}) => (
          <Pressable style={st.item} onPress={() => choose(item)}>
            <Thumb name={item.n} size={48} />
            <View style={st.itemMain}>
              <Text style={st.itemName} numberOfLines={1}>
                {item.n}
              </Text>
              <Text style={st.itemSub} numberOfLines={1}>
                {servingText(item)} · {kcalFor(item, defaultGrams(item))} kcal
              </Text>
            </View>
            {item.b === 1 && <Text style={st.badge}>기본</Text>}
            <Icon name="chev" size={18} color={C.faint} />
          </Pressable>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {flex: 1, backgroundColor: C.bg, paddingHorizontal: S.md},
  scroll: {flex: 1, backgroundColor: C.bg},
  scrollIn: {paddingHorizontal: S.md, paddingBottom: S.lg},
  searchBar: {flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 14, height: 48, marginTop: S.xs},
  search: {flex: 1, paddingHorizontal: S.xs, paddingVertical: 0, fontSize: 16, color: C.text},
  clear: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center'},
  cats: {gap: S.xs, paddingVertical: S.sm},
  cat: {paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: R.pill, backgroundColor: C.card},
  catOn: {backgroundColor: C.primary},
  catTx: {fontSize: 14, color: C.sub, fontWeight: '600'},
  catTxOn: {color: C.white},
  listIn: {paddingBottom: S.md},
  item: {flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.card, borderRadius: R.lg, padding: S.sm, marginBottom: S.xs},
  itemMain: {flex: 1},
  itemName: {fontSize: 16, color: C.text, fontWeight: '600'},
  itemSub: {fontSize: 13, lineHeight: 18, color: C.sub, marginTop: 2},
  badge: {fontSize: 12, fontWeight: '600', color: C.sub, backgroundColor: C.fill, paddingHorizontal: S.xs, paddingVertical: 3, borderRadius: 6, overflow: 'hidden'},
  empty: {padding: S.lg, alignItems: 'center'},
  emptyTx: {color: C.primary, fontSize: 15, fontWeight: '600'},
  catImg: {width: 110, height: 110, marginBottom: S.sm},
  emptyHint: {textAlign: 'center', color: C.sub, fontSize: 15, lineHeight: 22},
  footer: {padding: S.md, alignItems: 'center'},
  footerTx: {color: C.sub, fontSize: 14},

  hero: {alignItems: 'center', marginTop: S.sm},
  serving: {fontSize: 16, fontWeight: '600', color: C.text, marginTop: S.md},
  sub: {fontSize: 13, color: C.sub, marginTop: 2},
  row: {flexDirection: 'row', gap: S.xs, marginTop: S.lg},
  chip: {flex: 1, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: R.md, backgroundColor: C.card},
  chipOn: {backgroundColor: C.primary},
  chipTx: {color: C.text, fontSize: 15, fontWeight: '600'},
  chipTxOn: {color: C.white},
  card: {backgroundColor: C.card, borderRadius: R.xl, padding: 20, marginTop: S.sm},
  label: {fontSize: 14, fontWeight: '600', color: C.sub, marginBottom: S.xs},
  inputRow: {flexDirection: 'row', alignItems: 'center', gap: S.sm},
  input: {flex: 1, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 0, paddingVertical: S.xs, fontSize: 18, color: C.text},
  kcalInput: {fontSize: 22, fontWeight: '700'},
  unit: {fontSize: 14, color: C.sub},
  hint: {fontSize: 12, color: C.faint, marginTop: S.xs},
  kindRow: {flexDirection: 'row', gap: S.xs, marginTop: S.lg},
  // 회색 페이지 위라 비선택은 흰 바탕(배수 칩과 같은 규칙)
  kindBtn: {flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: R.md, backgroundColor: C.card},
  kindBtnOn: {backgroundColor: C.primary},
  kindTx: {fontSize: 15, fontWeight: '600', color: C.text},
  kindTxOn: {color: C.white},
  primary: {alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: R.lg, backgroundColor: C.primary, marginTop: S.sm},
  primaryTx: {color: C.white, fontSize: 17, fontWeight: '700'},
});
