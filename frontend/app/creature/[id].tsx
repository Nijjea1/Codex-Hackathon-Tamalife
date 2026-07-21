import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";

export default function LegacyCreatureDetailRoute() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/subscription/${id}`} />;
}
