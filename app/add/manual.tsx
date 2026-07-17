import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { IconButton } from "../../components/ui/IconButton";
import { Screen } from "../../components/ui/Screen";
import { useSubscriptionStore } from "../../store/useSubscriptionStore";
import { useUIStore } from "../../store/useUIStore";
import { SubscriptionCategory } from "../../types/subscription";

const categories: SubscriptionCategory[] = [
  "Entertainment",
  "Productivity",
  "Fitness",
  "Storage",
  "Other",
];

const creatureNames = ["Nova", "Bramble", "Echo", "Willow", "Zephyr", "Maple"];

export default function ManualScreen() {
  const router = useRouter();
  const addSubscription = useSubscriptionStore((s) => s.addSubscription);
  const showToast = useUIStore((s) => s.showToast);

  const [name, setName] = useState("");
  const [merchant, setMerchant] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<SubscriptionCategory>("Other");

  const valid = name.trim().length > 0 && merchant.trim().length > 0 && Number(price) > 0;

  const create = () => {
    const priceNum = Number(price);
    const creatureName =
      creatureNames[Math.floor(Math.random() * creatureNames.length)];
    addSubscription({
      id: `manual-${Date.now()}`,
      merchant: merchant.trim(),
      displayName: name.trim(),
      creatureName,
      species: "blob",
      price: priceNum,
      billingInterval: "monthly",
      nextActionDate: "2026-08-16",
      daysRemaining: 30,
      mood: "happy",
      healthScore: 94,
      category,
      annualCost: priceNum * 12,
      status: "active",
    });
    showToast({ message: `${creatureName} joined your garden!`, tone: "success" });
    router.dismissTo("/(tabs)/garden");
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel="Go back"
          icon={<ChevronLeft size={22} color={colors.text} />}
          onPress={() => router.back()}
        />
        <Text style={type.title}>Add manually</Text>
      </View>

      <Text style={styles.label}>Subscription name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Video Streaming"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        accessibilityLabel="Subscription name"
      />

      <Text style={styles.label}>Merchant</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. StreamFlix"
        placeholderTextColor={colors.textMuted}
        value={merchant}
        onChangeText={setMerchant}
        accessibilityLabel="Merchant"
      />

      <Text style={styles.label}>Monthly price (USD)</Text>
      <TextInput
        style={styles.input}
        placeholder="9.99"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
        accessibilityLabel="Monthly price"
      />

      <Text style={styles.label}>Category</Text>
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

      <Button label="Create creature" onPress={create} disabled={!valid} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    marginBottom: spacing.lg,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
});
