import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronLeft, ChevronUp } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, radius, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { Creature } from "../../components/creatures/Creature";
import { CreatureHabitat } from "../../components/creatures/CreatureHabitat";
import { HealthMeter } from "../../components/subscription/HealthMeter";
import { MoodBadge } from "../../components/subscription/MoodBadge";
import { ResolutionSheet } from "../../components/subscription/ResolutionSheet";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { GardenPill } from "../../components/ui/GardenKit";
import { IconButton } from "../../components/ui/IconButton";
import { Screen } from "../../components/ui/Screen";
import { useUIStore } from "../../store/useUIStore";
import { ResolutionAction } from "../../types/subscription";
import { useSubscriptionData } from "../../lib/useSubscriptionData";
import {
  daysLabel,
  formatDate,
  formatMoney,
  healthExplanation,
} from "../../utils/creatureMood";

type Phase = "normal" | "reviving" | "celebrated";

export default function CreatureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const p = useGardenPalette();
  const insets = useSafeAreaInsets();
  const { subscriptions, loading, resolve: resolveSubscription } = useSubscriptionData(id);
  const subscription = subscriptions.find((sub) => sub.id === id);
  const showToast = useUIStore((s) => s.showToast);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>("normal");
  const [openSection, setOpenSection] = useState<string | null>(null);

  if (!subscription) {
    return (
      <Screen scroll={false} contentStyle={{ alignItems: "center", justifyContent: "center" }}>
        <Text style={[styles.notFound, { color: p.ink }]}>{loading ? "Loading creature…" : "Creature not found"}</Text>
        <Button label="Back to garden" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  const s = subscription;
  const displayMood = phase === "reviving" ? "reviving" : s.mood;

  const sections = [
    {
      title: "Plan",
      content: `${formatMoney(s.price)} / ${s.billingInterval}\n${s.category}${s.currency ? ` · ${s.currency}` : ""}`,
    },
    {
      title: "Last price change",
      content:
        s.previousPrice != null
          ? `Increased from ${formatMoney(s.previousPrice)} to ${formatMoney(s.price)}.`
          : "No price change recorded for this item.",
    },
    {
      title: "Reminder schedule",
      content: s.nextActionDate
        ? `Reminders 14, 7 and 1 day before ${formatDate(s.nextActionDate)}.`
        : "No renewal date set, so no reminders are scheduled.",
    },
    { title: "Original receipt text", content: s.receiptText ?? "No receipt saved for this subscription." },
    { title: "Notes", content: s.notes ?? "No notes yet." },
  ];

  const cancelTone =
    s.cancellationDifficulty === "easy"
      ? "success"
      : s.cancellationDifficulty === "hard"
        ? "danger"
        : "warning";

  const handleResolve = (action: ResolutionAction) => {
    setSheetVisible(false);
    if (action === "snooze") {
      void resolveSubscription(s.id, "snooze").catch((e) =>
        showToast({ message: (e as Error).message, tone: "warning" })
      );
      showToast({ message: "We'll remind you again in 3 days.", tone: "info" });
      return;
    }
    if (action === "dispute") {
      void resolveSubscription(s.id, "dispute").catch((e) =>
        showToast({ message: (e as Error).message, tone: "warning" })
      );
      showToast({ message: "Charge flagged. We'll keep an eye on it.", tone: "warning" });
      return;
    }
    // cancel / renew / acceptPrice → the revive sequence
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPhase("reviving");
    setTimeout(() => {
      const apiAction = action === "acceptPrice" ? "keep" : action;
      void resolveSubscription(s.id, apiAction).catch((e) => {
        setPhase("normal");
        showToast({ message: (e as Error).message, tone: "warning" });
      });
      setPhase("celebrated");
    }, 1600);
  };

  return (
    <Screen edges={{ top: false }} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }} strongerShade={false}>
      <CreatureHabitat mood={displayMood} style={styles.habitat}>
        <View style={[styles.habitatTop, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton
            accessibilityLabel="Go back"
            icon={<ChevronLeft size={22} color={p.pillInk} strokeWidth={2.5} />}
            onPress={() => router.back()}
          />
          <MoodBadge mood={displayMood} />
        </View>

        <View style={styles.stage}>
          {phase === "reviving" && (
            <Animated.View entering={FadeIn} style={styles.burst}>
              {["#FFDD73", "#55D6BE", "#F6C453", "#62D98B", "#FFB4A2", "#FFDD73"].map((c, i) => (
                <Animated.View
                  key={i}
                  entering={ZoomIn.delay(i * 120).springify().damping(7)}
                  style={[
                    styles.burstDot,
                    {
                      backgroundColor: c,
                      transform: [
                        { translateX: Math.cos((i / 6) * Math.PI * 2) * 90 },
                        { translateY: Math.sin((i / 6) * Math.PI * 2) * 70 },
                      ],
                    },
                  ]}
                />
              ))}
            </Animated.View>
          )}
          <Creature
            species={s.species}
            mood={displayMood}
            size="large"
            interactive
            onPress={() => {}}
            accessibilityLabel={`${s.creatureName}, ${displayMood}`}
          />
        </View>

        <View style={styles.habitatInfo}>
          <Text style={styles.creatureName}>{s.creatureName}</Text>
          <Text style={styles.speciesLabel}>
            {s.species.charAt(0).toUpperCase() + s.species.slice(1)} species
          </Text>
        </View>
      </CreatureHabitat>

      {phase === "celebrated" ? (
        <Animated.View entering={FadeInDown.springify()} style={styles.celebrated}>
          <Text style={[styles.celebTitle, { color: p.ink }]}>
            {s.creatureName} can rest now.
          </Text>
          <Text style={[styles.celebBody, { color: p.body }]}>
            {s.status === "cancelled"
              ? `You'll save ${formatMoney(s.annualCost)} per year.`
              : "The renewal has been taken care of."}
          </Text>
          <Button
            label="Return to garden"
            onPress={() => router.replace("/(tabs)/garden")}
            style={{ marginTop: spacing.lg }}
          />
        </Animated.View>
      ) : (
        <View style={styles.body}>
          <Card style={{ gap: 4 }}>
            <Text style={[styles.merchant, { color: p.inkStrong }]}>{s.merchant}</Text>
            <Text style={[styles.priceLine, { color: p.ink }]}>
              {formatMoney(s.price)} {s.billingInterval === "trial" ? "after trial" : s.billingInterval}
            </Text>
            <Text style={[styles.bodyText, { color: p.body }]}>
              {s.billingInterval === "trial" ? "Ends" : "Renews"} {formatDate(s.nextActionDate)} ·{" "}
              {daysLabel(s.daysRemaining)}{" "}
              {s.daysRemaining > 1 ? "remaining" : ""}
            </Text>
            {(s.priceHikeDetected || (s.cancellationDifficulty && s.cancellationDifficulty !== "unknown")) && (
              <View style={styles.detailBadges}>
                {s.priceHikeDetected && <GardenPill tone="danger" label="PRICE INCREASE" />}
                {s.cancellationDifficulty && s.cancellationDifficulty !== "unknown" && (
                  <GardenPill tone={cancelTone} label={`${s.cancellationDifficulty.toUpperCase()} TO CANCEL`} />
                )}
              </View>
            )}
          </Card>

          <Card style={{ marginTop: spacing.sm + 2, gap: spacing.sm }}>
            <Text style={[styles.cardTitle, { color: p.ink }]}>Health</Text>
            <HealthMeter mood={displayMood} />
            <Text style={[styles.bodyText, { color: p.body }]}>{healthExplanation(s)}</Text>
          </Card>

          <View style={styles.actions}>
            <Button label="Review renewal" onPress={() => setSheetVisible(true)} />
            <View style={styles.actionRow}>
              <Button
                label="Cancelled"
                variant="danger"
                onPress={() => handleResolve("cancel")}
                style={{ flex: 1 }}
              />
              <Button
                label="Renewed"
                variant="secondary"
                onPress={() => handleResolve("renew")}
                style={{ flex: 1 }}
              />
            </View>
            <View style={styles.actionRow}>
              <Button
                label="Snooze"
                variant="ghost"
                onPress={() => handleResolve("snooze")}
                style={{ flex: 1 }}
              />
              <Button
                label="Edit details"
                variant="ghost"
                onPress={() => router.push(`/edit/${s.id}`)}
                style={{ flex: 1 }}
              />
            </View>
          </View>

          {sections.map(({ title, content }) => {
            const open = openSection === title;
            return (
              <Pressable
                key={title}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setOpenSection(open ? null : title)}
                style={[styles.accordion, { backgroundColor: p.cardBg, borderColor: p.cardBorder }]}
              >
                <View style={styles.accordionHeader}>
                  <Text style={[styles.cardTitle, { color: p.ink }]}>{title}</Text>
                  {open ? (
                    <ChevronUp size={18} color={p.muted} />
                  ) : (
                    <ChevronDown size={18} color={p.muted} />
                  )}
                </View>
                {open && (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <Text style={[styles.bodyText, { marginTop: spacing.sm, color: p.body }]}>{content}</Text>
                  </Animated.View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <ResolutionSheet
        visible={sheetVisible}
        subscription={s}
        onClose={() => setSheetVisible(false)}
        onResolve={handleResolve}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notFound: { fontFamily: fonts.pixelBold, fontSize: 19 },
  habitat: { borderRadius: 0, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, paddingBottom: spacing.md },
  habitatTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  stage: { alignItems: "center", marginTop: spacing.sm },
  burst: { position: "absolute", top: "40%", zIndex: 3 },
  burstDot: { position: "absolute", width: 12, height: 12, borderRadius: 12 },
  habitatInfo: { alignItems: "center", marginTop: spacing.sm },
  creatureName: { fontFamily: fonts.pixelBold, fontSize: 26, color: "#fff7d8", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  speciesLabel: { fontFamily: fonts.medium, fontSize: 13, color: "#e4e1f2", marginTop: 2 },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  merchant: { fontFamily: fonts.pixelBold, fontSize: 20 },
  priceLine: { fontFamily: fonts.pixelBold, fontSize: 16, fontVariant: ["tabular-nums"] },
  priceIncrease: { fontFamily: "monospace", fontWeight: "900", fontSize: 12 },
  bodyText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  detailBadges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 6 },
  cardTitle: { fontFamily: fonts.pixelBold, fontSize: 15 },
  actions: { gap: spacing.sm + 2, marginTop: spacing.md },
  actionRow: { flexDirection: "row", gap: spacing.sm + 2 },
  accordion: {
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm + 2,
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  celebrated: { padding: spacing.lg, paddingTop: spacing.xl, alignItems: "center" },
  celebTitle: { fontFamily: fonts.pixelBold, fontSize: 24, textAlign: "center" },
  celebBody: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, textAlign: "center", marginTop: spacing.sm },
});
