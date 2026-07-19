import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronLeft, ChevronUp } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { Creature } from "../../components/creatures/Creature";
import { CreatureHabitat } from "../../components/creatures/CreatureHabitat";
import { HealthMeter } from "../../components/subscription/HealthMeter";
import { MoodBadge } from "../../components/subscription/MoodBadge";
import { ResolutionSheet } from "../../components/subscription/ResolutionSheet";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
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

const accordionSections = [
  { title: "Billing history", body: "Jun 18 — $17.99\nMay 18 — $15.99\nApr 18 — $15.99" },
  { title: "Last price change", body: "Increased from $15.99 to $17.99 on June 18." },
  { title: "Reminder schedule", body: "Reminders at 14, 7 and 1 day before renewal." },
  { title: "Original receipt text", body: "" },
  { title: "Notes", body: "" },
];

type Phase = "normal" | "reviving" | "celebrated";

export default function CreatureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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
        <Text style={type.heading}>{loading ? "Loading creatureâ€¦" : "Creature not found"}</Text>
        <Button label="Back to garden" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  const s = subscription;
  const displayMood = phase === "reviving" ? "reviving" : s.mood;

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    <Screen edges={{ top: false }} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <CreatureHabitat mood={displayMood} style={styles.habitat}>
        <View style={[styles.habitatTop, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton
            accessibilityLabel="Go back"
            icon={<ChevronLeft size={22} color={colors.text} />}
            onPress={() => router.back()}
          />
          <MoodBadge mood={displayMood} />
        </View>

        <View style={styles.stage}>
          {phase === "reviving" && (
            <Animated.View entering={FadeIn} style={styles.burst}>
              {["#B8AEFF", "#55D6BE", "#F6C453", "#62D98B", "#8B7CFF", "#B8AEFF"].map((c, i) => (
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
          <Text style={[type.title, { textAlign: "center" }]}>
            {s.creatureName} can rest now.
          </Text>
          <Text style={[type.body, { textAlign: "center", marginTop: spacing.sm }]}>
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
            <Text style={styles.merchant}>{s.merchant}</Text>
            <Text style={styles.priceLine}>
              {formatMoney(s.price)} {s.billingInterval === "trial" ? "after trial" : s.billingInterval}
            </Text>
            {s.previousPrice != null && (
              <Text style={styles.priceIncrease}>
                Price increased from {formatMoney(s.previousPrice)}
              </Text>
            )}
            <Text style={type.body}>
              {s.billingInterval === "trial" ? "Ends" : "Renews"} {formatDate(s.nextActionDate)} ·{" "}
              {daysLabel(s.daysRemaining)}{" "}
              {s.daysRemaining > 1 ? "remaining" : ""}
            </Text>
          </Card>

          <Card style={{ marginTop: spacing.sm + 2, gap: spacing.sm }}>
            <Text style={type.subheading}>Health</Text>
            <HealthMeter mood={displayMood} />
            <Text style={type.bodySmall}>{healthExplanation(s)}</Text>
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
                onPress={() => showToast({ message: "Editing is mocked in this demo", tone: "info" })}
                style={{ flex: 1 }}
              />
            </View>
          </View>

          {accordionSections.map(({ title, body }) => {
            const content =
              title === "Original receipt text"
                ? s.receiptText ?? "No receipt saved for this subscription."
                : title === "Notes"
                ? s.notes ?? "No notes yet."
                : body;
            const open = openSection === title;
            return (
              <Pressable
                key={title}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setOpenSection(open ? null : title)}
                style={styles.accordion}
              >
                <View style={styles.accordionHeader}>
                  <Text style={type.subheading}>{title}</Text>
                  {open ? (
                    <ChevronUp size={18} color={colors.textMuted} />
                  ) : (
                    <ChevronDown size={18} color={colors.textMuted} />
                  )}
                </View>
                {open && (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <Text style={[type.bodySmall, { marginTop: spacing.sm }]}>{content}</Text>
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
  habitat: { borderRadius: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, paddingBottom: spacing.md },
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
  creatureName: { fontFamily: fonts.extraBold, fontSize: 26, color: colors.text },
  speciesLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  merchant: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.text },
  priceLine: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  priceIncrease: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.warning },
  actions: { gap: spacing.sm + 2, marginTop: spacing.md },
  actionRow: { flexDirection: "row", gap: spacing.sm + 2 },
  accordion: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm + 2,
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  celebrated: { padding: spacing.lg, paddingTop: spacing.xl },
});
