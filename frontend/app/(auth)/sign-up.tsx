import { useSSO } from "@clerk/expo";
import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
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
import { demoModeAvailable } from "../../lib/config";
import { useAuthStore } from "../../store/useAuthStore";
import { useDemoModeStore } from "../../store/useDemoModeStore";
import { useUIStore } from "../../store/useUIStore";

WebBrowser.maybeCompleteAuthSession();

type Step = "choose" | "form" | "verify";
type Mode = "signUp" | "signIn";

export default function SignUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const selectedStarter = useAuthStore((s) => s.selectedStarter);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const enterDemo = useDemoModeStore((s) => s.enter);
  const isDay = useUIStore((s) => s.onboardingTheme === "day");

  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { startSSOFlow } = useSSO();

  const initialMode: Mode = params.mode === "signIn" ? "signIn" : "signUp";
  const [step, setStep] = useState<Step>(initialMode === "signIn" ? "form" : "choose");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mascotId = selectedStarter ?? "penny";

  const finish = () => {
    completeOnboarding();
    router.replace("/(auth)/reveal");
  };

  const readableError = (e: unknown): string => {
    const msg = (e as { errors?: { message?: string }[] })?.errors?.[0]?.message;
    return msg ?? "Something went wrong. Please try again.";
  };

  const submitSocial = async (strategy: "oauth_google" | "oauth_apple") => {
    setError(null);
    setLoading(strategy);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: Linking.createURL("/(auth)/reveal", { scheme: "tamalife" }),
      });
      if (!createdSessionId || !setActive) {
        setError("Additional verification is required to finish signing in.");
        return;
      }
      await setActive({ session: createdSessionId });
      finish();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(null);
    }
  };

  const submitForm = async () => {
    setError(null);
    if (mode === "signUp") {
      if (!signUpLoaded) return;
      setLoading("form");
      try {
        await signUp.create({ emailAddress: email, password, firstName });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("verify");
      } catch (e) {
        setError(readableError(e));
      } finally {
        setLoading(null);
      }
    } else {
      if (!signInLoaded) return;
      setLoading("form");
      try {
        const attempt = await signIn.create({ identifier: email, password });
        if (attempt.status === "complete") {
          await setActiveSignIn({ session: attempt.createdSessionId });
          finish();
        } else {
          setError("Additional verification required. Try signing up instead.");
        }
      } catch (e) {
        setError(readableError(e));
      } finally {
        setLoading(null);
      }
    }
  };

  const submitCode = async () => {
    if (!signUpLoaded) return;
    setError(null);
    setLoading("verify");
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === "complete") {
        await setActiveSignUp({ session: attempt.createdSessionId });
        finish();
      } else {
        setError("That code didn't work. Check your email and try again.");
      }
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(null);
    }
  };

  const enterDemoGarden = () => {
    setLoading("demo");
    enterDemo();
    router.replace("/(tabs)/home");
  };

  const kicker = step === "verify" ? "VERIFY" : mode === "signUp" ? "SAVE POINT" : "WELCOME BACK";
  const heading =
    step === "verify" ? "Check your email" : mode === "signUp" ? "Save your garden" : "Welcome back";
  const supporting =
    step === "verify"
      ? `We sent a 6-digit code to ${email}.`
      : mode === "signUp"
      ? "Create an account so your creatures and expenses stay with you."
      : "Sign in to get back to your garden.";

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
          <Text style={[styles.kicker, !isDay && styles.kickerNight]}>{kicker}</Text>
          <Text style={[styles.heading, !isDay && styles.headingNight]}>{heading}</Text>
          <Text style={[styles.supporting, !isDay && styles.supportingNight]}>{supporting}</Text>

          {step === "choose" && (
            <View style={{ gap: spacing.sm + 2 }}>
              <GardenButton
                label="Continue with Apple"
                onPress={() => submitSocial("oauth_apple")}
                loading={loading === "oauth_apple"}
                variant="secondary"
              />
              <GardenButton
                label="Continue with Google"
                onPress={() => submitSocial("oauth_google")}
                loading={loading === "oauth_google"}
                variant="secondary"
              />
              <GardenButton
                label="Continue with email"
                onPress={() => {
                  setMode("signUp");
                  setStep("form");
                }}
                variant="secondary"
                icon={<Mail size={18} color="#31543c" />}
              />
            </View>
          )}

          {step === "form" && (
            <View style={{ gap: spacing.sm + 2 }}>
              {mode === "signUp" && (
                <TextInput
                  style={[styles.input, !isDay && styles.inputNight]}
                  placeholder="First name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  value={firstName}
                  onChangeText={setFirstName}
                  accessibilityLabel="First name"
                />
              )}
              <TextInput
                style={[styles.input, !isDay && styles.inputNight]}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
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

              {error && <Text style={styles.error}>{error}</Text>}

              <GardenButton
                label={mode === "signUp" ? "Create account" : "Sign in"}
                onPress={submitForm}
                loading={loading === "form"}
                disabled={
                  !email.includes("@") ||
                  password.length < 8 ||
                  (mode === "signUp" && firstName.trim().length === 0)
                }
              />

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setError(null);
                  setMode((m) => (m === "signUp" ? "signIn" : "signUp"));
                }}
                hitSlop={6}
                style={{ alignSelf: "center", marginTop: 2 }}
              >
                <Text style={[styles.toggle, !isDay && styles.toggleNight]}>
                  {mode === "signUp"
                    ? "Already have an account? Sign in"
                    : "New here? Create an account"}
                </Text>
              </Pressable>

              {mode === "signUp" && (
                <Text style={[styles.terms, !isDay && styles.termsNight]}>
                  Passwords need at least 8 characters. By continuing you agree to the Terms and
                  acknowledge the Privacy Policy.
                </Text>
              )}
            </View>
          )}

          {step === "verify" && (
            <View style={{ gap: spacing.sm + 2 }}>
              <TextInput
                style={[styles.input, styles.codeInput, !isDay && styles.inputNight]}
                placeholder="123456"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                maxLength={6}
                accessibilityLabel="Verification code"
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <GardenButton
                label="Verify & enter"
                onPress={submitCode}
                loading={loading === "verify"}
                disabled={code.length < 6}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setStep("form");
                  setCode("");
                  setError(null);
                }}
                hitSlop={6}
                style={{ alignSelf: "center" }}
              >
                <Text style={[styles.toggle, !isDay && styles.toggleNight]}>Use a different email</Text>
              </Pressable>
            </View>
          )}
        </View>

        {demoModeAvailable && (
          <Pressable
            accessibilityRole="button"
            onPress={enterDemoGarden}
            style={{ marginTop: spacing.lg, alignSelf: "center" }}
            hitSlop={8}
          >
            <Text style={[styles.demoLink, !isDay && styles.demoLinkNight]}>
              {loading === "demo" ? "Opening the garden..." : "Explore demo first"}
            </Text>
          </Pressable>
        )}
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
  codeInput: {
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 8,
    fontFamily: fonts.bold,
  },
  eye: { position: "absolute", right: 16, top: 16 },
  error: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.danger,
    textAlign: "center",
  },
  toggle: { fontFamily: "monospace", fontWeight: "900", fontSize: 12, color: "#31543c", textAlign: "center" },
  toggleNight: { color: "#eee8ff" },
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
