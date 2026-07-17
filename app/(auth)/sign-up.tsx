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
import { CreatureSpecies } from "../../types/subscription";

const starterSpecies: Record<string, CreatureSpecies> = {
  sprout: "sprout",
  glint: "gem",
  puff: "cloud",
};

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selectedStarter = useAuthStore((s) => s.selectedStarter);
  const signIn = useAuthStore((s) => s.signIn);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const species = starterSpecies[selectedStarter ?? "sprout"] ?? "sprout";

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
          <Text style={[type.title, { textAlign: "center" }]}>Save your garden</Text>
          <Text style={[type.body, { textAlign: "center", marginTop: 6, marginBottom: spacing.lg }]}>
            Create an account so your creatures and expenses stay with you.
          </Text>

          {!showEmailForm ? (
            <View style={{ gap: spacing.sm + 2 }}>
              <Button
                label="Continue with Apple"
                onPress={() => enter("apple")}
                loading={loading === "apple"}
                variant="secondary"
              />
              <Button
                label="Continue with Google"
                onPress={() => enter("google")}
                loading={loading === "google"}
                variant="secondary"
              />
              <Button
                label="Continue with email"
                onPress={() => setShowEmailForm(true)}
                variant="secondary"
                icon={<Mail size={18} color={colors.primaryLight} />}
              />
            </View>
          ) : (
            <View style={{ gap: spacing.sm + 2 }}>
              <TextInput
                style={styles.input}
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
              <Button
                label="Continue"
                onPress={() => enter("email")}
                loading={loading === "email"}
                disabled={!email.includes("@") || password.length < 4}
              />
              <Text style={styles.terms}>
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
  eye: { position: "absolute", right: 16, top: 16 },
  terms: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  demoLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.secondary },
});
