import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";

// Subscription detail and creature detail are the same screen in this
// prototype — keep both routes so deep links work either way.
export default function SubscriptionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/creature/${id}`} />;
}
