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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type BooleanKey = "push_enabled" | "email_enabled" | NotificationCategoryKey;

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
    api
      .notificationPreferences()
      .then(setPreferences)
      .catch((e) => showToast({ message: (e as Error).message, tone: "warning" }))
      .finally(() => setLoading(false));
  }, [api, demo, showToast]);

  const update = async (field: BooleanKey, value: boolean) => {
    const previous = preferences;
    setPreferences({ ...preferences, [field]: value });
    if (demo) return;
    try {
      setPreferences(await api.updateNotificationPreferences({ [field]: value }));
    } catch (e) {
      setPreferences(previous);
      showToast({ message: (e as Error).message, tone: "warning" });
    }
  };

  const toggle = (
    label: string,
    description: string | null,
    value: boolean,
    onChange: (v: boolean) => void,
    border: boolean,
    disabled = false,
    keyId?: string,
  ) => (
    <View
      key={keyId}
      style={[
        styles.row,
        border && { borderBottomWidth: 1.5, borderBottomColor: p.cardBorder },
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: p.ink }]}>{label}</Text>
        {description ? <Text style={[styles.desc, { color: p.body }]}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: p.gold, false: p.pillBorder }}
        thumbColor={p.cardBgSolid}
      />
    </View>
  );

  const digestLine = `${WEEKDAYS[preferences.weekly_digest_weekday] ?? "Mon"}, ${String(
    preferences.weekly_digest_hour,
  ).padStart(2, "0")}:00`;

  return (
    <GardenScreen title="Notifications" onBack={() => router.back()}>
      <GardenKicker>STAY IN THE LOOP</GardenKicker>
      <Text style={[styles.lead, { color: p.body }]}>
        Choose how and when Penny nudges you.
      </Text>
      {loading ? (
        <Text style={[styles.lead, { color: p.muted }]}>Loading preferences…</Text>
      ) : (
        <>
          <GardenKicker>CHANNELS</GardenKicker>
          <Card style={{ paddingVertical: 0, marginBottom: spacing.lg }}>
            {toggle("Push notifications", null, preferences.push_enabled, (v) => void update("push_enabled", v), true)}
            {toggle("Email", null, preferences.email_enabled, (v) => void update("email_enabled", v), false)}
          </Card>

          <GardenKicker>NOTIFICATION TYPES</GardenKicker>
          <Card style={{ paddingVertical: 0 }}>
            {CATEGORIES.map((c, i) =>
              toggle(
                c.label,
                c.description,
                preferences[c.key],
                (v) => void update(c.key, v),
                i < CATEGORIES.length - 1,
                !preferences.push_enabled && !preferences.email_enabled,
                c.key,
              ),
            )}
          </Card>

          <View style={styles.schedule}>
            <Text style={[styles.scheduleNote, { color: p.body }]}>
              Reminders: {preferences.reminder_days_before.join(", ")} days before
            </Text>
            <Text style={[styles.scheduleNote, { color: p.body }]}>Weekly digest: {digestLine}</Text>
          </View>
        </>
      )}
    </GardenScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: spacing.md },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  rowText: { flex: 1, paddingVertical: spacing.sm, gap: 2 },
  label: { fontFamily: fonts.pixelBold, fontSize: 14 },
  desc: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  schedule: { paddingVertical: spacing.md, gap: 4 },
  scheduleNote: { fontFamily: fonts.medium, fontSize: 13 },
});
