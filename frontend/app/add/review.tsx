import { useRouter } from "expo-router";
import { ChevronDown, ChevronLeft, ChevronUp, TrendingUp } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconButton } from "../../components/ui/IconButton";
import { Screen } from "../../components/ui/Screen";
import { useReceiptDraftStore } from "../../store/useReceiptDraftStore";
import { useDemoModeStore } from "../../store/useDemoModeStore";
import { useApiClient } from "../../lib/api";
import { mapSubscription } from "../../lib/mappers";
import { BillingCycleDto } from "../../types/api";
import { useUIStore } from "../../store/useUIStore";

const evidence = [
  { label: "Renewal date", snippet: "“will renew on August 12, 2026”" },
  { label: "New price", snippet: "“new monthly price will be $19.99”" },
  { label: "Previous price", snippet: "“previous monthly price was $17.99”" },
];

export default function ReviewScreen() {
  const router = useRouter();
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
      const response = await api.confirmParse(parseId, edited, "Nova", "gem");
      setSubscription(mapSubscription(response.subscription));
      router.push("/add/success");
    } catch (e) {
      showToast({ message: (e as Error).message, tone: "warning" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel="Go back"
          icon={<ChevronLeft size={22} color={colors.text} />}
          onPress={() => router.back()}
        />
        <View style={{ flex: 1 }}>
          <Text style={type.title}>We found a subscription</Text>
        </View>
      </View>

      <View style={styles.confidence}>
        <View style={styles.confidenceDot} />
        <Text style={styles.confidenceText}>
          {extracted ? `${Math.round(extracted.confidence * 100)}% confidence` : "High confidence"}
        </Text>
      </View>

      <View style={styles.increase}>
        <TrendingUp size={16} color={colors.warning} />
        <Text style={styles.increaseText}>Price increased by $2.00 per month.</Text>
      </View>

      <Card style={{ paddingVertical: spacing.xs }}>
        {rows.map(({ key, label }, i) => (
          <View key={key} style={[styles.fieldRow, i > 0 && styles.fieldDivider]}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
              style={styles.fieldInput}
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
        style={styles.evidence}
      >
        <View style={styles.evidenceHeader}>
          <Text style={type.subheading}>Where we found this</Text>
          {showEvidence ? (
            <ChevronUp size={18} color={colors.textMuted} />
          ) : (
            <ChevronDown size={18} color={colors.textMuted} />
          )}
        </View>
        {showEvidence && (
          <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing.sm }}>
            {(extracted?.evidence ?? evidence).map((e) => (
              <View key={e.label} style={styles.evidenceRow}>
                <Text style={styles.evidenceLabel}>{e.label}</Text>
                <Text style={styles.evidenceSnippet}>{e.snippet}</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  confidence: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.successSoft,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: spacing.sm + 2,
  },
  confidenceDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: colors.success },
  confidenceText: { fontFamily: fonts.bold, fontSize: 13, color: colors.success },
  increase: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  increaseText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.warning },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  fieldDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  fieldInput: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
    textAlign: "right",
    flex: 1,
    padding: 0,
  },
  evidence: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm + 2,
  },
  evidenceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  evidenceRow: { marginBottom: spacing.sm },
  evidenceLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.primaryLight },
  evidenceSnippet: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
});
