/**
 * 영양제·약 정보: 식약처 공공 정보(저장해 둔 것, 없으면 받아서 항목에 저장)를 접었다 펴는 칸으로.
 * 내용은 API 글 그대로만 보여 준다(직접 만든 경고·조언 없음).
 * 건강 탭 안에서 띄운다(Health.js). children = 그 위에 뜨는 시트(고치기).
 */
import React, {useEffect, useRef, useState} from 'react';
import {Animated, Image, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {C, S, R, T, ACCENT} from '../theme';
import {Header, Icon} from '../ui';
import {Badge, Button, Card, SectionTitle, useReduceMotion} from '../kit';
import {KIND_LABEL, slotLabel} from '../health/store';
import {SOURCE_LINE, fetchDetail, fmtDate, hasKey, infoSections, updatedOf} from '../health/api';

const A = ACCENT.health;

/** @param {{item: any, items: any[], onBack: () => void, onEdit: () => void, onInfo: (info: any) => void, children?: any}} props */
export default function HealthInfo({item, items, onBack, onEdit, onInfo, children}) {
  const api = item.source?.api || (item.kind === 'medicine' ? 'drug' : 'supplement');
  const raw = item.info?.raw;
  const canFetch = !!item.source && hasKey(api);
  const [state, setState] = useState({status: 'idle'});
  const [tries, setTries] = useState(0);
  const infoRef = useRef(onInfo);
  infoRef.current = onInfo;

  useEffect(() => {
    if (raw || !canFetch) return;
    let alive = true;
    setState({status: 'loading'});
    fetchDetail(item.source, item.name).then(
      r => {
        if (!alive) return;
        if (r) infoRef.current({raw: r, fetchedAt: Date.now()});
        setState({status: r ? 'idle' : 'none'});
      },
      e => alive && setState({status: 'error', error: e.message}),
    );
    return () => {
      alive = false;
    };
  }, [raw, canFetch, item.source, item.name, tries]);

  const sections = raw ? infoSections(api, raw) : [];
  const main = sections.filter(s => !s.extra);
  const extra = sections.filter(s => s.extra);
  const company = raw && (api === 'drug' ? raw.entpName : raw.ENTRPS);
  const img = raw?.itemImage ? String(raw.itemImage).replace(/^http:/, 'https:') : '';
  const updated = raw ? updatedOf(api, raw) : '';
  const fetched = item.info?.fetchedAt ? fmtDate(new Date(item.info.fetchedAt).toISOString()) : '';

  // 내 약이 둘 이상이고 상호작용 글이 있으면, 다른 약의 상호작용 글을 그대로 모아 보여 준다
  const meds = items.filter(i => i.kind === 'medicine' && i.active !== false && i.info?.raw?.intrcQesitm);
  const others = item.kind === 'medicine' && meds.length >= 2 ? meds.filter(m => m.id !== item.id) : [];

  return (
    <View style={st.flex}>
      <View style={st.head}>
        <Header title={KIND_LABEL[item.kind]} onBack={onBack} />
      </View>
      <ScrollView contentContainerStyle={st.in}>
        <Card>
          <Text style={T.h2}>{item.name}</Text>
          {!!company && <Text style={[T.caption, st.mt]}>{company}</Text>}
          <View style={st.badges}>
            {!!item.dose && <Badge label={item.dose} accent={A} />}
            {(item.slots.length ? item.slots.map(slotLabel) : ['필요할 때']).map(l => (
              <Badge key={l} label={l} accent={A} />
            ))}
          </View>
          {!!item.memo && <Text style={[T.body, st.mt]}>{item.memo}</Text>}
          {!!img && (
            <Image source={{uri: img}} style={st.img} resizeMode="contain" accessibilityLabel={`${item.name} 사진`} />
          )}
          <Pressable onPress={onEdit} style={st.edit} accessibilityRole="button" accessibilityLabel="고치기">
            <Icon name="pencil" size={16} color={C.primary} />
            <Text style={[st.link]}>고치기</Text>
          </Pressable>
        </Card>

        {!raw && (
          <Card style={st.mtL}>
            {state.status === 'loading' ? (
              <Text style={T.caption}>정보를 불러오는 중…</Text>
            ) : state.status === 'error' ? (
              <>
                <Text style={T.caption}>{state.error}</Text>
                <Button label="다시 시도" tone="soft" accent={A} onPress={() => setTries(t => t + 1)} />
              </>
            ) : !item.source ? (
              <Text style={T.caption}>직접 입력한 항목이라 공공 정보가 없어요. 고치기에서 이름을 검색해 연결할 수 있어요.</Text>
            ) : !hasKey(api) ? (
              <Text style={T.caption}>정보 검색 키가 설정되지 않았어요.</Text>
            ) : (
              <Text style={T.caption}>공공 정보에서 이 항목을 찾지 못했어요.</Text>
            )}
          </Card>
        )}

        {main.map((s, i) => (
          <Fold key={s.key} label={s.label} text={s.text} open={i === 0} warn={s.key === 'atpnWarnQesitm'} />
        ))}
        {extra.length > 0 && (
          <>
            <SectionTitle title="기타 정보" />
            {extra.map(s => (
              <Fold key={s.key} label={s.label} text={s.text} />
            ))}
          </>
        )}

        {others.length > 0 && (
          <>
            <SectionTitle title="내 다른 약의 상호작용 안내" hint="설명서 글 그대로예요" />
            {others.map(m => (
              <Fold key={m.id} label={m.name} text={m.info.raw.intrcQesitm} />
            ))}
          </>
        )}

        <View style={st.foot}>
          {raw && <Text style={T.tiny}>{SOURCE_LINE}</Text>}
          {(!!updated || !!fetched) && (
            <Text style={T.tiny}>{[updated && `갱신 ${updated}`, fetched && `불러온 날 ${fetched}`].filter(Boolean).join(' · ')}</Text>
          )}
          <Text style={[T.caption, st.mt]}>참고용 정보예요. 복용은 의사·약사와 상의하세요.</Text>
        </View>
      </ScrollView>
      {children}
    </View>
  );
}

/** 제목을 누르면 펼쳐지는 칸 */
function Fold({label, text, open: open0 = false, warn}) {
  const reduce = useReduceMotion();
  const [open, setOpen] = useState(open0);
  const rot = useRef(new Animated.Value(open0 ? 1 : 0)).current;
  const toggle = () => {
    const next = !open;
    if (!reduce) {
      LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
      Animated.timing(rot, {toValue: next ? 1 : 0, duration: 220, useNativeDriver: true}).start();
    } else rot.setValue(next ? 1 : 0);
    setOpen(next);
  };
  const spin = rot.interpolate({inputRange: [0, 1], outputRange: ['0deg', '90deg']});
  return (
    <View style={st.fold}>
      <Pressable
        onPress={toggle}
        style={st.foldHead}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{expanded: open}}>
        <Text style={[T.title, st.flex, warn && {color: C.danger}]}>{label}</Text>
        <Animated.View style={{transform: [{rotate: spin}]}}>
          <Icon name="chev" size={18} color={C.faint} />
        </Animated.View>
      </Pressable>
      {open && (
        <Text style={[T.body, st.foldTx]} selectable>
          {text}
        </Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  flex: {flex: 1},
  head: {paddingHorizontal: S.xs},
  in: {padding: S.md, paddingBottom: S.xl * 2},
  mt: {marginTop: S.xxs},
  mtL: {marginTop: S.sm},
  badges: {flexDirection: 'row', flexWrap: 'wrap', gap: S.xxs, marginTop: S.sm},
  img: {width: '100%', height: 160, marginTop: S.sm, borderRadius: R.md, backgroundColor: C.white},
  edit: {flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: S.xs},
  link: {fontSize: 14, fontWeight: '600', color: C.primary},
  fold: {backgroundColor: C.card, borderRadius: R.lg, marginTop: S.sm, paddingHorizontal: S.md, overflow: 'hidden'},
  foldHead: {flexDirection: 'row', alignItems: 'center', minHeight: 52},
  foldTx: {lineHeight: 22, paddingBottom: S.md},
  foot: {marginTop: S.lg, gap: 2},
});
