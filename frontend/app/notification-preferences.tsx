import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { IconButton } from "../components/ui/IconButton";
import { Screen } from "../components/ui/Screen";
import { colors, fonts, radius, spacing, type } from "../constants/theme";
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

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Go back" icon={<ChevronLeft size={22} color={colors.text} />} onPress={() => router.back()} />
        <Text style={type.title}>Notifications</Text>
      </View>
      {loading ? <Text style={type.bodySmall}>Loading preferencesâ€¦</Text> : (
        <View style={styles.card}>
          <PreferenceRow label="Push reminders" value={preferences.push_enabled} onChange={(value) => void update("push_enabled", value)} />
          <PreferenceRow label="Email reminders" value={preferences.email_enabled} onChange={(value) => void update("email_enabled", value)} />
          <View style={styles.schedule}>
            <Text style={styles.label}>Reminder schedule</Text>
            <Text style={type.bodySmall}>{preferences.reminder_days_before.join(", ")} days before</Text>
          </View>
        </View>
      )}
    </Screen>
  );
}

function PreferenceRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Switch accessibilityLabel={label} value={value} onValueChange={onChange} /></View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: colors.border, borderBottomWidth: 1 },
  schedule: { paddingVertical: spacing.md, gap: 4 },
  label: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.text },
});
