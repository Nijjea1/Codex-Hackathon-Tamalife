import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  BadgeCheck,
  BellOff,
  CircleDollarSign,
  ScissorsLineDashed,
  ShieldQuestion,
} from "lucide-react-native";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
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
  const p = useGardenPalette();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const close = () => {
    setConfirmingCancel(false);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      {confirmingCancel ? (
        <View>
          <Text style={[styles.title, { color: p.ink, textAlign: "center" }]}>Cancel {subscription.merchant}?</Text>
          <View style={[styles.savings, { backgroundColor: p.successBg }]}>
            <Text style={[styles.savingsAmount, { color: p.success }]}>
              You'll save {formatMoney(subscription.annualCost)} per year.
            </Text>
            <Text style={[styles.body, { color: p.body, textAlign: "center" }]}>
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
          <Text style={[styles.title, { color: p.ink, textAlign: "center", marginBottom: spacing.xs }]}>
            What did you decide?
          </Text>
          <Text style={[styles.body, { color: p.body, textAlign: "center", marginBottom: spacing.md }]}>
            {subscription.merchant} · {formatMoney(subscription.price)}/month
          </Text>
          {options.map(({ action, label, description, icon: Icon }) => (
            <Pressable
              key={action}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: p.warningBg }]}
              onPress={() => {
                if (action === "cancel") {
                  setConfirmingCancel(true);
                } else {
                  onResolve(action);
                }
              }}
            >
              <View style={[styles.iconWrap, { backgroundColor: p.cardBg, borderColor: p.cardBorder }]}>
                <Icon size={20} color={action === "cancel" ? p.danger : p.accent} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: p.ink }]}>{label}</Text>
                <Text style={[styles.body, { color: p.body }]}>{description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.pixelBold, fontSize: 20 },
  body: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    padding: spacing.sm + 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: { fontFamily: fonts.pixelBold, fontSize: 15, marginBottom: 1 },
  savings: {
    borderRadius: 12,
    padding: spacing.md,
    marginVertical: spacing.md,
    gap: 6,
  },
  savingsAmount: { fontFamily: fonts.pixelBold, fontSize: 18, textAlign: "center" },
});
