/**
 * 설정: 하루 목표 칼로리 + 권장 칼로리 계산 + 앱 정보.
 *
 * 기존 "다이어트 계산기"(Mifflin-St Jeor)를 여기 도우미로 남겼다. 계산기로 설치한
 * 기존 사용자가 기능을 통째로 잃지 않게 하면서, 목표 칼로리 기본값도 채워준다.
 * 카드를 누르면 그 자리에서 펼쳐진다(화면을 더 늘리지 않으려고).
 */
import React, {useState} from 'react';
import {View, Text, TextInput, Pressable, StyleSheet, ScrollView, Linking} from 'react-native';
import CatMascot from './CatMascot';
import {C, S, R, T} from './theme';
import {recommendKcal} from './store';
import {Icon, Header} from './ui';

const VERSION = '2.1.0'; // android/app/build.gradle versionName과 맞출 것
const PRIVACY_URL = 'https://sennaseo.github.io/diet-calc-privacy/';

// 아이콘 + 제목(+값/설명) + 오른쪽 화살표 한 줄
const Row = ({icon, title, value, sub, open, onPress}) => (
  <Pressable style={st.row} onPress={onPress}>
    <Icon name={icon} color={C.text} size={22} />
    <View style={st.rowMain}>
      <Text style={st.rowTitle}>{title}</Text>
      {value ? <Text style={st.value}>{value}</Text> : null}
      {sub ? <Text style={st.rowSub}>{sub}</Text> : null}
    </View>
    {onPress && (
      <View style={open && st.rot}>
        <Icon name="chev" size={18} color={C.faint} />
      </View>
    )}
  </Pressable>
);

