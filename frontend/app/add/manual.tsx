import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { GardenScreen } from "../../components/ui/GardenScreen";
import { useSubscriptionStore } from "../../store/useSubscriptionStore";
import { useUIStore } from "../../store/useUIStore";
import { SubscriptionCategory } from "../../types/subscription";
import { useDemoModeStore } from "../../store/useDemoModeStore";
import { useApiClient } from "../../lib/api";
import { BillingCycleDto } from "../../types/api";
import { assignCreature } from "../../lib/creatureAssign";

const categories: SubscriptionCategory[] = [
  "Entertainment",
  "Productivity",
  "Fitness",
  "Storage",
  "Other",
];

export default function ManualScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const addSubscription = useSubscriptionStore((s) => s.addSubscription);
  const showToast = useUIStore((s) => s.showToast);
  const demoMode = useDemoModeStore((s) => s.active);
  const api = useApiClient();

  const [name, setName] = useState("");
  const [merchant, setMerchant] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<SubscriptionCategory>("Other");
  const [billingCycle, setBillingCycle] = useState<Exclude<BillingCycleDto, "one_time">>("monthly");
  const [renewalDate, setRenewalDate] = useState("");
  const [loading, setLoading] = useState(false);

  const valid = name.trim().length > 0 && merchant.trim().length > 0 && Number(price) > 0;

  const create = async () => {
    const priceNum = Number(price);
    const assignment = assignCreature(category, merchant.trim(), name.trim());
    const creatureName = assignment.name;
    setLoading(true);
    try {
      const local = {
        id: `manual-${Date.now()}`,
        merchant: merchant.trim(),
        displayName: name.trim(),
        creatureName,
        species: assignment.species,
        price: priceNum,
        billingInterval: billingCycle,
        nextActionDate: renewalDate,
        daysRemaining: 30,
        mood: "happy",
        healthScore: 94,
        category,
      annualCost: billingCycle === "yearly" ? priceNum : billingCycle === "weekly" ? priceNum * 52 : priceNum * 12,
        status: "active",
      } as const;
      if (demoMode) {
        addSubscription(local);
      } else {
        await api.createSubscription({
          vendor_name: merchant.trim(),
          display_name: name.trim(),
          category,
          amount: priceNum,
          currency: "USD",
          billing_cycle: billingCycle,
          renewal_or_expiry_date: renewalDate || null,
          creature_name: creatureName,
          creature_species: assignment.species,
        });
      }
      showToast({ message: `${creatureName} joined your garden!`, tone: "success" });
      router.dismissTo("/(tabs)/garden");
    } catch (e) {
      showToast({ message: (e as Error).message, tone: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: p.inputBg, borderColor: p.inputBorder, color: p.inputInk }];

  return (
    <GardenScreen title="Add manually" onBack={() => router.back()}>
      <Text style={[styles.label, { color: p.ink }]}>Subscription name</Text>
      <TextInput
        style={inputStyle}
        placeholder="e.g. Video Streaming"
        placeholderTextColor={p.muted}
        value={name}
        onChangeText={setName}
        accessibilityLabel="Subscription name"
      />

      <Text style={[styles.label, { color: p.ink }]}>Merchant</Text>
      <TextInput
        style={inputStyle}
        placeholder="e.g. StreamFlix"
        placeholderTextColor={p.muted}
        value={merchant}
        onChangeText={setMerchant}
        accessibilityLabel="Merchant"
      />

      <Text style={[styles.label, { color: p.ink }]}>Price (USD)</Text>
      <TextInput
        style={inputStyle}
        placeholder="9.99"
        placeholderTextColor={p.muted}
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
        accessibilityLabel="Price"
      />

      <Text style={[styles.label, { color: p.ink }]}>Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
        style={{ flexGrow: 0, marginBottom: spacing.lg }}
      >
        {categories.map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: p.ink }]}>Billing frequency</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ flexGrow: 0, marginBottom: spacing.md }}>
        {(["weekly", "monthly", "yearly", "trial"] as Exclude<BillingCycleDto, "one_time">[]).map((cycle) => (
          <Chip key={cycle} label={cycle} selected={billingCycle === cycle} onPress={() => setBillingCycle(cycle)} />
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: p.ink }]}>Renewal or expiry date</Text>
      <TextInput
        style={inputStyle}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={p.muted}
        value={renewalDate}
        onChangeText={setRenewalDate}
        accessibilityLabel="Renewal or expiry date"
      />

      <Button label="Create creature" onPress={create} disabled={!valid} loading={loading} style={{ marginTop: spacing.sm }} />
    </GardenScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.pixelBold,
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    fontFamily: fonts.medium,
    fontSize: 15,
    marginBottom: spacing.md,
  },
});
