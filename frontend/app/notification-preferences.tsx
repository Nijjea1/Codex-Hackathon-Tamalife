import { useRouter } from "expo-router";
import { BellRing, Check } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Card } from "../components/ui/Card";
import { GardenKicker } from "../components/ui/GardenKit";
import { GardenScreen } from "../components/ui/GardenScreen";
import { useGardenPalette } from "../constants/garden";
import { fonts, spacing } from "../constants/theme";
import { useApiClient } from "../lib/api";
import { useDemoModeStore } from "../store/useDemoModeStore";
import { useUIStore } from "../store/useUIStore";
import { NotificationCategoryKey, NotificationPreferencesDto } from "../types/api";

const defaults: NotificationPreferencesDto = {
  reminder_days_before: [14, 7, 1],
  push_enabled: true,
  email_enabled: false,
  renewal_enabled: true,
  price_hike_enabled: true,
  creature_health_enabled: true,
  re_engagement_enabled: true,
  weekly_digest_enabled: true,
  re_engagement_after_days: 7,
  weekly_digest_weekday: 0,
  weekly_digest_hour: 9,
};

const CATEGORIES: { key: NotificationCategoryKey; label: string; description: string }[] = [
  { key: "renewal_enabled", label: "Renewal reminders", description: "Before a subscription or bill renews." },
  { key: "price_hike_enabled", label: "Price-hike alerts", description: "When a subscription's price goes up." },
  { key: "creature_health_enabled", label: "Creature health", description: "When a creature gets sick and needs action." },
  { key: "re_engagement_enabled", label: "We miss you", description: "A nudge when you've been away for a while." },
  { key: "weekly_digest_enabled", label: "Weekly digest", description: "A weekly summary of your garden." },
];

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 30, label: "30 days" },
  { value: 14, label: "14 days" },
  { value: 7, label: "7 days" },
  { value: 3, label: "3 days" },
  { value: 1, label: "1 day" },
  { value: 0, label: "Renewal day" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type BooleanKey = "push_enabled" | "email_enabled" | NotificationCategoryKey;

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const api = useApiClient();
  const demo = useDemoModeStore((state) => state.active);
  const showToast = useUIStore((state) => state.showToast);
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demo) return;
    api
      .notificationPreferences()
      .then(setPreferences)
      .catch((error) => showToast({ message: (error as Error).message, tone: "warning" }))
      .finally(() => setLoading(false));
  }, [api, demo, showToast]);

  const persist = async (
    next: NotificationPreferencesDto,
    patch: Partial<NotificationPreferencesDto>,
  ) => {
    const previous = preferences;
    setPreferences(next);
    if (demo) return;

    setSaving(true);
    try {
      setPreferences(await api.updateNotificationPreferences(patch));
    } catch (error) {
      setPreferences(previous);
      showToast({ message: (error as Error).message, tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  const toggleBoolean = (field: BooleanKey, value: boolean) => {
    void persist({ ...preferences, [field]: value }, { [field]: value });
  };

  const toggleDay = (day: number) => {
    const selected = preferences.reminder_days_before.includes(day);
    const days = selected
      ? preferences.reminder_days_before.filter((candidate) => candidate !== day)
      : [...preferences.reminder_days_before, day];
    if (days.length === 0) {
      showToast({ message: "Keep at least one reminder.", tone: "info" });
      return;
    }

    const sorted = [...days].sort((a, b) => b - a);
    void persist(
      { ...preferences, reminder_days_before: sorted },
      { reminder_days_before: sorted },
    );
  };

  const switchRow = (
    label: string,
    description: string,
    value: boolean,
    onChange: (value: boolean) => void,
    border: boolean,
    disabled = false,
    key?: string,
  ) => (
    <View
      key={key}
      style={[
        styles.row,
        border && { borderBottomWidth: 1.5, borderBottomColor: p.cardBorder },
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: p.ink }]}>{label}</Text>
        <Text style={[styles.hint, { color: p.muted }]}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={saving || disabled}
        onValueChange={onChange}
        trackColor={{ true: p.gold, false: p.pillBorder }}
        thumbColor={p.cardBgSolid}
      />
    </View>
  );

  const channelsDisabled = !preferences.push_enabled && !preferences.email_enabled;
  const digestLine = `${WEEKDAYS[preferences.weekly_digest_weekday] ?? "Mon"}, ${String(
    preferences.weekly_digest_hour,
  ).padStart(2, "0")}:00`;

  return (
    <GardenScreen title="Notifications" onBack={() => router.back()}>
      <GardenKicker>STAY IN THE LOOP</GardenKicker>
      <Text style={[styles.lead, { color: p.body }]}>Choose how and when Penny nudges you.</Text>

      {loading ? (
        <Text style={[styles.lead, { color: p.muted }]}>Loading preferences…</Text>
      ) : (
        <>
          <GardenKicker>CHANNELS</GardenKicker>
          <Card style={styles.card}>
            {switchRow(
              "Push notifications",
              "A nudge on your phone",
              preferences.push_enabled,
              (value) => toggleBoolean("push_enabled", value),
              true,
            )}
            {switchRow(
              "Email notifications",
              "A heads-up in your inbox",
              preferences.email_enabled,
              (value) => toggleBoolean("email_enabled", value),
              false,
            )}
          </Card>

          <GardenKicker>NOTIFICATION TYPES</GardenKicker>
          <Card style={styles.card}>
            {CATEGORIES.map((category, index) =>
              switchRow(
                category.label,
                category.description,
                preferences[category.key],
                (value) => toggleBoolean(category.key, value),
                index < CATEGORIES.length - 1,
                channelsDisabled,
                category.key,
              ),
            )}
          </Card>

          <View style={styles.scheduleHead}>
            <BellRing size={16} color={p.accent} strokeWidth={2.5} />
            <Text style={[styles.scheduleTitle, { color: p.ink }]}>Remind me before renewal</Text>
          </View>
          <Text style={[styles.hint, { color: p.muted, marginBottom: spacing.sm }]}>
            Tap to choose your reminder lead times.
          </Text>
          <Card style={styles.card}>
            {DAY_OPTIONS.map(({ value, label }, index) => {
              const selected = preferences.reminder_days_before.includes(value);
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={saving}
                  onPress={() => toggleDay(value)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    index > 0 && { borderTopWidth: 1.5, borderTopColor: p.cardBorder },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.optionLabel, { color: p.ink }]}>{label}</Text>
                  <View
                    style={[
                      styles.check,
                      selected
                        ? { backgroundColor: p.gold, borderColor: p.goldBorder }
                        : { backgroundColor: "transparent", borderColor: p.pillBorder },
                    ]}
                  >
                    {selected && <Check size={15} color={p.onGold} strokeWidth={3.5} />}
                  </View>
                </Pressable>
              );
            })}
          </Card>

          <View style={[styles.summary, { backgroundColor: p.warningBg, borderColor: p.goldBorder }]}>
            <Text style={[styles.summaryText, { color: p.body }]}>
              {saving
                ? "Saving…"
                : `Renewal reminders: ${preferences.reminder_days_before.join(", ")} day${
                    preferences.reminder_days_before.length === 1 ? "" : "s"
                  } before.`}
            </Text>
            <Text style={[styles.summaryText, { color: p.body }]}>Weekly digest: {digestLine}</Text>
          </View>
        </>
      )}
    </GardenScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: spacing.md },
  card: { paddingVertical: 0, marginBottom: spacing.lg },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  rowText: { flex: 1, paddingVertical: spacing.sm, gap: 2 },
  label: { fontFamily: fonts.pixelBold, fontSize: 14 },
  hint: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  disabled: { opacity: 0.45 },
  scheduleHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  scheduleTitle: { fontFamily: fonts.pixelBold, fontSize: 15 },
  optionRow: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  optionLabel: { fontFamily: fonts.pixelBold, fontSize: 14 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
  summary: { borderWidth: 1.5, borderRadius: 12, padding: spacing.md, gap: 4 },
  summaryText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
});
