import { ExternalLink, TrendingDown, TrendingUp } from "lucide-react-native";
import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useGardenPalette } from "../../constants/garden";
import { fonts, spacing } from "../../constants/theme";
import { mapAlternative, mapDeal, mapPricePoint, safeExternalUrl } from "../../lib/priceIntelligenceMappers";
import {
  AlternativeDto,
  DealDto,
  MerchantMatchDto,
  PricePointDto,
  RecommendationDto,
} from "../../types/priceIntelligence";
import { formatMoney } from "../../utils/creatureMood";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export function InlineResourceState({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error?: string | null;
  empty?: string;
  onRetry: () => void;
}) {
  const p = useGardenPalette();
  if (loading) return (
    <Card accessibilityLabel="Loading verified pricing" style={{ gap: spacing.sm }}>
      <View style={[styles.skeleton, { backgroundColor: p.warningBg, width: "46%" }]} />
      <View style={[styles.skeleton, { backgroundColor: p.warningBg, width: "88%" }]} />
      <View style={[styles.skeleton, { backgroundColor: p.warningBg, width: "68%" }]} />
    </Card>
  );
  if (error) return (
    <Card style={{ gap: spacing.sm }}>
      <Text style={[styles.body, { color: p.danger }]}>{error}</Text>
      <Button label="Try again" variant="secondary" onPress={onRetry} />
    </Card>
  );
  return empty ? <Card><Text style={[styles.body, { color: p.muted }]}>{empty}</Text></Card> : null;
}

export function MerchantMatchCard({
  match,
}: {
  match: MerchantMatchDto | null;
}) {
  const p = useGardenPalette();
  if (!match) return <Card><Text style={[styles.body, { color: p.muted }]}>No verified provider match yet.</Text></Card>;
  const isDemo = match.method === "demo_fixture" || match.method === "sample_fixture";
  const confidence = `${Math.round(match.confidence * 100)}% match`;
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: p.ink }]}>{match.provider_name}</Text>
          <Text style={[styles.body, { color: p.body }]}>{match.plan_name} · {confidence}</Text>
        </View>
        <Text style={[styles.badge, { color: match.status === "confirmed" ? p.success : p.warning }]}>
          {isDemo ? "SAMPLE DATA" : match.status.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.caption, { color: p.muted }]}>
        {isDemo ? "Sample local walkthrough data — not a live provider claim." : "Matched automatically from verified pricing data."}
      </Text>
    </Card>
  );
}

export function PriceHistoryCard({ items }: { items: PricePointDto[] }) {
  const p = useGardenPalette();
  return (
    <Card style={{ gap: spacing.sm }}>
      {items.slice(0, 8).map((raw, index) => {
        const item = mapPricePoint(raw);
        const Icon = item.change_type === "decrease" ? TrendingDown : TrendingUp;
        return (
          <View key={item.id} style={[styles.historyRow, index > 0 && { borderTopColor: p.cardBorder, borderTopWidth: 1 }]}>
            <Icon size={17} color={item.change_type === "decrease" ? p.success : item.change_type === "increase" ? p.danger : p.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: p.ink }]}>{formatMoney(item.price)}</Text>
              <Text style={[styles.caption, { color: p.muted }]}>{new Date(item.observed_at).toLocaleDateString()} · {Math.round(item.confidence * 100)}% confidence</Text>
            </View>
            {item.changeAmount !== null && <Text style={[styles.badge, { color: item.changeAmount > 0 ? p.danger : p.success }]}>{item.changeAmount > 0 ? "+" : ""}{formatMoney(item.changeAmount)}</Text>}
          </View>
        );
      })}
    </Card>
  );
}

export function DealsCard({ items }: { items: DealDto[] }) {
  const p = useGardenPalette();
  const open = async (url: string) => {
    const safe = safeExternalUrl(url);
    if (safe && await Linking.canOpenURL(safe)) await Linking.openURL(safe);
  };
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((raw) => {
        const item = mapDeal(raw);
        const isDemo = item.source.source_url.includes("demo.tamalife.local");
        const price = item.promotionalPrice ?? item.regularPrice;
        return (
          <Card key={item.id} onPress={isDemo ? undefined : () => void open(item.source.source_url)} accessibilityLabel={isDemo ? item.title : `Open ${item.title} deal`}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: p.ink }]}>{item.title}</Text>
                {item.description && <Text style={[styles.body, { color: p.body }]}>{item.description}</Text>}
                {isDemo && <Text style={[styles.caption, { color: p.warning }]}>SIMULATED LOCAL SAMPLE</Text>}
                {item.expires_at && <Text style={[styles.caption, { color: p.muted }]}>Ends {new Date(item.expires_at).toLocaleDateString()}</Text>}
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                {price !== null && <Text style={[styles.price, { color: p.success }]}>{formatMoney(price)}</Text>}
                {!isDemo && <ExternalLink size={16} color={p.accent} />}
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

export function AlternativesCard({ items }: { items: AlternativeDto[] }) {
  const p = useGardenPalette();
  return <View style={{ gap: spacing.sm }}>{items.map((raw) => {
    const item = mapAlternative(raw);
    return (
      <Card key={item.id}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: p.ink }]}>{item.provider_name} {item.plan_name}</Text>
            <Text style={[styles.body, { color: p.body }]}>{formatMoney(item.currentPrice)} {item.billing_cycle}</Text>
            <Text style={[styles.caption, { color: p.muted }]}>{Math.round(item.feature_similarity * 100)}% feature match · switching effort {item.switching_effort}/5</Text>
          </View>
          {item.monthlySavings !== null && <Text style={[styles.price, { color: p.success }]}>Save {formatMoney(item.monthlySavings)}/mo</Text>}
        </View>
      </Card>
    );
  })}</View>;
}

export function RecommendationsCard({
  items,
}: {
  items: RecommendationDto[];
}) {
  const p = useGardenPalette();
  return <View style={{ gap: spacing.sm }}>{items.map((item) => (
    <Card key={item.id} style={{ gap: spacing.sm }}>
      <Text style={[styles.title, { color: p.ink }]}>{item.recommendation_type.replace(/_/g, " ")}</Text>
      <Text style={[styles.body, { color: p.body }]}>{item.explanation}</Text>
      {item.estimated_monthly_savings && <Text style={[styles.price, { color: p.success }]}>Potentially save {formatMoney(Number(item.estimated_monthly_savings))}/mo</Text>}
      <Text style={[styles.caption, { color: p.muted }]}>Based on verified pricing and your subscription details.</Text>
    </Card>
  ))}</View>;
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.pixelBold, fontSize: 15, textTransform: "capitalize" },
  body: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, marginTop: 2 },
  badge: { fontFamily: "monospace", fontWeight: "900", fontSize: 11 },
  price: { fontFamily: fonts.pixelBold, fontSize: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  historyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  skeleton: { height: 12, borderRadius: 8, opacity: 0.75 },
});
