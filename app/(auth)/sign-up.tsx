import { useRouter } from "expo-router";
import { Eye, EyeOff, Mail } from "lucide-react-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, spacing } from "../../constants/theme";
import { GardenBackdrop } from "../../components/onboarding/GardenBackdrop";
import { GardenButton } from "../../components/onboarding/GardenButton";
import { MascotPortrait } from "../../components/onboarding/MascotPortrait";
import { useAuthStore } from "../../store/useAuthStore";
import { useUIStore } from "../../store/useUIStore";

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selectedStarter = useAuthStore((s) => s.selectedStarter);
  const signIn = useAuthStore((s) => s.signIn);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const isDay = useUIStore((s) => s.onboardingTheme === "day");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const mascotId = selectedStarter ?? "penny";

  const enter = (method: string) => {
    setLoading(method);
    setTimeout(() => {
      signIn();
      completeOnboarding();
      router.replace("/(auth)/reveal");
    }, 800);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, !isDay && styles.rootNight]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <GardenBackdrop strongerShade hideSky />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.peek}>
          <View style={styles.peekFrame}>
            <MascotPortrait id={mascotId} size={118} />
          </View>
        </View>

        <View style={[styles.formCard, !isDay && styles.formCardNight]}>
          <Text style={[styles.kicker, !isDay && styles.kickerNight]}>SAVE POINT</Text>
          <Text style={[styles.heading, !isDay && styles.headingNight]}>Save your garden</Text>
          <Text style={[styles.supporting, !isDay && styles.supportingNight]}>
            Create an account so your creatures and expenses stay with you.
          </Text>

          {!showEmailForm ? (
            <View style={{ gap: spacing.sm + 2 }}>
              <GardenButton
                label="Continue with Apple"
                onPress={() => enter("apple")}
                loading={loading === "apple"}
                variant="secondary"
              />
              <GardenButton
                label="Continue with Google"
                onPress={() => enter("google")}
                loading={loading === "google"}
                variant="secondary"
              />
              <GardenButton
                label="Continue with email"
                onPress={() => setShowEmailForm(true)}
                variant="secondary"
                icon={<Mail size={18} color="#31543c" />}
              />
            </View>
          ) : (
            <View style={{ gap: spacing.sm + 2 }}>
              <TextInput
                style={[styles.input, !isDay && styles.inputNight]}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                accessibilityLabel="Email"
              />
              <View>
                <TextInput
                  style={[styles.input, !isDay && styles.inputNight]}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel="Password"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eye}
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textMuted} />
                  ) : (
                    <Eye size={18} color={colors.textMuted} />
                  )}
                </Pressable>
              </View>
              <GardenButton
                label="Continue"
                onPress={() => enter("email")}
                loading={loading === "email"}
                disabled={!email.includes("@") || password.length < 4}
              />
              <Text style={[styles.terms, !isDay && styles.termsNight]}>
                By continuing you agree to the Terms and acknowledge the Privacy Policy.
              </Text>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => enter("demo")}
          style={{ marginTop: spacing.lg, alignSelf: "center" }}
          hitSlop={8}
        >
          <Text style={[styles.demoLink, !isDay && styles.demoLinkNight]}>
            {loading === "demo" ? "Opening the garden..." : "Explore demo first"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#e4efb7" },
  rootNight: { backgroundColor: "#151132" },
  peek: { alignItems: "center", marginBottom: -34, zIndex: 2 },
  peekFrame: { borderRadius: 59, overflow: "hidden", borderWidth: 4, borderColor: "#fff1aa" },
  formCard: {
    backgroundColor: "rgba(255,247,210,0.96)",
    borderWidth: 3,
    borderColor: "#4f7b55",
    borderRadius: 10,
    padding: spacing.lg,
    paddingTop: spacing.xl + 8,
    shadowColor: "#587245",
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 0.58,
    shadowRadius: 0,
  },
  formCardNight: { backgroundColor: "rgba(43,31,76,0.96)", borderColor: "#9b8ad6", shadowColor: "#120d27" },
  kicker: { color: "#b06a43", fontFamily: "monospace", fontWeight: "900", fontSize: 10, letterSpacing: 1, textAlign: "center" },
  kickerNight: { color: "#ffd66e" },
  heading: { color: "#234f3a", fontFamily: "monospace", fontWeight: "900", fontSize: 24, textAlign: "center", marginTop: 6 },
  headingNight: { color: "#fff5d6" },
  supporting: { color: "#526348", fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 6, marginBottom: spacing.lg },
  supportingNight: { color: "#d6cdea" },
  input: {
    backgroundColor: "#fffbed",
    borderWidth: 2,
    borderColor: "#789263",
    borderRadius: 7,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: "#294d38",
  },
  inputNight: { backgroundColor: "#241b43", borderColor: "#806fb2", color: "#fff5e6" },
  eye: { position: "absolute", right: 16, top: 16 },
  terms: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#66725b",
    textAlign: "center",
    marginTop: 4,
  },
  termsNight: { color: "#b9aecf" },
  demoLink: { fontFamily: "monospace", fontWeight: "900", fontSize: 12, color: "#31543c", backgroundColor: "rgba(255,244,200,0.88)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 5 },
  demoLinkNight: { color: "#eee8ff", backgroundColor: "rgba(50,38,83,0.9)" },
});
