import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Check, ChevronLeft, ChevronRight } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../../../constants/theme";
import { GardenBackdrop } from "../../../components/onboarding/GardenBackdrop";
import { GardenButton } from "../../../components/onboarding/GardenButton";
import { MascotId, MascotPortrait, mascotOptions } from "../../../components/onboarding/MascotPortrait";
import { ProgressHeader } from "../../../components/onboarding/ProgressHeader";
import { useGardenClickSound } from "../../../components/onboarding/GardenAmbience";
import { useAuthStore } from "../../../store/useAuthStore";
import { useUIStore } from "../../../store/useUIStore";

type Mascot = (typeof mascotOptions)[number];
const GAP = 14;

export default function ChooseCreatureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const setStarter = useAuthStore((s) => s.setStarter);
  const isDay = useUIStore((s) => s.onboardingTheme === "day");
  const playClick = useGardenClickSound();
  const listRef = useRef<FlatList<Mascot>>(null);
  const cardWidth = Math.min(width - 64, 330);
  const interval = cardWidth + GAP;
  const sidePadding = Math.max(16, (width - cardWidth) / 2);
  const [selectedId, setSelectedId] = useState<MascotId>("penny");
  const [celebrating, setCelebrating] = useState(false);
  const activeIndex = mascotOptions.findIndex((item) => item.id === selectedId);
  const active = mascotOptions[activeIndex] ?? mascotOptions[0];

  const selectIndex = (index: number, scroll = false) => {
    const bounded = Math.max(0, Math.min(mascotOptions.length - 1, index));
    const next = mascotOptions[bounded];
    if (next.id !== selectedId) Haptics.selectionAsync();
    setSelectedId(next.id);
    if (scroll) listRef.current?.scrollToOffset({ offset: bounded * interval, animated: true });
  };

  const updateCenteredCard = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    selectIndex(Math.round(event.nativeEvent.contentOffset.x / interval));
  };

  const choose = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStarter(active.id);
    setCelebrating(true);
    setTimeout(() => router.push("/(auth)/sign-up"), 1100);
  };

  return (
    <View style={[styles.root, !isDay && styles.rootNight, { paddingTop: insets.top + spacing.sm }]}>
      <GardenBackdrop strongerShade hideSky />
      <View style={styles.header}>
        <ProgressHeader step={5} total={5} />
        <View style={[styles.headingCard, !isDay && styles.headingCardNight]}>
          <Text style={[styles.stepLabel, !isDay && styles.stepLabelNight]}>FINAL GARDEN QUEST</Text>
          <Text style={[styles.heading, !isDay && styles.headingNight]}>Swipe to meet your buddy.</Text>
          <Text style={[styles.supporting, !isDay && styles.supportingNight]}>Press and select a companion to join your journey!</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={mascotOptions}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        bounces={false}
        contentContainerStyle={{ paddingHorizontal: sidePadding, paddingTop: spacing.md, paddingBottom: spacing.sm }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        getItemLayout={(_, index) => ({ length: interval, offset: interval * index, index })}
        onMomentumScrollEnd={updateCenteredCard}
        onScrollEndDrag={updateCenteredCard}
        scrollEventThrottle={16}
        renderItem={({ item }) => {
          const selected = item.id === selectedId;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.name}, ${item.role}`}
              onPress={() => { playClick(); selectIndex(mascotOptions.findIndex((mascot) => mascot.id === item.id), true); }}
              style={({ pressed }) => [styles.card, !isDay && styles.cardNight, selected && styles.cardSelected, selected && !isDay && styles.cardSelectedNight, { width: cardWidth }, pressed && styles.cardPressed]}
            >
              <View style={[styles.portraitFrame, !isDay && styles.portraitFrameNight]}>
                <MascotPortrait id={item.id} size={Math.min(232, cardWidth - 48)} />
              </View>
              <Text style={[styles.name, !isDay && styles.nameNight]}>{item.name}</Text>
              <Text style={[styles.role, !isDay && styles.roleNight]}>{item.role}</Text>
              <Text style={[styles.personality, !isDay && styles.personalityNight]}>{item.personality}</Text>
              {selected && <View style={[styles.selectedBadge, !isDay && styles.selectedBadgeNight]}><Check size={14} color="#fff" strokeWidth={4} /><Text style={styles.selectedText}>SELECTED</Text></View>}
            </Pressable>
          );
        }}
      />

      <View style={styles.carouselControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous companion" disabled={activeIndex === 0} onPress={() => { playClick(); selectIndex(activeIndex - 1, true); }} style={[styles.arrow, !isDay && styles.arrowNight, activeIndex === 0 && styles.arrowDisabled]}>
          <ChevronLeft size={21} color={isDay ? "#31543c" : "#eee8ff"} strokeWidth={3} />
        </Pressable>
        <View style={styles.dots}>
          {mascotOptions.map((item, index) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Show ${item.name}`} onPress={() => { playClick(); selectIndex(index, true); }} style={[styles.dot, !isDay && styles.dotNight, item.id === selectedId && styles.dotActive, item.id === selectedId && !isDay && styles.dotActiveNight]} />
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Next companion" disabled={activeIndex === mascotOptions.length - 1} onPress={() => { playClick(); selectIndex(activeIndex + 1, true); }} style={[styles.arrow, !isDay && styles.arrowNight, activeIndex === mascotOptions.length - 1 && styles.arrowDisabled]}>
          <ChevronRight size={21} color={isDay ? "#31543c" : "#eee8ff"} strokeWidth={3} />
        </Pressable>
      </View>

      <View style={[styles.footer, !isDay && styles.footerNight, { paddingBottom: insets.bottom + spacing.md }]}>
        <GardenButton label={`CHOOSE ${active.name.toUpperCase()}`} onPress={choose} />
      </View>

      {celebrating && (
        <Animated.View entering={FadeIn.duration(180)} style={[styles.celebration, !isDay && styles.celebrationNight]}>
          <Animated.View entering={ZoomIn.springify().damping(10)} style={styles.celebrationPortrait}><MascotPortrait id={active.id} size={220} /></Animated.View>
          <Animated.Text entering={FadeIn.delay(220)} style={styles.celebrationText}>{active.name} is on your team!</Animated.Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#dfe9ad" },
  rootNight: { backgroundColor: "#151132" },
  header: { paddingHorizontal: spacing.md, zIndex: 2 },
  headingCard: { marginTop: spacing.sm + 4, backgroundColor: "rgba(255,249,221,0.97)", borderWidth: 3, borderColor: "#66835a", padding: 13, shadowColor: "#587245", shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.45, shadowRadius: 0 },
  headingCardNight: { backgroundColor: "rgba(43,31,76,0.97)", borderColor: "#9b8ad6", shadowColor: "#120d27" },
  stepLabel: { color: "#b06a43", fontFamily: "monospace", fontWeight: "900", fontSize: 10, letterSpacing: 0.9 },
  stepLabelNight: { color: "#ffd66e" },
  heading: { color: "#234f3a", fontFamily: "monospace", fontWeight: "900", fontSize: 21, lineHeight: 25, marginTop: 5 },
  headingNight: { color: "#fff5d6" },
  supporting: { color: "#526348", fontFamily: "monospace", fontWeight: "700", fontSize: 10, lineHeight: 15, marginTop: 4 },
  supportingNight: { color: "#d6cdea" },
  card: { alignItems: "center", alignSelf: "stretch", backgroundColor: "rgba(255,250,225,0.98)", borderWidth: 3, borderColor: "#82986d", borderRadius: 10, padding: 12, minHeight: 365 },
  cardNight: { backgroundColor: "rgba(48,36,80,0.98)", borderColor: "#7869a5" },
  cardSelected: { borderColor: "#26714e", shadowColor: "#426944", shadowOffset: { width: 5, height: 6 }, shadowOpacity: 0.65, shadowRadius: 0 },
  cardSelectedNight: { borderColor: "#c1b2ff", shadowColor: "#151027" },
  cardPressed: { transform: [{ scale: 0.99 }] },
  portraitFrame: { borderWidth: 4, borderColor: "#70915f", borderRadius: 10, overflow: "hidden" },
  portraitFrameNight: { borderColor: "#9b8ad6" },
  name: { color: "#234f3a", fontFamily: "monospace", fontWeight: "900", fontSize: 23, marginTop: 9 },
  nameNight: { color: "#fff4d4" },
  role: { color: "#a35d3d", fontFamily: "monospace", fontWeight: "900", fontSize: 10, marginTop: 1 },
  roleNight: { color: "#ffd66e" },
  personality: { color: "#526348", fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 7, maxWidth: 270 },
  personalityNight: { color: "#d6cdea" },
  selectedBadge: { marginTop: 9, flexDirection: "row", gap: 5, alignItems: "center", backgroundColor: "#3b8c64", borderRadius: 5, paddingHorizontal: 9, paddingVertical: 5 },
  selectedBadgeNight: { backgroundColor: "#8f7ae8" },
  selectedText: { color: "#fff", fontFamily: "monospace", fontWeight: "900", fontSize: 9 },
  carouselControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 13, paddingVertical: 8 },
  arrow: { width: 38, height: 34, borderRadius: 6, borderWidth: 2, borderColor: "#66835a", backgroundColor: "#fff3c4", alignItems: "center", justifyContent: "center" },
  arrowNight: { borderColor: "#9584cc", backgroundColor: "#322653" },
  arrowDisabled: { opacity: 0.35 },
  dots: { flexDirection: "row", gap: 7, alignItems: "center" },
  dot: { width: 9, height: 9, borderRadius: 3, backgroundColor: "#9fa777" },
  dotNight: { backgroundColor: "#51446f" },
  dotActive: { width: 22, backgroundColor: "#3b8c64" },
  dotActiveNight: { backgroundColor: "#aa92ff" },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: "rgba(255,248,215,0.97)", borderTopWidth: 1, borderTopColor: "#789263" },
  footerNight: { backgroundColor: "rgba(30,22,57,0.98)", borderTopColor: "#7566a5" },
  celebration: { ...StyleSheet.absoluteFillObject, zIndex: 20, backgroundColor: "rgba(43,91,62,0.94)", alignItems: "center", justifyContent: "center" },
  celebrationNight: { backgroundColor: "rgba(24,17,49,0.96)" },
  celebrationPortrait: { borderWidth: 5, borderColor: "#fff0a6", borderRadius: 12, overflow: "hidden" },
  celebrationText: { fontFamily: "monospace", fontWeight: "900", fontSize: 20, color: "#fff4c8", marginTop: spacing.md },
});
