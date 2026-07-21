import { useRouter } from "expo-router";
import { ChevronDown, ChevronUp, Mail } from "lucide-react-native";
import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { GardenScreen } from "../components/ui/GardenScreen";
import { Card } from "../components/ui/Card";
import { GardenKicker } from "../components/ui/GardenKit";
import { fonts, spacing } from "../constants/theme";
import { useGardenPalette } from "../constants/garden";
import { useUIStore } from "../store/useUIStore";

const SUPPORT_EMAIL = "avneetnijjer06@gmail.com";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Tamalife?",
    a: "Tamalife turns every subscription, bill and free trial into a little creature. Its health reflects how on top of it you are — thriving when it's handled, wilting when a renewal or price change needs your attention.",
  },
  {
    q: "How do I add a subscription?",
    a: "Tap the + button in the tab bar. You can upload a receipt (PDF or image) and we'll read it automatically, paste receipt text, or enter the details by hand.",
  },
  {
    q: "How does the receipt scanner work?",
    a: "Upload a PDF or photo of a receipt and our AI extracts the merchant, price, renewal date and billing cycle. If it's confident, a creature hatches automatically; if not, you get a quick review screen to confirm the details.",
  },
  {
    q: "Why did a creature get sick?",
    a: "Creatures decay as a renewal approaches, and faster if we detect an unresolved price increase. Resolve it — renew, cancel, snooze or dispute — and the creature recovers.",
  },
  {
    q: "What do price-change alerts mean?",
    a: "When a subscription's price goes up, we flag it with a red PRICE INCREASE badge and surface it under Price changes so you can decide whether to keep it.",
  },
  {
    q: "How do reminders work?",
    a: "Go to Profile → Notification preferences to turn push/email reminders on or off and pick your lead times (e.g. 14, 7 and 1 day before a renewal).",
  },
  {
    q: "How do I unlock new creature friends?",
    a: "New friends unlock as you grow your garden — tracking more subscriptions, levelling up, and resolving renewals. Your Profile shows each locked friend and exactly what's needed to unlock it.",
  },
  {
    q: "Is my data safe?",
    a: "Your subscriptions are stored securely in your own account. Receipts are only used to pull out billing details.",
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const showToast = useUIStore((s) => s.showToast);
  const [open, setOpen] = useState<string | null>(FAQS[0].q);

  const emailSupport = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Tamalife support")}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else showToast({ message: `Email us at ${SUPPORT_EMAIL}`, tone: "info" });
    } catch {
      showToast({ message: `Email us at ${SUPPORT_EMAIL}`, tone: "info" });
    }
  };

  return (
    <GardenScreen title="Help & FAQ" onBack={() => router.back()}>
      <GardenKicker>WE'VE GOT YOU</GardenKicker>
      <Text style={[styles.lead, { color: p.body }]}>
        Answers to common questions. Still stuck? Reach out any time.
      </Text>

      {FAQS.map(({ q, a }) => {
        const expanded = open === q;
        return (
          <Pressable
            key={q}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setOpen(expanded ? null : q)}
            style={[styles.item, { backgroundColor: p.cardBg, borderColor: p.cardBorder, shadowColor: p.cardShadow }]}
          >
            <View style={styles.itemHead}>
              <Text style={[styles.q, { color: p.ink }]}>{q}</Text>
              {expanded ? <ChevronUp size={18} color={p.muted} /> : <ChevronDown size={18} color={p.muted} />}
            </View>
            {expanded && (
              <Animated.View entering={FadeIn.duration(180)}>
                <Text style={[styles.a, { color: p.body }]}>{a}</Text>
              </Animated.View>
            )}
          </Pressable>
        );
      })}

      <View style={styles.supportWrap}>
        <GardenKicker>NEED MORE HELP?</GardenKicker>
        <Card style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <Text style={[styles.a, { color: p.body }]}>
            Email us and we'll get back to you as soon as we can.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Email support at ${SUPPORT_EMAIL}`}
            onPress={emailSupport}
            style={({ pressed }) => [styles.emailBtn, { backgroundColor: p.gold, borderColor: p.goldBorder }, pressed && { transform: [{ translateY: 2 }] }]}
          >
            <Mail size={18} color={p.onGold} strokeWidth={2.6} />
            <Text style={[styles.emailText, { color: p.onGold }]}>{SUPPORT_EMAIL}</Text>
          </Pressable>
        </Card>
      </View>
    </GardenScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: spacing.md },
  item: {
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 3,
  },
  itemHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  q: { fontFamily: fonts.pixelBold, fontSize: 14, flex: 1 },
  a: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  supportWrap: { marginTop: spacing.md },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
  },
  emailText: { fontFamily: fonts.pixelBold, fontSize: 14 },
});
