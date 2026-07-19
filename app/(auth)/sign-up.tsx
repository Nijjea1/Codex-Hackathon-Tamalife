import { useSignIn, useSignUp } from "@clerk/clerk-expo";
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
import { colors, fonts, radius, spacing, type } from "../../constants/theme";
import { Creature } from "../../components/creatures/Creature";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/useAuthStore";
import { useUIStore } from "../../store/useUIStore";
import { CreatureSpecies } from "../../types/subscription";

const starterSpecies: Record<string, CreatureSpecies> = {
  sprout: "sprout",
  glint: "gem",
  puff: "cloud",
};

type Step = "choose" | "form" | "verify";
type Mode = "signUp" | "signIn";

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selectedStarter = useAuthStore((s) => s.selectedStarter);
  const signInStore = useAuthStore((s) => s.signIn);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const showToast = useUIStore((s) => s.showToast);

  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();

  const [step, setStep] = useState<Step>("choose");
  const [mode, setMode] = useState<Mode>("signUp");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const species = starterSpecies[selectedStarter ?? "sprout"] ?? "sprout";

  const finish = () => {
    completeOnboarding();
    signInStore();
    router.replace("/(auth)/reveal");
  };

  const readableError = (e: unknown): string => {
    const msg = (e as { errors?: { message?: string }[] })?.errors?.[0]?.message;
    return msg ?? "Something went wrong. Please try again.";
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

  const exploreDemo = () => {
    setLoading("demo");
    setTimeout(() => {
      signInStore();
      completeOnboarding();
      router.replace("/(auth)/reveal");
    }, 600);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.peek}>
          <Creature species={species} mood="happy" size="medium" />
        </View>

        <View style={styles.formCard}>
          <Text style={[type.title, { textAlign: "center" }]}>
            {step === "verify"
              ? "Check your email"
              : mode === "signUp"
              ? "Save your garden"
              : "Welcome back"}
          </Text>
          <Text style={[type.body, { textAlign: "center", marginTop: 6, marginBottom: spacing.lg }]}>
            {step === "verify"
              ? `We sent a 6-digit code to ${email}.`
              : mode === "signUp"
              ? "Create an account so your creatures and expenses stay with you."
              : "Sign in to get back to your garden."}
          </Text>

          {step === "choose" && (
            <View style={{ gap: spacing.sm + 2 }}>
              <Button
                label="Continue with Apple"
                onPress={() =>
                  showToast({ message: "Apple sign-in is coming soon — use email", tone: "info" })
                }
                variant="secondary"
              />
              <Button
                label="Continue with Google"
                onPress={() =>
                  showToast({ message: "Google sign-in is coming soon — use email", tone: "info" })
                }
                variant="secondary"
              />
              <Button
                label="Continue with email"
                onPress={() => {
                  setMode("signUp");
                  setStep("form");
                }}
                variant="secondary"
                icon={<Mail size={18} color={colors.primaryLight} />}
              />
            </View>
          )}

          {step === "form" && (
            <View style={{ gap: spacing.sm + 2 }}>
              {mode === "signUp" && (
                <TextInput
                  style={styles.input}
                  placeholder="First name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  value={firstName}
                  onChangeText={setFirstName}
                  accessibilityLabel="First name"
                />
              )}
              <TextInput
                style={styles.input}
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
                  style={styles.input}
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

              <Button
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
                <Text style={styles.toggle}>
                  {mode === "signUp"
                    ? "Already have an account? Sign in"
                    : "New here? Create an account"}
                </Text>
              </Pressable>

              {mode === "signUp" && (
                <Text style={styles.terms}>
                  Passwords need at least 8 characters. By continuing you agree to the Terms and
                  Privacy Policy.
                </Text>
              )}
            </View>
          )}

          {step === "verify" && (
            <View style={{ gap: spacing.sm + 2 }}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="123456"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                maxLength={6}
                accessibilityLabel="Verification code"
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
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
                <Text style={styles.toggle}>Use a different email</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={exploreDemo}
          style={{ marginTop: spacing.lg, alignSelf: "center" }}
          hitSlop={8}
        >
          <Text style={styles.demoLink}>
            {loading === "demo" ? "Opening the garden..." : "Explore demo first"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  peek: { alignItems: "center", marginBottom: -34, zIndex: 2 },
  formCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    paddingTop: spacing.xl + 8,
  },
  input: {
    backgroundColor: colors.backgroundRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
  },
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
  toggle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primaryLight },
  terms: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  demoLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.secondary },
});