/** @param {{goal: number, onSave: (g: number) => void, onBack?: () => void}} props */
export default function Settings({goal, onSave, onBack}) {
  const [val, setVal] = useState(goal ? String(goal) : '');
  const [edit, setEdit] = useState(false);
  const [calc, setCalc] = useState(false);
  const [sex, setSex] = useState('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const canCalc = Number(age) > 0 && Number(height) > 0 && Number(weight) > 0;

  // 계산 결과는 목표 칸에 채워만 두고, 저장은 사용자가 확인하고 누른다
  const runCalc = () => {
    const kcal = recommendKcal({
      sex,
      age: Number(age),
      height: Number(height),
      weight: Number(weight),
    });
    setVal(String(kcal));
    setCalc(false);
    setEdit(true);
  };

  const save = () => {
    onSave(Math.max(0, Number(val) || 0));
    setEdit(false);
  };

  return (
    <ScrollView
      style={st.wrap}
      contentContainerStyle={st.in}
      keyboardShouldPersistTaps="handled">
      <Header title="설정" onBack={onBack} />
      <CatMascot size={80} style={st.cat} />

      <View style={st.card}>
        <Row
          icon="target"
          title="하루 목표 칼로리"
          value={goal > 0 ? `${goal.toLocaleString()} kcal` : null}
          sub={goal > 0 ? null : '아직 정하지 않았어요 · 눌러서 정하기'}
          open={edit}
          onPress={() => setEdit(!edit)}
        />
        {edit && (
          <View style={st.body}>
            <TextInput
              style={st.input}
              value={val}
              onChangeText={t => setVal(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="예: 1800"
              placeholderTextColor={C.hint}
            />
            <Pressable style={st.save} onPress={save}>
              <Text style={st.saveTx}>저장</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={st.card}>
        <Row
          icon="calc"
          title="권장 칼로리 계산하기"
          sub="키·몸무게·나이로 권장 칼로리를 알아봐요"
          open={calc}
          onPress={() => setCalc(!calc)}
        />
        {calc && (
          <View style={st.body}>
            <View style={st.sexRow}>
              {[
                ['male', '남성'],
                ['female', '여성'],
              ].map(([k, lbl]) => (
                <Pressable
                  key={k}
                  onPress={() => setSex(k)}
                  style={[st.sexBtn, sex === k && st.sexOn]}>
                  <Text style={[st.sexTx, sex === k && st.sexTxOn]}>{lbl}</Text>
                </Pressable>
              ))}
            </View>

            {[
              ['나이', age, setAge, '세'],
              ['키', height, setHeight, 'cm'],
              ['몸무게', weight, setWeight, 'kg'],
            ].map(([lbl, v, setter, unit]) => (
              <View key={lbl} style={st.field}>
                <Text style={st.fieldLbl}>
                  {lbl} ({unit})
                </Text>
                <TextInput
                  style={st.fieldInput}
                  value={v}
                  onChangeText={t => setter(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
            ))}

            <Pressable
              onPress={runCalc}
              disabled={!canCalc}
              style={[st.calcBtn, !canCalc && st.calcBtnOff]}>
              <Text style={st.calcBtnTx}>계산해서 목표에 넣기</Text>
            </Pressable>
            <Text style={st.note}>
              Mifflin-St Jeor 기준 감량 권장치(유지 칼로리의 80%)입니다. 일반적인
              참고치이며 의학적 조언이 아닙니다.
            </Text>
          </View>
        )}
      </View>

      <View style={st.card}>
        <Row icon="info" title="앱 정보" sub={`버전 ${VERSION}`} />
        <View style={st.body}>
          <Text style={st.source}>
            영양정보 출처: 식품의약품안전처 식품영양성분 데이터베이스 (2026.08){'\n'}
            Korean Food Composition Database system (K-FCDB)
          </Text>
          <Pressable style={st.link} onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={st.linkTx}>개인정보처리방침</Text>
            <Icon name="chev" size={16} color={C.primary} />
          </Pressable>
        </View>
      </View>

      <View style={st.backup}>
        <Icon name="cloud" size={18} color={C.sub} />
        <Text style={st.backupTx}>기록은 구글 계정에 자동 백업돼요</Text>
      </View>
      <Text style={st.privacy}>
        기록은 이 기기와 본인 구글 계정 백업에만 저장되며, 개발자에게 전송되지 않습니다.
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: {flex: 1, backgroundColor: C.bg},
  in: {paddingHorizontal: S.md, paddingBottom: S.lg},
  cat: {width: 80, height: 80, alignSelf: 'center', marginBottom: S.xs},
  card: {backgroundColor: C.card, borderRadius: R.xl, padding: 20, marginTop: S.sm},
  row: {flexDirection: 'row', alignItems: 'center', gap: S.md},
  rowMain: {flex: 1},
  rowTitle: {fontSize: 16, fontWeight: '600', color: C.text},
  value: {fontSize: 20, fontWeight: '800', color: C.text, marginTop: 2},
  rowSub: {...T.caption, marginTop: 2},
  rot: {transform: [{rotate: '90deg'}]},
  body: {marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.border},
  input: {backgroundColor: C.fill, borderRadius: R.md, height: 52, paddingHorizontal: S.md, paddingVertical: 0, fontSize: 20, fontWeight: '700', color: C.text},
  save: {marginTop: S.sm, alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: R.lg, backgroundColor: C.primary},
  saveTx: {color: C.white, fontSize: 16, fontWeight: '700'},
  sexRow: {flexDirection: 'row', gap: S.xs, marginBottom: S.sm},
  sexBtn: {flex: 1, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: R.md, backgroundColor: C.fill},
  sexOn: {backgroundColor: C.primary},
  sexTx: {color: C.text, fontSize: 15, fontWeight: '600'},
  sexTxOn: {color: C.white, fontWeight: '700'},
  field: {flexDirection: 'row', alignItems: 'center', marginTop: S.sm},
  fieldLbl: {flex: 1, fontSize: 15, color: C.text},
  fieldInput: {width: 100, height: 44, backgroundColor: C.fill, borderRadius: 10, paddingHorizontal: S.sm, paddingVertical: 0, fontSize: 16, color: C.text, textAlign: 'right'},
  calcBtn: {marginTop: S.md, alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: R.lg, backgroundColor: C.primary},
  calcBtnOff: {opacity: 0.4},
  calcBtnTx: {color: C.white, fontSize: 16, fontWeight: '700'},
  note: {...T.tiny, marginTop: S.sm},
  source: {...T.caption},
  link: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginTop: S.xs},
  linkTx: {fontSize: 14, fontWeight: '600', color: C.primary},
  backup: {flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.lg, alignSelf: 'center'},
  backupTx: {fontSize: 13, color: C.text, fontWeight: '600'},
  privacy: {...T.tiny, marginTop: S.xs, textAlign: 'center', paddingHorizontal: S.lg},
});
