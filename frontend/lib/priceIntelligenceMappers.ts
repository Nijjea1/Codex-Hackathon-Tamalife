import { Alternative, AlternativeDto, Deal, DealDto, PricePoint, PricePointDto } from "../types/priceIntelligence";

function decimal(value: string | null): number | null {
  if (value === null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export const mapPricePoint = (dto: PricePointDto): PricePoint => ({
  ...dto,
  price: decimal(dto.price) ?? 0,
  promotionalPrice: decimal(dto.promotional_price),
  previousPrice: decimal(dto.previous_price),
  changeAmount: decimal(dto.change_amount),
  changePercentage: decimal(dto.change_percentage),
});

export const mapDeal = (dto: DealDto): Deal => ({
  ...dto,
  regularPrice: decimal(dto.regular_price),
  promotionalPrice: decimal(dto.promotional_price),
});

export const mapAlternative = (dto: AlternativeDto): Alternative => ({
  ...dto,
  currentPrice: decimal(dto.current_price) ?? 0,
  monthlyCost: decimal(dto.monthly_cost),
  monthlySavings: decimal(dto.monthly_savings),
  annualSavings: decimal(dto.annual_savings),
});

export function safeExternalUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
