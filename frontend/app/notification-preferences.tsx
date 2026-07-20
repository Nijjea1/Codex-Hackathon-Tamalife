import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
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

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const p = useGardenPalette();
  const api = useApiClient();
  const demo = useDemoModeStore((s) => s.active);
  const showToast = useUIStore((s) => s.showToast);
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(!demo);

  useEffect(() => {
    if (demo) return;
    api.notificationPreferences()
      .then(setPreferences)
      .catch((e) => showToast({ message: (e as Error).message, tone: "warning" }))
      .finally(() => setLoading(false));
  }, [api, demo, showToast]);

  const update = async (field: "push_enabled" | "email_enabled", value: boolean) => {
    const previous = preferences;
    const next = { ...preferences, [field]: value };
    setPreferences(next);
    if (demo) return;
    try {
      setPreferences(await api.updateNotificationPreferences({ [field]: value }));
    } catch (e) {
      setPreferences(previous);
      showToast({ message: (e as Error).message, tone: "warning" });
    }
  };

  const row = (label: string, value: boolean, onChange: (v: boolean) => void, border: boolean) => (
    <View style={[styles.row, border && { borderBottomWidth: 1.5, borderBottomColor: p.cardBorder }]}>
      <Text style={[styles.label, { color: p.ink }]}>{label}</Text>
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
        Choose how Penny nudges you before a renewal.
      </Text>
      {loading ? (
        <Text style={[styles.lead, { color: p.muted }]}>Loading preferences…</Text>
      ) : (
        <Card style={{ paddingVertical: 0 }}>
          {row("Push reminders", preferences.push_enabled, (v) => void update("push_enabled", v), true)}
          {row("Email reminders", preferences.email_enabled, (v) => void update("email_enabled", v), true)}
          <View style={styles.schedule}>
            <Text style={[styles.label, { color: p.ink }]}>Reminder schedule</Text>
            <Text style={[styles.scheduleNote, { color: p.body }]}>
              {preferences.reminder_days_before.join(", ")} days before
            </Text>
          </View>
        </Card>
      )}
    </GardenScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: spacing.md },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  schedule: { paddingVertical: spacing.md, gap: 4 },
  label: { fontFamily: fonts.pixelBold, fontSize: 14 },
  scheduleNote: { fontFamily: fonts.medium, fontSize: 13 },
});
