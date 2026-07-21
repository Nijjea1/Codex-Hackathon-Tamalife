import { useUser } from "@clerk/expo";
import { CheckCircle2, CloudOff, Loader } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, spacing } from "../constants/theme";
import { useGardenPalette } from "../constants/garden";
import { apiBaseUrl, MeResponse, useApiClient } from "../lib/api";
import { Card } from "./ui/Card";
import { GardenKicker } from "./ui/GardenKit";
import { useForegroundRefresh } from "../lib/useForegroundRefresh";

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
  const p = useGardenPalette();
  const { isSignedIn, user } = useUser();
  const api = useApiClient();
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const mounted = useRef(false);

  const loadAccount = useCallback(async () => {
    if (!isSignedIn) {
      if (mounted.current) setStatus({ kind: "demo" });
      return;
    }
    if (mounted.current) setStatus({ kind: "loading" });
    try {
      const me = await api.request<MeResponse>("/v1/me");
      if (mounted.current) setStatus({ kind: "connected", userId: me.clerk_user_id });
    } catch (e) {
      if (mounted.current) setStatus({ kind: "error", code: (e as Error).message });
    }
  }, [isSignedIn, api]);

  useEffect(() => {
    mounted.current = true;
    void loadAccount();
    return () => {
      mounted.current = false;
    };
  }, [loadAccount]);

  useForegroundRefresh(loadAccount, Boolean(isSignedIn));

  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <Card style={{ gap: spacing.sm, marginTop: spacing.md }}>
      <GardenKicker>ACCOUNT</GardenKicker>

      {isSignedIn ? (
        <>
          <Text style={[styles.name, { color: p.ink }]}>{user?.fullName || user?.firstName || "Signed in"}</Text>
          {email && <Text style={[styles.body, { color: p.body }]}>{email}</Text>}
        </>
      ) : (
        <Text style={[styles.name, { color: p.ink }]}>Demo mode</Text>
      )}

      <View style={[styles.statusRow, { backgroundColor: p.warningBg }]}>
        {status.kind === "loading" && (
          <>
            <Loader size={16} color={p.muted} />
            <Text style={[styles.statusText, { color: p.body }]}>Checking backend…</Text>
          </>
        )}
        {status.kind === "connected" && (
          <>
            <CheckCircle2 size={16} color={p.success} />
            <Text style={[styles.statusText, { color: p.success }]}>
              Backend verified you — id {status.userId.slice(0, 14)}…
            </Text>
          </>
        )}
        {status.kind === "demo" && (
          <>
            <CloudOff size={16} color={p.muted} />
            <Text style={[styles.statusText, { color: p.body }]}>Not signed in (demo data)</Text>
          </>
        )}
        {status.kind === "error" && (
          <>
            <CloudOff size={16} color={p.warning} />
            <Text style={[styles.statusText, { color: p.warning }]}>
              Backend unreachable ({status.code})
            </Text>
          </>
        )}
      </View>
      <Text style={[styles.apiUrl, { color: p.muted }]}>API: {apiBaseUrl}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.pixelBold, fontSize: 16 },
  body: { fontFamily: fonts.medium, fontSize: 13 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusText: { fontFamily: fonts.medium, fontSize: 12, flex: 1 },
  apiUrl: { fontFamily: fonts.regular, fontSize: 11 },
});
