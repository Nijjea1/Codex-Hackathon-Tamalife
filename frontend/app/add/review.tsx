import { useRouter } from "expo-router";
import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { GardenScreen } from "../../components/ui/GardenScreen";
import { GardenPill } from "../../components/ui/GardenKit";
import { useReceiptDraftStore } from "../../store/useReceiptDraftStore";
import { useDemoModeStore } from "../../store/useDemoModeStore";
import { useApiClient } from "../../lib/api";
import { mapSubscription } from "../../lib/mappers";
import { BillingCycleDto } from "../../types/api";
import { useUIStore } from "../../store/useUIStore";
import { assignCreature } from "../../lib/creatureAssign";

const evidence = [
  { label: "Renewal date", snippet: "“will renew on August 12, 2026”" },
  { label: "New price", snippet: "“new monthly price will be $19.99”" },
  { label: "Previous price", snippet: "“previous monthly price was $17.99”" },
];

export default function ReviewScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const parseId = useReceiptDraftStore((s) => s.parseId);
  const extracted = useReceiptDraftStore((s) => s.extracted);
  const setExtracted = useReceiptDraftStore((s) => s.setExtracted);
  const setSubscription = useReceiptDraftStore((s) => s.setSubscription);
  const demoMode = useDemoModeStore((s) => s.active);
  const api = useApiClient();
  const showToast = useUIStore((s) => s.showToast);
  const [submitting, setSubmitting] = useState(false);
  const [fields, setFields] = useState({
    name: extracted?.display_name ?? "Video Streaming",
    merchant: extracted?.vendor_name ?? "StreamFlix",
    price: extracted?.amount ?? "19.99",
    previousPrice: extracted?.previous_amount ?? "17.99",
    currency: extracted?.currency ?? "USD",
    frequency: extracted?.billing_cycle ?? "monthly",
    renewalDate: extracted?.renewal_or_expiry_date ?? "2026-08-12",
    category: extracted?.category ?? "Entertainment",
  });
  const [showEvidence, setShowEvidence] = useState(false);

  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((f) => ({ ...f, [key]: value }));

  const rows: { key: keyof typeof fields; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "merchant", label: "Merchant" },
    { key: "price", label: "Current price" },
    { key: "previousPrice", label: "Previous price" },
    { key: "currency", label: "Currency" },
    { key: "frequency", label: "Billing frequency" },
    { key: "renewalDate", label: "Renewal date" },
    { key: "category", label: "Category" },
  ];

  const confirm = async () => {
    if (demoMode || !parseId || !extracted) {
      router.push("/add/success");
      return;
    }
    const edited = {
      ...extracted,
      display_name: fields.name.trim(),
      vendor_name: fields.merchant.trim(),
      amount: fields.price,
      previous_amount: fields.previousPrice ? fields.previousPrice : null,
      currency: fields.currency.toUpperCase(),
      billing_cycle: fields.frequency.toLowerCase() as BillingCycleDto,
      renewal_or_expiry_date: fields.renewalDate || null,
      category: fields.category,
    };
    setSubmitting(true);
    try {
      setExtracted(edited);
      const assignment = assignCreature(edited.category, edited.vendor_name, edited.display_name);
      const response = await api.confirmParse(parseId, edited, assignment.name, assignment.species);
      setSubscription(mapSubscription(response.subscription));
      router.push("/add/success");
    } catch (e) {
      showToast({ message: (e as Error).message, tone: "warning" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GardenScreen title="We found a subscription" onBack={() => router.back()}>
      <View style={styles.badges}>
        <GardenPill
          tone="success"
          label={extracted ? `${Math.round(extracted.confidence * 100)}% CONFIDENCE` : "HIGH CONFIDENCE"}
        />
        <GardenPill tone="warning" label="PRICE +$2.00 / MO" />
      </View>

      <View style={[styles.increase, { backgroundColor: p.warningBg }]}>
        <TrendingUp size={16} color={p.accent} strokeWidth={2.4} />
        <Text style={[styles.increaseText, { color: p.body }]}>Price increased by $2.00 per month.</Text>
      </View>

      <Card style={{ paddingVertical: spacing.xs }}>
        {rows.map(({ key, label }, i) => (
          <View key={key} style={[styles.fieldRow, i > 0 && { borderTopWidth: 1.5, borderTopColor: p.cardBorder }]}>
            <Text style={[styles.fieldLabel, { color: p.muted }]}>{label}</Text>
            <TextInput
              style={[styles.fieldInput, { color: p.inkStrong }]}
              value={fields[key]}
              onChangeText={set(key)}
              accessibilityLabel={label}
            />
          </View>
        ))}
      </Card>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showEvidence }}
        onPress={() => setShowEvidence((v) => !v)}
        style={[styles.evidence, { backgroundColor: p.cardBg, borderColor: p.cardBorder }]}
      >
        <View style={styles.evidenceHeader}>
          <Text style={[styles.evidenceTitle, { color: p.ink }]}>Where we found this</Text>
          {showEvidence ? (
            <ChevronUp size={18} color={p.muted} />
          ) : (
            <ChevronDown size={18} color={p.muted} />
          )}
        </View>
        {showEvidence && (
          <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing.sm }}>
            {(extracted?.evidence ?? evidence).map((e) => (
              <View key={e.label} style={styles.evidenceRow}>
                <Text style={[styles.evidenceLabel, { color: p.accent }]}>{e.label}</Text>
                <Text style={[styles.evidenceSnippet, { color: p.body }]}>{e.snippet}</Text>
              </View>
            ))}
          </Animated.View>
        )}
      </Pressable>

      <Button
        label="Create creature"
        onPress={confirm}
        loading={submitting}
        style={{ marginTop: spacing.lg }}
      />
    </GardenScreen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm + 2, flexWrap: "wrap" },
  increase: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 12,
    padding: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  increaseText: { fontFamily: fonts.medium, fontSize: 13 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 13 },
  fieldInput: {
    fontFamily: fonts.pixelBold,
    fontSize: 14,
    textAlign: "right",
    flex: 1,
    padding: 0,
  },
  evidence: {
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm + 2,
  },
  evidenceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  evidenceTitle: { fontFamily: fonts.pixelBold, fontSize: 15 },
  evidenceRow: { marginBottom: spacing.sm },
  evidenceLabel: { fontFamily: "monospace", fontWeight: "900", fontSize: 11 },
  evidenceSnippet: { fontFamily: fonts.regular, fontSize: 13, marginTop: 1 },
});
