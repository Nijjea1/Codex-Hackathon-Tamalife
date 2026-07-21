import { useRouter } from "expo-router";
import { BellRing } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { GardenScreen } from "../components/ui/GardenScreen";
import { Card } from "../components/ui/Card";
import { GardenKicker } from "../components/ui/GardenKit";
import { fonts, spacing } from "../constants/theme";
import { useGardenPalette } from "../constants/garden";
import { useApiClient } from "../lib/api";
import { useDemoModeStore } from "../store/useDemoModeStore";
import { useUIStore } from "../store/useUIStore";
import { NotificationPreferencesDto } from "../types/api";

const defaults: NotificationPreferencesDto = {
  reminder_days_before: [14, 7, 1],
  push_enabled: true,
  email_enabled: false,
};

// Selectable reminder lead times.
const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 30, label: "30 days" },
  { value: 14, label: "14 days" },
  { value: 7, label: "7 days" },
  { value: 3, label: "3 days" },
  { value: 1, label: "1 day" },
  { value: 0, label: "Renewal day" },
];

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const api = useApiClient();
  const demo = useDemoModeStore((s) => s.active);
  const showToast = useUIStore((s) => s.showToast);
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demo) return;
    api.notificationPreferences()
      .then(setPreferences)
      .catch((e) => showToast({ message: (e as Error).message, tone: "warning" }))
      .finally(() => setLoading(false));
  }, [api, demo, showToast]);

  const persist = async (next: NotificationPreferencesDto, patch: Partial<NotificationPreferencesDto>) => {
    const previous = preferences;
    setPreferences(next);
    if (demo) return;
    setSaving(true);
    try {
      setPreferences(await api.updateNotificationPreferences(patch));
    } catch (e) {
      setPreferences(previous);
      showToast({ message: (e as Error).message, tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (field: "push_enabled" | "email_enabled", value: boolean) =>
    void persist({ ...preferences, [field]: value }, { [field]: value });

  const toggleDay = (day: number) => {
    const has = preferences.reminder_days_before.includes(day);
    const days = has
      ? preferences.reminder_days_before.filter((d) => d !== day)
      : [...preferences.reminder_days_before, day];
    if (days.length === 0) {
      showToast({ message: "Keep at least one reminder.", tone: "info" });
      return;
    }
    const sorted = [...days].sort((a, b) => b - a);
    void persist({ ...preferences, reminder_days_before: sorted }, { reminder_days_before: sorted });
  };

  const channelRow = (label: string, hint: string, value: boolean, onChange: (v: boolean) => void, border: boolean) => (
    <View style={[styles.row, border && { borderTopWidth: 1.5, borderTopColor: p.cardBorder }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: p.ink }]}>{label}</Text>
        <Text style={[styles.hint, { color: p.muted }]}>{hint}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: p.gold, false: p.pillBorder }}
        thumbColor={p.cardBgSolid}
      />
    </View>
  );

  return (
    <GardenScreen title="Notifications" onBack={() => router.back()}>
      <GardenKicker>STAY IN THE LOOP</GardenKicker>
      <Text style={[styles.lead, { color: p.body }]}>
        Choose how and when Penny nudges you before a renewal.
      </Text>

      {loading ? (
        <Text style={[styles.lead, { color: p.muted }]}>Loading preferences…</Text>
      ) : (
        <>
          <Card style={{ paddingVertical: 0 }}>
            {channelRow("Push reminders", "A nudge on your phone", preferences.push_enabled, (v) => toggleChannel("push_enabled", v), false)}
            {channelRow("Email reminders", "A heads-up in your inbox", preferences.email_enabled, (v) => toggleChannel("email_enabled", v), true)}
          </Card>

          <View style={styles.scheduleHead}>
            <BellRing size={16} color={p.accent} strokeWidth={2.5} />
            <Text style={[styles.scheduleTitle, { color: p.ink }]}>Remind me before renewal</Text>
          </View>
          <Text style={[styles.hint, { color: p.muted, marginBottom: spacing.sm }]}>
            Tap to choose your reminder lead times.
          </Text>
          <View style={styles.chipRow}>
            {DAY_OPTIONS.map(({ value, label }) => {
              const selected = preferences.reminder_days_before.includes(value);
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => toggleDay(value)}
                  style={[
                    styles.chip,
                    { backgroundColor: selected ? p.gold : p.pill, borderColor: selected ? p.goldBorder : p.pillBorder },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selected ? p.onGold : p.pillInk }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.summary, { backgroundColor: p.warningBg, borderColor: p.goldBorder }]}>
            <Text style={[styles.summaryText, { color: p.body }]}>
              {saving ? "Saving…" : `You'll be reminded ${preferences.reminder_days_before.join(", ")} day${preferences.reminder_days_before.length === 1 ? "" : "s"} before each renewal.`}
            </Text>
          </View>
        </>
      )}
    </GardenScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: spacing.md },
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  label: { fontFamily: fonts.pixelBold, fontSize: 14 },
  hint: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  scheduleHead: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.lg, marginBottom: 4 },
  scheduleTitle: { fontFamily: fonts.pixelBold, fontSize: 15 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 2 },
  chipText: { fontFamily: fonts.pixel, fontSize: 13, letterSpacing: 0.3 },
  summary: { marginTop: spacing.md, borderWidth: 1.5, borderRadius: 12, padding: spacing.md },
  summaryText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
});
