import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  BadgeCheck,
  BellOff,
  CircleDollarSign,
  ScissorsLineDashed,
  ShieldQuestion,
} from "lucide-react-native";
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { ResolutionAction, Subscription } from "../../types/subscription";
import { formatMoney } from "../../utils/creatureMood";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";

type Props = {
  visible: boolean;
  subscription: Subscription;
  onClose: () => void;
  onResolve: (action: ResolutionAction) => void;
};

const options: {
  action: ResolutionAction;
  label: string;
  description: string;
  icon: typeof BadgeCheck;
}[] = [
  {
    action: "renew",
    label: "Keep and renew",
    description: "You still use it. The creature will be happy again.",
    icon: BadgeCheck,
  },
  {
    action: "cancel",
    label: "Cancel subscription",
    description: "Stop paying for this. We'll show what you save.",
    icon: ScissorsLineDashed,
  },
  {
    action: "acceptPrice",
    label: "Accept new price",
    description: "Acknowledge the price change and keep going.",
    icon: CircleDollarSign,
  },
  {
    action: "dispute",
    label: "Dispute charge",
    description: "Flag this charge to look into it later.",
    icon: ShieldQuestion,
  },
  {
    action: "snooze",
    label: "Remind me later",
    description: "We'll ask again in 3 days.",
    icon: BellOff,
  },
];

export function ResolutionSheet({ visible, subscription, onClose, onResolve }: Props) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const close = () => {
    setConfirmingCancel(false);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      {confirmingCancel ? (
        <View>
          <Text style={[type.title, { textAlign: "center" }]}>Cancel {subscription.merchant}?</Text>
          <View style={styles.savings}>
            <Text style={styles.savingsAmount}>
              You'll save {formatMoney(subscription.annualCost)} per year.
            </Text>
            <Text style={[type.bodySmall, { textAlign: "center" }]}>
              {subscription.creatureName} will finally get to rest.
            </Text>
          </View>
          <Button
            label="Confirm cancellation"
            onPress={() => {
              setConfirmingCancel(false);
              onResolve("cancel");
            }}
          />
          <Button label="Go back" variant="ghost" onPress={() => setConfirmingCancel(false)} style={{ marginTop: spacing.sm }} />
        </View>
      ) : (
        <View>
          <Text style={[type.title, { textAlign: "center", marginBottom: spacing.xs }]}>
            What did you decide?
          </Text>
          <Text style={[type.bodySmall, { textAlign: "center", marginBottom: spacing.md }]}>
            {subscription.merchant} · {formatMoney(subscription.price)}/month
          </Text>
          {options.map(({ action, label, description, icon: Icon }) => (
            <Pressable
              key={action}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceRaised }]}
              onPress={() => {
                if (action === "cancel") {
                  setConfirmingCancel(true);
                } else {
                  onResolve(action);
                }
              }}
            >
              <View style={styles.iconWrap}>
                <Icon size={20} color={action === "cancel" ? colors.danger : colors.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{label}</Text>
                <Text style={type.bodySmall}>{description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginBottom: 1 },
  savings: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
    gap: 6,
  },
  savingsAmount: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.success,
    textAlign: "center",
  },
});
