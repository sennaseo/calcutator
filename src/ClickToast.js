/**
 * 클릭 토스트: 기록 직후 탭바 위에 잠깐 떴다 사라지는 하단 다크 스낵바.
 * onUndo가 있으면 3초 유지 + 되돌리기 버튼, 없으면 1.2초. 숨은 뒤엔 아무것도 렌더하지 않아 터치를 막지 않는다.
 * 숨김이 끝나면(자연 종료/되돌리기) onHide를 한 번 부른다.
 * event = {key, title, kcal?, msg?} -- kcal이 없으면(건강·생활 알림) kcal 줄을 안 그린다.
 */
import React, {useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View} from 'react-native';
import {C, S, R} from './theme';

/** @param {{event: any, onUndo?: () => void, onHide?: () => void}} props */
export default function ClickToast({event, onUndo, onHide}) {
  const [shown, setShown] = useState(false);
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(12)).current;
  const anim = useRef(null);
  const hideRef = useRef(onHide);
  hideRef.current = onHide;

  // 이벤트가 바뀔 때마다 진행 중인 애니메이션을 멈추고 처음부터 다시
  useEffect(() => {
    if (anim.current) anim.current.stop();
    if (!event) {
      setShown(false);
      return undefined;
    }
    op.setValue(0);
    ty.setValue(12);
    setShown(true);
    AccessibilityInfo.announceForAccessibility(
      [event.title, event.kcal != null && `${event.kcal} kcal`, event.msg].filter(Boolean).join(', '),
    );
    const a = Animated.sequence([
      Animated.parallel([
        Animated.timing(op, {toValue: 1, duration: 150, useNativeDriver: true}),
        Animated.timing(ty, {toValue: 0, duration: 150, useNativeDriver: true}),
      ]),
      Animated.delay(onUndo ? 3000 : 1200),
      Animated.timing(op, {toValue: 0, duration: 200, useNativeDriver: true}),
    ]);
    anim.current = a;
    a.start(({finished}) => {
      if (finished) {
        setShown(false);
        hideRef.current?.();
      }
    });
    return () => a.stop();
    // onUndo 유무는 이벤트 시작 시점 값만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event && event.key]);

  if (!event || !shown) return null;

  const undo = () => {
    if (anim.current) anim.current.stop();
    setShown(false);
    onUndo();
    hideRef.current?.();
  };

  return (
    <View style={st.wrap} pointerEvents="box-none">
      <Animated.View style={[st.card, {opacity: op, transform: [{translateY: ty}]}]}>
        <View style={st.left}>
          <View style={st.row}>
            <Text style={st.title}>{event.title}</Text>
            {event.kcal != null && <Text style={st.kcal}>{`+${(event.kcal || 0).toLocaleString()} kcal`}</Text>}
          </View>
          {!!event.msg && (
            <Text style={st.msg} numberOfLines={1}>
              {event.msg}
            </Text>
          )}
        </View>
        {onUndo && (
          <Pressable accessibilityRole="button" onPress={undo} hitSlop={8} style={st.btn}>
            <Text style={st.btnT}>되돌리기</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {position: 'absolute', left: 16, right: 16, bottom: 12, zIndex: 10},
  card: {
    backgroundColor: C.toast,
    borderRadius: R.lg,
    minHeight: 56,
    paddingVertical: 14,
    paddingLeft: 20,
    paddingRight: S.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {flex: 1},
  row: {flexDirection: 'row', alignItems: 'baseline', gap: S.xs},
  title: {fontSize: 15, fontWeight: '700', color: C.white},
  kcal: {fontSize: 15, fontWeight: '600', color: C.white},
  msg: {fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2},
  btn: {minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: S.sm},
  btnT: {fontSize: 14, fontWeight: '700', color: C.primaryLight},
});
