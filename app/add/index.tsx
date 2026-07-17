import { useRouter } from "expo-router";
import { ClipboardPaste, Image as ImageIcon, Mail, PencilLine, X } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { Creature } from "../../components/creatures/Creature";
import { IconButton } from "../../components/ui/IconButton";
import { Screen } from "../../components/ui/Screen";

type Method = {
  title: string;
  description: string;
  icon: typeof ClipboardPaste;
  route?: "/add/paste" | "/add/manual";
  comingSoon?: boolean;
};

const methods: Method[] = [
  {
    title: "Paste receipt or email",
    description: "Paste renewal or billing text and we'll fill in the details.",
    icon: ClipboardPaste,
    route: "/add/paste",
  },
  {
    title: "Add manually",
    description: "Enter the price and renewal date yourself.",
    icon: PencilLine,
    route: "/add/manual",
  },
  {
    title: "Upload screenshot",
    description: "Snap your billing page and let us read it.",
    icon: ImageIcon,
    comingSoon: true,
  },
  {
    title: "Connect email",
    description: "Find subscriptions automatically from receipts.",
    icon: Mail,
    comingSoon: true,
  },
];

export default function AddScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={type.title}>Bring an expense to life</Text>
        <IconButton
          accessibilityLabel="Close"
          icon={<X size={20} color={colors.text} />}
          onPress={() => router.back()}
        />
      </View>
      <View style={styles.companion}>
        <Creature species="egg" mood="happy" size="medium" />
        <Text style={[type.body, { textAlign: "center", marginTop: spacing.sm }]}>
          Every expense you add becomes a creature in your garden.
        </Text>
      </View>

      {methods.map(({ title, description, icon: Icon, route, comingSoon }) => (
        <Pressable
          key={title}
          accessibilityRole="button"
          accessibilityLabel={comingSoon ? `${title}, coming soon` : title}
          disabled={comingSoon}
          onPress={() => route && router.push(route)}
          style={({ pressed }) => [
            styles.method,
            pressed && { transform: [{ scale: 0.98 }] },
            comingSoon && { opacity: 0.55 },
          ]}
        >
          <View style={styles.methodIcon}>
            <Icon size={22} color={comingSoon ? colors.textMuted : colors.primaryLight} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.methodTitleRow}>
              <Text style={styles.methodTitle}>{title}</Text>
              {comingSoon && (
                <View style={styles.soonBadge}>
                  <Text style={styles.soonText}>Coming soon</Text>
                </View>
              )}
            </View>
            <Text style={type.bodySmall}>{description}</Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  companion: { alignItems: "center", marginVertical: spacing.md },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    minHeight: 84,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  methodTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  methodTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  soonBadge: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  soonText: { fontFamily: fonts.semiBold, fontSize: 10, color: colors.warning },
});
