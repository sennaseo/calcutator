/**
 * 빠른 기록 시트(오늘 화면 '+ 기록'): registry에 등록된 타일을 3열로.
 */
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {C, S, R} from '../theme';
import {Icon} from '../ui';
import {FadeIn, PressScale, Sheet} from '../kit';
import {quickActions} from '../registry';

/** @param {{onClose: () => void, onRun: (a: any) => void}} props */
export default function QuickAdd({onClose, onRun}) {
  return (
    <Sheet title="빠른 기록" onClose={onClose}>
      <View style={st.grid}>
        {quickActions().map((a, i) => {
          return (
            <FadeIn key={a.id} index={i} style={st.cell}>
              <PressScale style={st.tile} onPress={() => onRun(a)} accessibilityLabel={a.label}>
                <View style={st.tileIn}>
                  <Icon name={a.icon} size={26} color={C.text} width={2} />
                  <Text style={st.label} numberOfLines={1}>
                    {a.label}
                  </Text>
                </View>
              </PressScale>
            </FadeIn>
          );
        })}
      </View>
    </Sheet>
  );
}

const st = StyleSheet.create({
  grid: {flexDirection: 'row', flexWrap: 'wrap', rowGap: S.sm},
  cell: {width: '33.33%', paddingHorizontal: S.xxs},
  tile: {borderRadius: R.lg, backgroundColor: C.fill, minHeight: 88},
  tileIn: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm},
  label: {fontSize: 13, fontWeight: '600', color: C.text},
});
