/**
 * 여러 화면이 같이 쓰는 작은 조각: 선 아이콘, 음식 썸네일, 뒤로가기 머리줄.
 *
 * 아이콘은 아이콘 폰트 라이브러리 대신 react-native-svg 선 몇 개로 그린다
 * (링 때문에 svg는 어차피 들어오니 의존성을 더 늘리지 않는다).
 */
import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {C} from './theme';
import {emojiOf} from './store';

// 톱니 8개짜리 기어: 바깥(10)·안쪽(7.5) 반지름을 번갈아 찍은 다각형 + 가운데 구멍
const GEAR = (() => {
  const pts = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * 2 * Math.PI;
    const r = i % 4 < 2 ? 10 : 7.5;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z`;
})();

// 24x24 기준 선 경로
const P = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  stats: 'M6 19v-6M12 19V6M18 19v-9',
  settings: GEAR,
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  close: 'M8 8l8 8M16 8l-8 8',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  target:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  calc: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 6.5h7v3h-7zM9 13h.01M12 13h.01M15 13h.01M9 17h.01M12 17h.01M15 17h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  cloud: 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11 3.5 3.5 0 0 0 7 18z',
  // 생활 기록·건강용
  today: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  candy: 'M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0zM8 12 3.5 8.5v7zM16 12l4.5-3.5v7zM10.5 9.5l3 5', // 양쪽 포장지 꼬인 사탕
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7zM7 10l7 7',
  capsule: 'M12 3a4 4 0 0 1 4 4v10a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4zM8 12h8',
  chair: 'M7 4h10v8H7zM5 12h14v3H5zM7 15v6M17 15v6',
  bus: 'M6 4h12a2 2 0 0 1 2 2v10H4V6a2 2 0 0 1 2-2zM4 11h16M7 16v3M17 16v3M8 13.5h.01M16 13.5h.01',
  drop: 'M12 3.5s-6 6.6-6 10.5a6 6 0 0 0 12 0c0-3.9-6-10.5-6-10.5z',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  timer: 'M12 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 10.5V14M10 3h4M18.5 6.5 17 8',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  trash: 'M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  chevDown: 'M5 9l7 7 7-7',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  wallet: 'M3 7a2 2 0 0 1 2-2h12a1 1 0 0 1 1 1v2M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM16 13.5h.01',
};
P.edit = P.pencil;

/**
 * 선 아이콘. fill을 주면 안을 칠한다(즐겨찾기 별 등).
 * @param {{name: string, size?: number, color?: string, width?: number, fill?: string}} props
 */
export function Icon({name, size = 24, color = C.sub, width = 2, fill = 'none'}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={P[name] || P.info}
        stroke={color}
        strokeWidth={width}
        fill={fill}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * 음식 사진 대신 분류 이모지를 회색 네모에
 * @param {{name: string, size?: number}} props
 */
export function Thumb({name, size = 48}) {
  return (
    <View style={[st.thumb, {width: size, height: size, borderRadius: size * 0.25}]}>
      <Text style={{fontSize: size * 0.5}}>{emojiOf(name)}</Text>
    </View>
  );
}

/**
 * 뒤로가기 + 가운데 제목. 오른쪽은 제목이 가운데 오도록 같은 폭만큼 비운다.
 * @param {{title: string, onBack?: () => void}} props
 */
export function Header({title, onBack}) {
  return (
    <View style={st.head}>
      <Pressable
        onPress={onBack}
        disabled={!onBack}
        style={st.side}
        hitSlop={8}
        accessible={!!onBack}
        accessibilityRole={onBack ? 'button' : undefined}
        accessibilityLabel={onBack ? '뒤로' : undefined}>
        {onBack && <Icon name="back" color={C.text} />}
      </Pressable>
      <Text style={st.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={st.side} />
    </View>
  );
}

const st = StyleSheet.create({
  thumb: {backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center'},
  head: {flexDirection: 'row', alignItems: 'center', height: 56},
  side: {width: 44, height: 44, justifyContent: 'center'},
  title: {flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: C.text},
});

