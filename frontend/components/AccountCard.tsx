import { useUser } from "@clerk/expo";
import { CheckCircle2, CloudOff, Loader } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, type } from "../constants/theme";
import { apiBaseUrl, MeResponse, useApiClient } from "../lib/api";
import { Card } from "./ui/Card";

type Status =
  | { kind: "demo" }
  | { kind: "loading" }
  | { kind: "connected"; userId: string }
  | { kind: "error"; code: string };

/**
 * Proves the full auth chain end to end: shows the signed-in Clerk identity
 * (real name + email) and the result of calling the protected backend
 * /v1/me with the live Clerk token.
 */
export function AccountCard() {
  const { isSignedIn, user } = useUser();
  const api = useApiClient();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSignedIn) {
        if (active) setStatus({ kind: "demo" });
        return;
      }
      setStatus({ kind: "loading" });
      try {
        const me = await api.request<MeResponse>("/v1/me");
        if (active) setStatus({ kind: "connected", userId: me.clerk_user_id });
      } catch (e) {
        if (active) setStatus({ kind: "error", code: (e as Error).message });
      }
    })();
    return () => {
      active = false;
    };
  }, [isSignedIn, api]);

  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <Card style={{ gap: spacing.sm, marginTop: spacing.md }}>
      <Text style={type.caption}>ACCOUNT</Text>

      {isSignedIn ? (
        <>
          <Text style={styles.name}>{user?.fullName || user?.firstName || "Signed in"}</Text>
          {email && <Text style={type.bodySmall}>{email}</Text>}
        </>
      ) : (
        <Text style={styles.name}>Demo mode</Text>
      )}

      <View style={styles.statusRow}>
        {status.kind === "loading" && (
          <>
            <Loader size={16} color={colors.textMuted} />
            <Text style={styles.statusText}>Checking backend…</Text>
          </>
        )}
        {status.kind === "connected" && (
          <>
            <CheckCircle2 size={16} color={colors.success} />
            <Text style={[styles.statusText, { color: colors.success }]}>
              Backend verified you — id {status.userId.slice(0, 14)}…
            </Text>
          </>
        )}
        {status.kind === "demo" && (
          <>
            <CloudOff size={16} color={colors.textMuted} />
            <Text style={styles.statusText}>Not signed in (demo data)</Text>
          </>
        )}
        {status.kind === "error" && (
          <>
            <CloudOff size={16} color={colors.warning} />
            <Text style={[styles.statusText, { color: colors.warning }]}>
              Backend unreachable ({status.code})
            </Text>
          </>
        )}
      </View>
      <Text style={styles.apiUrl}>API: {apiBaseUrl}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.backgroundRaised,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textSecondary, flex: 1 },
  apiUrl: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
});
