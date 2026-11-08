/**
 * 간식을 큰 버튼에 걸기 전에 "1개가 몇 kcal인지" 정하는 아래 카드.
 *
 * 마이쮸 한 봉지를 사면 봉지 kcal과 개수만 알면 된다 -- 1개 kcal은 나눗셈으로.
 * 여기선 기록하지 않는다. 기록은 큰 버튼을 누를 때마다 1개씩.
 */
import React, {useState} from 'react';
import {View, Text, TextInput, Pressable, Modal, KeyboardAvoidingView, Platform, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {C, S, R, T} from './theme';
import {pieceKcal, pieceEntry, shortName} from './store';

/** @param {{entry: any, onConfirm: (e: any) => void, onClose: () => void}} props */
export default function HangSheet({entry, onConfirm, onClose}) {
  // 직접 입력(kcal 0)은 봉지 칸을 비워 둔다 -- 0을 지우고 쓰게 하지 않게
  const [pack, setPack] = useState(entry.kcal ? String(entry.kcal) : '');
  const [n, setN] = useState('1');
  const piece = pieceKcal(Number(pack), Number(n));
  const ok = piece != null && piece >= 1;
  const num = t => t.replace(/[^0-9]/g, '');
  // Context는 Modal을 건너 전달된다(Shell의 Provider) -- 엣지투엣지에서 내비게이션 바에 버튼이 가리지 않게
  const {bottom} = useSafeAreaInsets();

  return (
    <Modal transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={st.dim} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={st.flex} onPress={onClose} />
        <View style={[st.card, {paddingBottom: S.lg + bottom}]}>
          <Text style={st.title} numberOfLines={1}>
            {shortName(entry.name)}
          </Text>
          <View style={st.row}>
            <View style={st.field}>
              <Text style={st.label}>봉지 전체 kcal</Text>
              <TextInput
                style={st.input}
                value={pack}
                onChangeText={t => setPack(num(t))}
                keyboardType="number-pad"
                accessibilityLabel="봉지 전체 칼로리"
              />
            </View>
            <View style={st.field}>
              <Text style={st.label}>개수</Text>
              <TextInput
                style={st.input}
                value={n}
                onChangeText={t => setN(num(t))}
                keyboardType="number-pad"
                accessibilityLabel="개수"
              />
            </View>
          </View>
          <Text style={[st.preview, !ok && st.hint]}>{ok ? `1개 = ${piece} kcal` : '봉지 칼로리와 개수를 적어 주세요'}</Text>
          <View style={st.row}>
            <Pressable style={[st.btn, st.cancel]} onPress={onClose} accessibilityRole="button">
              <Text style={st.cancelTx}>취소</Text>
            </Pressable>
            <Pressable
              style={[st.btn, st.ok, !ok && st.off]}
              disabled={!ok}
              onPress={() => onConfirm(pieceEntry(entry, Number(pack), Number(n)))}
              accessibilityRole="button"
              accessibilityLabel="이 간식 걸기"
              accessibilityState={{disabled: !ok}}>
              <Text style={st.okTx}>이 간식 걸기</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  flex: {flex: 1},
  dim: {flex: 1, backgroundColor: C.dim},
  card: {backgroundColor: C.card, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: 20},
  title: T.h2,
  row: {flexDirection: 'row', gap: S.sm, marginTop: S.md},
  field: {flex: 1, gap: S.xs},
  label: T.label,
  input: {backgroundColor: C.fill, borderRadius: R.md, height: 52, paddingHorizontal: S.md, paddingVertical: 0, fontSize: 20, fontWeight: '700', color: C.text},
  preview: {fontSize: 16, fontWeight: '700', color: C.text, marginTop: S.md},
  hint: {...T.caption},
  btn: {flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: R.lg},
  cancel: {backgroundColor: C.fill},
  cancelTx: {fontSize: 16, fontWeight: '700', color: C.text},
  ok: {backgroundColor: C.primary},
  okTx: {fontSize: 16, fontWeight: '700', color: C.white},
  off: {opacity: 0.4},
});
