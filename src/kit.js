/**
 * UI 키트: 여러 화면이 같이 쓰는 조각. 토큰은 theme.js, 아이콘·썸네일·머리줄은 ui.js.
 *
 * 원칙
 * - 누르는 건 PressScale(눌리면 0.98) 또는 플랫 버튼(눌리면 색만 진해짐)
 * - 큰 움직임(시트 슬라이드·목록 페이드·링 채우기)은 '동작 줄이기'가 켜지면 생략
 * - 터치 영역은 최소 44, 모든 터치 요소에 accessibilityLabel
 * - 애니메이션은 가능하면 useNativeDriver: true (svg 속성·width는 JS 드라이버)
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {C, S, R, T} from './theme';
import {Icon} from './ui';
import CatMascot from './CatMascot';
import {dayKey, shiftDay, fmtDay} from './store';

// ---- 훅 ----

// 동작 줄이기 값은 앱 전체에서 하나 -- 컴포넌트마다 처음 한 프레임 깜빡이지 않게 모듈에 기억해 둔다
let reduceCache = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  ?.then(v => {
    reduceCache = !!v;
  })
  .catch(() => {});

/** '동작 줄이기' 설정. true면 큰 움직임을 건너뛴다. */
export function useReduceMotion() {
  const [v, setV] = useState(reduceCache);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then(x => {
        reduceCache = !!x;
        if (alive) setV(!!x);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', x => {
      reduceCache = !!x;
      setV(!!x);
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return v;
}

/** intervalMs마다 다시 그려지는 현재 시각(ms). 타이머·'N분 전' 표시용. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// ---- 누르기 ----

/**
 * 눌리면 살짝 작아졌다 돌아오는 Pressable. 나머지 props(onPress·accessibility*)는 그대로 넘긴다.
 * @param {{onPress?: () => any, onLongPress?: () => any, onPressIn?: (e: any) => void, onPressOut?: (e: any) => void, style?: any, children?: any, scaleTo?: number, disabled?: boolean, [k: string]: any}} props
 */
export function PressScale({style, children, scaleTo = 0.98, disabled, ...rest}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = v => Animated.timing(s, {toValue: v, duration: v === 1 ? 120 : 90, useNativeDriver: true}).start();
  // style은 겉(Animated.View)에 -- 크기·여백·배경이 같이 줄어야 눌린 느낌이 난다
  return (
    <Animated.View style={[style, disabled && st.off, {transform: [{scale: s}]}]}>
      <Pressable
        accessibilityRole="button"
        {...rest}
        disabled={disabled}
        accessibilityState={{disabled: !!disabled, ...rest.accessibilityState}}
        onPressIn={e => {
          to(scaleTo);
          rest.onPressIn?.(e);
        }}
        onPressOut={e => {
          to(1);
          rest.onPressOut?.(e);
        }}
        style={st.fill}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ---- 플랫 버튼 ----

const ABS = {position: 'absolute', top: 0, bottom: 0, left: 0, right: 0};

/**
 * 플랫 버튼(옛 이름 Jelly 유지). solid = 강조색 바탕(눌리면 진해짐), soft = 회색 바탕(눌리면 조금 진한 회색).
 * 모서리 16, w===h면 원(아이콘 버튼). 크기는 안 줄이고 색만 바뀐다.
 * 나머지 props(onPress·onLongPress·accessibility*)는 Pressable로 그대로.
 * @param {{accent?: {main: string, soft: string, dark: string}, tone?: 'solid'|'soft'|'plain'|'card', h?: number, w?: number, style?: any, disabled?: boolean, children?: any, [k: string]: any}} props
 */
export function Jelly({accent, tone = 'solid', h = 52, w, style, disabled, children, ...rest}) {
  const solid = tone === 'solid';
  const radius = w === h ? h / 2 : R.lg;
  const plain = tone === 'plain'; // 바탕 없는 헤더 아이콘
  // card = 흰 바탕 보조 버튼: 회색 페이지 위에선 회색(soft)이 바탕에 묻혀서 이걸 쓴다
  const bg = solid ? accent?.main ?? C.primary : plain ? 'transparent' : tone === 'card' ? C.card : C.fill;
  // 라벤더는 정해진 눌림색, 다른 강조색(위험 등)은 그 색의 진한 쪽
  const bgDown = solid ? (accent && accent.main !== C.primary ? accent.dark : C.primaryPressed) : plain ? C.fill : C.fillPressed;
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      accessibilityState={{disabled: !!disabled, ...rest.accessibilityState}}
      style={({pressed}) => [st.jelly, {width: w, height: h, borderRadius: radius, backgroundColor: pressed ? bgDown : bg}, style, disabled && st.off]}>
      {children}
    </Pressable>
  );
}

/**
 * 동그란 회색 아이콘 버튼(스테퍼 ±·상단 아이콘). plain이면 바탕 없이 맨 아이콘(헤더용).
 * @param {{icon: string, size?: number, plain?: boolean, accent?: {main: string, soft: string, dark: string}, style?: any, [k: string]: any}} props
 */
export function IconJelly({icon, size = 44, plain, accent: _accent, style, ...rest}) {
  return (
    <Jelly tone={plain ? 'plain' : 'soft'} h={size} w={size} style={style} {...rest}>
      <Icon name={icon} size={20} color={C.text} width={2.2} />
    </Jelly>
  );
}

// ---- 카드·제목 ----

/**
 * 흰 카드. title을 주면 위에 제목 줄(오른쪽 action 링크). onPress를 주면 카드 전체가 PressScale.
 * icon은 옛 호출부 호환용으로 받기만 한다(색 원 아이콘은 그리지 않음).
 * @param {{title?: string, icon?: string, accent?: {main: string, soft: string, dark: string}, action?: {label: string, onPress: () => void}, onPress?: () => void, accessibilityLabel?: string, style?: any, children?: any}} props
 */
export function Card({title, action, onPress, accessibilityLabel, style, children}) {
  const body = (
    <>
      {!!title && (
        <View style={st.cardHead}>
          <Text style={[T.title, st.flex]} numberOfLines={1}>
            {title}
          </Text>
          {action && (
            <Pressable onPress={action.onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={action.label} style={st.cardAction}>
              <Text style={st.link}>{action.label}</Text>
            </Pressable>
          )}
        </View>
      )}
      {children}
    </>
  );
  if (!onPress) return <View style={[st.card, style]}>{body}</View>;
  return (
    <PressScale style={[st.card, style]} onPress={onPress} scaleTo={0.98} accessibilityLabel={accessibilityLabel || title}>
      {body}
    </PressScale>
  );
}

/**
 * 목록 위 소제목 + 오른쪽 작은 링크.
 * @param {{title: string, hint?: string, action?: {label: string, onPress: () => void}, style?: any}} props
 */
export function SectionTitle({title, hint, action, style}) {
  return (
    <View style={[st.sec, style]}>
      <Text style={st.secTitle}>{title}</Text>
      {!!hint && <Text style={T.tiny}>{hint}</Text>}
      {action && (
        <Pressable onPress={action.onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={action.label} style={st.secAction}>
          <Text style={st.link}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * 작은 꼬리표('즐겨찾기', '3번'). accent가 없으면 회색.
 * @param {{label: string, accent?: {main: string, soft: string, dark: string}, style?: any}} props
 */
export function Badge({label, accent, style}) {
  return (
    <View style={[st.badge, {backgroundColor: accent ? accent.soft : C.fill}, style]}>
      <Text style={[st.badgeTx, {color: accent ? accent.dark : C.sub}]}>{label}</Text>
    </View>
  );
}
export const Pill = Badge;

/**
 * 선택 칩. 회색 바탕, selected면 라벤더 바탕 흰 글자. soft(+30분 같은 빠른 더하기)도 회색. right는 오른쪽 작은 글자(kcal 등).
 * @param {{label: string, emoji?: string, icon?: string, right?: string|number, selected?: boolean, soft?: boolean, onPress?: () => void, onLongPress?: () => void, accent?: {main: string, soft: string, dark: string}, accessibilityLabel?: string, style?: any}} props
 */
export function Chip({label, emoji, icon, right, selected, onPress, onLongPress, accent, accessibilityLabel, style}) {
  return (
    <PressScale
      style={[st.chip, selected && {backgroundColor: accent?.main ?? C.primary}, style]}
      hitSlop={{top: 3, bottom: 3}}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{selected: !!selected}}>
      <View style={st.chipIn}>
        {!!emoji && <Text style={st.chipEmoji}>{emoji}</Text>}
        {!!icon && <Icon name={icon} size={16} color={selected ? C.white : C.sub} />}
        <Text style={[st.chipTx, selected && st.onSolid]} numberOfLines={1}>
          {label}
        </Text>
        {right != null && <Text style={[T.tiny, selected && st.onSolidSub]}>{right}</Text>}
      </View>
    </PressScale>
  );
}

/**
 * 비어 있을 때: 고양이 + 한 줄 + 보조 줄 + (선택) 버튼.
 * @param {{title: string, sub?: string, action?: {label: string, onPress: () => void}, accent?: {main: string, soft: string, dark: string}, size?: number}} props
 */
export function EmptyState({title, sub, action, size = 80}) {
  return (
    <View style={st.empty}>
      <CatMascot size={size} />
      <Text style={[T.title, st.center]}>{title}</Text>
      {!!sub && <Text style={[T.caption, st.center]}>{sub}</Text>}
      {action && <Button label={action.label} onPress={action.onPress} style={st.emptyBtn} />}
    </View>
  );
}

/**
 * 꽉 찬 버튼(높이 52). tone='soft'면 회색 바탕 + 검은 글자(accent를 주면 그 진한 색 글자). 'card'는 같은 모양의 흰 바탕(회색 페이지 위).
 * @param {{label: string, onPress: () => void, accent?: {main: string, soft: string, dark: string}, tone?: 'solid'|'soft'|'card', disabled?: boolean, style?: any, accessibilityLabel?: string}} props
 */
export function Button({label, onPress, accent, tone = 'solid', disabled, style, accessibilityLabel}) {
  const soft = tone === 'soft' || tone === 'card';
  return (
    <Jelly
      accent={accent}
      tone={soft ? tone : 'solid'}
      style={[st.btn, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel || label}>
      <Text style={[st.btnTx, soft && {color: accent ? accent.dark : C.text}]}>{label}</Text>
    </Jelly>
  );
}

// ---- 진행 링 ----

const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * 원형 진행 링(0~1). 처음 그릴 때와 값이 바뀔 때 부드럽게 채워진다. children은 가운데에.
 * @param {{progress: number, size?: number, stroke?: number, color?: string, track?: string, children?: any}} props
 */
export function Ring({progress, size = 64, stroke = 7, color = C.primary, track = C.fill, children}) {
  const reduce = useReduceMotion();
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) v.setValue(p);
    else Animated.timing(v, {toValue: p, duration: 700, useNativeDriver: false}).start();
  }, [p, reduce, v]);
  const offset = v.interpolate({inputRange: [0, 1], outputRange: [len, 0]});
  return (
    <View style={{width: size, height: size}} accessibilityRole="progressbar" accessibilityValue={{min: 0, max: 100, now: Math.round(p * 100)}}>
      {/* 12시 방향부터 채우려고 svg 통째로 -90도 */}
      <Svg width={size} height={size} style={[StyleSheet.absoluteFill, st.rot]}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <ACircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${len} ${len}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <View style={st.ringMid}>{children}</View>
    </View>
  );
}

// ---- 입력 ----

/**
 * − 값 + . 길게 누르면 계속 바뀐다(점점 빨라짐).
 * @param {{value: number, onChange: (v: number) => void, step?: number, min?: number, max?: number, unit?: string, label?: string, accent?: {main: string, soft: string, dark: string}}} props
 */
export function Stepper({value, onChange, step = 1, min = 0, max = 99999, unit, label = '값'}) {
  const val = useRef(value);
  val.current = value;
  const timer = useRef(null);
  const set = d => {
    const next = Math.max(min, Math.min(max, val.current + d));
    if (next !== val.current) {
      val.current = next;
      onChange(next);
    }
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const hold = d => {
    let gap = 160;
    const tick = () => {
      set(d);
      gap = Math.max(40, gap * 0.85);
      timer.current = setTimeout(tick, gap);
    };
    tick();
  };
  useEffect(() => stop, []);
  const btn = (d, icon, name) => (
    <IconJelly
      icon={icon}
      onPress={() => set(d)}
      onLongPress={() => hold(d)}
      delayLongPress={350}
      onPressOut={stop}
      accessibilityLabel={`${label} ${name}`}
      disabled={d < 0 ? value <= min : value >= max}
    />
  );
  return (
    <View style={st.stepper} accessibilityLabel={`${label} ${value}${unit || ''}`}>
      {btn(-step, 'minus', '줄이기')}
      <Text style={st.stepV}>
        {value.toLocaleString()}
        {!!unit && <Text style={st.stepU}>{` ${unit}`}</Text>}
      </Text>
      {btn(step, 'plus', '늘리기')}
    </View>
  );
}

/**
 * 탭처럼 고르는 막대. 선택 표시가 옆으로 미끄러진다.
 * @param {{options: Array<{key: string, label: string}>, value: string, onChange: (k: string) => void, accent?: {main: string, soft: string, dark: string}, style?: any}} props
 */
export function Segmented({options, value, onChange, style}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex(o => o.key === value));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => {
    Animated.spring(x, {toValue: idx, useNativeDriver: true, speed: 20, bounciness: 6}).start();
  }, [idx, x]);
  const cw = w / options.length;
  return (
    <View style={[st.seg, style]} onLayout={e => setW(e.nativeEvent.layout.width - 6)} accessibilityRole="tablist">
      {w > 0 && (
        <Animated.View
          style={[st.segInd, {width: cw, transform: [{translateX: Animated.multiply(x, cw)}]}]}
          pointerEvents="none"
        />
      )}
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={st.segItem}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{selected: on}}>
            <Text style={[st.segTx, on && st.segOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- 목록 ----

const SWIPE = 88;

/**
 * 왼쪽으로 밀면 오른쪽에 삭제 버튼이 드러나는 줄. 화면 낭독기에선 '삭제' 동작으로도 지울 수 있다.
 * @param {{onDelete: () => void, deleteLabel?: string, children?: any, style?: any}} props
 */
export function SwipeRow({onDelete, deleteLabel = '삭제', children, style}) {
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const snap = to => {
    open.current = to !== 0;
    Animated.spring(x, {toValue: to, useNativeDriver: true, speed: 24, bounciness: 4}).start();
  };
  const pan = useRef(
    PanResponder.create({
      // 가로로 확실히 밀 때만 잡는다 -- 세로 스크롤·탭은 그대로
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => x.setValue(Math.max(-SWIPE * 1.3, Math.min(0, g.dx + (open.current ? -SWIPE : 0)))),
      onPanResponderRelease: (_, g) => snap(g.dx + (open.current ? -SWIPE : 0) < -SWIPE / 2 || g.vx < -0.5 ? -SWIPE : 0),
      onPanResponderTerminate: () => snap(open.current ? -SWIPE : 0),
    }),
  ).current;
  return (
    <View
      style={[st.swipe, style]}
      accessibilityActions={[{name: 'delete', label: deleteLabel}]}
      onAccessibilityAction={e => e.nativeEvent.actionName === 'delete' && onDelete()}>
      {/* 닫혀 있을 땐 숨긴다 -- 둥근 모서리 틈으로 빨간 바탕이 비치지 않게 */}
      <Animated.View style={[st.swipeBack, {opacity: x.interpolate({inputRange: [-8, 0], outputRange: [1, 0], extrapolate: 'clamp'})}]}>
        <Pressable
          style={st.swipeDel}
          onPress={() => {
            snap(0);
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}>
          <Icon name="trash" size={20} color={C.white} />
          <Text style={st.swipeTx}>삭제</Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={{transform: [{translateX: x}]}} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * 처음 나타날 때 아래에서 살짝 떠오르며 페이드인. index로 순서대로 늦춘다(최대 8칸).
 * @param {{index?: number, children?: any, style?: any}} props
 */
export function FadeIn({index = 0, children, style}) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, {toValue: 1, duration: 180, delay: Math.min(index, 8) * 35, useNativeDriver: true}).start();
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ty = v.interpolate({inputRange: [0, 1], outputRange: [6, 0]});
  return <Animated.View style={[style, {opacity: v, transform: [{translateY: ty}]}]}>{children}</Animated.View>;
}

// ---- 날짜 ----

/**
 * ‹ 2026년 11월 5일 (목) › . 좌우로 밀어도 하루씩 넘어간다(오른쪽으로 밀면 전날). max(기본 오늘) 다음으론 못 간다(max=null이면 미래 허용).
 * @param {{day: string, onChange: (day: string) => void, accent?: {main: string, soft: string, dark: string}, max?: string | null}} props
 */
export function DateNav({day, onChange, max = dayKey()}) {
  const atMax = max != null && day >= max;
  const isToday = day === dayKey();
  const ref = useRef({day, onChange, atMax});
  ref.current = {day, onChange, atMax};
  const x = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => x.setValue(g.dx / 4),
      onPanResponderRelease: (_, g) => {
        const {day: d, onChange: f, atMax: end} = ref.current;
        if (g.dx > 60) f(shiftDay(d, -1));
        else if (g.dx < -60 && !end) f(shiftDay(d, 1));
        Animated.spring(x, {toValue: 0, useNativeDriver: true, speed: 20, bounciness: 8}).start();
      },
      onPanResponderTerminate: () => x.setValue(0),
    }),
  ).current;
  return (
    <View style={st.dateRow} {...pan.panHandlers}>
      <Pressable
        onPress={() => onChange(shiftDay(day, -1))}
        style={st.navBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="이전 날">
        <Icon name="back" size={20} color={C.text} />
      </Pressable>
      <Animated.View style={[st.dateMid, {transform: [{translateX: x}]}]}>
        <Text style={T.title}>{fmtDay(day)}</Text>
        {!isToday && (
          <Pressable onPress={() => onChange(dayKey())} hitSlop={10} accessibilityRole="button" accessibilityLabel="오늘로">
            <Text style={st.toToday}>오늘로</Text>
          </Pressable>
        )}
      </Animated.View>
      <Pressable
        onPress={() => !atMax && onChange(shiftDay(day, 1))}
        style={[st.navBtn, atMax && st.navOff]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="다음 날"
        accessibilityState={{disabled: atMax}}>
        <Icon name="chev" size={20} color={C.text} />
      </Pressable>
    </View>
  );
}

// ---- 아래 시트 ----

/**
 * 아래에서 올라오는 시트. 그려질 때 열리고, 배경 탭·뒤로가기·아래로 끌기로 닫힌다(닫힘 애니 뒤 onClose).
 * 코드로 닫을 땐 부모가 그냥 안 그리면 된다(애니 없이 사라짐).
 * RN Modal은 안드로이드 내비게이션 바 밑까지 깔리므로 navigationBarTranslucent + 아래 inset 여백(HangSheet와 같은 방법).
 * @param {{onClose: () => void, title?: string, children?: any, keyboard?: boolean}} props
 */
export function Sheet({onClose, title, children, keyboard}) {
  const reduce = useReduceMotion();
  const {bottom} = useSafeAreaInsets();
  const y = useRef(new Animated.Value(reduce ? 0 : 600)).current;
  const fade = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const h = useRef(600);
  const closing = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (reduce) return;
    Animated.parallel([
      Animated.spring(y, {toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4}),
      Animated.timing(fade, {toValue: 1, duration: 200, useNativeDriver: true}),
    ]).start();
    // 열릴 때 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    if (closing.current) return;
    closing.current = true;
    if (reduceCache) return closeRef.current();
    Animated.parallel([
      Animated.timing(y, {toValue: h.current, duration: 200, useNativeDriver: true}),
      Animated.timing(fade, {toValue: 0, duration: 200, useNativeDriver: true}),
    ]).start(() => closeRef.current());
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.8) dismiss();
        else Animated.spring(y, {toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6}).start();
      },
    }),
  ).current;

  const card = (
    <Animated.View
      style={[st.sheet, {paddingBottom: S.lg + bottom, transform: [{translateY: y}]}]}
      onLayout={e => (h.current = e.nativeEvent.layout.height)}>
      {/* 손잡이·제목 줄을 끌면 닫힌다(안쪽 스크롤과 안 싸우게 여기만) */}
      <View {...pan.panHandlers} style={st.grab}>
        <View style={st.handle} />
        {!!title && <Text style={T.h2}>{title}</Text>}
      </View>
      {children}
    </Animated.View>
  );

  return (
    <Modal transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={dismiss}>
      <Animated.View style={[StyleSheet.absoluteFill, st.dim, {opacity: fade}]} />
      <KeyboardAvoidingView style={st.flex} behavior={keyboard ? (Platform.OS === 'ios' ? 'padding' : 'height') : undefined} enabled={!!keyboard}>
        <Pressable style={st.flex} onPress={dismiss} accessibilityRole="button" accessibilityLabel="닫기" />
        {card}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  flex: {flex: 1},
  fill: {flexGrow: 1, justifyContent: 'center'},
  off: {opacity: 0.4},
  center: {textAlign: 'center'},
  link: {fontSize: 14, fontWeight: '600', color: C.primary},

  card: {backgroundColor: C.card, borderRadius: R.xl, padding: 20},
  cardHead: {flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm},
  cardAction: {minHeight: 28, justifyContent: 'center'},

  jelly: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6},
  onSolid: {color: C.white},
  onSolidSub: {color: 'rgba(255,255,255,0.8)'},

  sec: {flexDirection: 'row', alignItems: 'baseline', gap: S.xs, marginTop: 28, marginBottom: S.sm},
  secTitle: {fontSize: 18, fontWeight: '700', color: C.text},
  secAction: {marginLeft: 'auto', minHeight: 32, justifyContent: 'center'},

  badge: {alignSelf: 'flex-start', height: 24, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 6},
  badgeTx: {fontSize: 12, fontWeight: '600'},

  chip: {height: 38, borderRadius: R.pill, backgroundColor: C.fill},
  chipIn: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38},
  chipEmoji: {fontSize: 16},
  chipTx: {fontSize: 14, fontWeight: '600', color: C.text, maxWidth: 120},

  empty: {alignItems: 'center', paddingTop: S.xl, paddingBottom: S.md, gap: S.xs},
  emptyBtn: {marginTop: S.sm, alignSelf: 'stretch'},

  btn: {marginTop: S.sm},
  btnTx: {fontSize: 16, fontWeight: '700', color: C.white, textAlign: 'center', paddingHorizontal: S.lg},

  rot: {transform: [{rotate: '-90deg'}]},
  ringMid: {...ABS, alignItems: 'center', justifyContent: 'center'},

  stepper: {flexDirection: 'row', alignItems: 'center', gap: S.md, justifyContent: 'center'},
  // 큰 숫자 안에 끼운 글자는 lineHeight를 빼야 줄이 잘리지 않는다
  stepU: {fontSize: 14, fontWeight: '600', color: C.sub},
  stepV: {minWidth: 96, textAlign: 'center', fontSize: 28, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums']},

  seg: {flexDirection: 'row', height: 40, backgroundColor: C.fill, borderRadius: 10, padding: 3},
  segInd: {position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: R.sm, backgroundColor: C.card},
  segItem: {flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center'},
  segTx: {fontSize: 14, fontWeight: '600', color: C.sub},
  segOn: {color: C.text, fontWeight: '700'},

  swipe: {borderRadius: R.lg, overflow: 'hidden', marginBottom: S.sm},
  // 높이 '100%'는 absolute 부모 안에서 Yoga가 엉뚱하게 계산해 줄이 화면 밖으로 밀렸다(2026-11-05 에뮬) -> top/bottom 고정
  swipeBack: {...ABS, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: C.danger},
  swipeDel: {width: SWIPE, alignItems: 'center', justifyContent: 'center', gap: 2},
  swipeTx: {fontSize: 12, fontWeight: '700', color: C.white},

  dateRow: {flexDirection: 'row', alignItems: 'center'},
  dateMid: {flex: 1, alignItems: 'center'},
  toToday: {fontSize: 13, fontWeight: '600', color: C.primary, marginTop: 2},
  navBtn: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  navOff: {opacity: 0.25},

  dim: {backgroundColor: C.dim},
  sheet: {backgroundColor: C.card, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 20},
  grab: {paddingTop: S.sm, paddingBottom: S.sm, gap: S.sm},
  handle: {alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.border},
});
