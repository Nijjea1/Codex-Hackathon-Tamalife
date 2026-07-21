import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, spacing } from "../../constants/theme";
import { useGardenPalette } from "../../constants/garden";
import { GardenBackdrop } from "../onboarding/GardenBackdrop";
import { AmbienceButton } from "../onboarding/GardenAmbience";
import { GardenModeButton } from "../onboarding/GardenModeButton";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  /** Screen title shown in the pixel header. Omit for a header-less screen. */
  title?: string;
  /** Small line under the title. */
  subtitle?: string;
  /** Provide to show a back chevron that runs this callback. */
  onBack?: () => void;
  /** Show the ambience + day/night controls in the header (default true). */
  showControls?: boolean;
  /** Extra node rendered on the right of the header, before the controls. */
  headerRight?: React.ReactNode;
  strongerShade?: boolean;
  hideSky?: boolean;
  contentStyle?: ViewStyle;
  style?: ViewStyle;
};

/**
 * The cozy garden shell used by every screen: animated day/night backdrop,
 * safe-area padding, an optional pixel header with a back button, and the
 * shared ambience + day/night controls. Restyles automatically when the
 * global day/night theme flips.
 */
export function GardenScreen({
  children,
  scroll = true,
  title,
  subtitle,
  onBack,
  showControls = true,
  headerRight,
  strongerShade = false,
  hideSky = false,
  contentStyle,
  style,
}: Props) {
  const p = useGardenPalette();
  const insets = useSafeAreaInsets();

  const header = (title || onBack || showControls || headerRight) && (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerLeft}>
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: p.pill, borderColor: p.pillBorder },
              pressed && styles.pressed,
            ]}
          >
            <ArrowLeft size={18} color={p.pillInk} strokeWidth={2.75} />
          </Pressable>
        )}
        {title && (
          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: p.ink }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: p.body }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        )}
      </View>
      <View style={styles.headerRight}>
        {headerRight}
        {showControls && (
          <>
            <AmbienceButton compact />
            <GardenModeButton compact />
          </>
        )}
      </View>
    </View>
  );

  const pad = {
    paddingTop: header ? spacing.md : insets.top + spacing.lg,
    paddingBottom: insets.bottom + spacing.xl,
    paddingHorizontal: spacing.md,
  };

  const scrim: readonly [string, string, string] = p.isDay
    ? ["rgba(247,245,220,0.94)", "rgba(247,245,220,0.55)", "rgba(247,245,220,0)"]
    : ["rgba(13,12,36,0.94)", "rgba(13,12,36,0.55)", "rgba(13,12,36,0)"];

  return (
    <View style={[styles.root, { backgroundColor: p.bgDeep }, style]}>
      <GardenBackdrop strongerShade={strongerShade} hideSky={hideSky} />
      <LinearGradient
        pointerEvents="none"
        colors={scrim}
        style={[styles.scrim, { height: insets.top + 108 }]}
      />
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, pad, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  flex: { flex: 1 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    zIndex: 5,
    gap: spacing.sm,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 7 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { transform: [{ translateY: 2 }] },
  titleWrap: { flex: 1 },
  title: { fontFamily: fonts.pixelBold, fontSize: 20, letterSpacing: 1 },
  subtitle: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
});
