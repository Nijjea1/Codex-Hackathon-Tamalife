import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { GardenScreen } from "../../components/ui/GardenScreen";
import { useApiClient } from "../../lib/api";
import { useSubscriptionData } from "../../lib/useSubscriptionData";
import { useSubscriptionStore } from "../../store/useSubscriptionStore";
import { useUIStore } from "../../store/useUIStore";
import { BillingInterval, SubscriptionCategory } from "../../types/subscription";
import { BillingCycleDto } from "../../types/api";

const categories: SubscriptionCategory[] = [
  "Entertainment",
  "Streaming",
  "Music",
  "Productivity",
  "Fitness",
  "Storage",
  "Delivery",
  "News",
  "Mobile",
  "Other",
];
const cycles: BillingInterval[] = ["weekly", "monthly", "yearly", "trial"];

export default function EditSubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const p = useGardenPalette();
  const api = useApiClient();
  const { subscriptions, demo, loading, refresh } = useSubscriptionData(id);
  const updateLocal = useSubscriptionStore((s) => s.updateSubscription);
  const showToast = useUIStore((s) => s.showToast);
  const subscription = subscriptions.find((s) => s.id === id);

  const [name, setName] = useState(subscription?.displayName ?? "");
  const [merchant, setMerchant] = useState(subscription?.merchant ?? "");
  const [price, setPrice] = useState(subscription ? String(subscription.price) : "");
  const [category, setCategory] = useState<SubscriptionCategory>(subscription?.category ?? "Other");
  const [cycle, setCycle] = useState<BillingInterval>(subscription?.billingInterval ?? "monthly");
  const [renewalDate, setRenewalDate] = useState(subscription?.nextActionDate ?? "");
  const [notes, setNotes] = useState(subscription?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
    if (!subscription || initialized) return;
    setName(subscription.displayName);
    setMerchant(subscription.merchant);
    setPrice(String(subscription.price));
    setCategory(subscription.category);
    setCycle(subscription.billingInterval);
    setRenewalDate(subscription.nextActionDate);
    setNotes(subscription.notes ?? "");
    setInitialized(true);
  }, [initialized, subscription]);

  if (!subscription) {
    return (
      <GardenScreen title="Edit" onBack={() => router.back()} scroll={false}>
        <Text style={[styles.missing, { color: p.ink }]}>{loading ? "Loading subscription…" : "This item could not be found."}</Text>
      </GardenScreen>
    );
  }

  const valid = name.trim().length > 0 && merchant.trim().length > 0 && Number(price) > 0;

  const save = async () => {
    const priceNum = Number(price);
    setSaving(true);
    try {
      if (demo) {
        const annualCost =
          cycle === "yearly" ? priceNum : cycle === "weekly" ? priceNum * 52 : priceNum * 12;
        updateLocal(id, {
          displayName: name.trim(),
          merchant: merchant.trim(),
          price: priceNum,
          category,
          billingInterval: cycle,
          nextActionDate: renewalDate,
          notes: notes.trim() || undefined,
          annualCost,
          monthlyCost: annualCost / 12,
        });
      } else {
        await api.updateSubscription(id, {
          display_name: name.trim(),
          vendor_name: merchant.trim(),
          amount: priceNum,
          category,
          billing_cycle: cycle as BillingCycleDto,
          renewal_or_expiry_date: renewalDate || null,
          notes: notes.trim() || null,
        });
        await refresh();
      }
      showToast({ message: "Saved your changes.", tone: "success" });
      router.back();
    } catch (e) {
      showToast({ message: (e as Error).message, tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: p.inputBg, borderColor: p.inputBorder, color: p.inputInk }];

  return (
    <GardenScreen title={`Edit ${subscription.creatureName}`} onBack={() => router.back()}>
      <Text style={[styles.label, { color: p.ink }]}>Name</Text>
      <TextInput style={inputStyle} value={name} onChangeText={setName} placeholderTextColor={p.muted} accessibilityLabel="Name" />

      <Text style={[styles.label, { color: p.ink }]}>Merchant</Text>
      <TextInput style={inputStyle} value={merchant} onChangeText={setMerchant} placeholderTextColor={p.muted} accessibilityLabel="Merchant" />

      <Text style={[styles.label, { color: p.ink }]}>Price ({subscription.currency ?? "USD"})</Text>
      <TextInput style={inputStyle} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholderTextColor={p.muted} accessibilityLabel="Price" />

      <Text style={[styles.label, { color: p.ink }]}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ flexGrow: 0, marginBottom: spacing.lg }}>
        {categories.map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: p.ink }]}>Billing frequency</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ flexGrow: 0, marginBottom: spacing.md }}>
        {cycles.map((c) => (
          <Chip key={c} label={c} selected={cycle === c} onPress={() => setCycle(c)} />
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: p.ink }]}>Renewal or expiry date</Text>
      <TextInput style={inputStyle} value={renewalDate} onChangeText={setRenewalDate} placeholder="YYYY-MM-DD" placeholderTextColor={p.muted} accessibilityLabel="Renewal date" />

      <Text style={[styles.label, { color: p.ink }]}>Notes</Text>
      <TextInput style={[...inputStyle, styles.notes]} value={notes} onChangeText={setNotes} multiline placeholder="Optional" placeholderTextColor={p.muted} accessibilityLabel="Notes" />

      <Button label="Save changes" onPress={save} disabled={!valid} loading={saving} style={{ marginTop: spacing.sm }} />
    </GardenScreen>
  );
}

const styles = StyleSheet.create({
  missing: { fontFamily: fonts.pixelBold, fontSize: 18, textAlign: "center", marginTop: spacing.xl },
  label: { fontFamily: fonts.pixelBold, fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    fontFamily: fonts.medium,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  notes: { minHeight: 88, paddingTop: spacing.sm, textAlignVertical: "top" },
});
