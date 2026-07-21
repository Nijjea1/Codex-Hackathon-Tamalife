import { useUser } from "@clerk/expo";
import { CheckCircle2, CloudOff, Loader } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, spacing } from "../constants/theme";
import { useGardenPalette } from "../constants/garden";
import { useApiClient } from "../lib/api";
import { Card } from "./ui/Card";
import { GardenKicker } from "./ui/GardenKit";

type Status = "demo" | "loading" | "connected" | "error";

export function AccountCard() {
  const p = useGardenPalette();
  const { isSignedIn, user } = useUser();
  const api = useApiClient();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let active = true;
    if (!isSignedIn) {
      setStatus("demo");
      return () => {
        active = false;
      };
    }
    setStatus("loading");
    api.me().then(
      () => active && setStatus("connected"),
      () => active && setStatus("error"),
    );
    return () => {
      active = false;
    };
  }, [api, isSignedIn]);

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
      {status !== "error" && (
        <View style={[styles.statusRow, { backgroundColor: p.warningBg }]}>
          {status === "loading" && <Loader size={16} color={p.muted} />}
          {status === "connected" && <CheckCircle2 size={16} color={p.success} />}
          {status === "demo" && <CloudOff size={16} color={p.muted} />}
          <Text style={[styles.statusText, { color: status === "connected" ? p.success : p.body }]}>
            {status === "loading" && "Connecting your account…"}
            {status === "connected" && "Account connected"}
            {status === "demo" && "Exploring with demo data"}
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.pixelBold, fontSize: 16 },
  body: { fontFamily: fonts.medium, fontSize: 13 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  statusText: { fontFamily: fonts.medium, fontSize: 12, flex: 1 },
});
