/**
 * 아래 탭: 오늘 · 간식 · 건강 · 생활 · 가계부. 전폭 흰 막대 + 위 헤어라인, 선택 탭은 진한 글자.
 * 빠른 기록(+)은 오늘 화면 헤더의 '+ 기록' 버튼으로 옮겼다.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {C} from './theme';
import {Icon} from './ui';

export const TABS = [
  {key: 'today', label: '오늘', icon: 'today'},
  {key: 'snacks', label: '간식', icon: 'candy'},
  {key: 'health', label: '건강', icon: 'heart'},
  {key: 'life', label: '생활', icon: 'sun'},
  {key: 'money', label: '가계부', icon: 'wallet'},
];

/** @param {{tab: string, onTab: (k: string) => void}} props */
export default function TabBar({tab, onTab}) {
  return (
    <View style={st.bar}>
      {TABS.map(t => {
        const on = tab === t.key;
        return (
          <Pressable
            key={t.key}
            style={st.tab}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{selected: on}}
            onPress={() => onTab(t.key)}>
            <Icon name={t.icon} size={24} color={on ? C.text : C.faint} width={on ? 2.4 : 2} />
            <Text style={[st.tx, on && st.on]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  bar: {flexDirection: 'row', height: 56, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border},
  tab: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2},
  tx: {fontSize: 11, fontWeight: '600', color: C.faint},
  on: {color: C.text},
});
