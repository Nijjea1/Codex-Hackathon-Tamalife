import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../../constants/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function BottomSheet({ visible, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityLabel="Close sheet"
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
            onPress={onClose}
          />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          exiting={SlideOutDown}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <View style={styles.grabber} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.backgroundRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
});
