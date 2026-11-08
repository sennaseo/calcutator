/**
 * 털뭉치 고양이 마스코트.
 * - 크게(size >= 150) 쓸 때: WebView 안에서 three.js로 실시간 3D 렌더 (android/app/src/main/assets/mascot/index.html,
 *   원본은 mascot/src, `npm run build:mascot`으로 다시 만든다). 터치(톡/꾹/드래그)는 페이지가 직접 받는다.
 * - 작게(빈 화면 장식 등) 쓸 때, 3D가 뜨기 전(자리표시), 렌더러가 계속 죽을 때: 정지 이미지(cat3d_still.png).
 *   cat3d_still.png = 3D 첫 프레임을 그대로 찍은 것. 카메라·모델·셰이더를 바꾸면 `node scripts/build-mascot.js --still`로 다시 찍는다.
 * 페이지 → RN: {type:'ready'} 첫 프레임, {type:'touch', active} 스크롤 잠금용, {type:'fps'} 개발용
 * RN → 페이지: window.handleMessage({type:'pulse'|'reduceMotion'|'pause'|'resume'|'mode'})
 * mode: 'idle'(기본) | 'eat'(앞발로 쿠키를 들고 냠냠 -- 간식 화면용). 처음 값은 URL(?mode=)로, 바뀌면 메시지로 보낸다.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, AppState, Image, StyleSheet, View} from 'react-native';
import {WebView} from 'react-native-webview';

// 3D 첫 프레임(투명 배경, 624px = 208dp@3x). 모드별로 하나씩
const STILL = {idle: require('./assets/cat3d_still.png'), eat: require('./assets/cat3d_still_eat.png')};
const LIVE_MIN = 150; // 이보다 작으면 정지 이미지
const PAGE = 'file:///android_asset/mascot/index.html';
const MAX_RESTARTS = 1; // 렌더러가 두 번째로 죽으면 더 띄우지 않고 정지 이미지로 남는다(메모리가 모자란 기기)

function StillCat({size, mode = 'idle'}) {
  return <Image source={STILL[mode] || STILL.idle} fadeDuration={0} resizeMode="contain" style={{width: size, height: size}} />;
}

function Decor({size, style, mode}) {
  return (
    <View style={[{width: size, height: size}, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <StillCat size={size} mode={mode} />
    </View>
  );
}

/** @param {{size?: number, press?: any, style?: any, onTouch?: (down: boolean) => void, mode?: 'idle' | 'eat'}} props */
export default function CatMascot({size = 64, press, style, onTouch, mode = 'idle'}) {
  if (size < LIVE_MIN) return <Decor size={size} style={style} />;
  return <LiveCat size={size} press={press} style={style} onTouch={onTouch} mode={mode} />;
}

function LiveCat({size, press, style, onTouch, mode}) {
  const web = useRef(null);
  const [source] = useState(() => ({uri: `${PAGE}?mode=${mode}`})); // 바꾸면 페이지가 다시 로드되니 처음 값만
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [ready, setReady] = useState(false);
  const [gen, setGen] = useState(0); // 렌더러 프로세스가 죽으면 WebView를 새로 띄운다
  const [dead, setDead] = useState(false);
  const deaths = useRef(0);
  const readyRef = useRef(false);
  const reduce = useRef(false);
  const first = useRef(true);
  const touchCb = useRef(onTouch);
  touchCb.current = onTouch;

  const send = useCallback(msg => {
    if (!readyRef.current) return;
    web.current?.injectJavaScript(`window.handleMessage(${JSON.stringify(JSON.stringify(msg))});true;`);
  }, []);
  const pulse = useCallback(() => send({type: 'pulse'}), [send]);

  useEffect(() => {
    let alive = true;
    const set = v => {
      reduce.current = !!v;
      send({type: 'reduceMotion', value: !!v});
    };
    AccessibilityInfo.isReduceMotionEnabled().then(v => alive && set(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', set);
    const app = AppState.addEventListener('change', s => send({type: s === 'active' ? 'resume' : 'pause'}));
    return () => {
      alive = false;
      sub?.remove();
      app?.remove();
      touchCb.current?.(false); // 언마운트 중에 잡혀 있던 스크롤 잠금 풀기
    };
  }, [send]);

  // 처음 그릴 때의 press 값은 무시 -- 화면을 열 때마다 반응하면 안 된다
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (press != null) pulse();
  }, [press, pulse]);

  useEffect(() => send({type: 'mode', value: mode}), [mode, send]);

  // 메모리가 모자라면 시스템이 WebView 렌더러만 죽인다 -- 그대로 두면 빈 칸이 되니 정지 이미지로 돌아갔다가 다시 띄운다
  // 계속 죽으면(그만큼 메모리가 없다) 다시 띄우지 않는다 -- 무한 재시작 방지
  const restart = useCallback(() => {
    readyRef.current = false;
    setReady(false);
    touchCb.current?.(false);
    deaths.current += 1;
    if (deaths.current > MAX_RESTARTS) setDead(true);
    else setGen(g => g + 1);
  }, []);

  const onMessage = useCallback(
    e => {
      let m;
      try {
        m = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (__DEV__ && m.type === 'ready') console.log('[cat3d] ready');
      if (m.type === 'ready') {
        readyRef.current = true;
        setReady(true);
        send({type: 'reduceMotion', value: reduce.current});
        send({type: 'mode', value: modeRef.current}); // 다시 띄웠을 때 등 URL 값과 달라졌을 수 있다
      } else if (m.type === 'touch') touchCb.current?.(!!m.active);
      else if (__DEV__ && m.type !== 'tap' && m.type !== 'pet') console.log('[cat3d]', m);
    },
    [send],
  );

  if (dead) return <Decor size={size} style={style} mode={mode} />; // 반응 없는 그림이니 버튼으로 읽히지 않게
  return (
    <View
      style={[{width: size, height: size}, style]}
      accessible
      accessibilityRole="button"
      accessibilityLabel="고양이 쓰다듬기"
      accessibilityHint="두드리면 기뻐하고, 꾹 누르거나 문지르면 쓰다듬어요"
      accessibilityActions={[{name: 'activate'}]}
      onAccessibilityAction={pulse}>
      <WebView
        key={gen}
        ref={web}
        source={source}
        originWhitelist={['file://*']}
        onMessage={onMessage}
        onRenderProcessGone={restart}
        importantForAccessibility="no-hide-descendants"
        style={st.web}
        containerStyle={st.web}
        scrollEnabled={false}
        nestedScrollEnabled // 안드로이드: 고양이를 만지는 동안 부모 ScrollView가 터치를 가로채지 않게(네이티브에서 즉시)
        overScrollMode="never"
        bounces={false}
        setBuiltInZoomControls={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        textZoom={100}
        webviewDebuggingEnabled={__DEV__}
      />
      {!ready && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="cat-placeholder">
          <StillCat size={size} mode={mode} />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  web: {flex: 1, backgroundColor: 'transparent'},
});
