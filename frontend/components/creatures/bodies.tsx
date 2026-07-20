import React from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { CreatureSpecies } from "../../types/subscription";
import { CreaturePalette } from "./palettes";

type BodyProps = { size: number; palette: CreaturePalette; id: string };

// Every body renders in a 120x120 viewBox. Radial gradients + a top-left
// highlight fake the "3D" volume. These are the components to replace with
// Rive / GLB / R3F renderers later — the interface stays the same.

function Grad({ id, palette }: { id: string; palette: CreaturePalette }) {
  return (
    <Defs>
      <RadialGradient id={`${id}-g`} cx="38%" cy="30%" r="80%">
        <Stop offset="0%" stopColor={palette.bodyLight} />
        <Stop offset="55%" stopColor={palette.body} />
        <Stop offset="100%" stopColor={palette.bodyDark} />
      </RadialGradient>
    </Defs>
  );
}

export function CloudBody({ size, palette, id }: BodyProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Grad id={id} palette={palette} />
      <Ellipse cx="60" cy="72" rx="44" ry="30" fill={`url(#${id}-g)`} />
      <Circle cx="34" cy="60" r="20" fill={`url(#${id}-g)`} />
      <Circle cx="62" cy="48" r="26" fill={`url(#${id}-g)`} />
      <Circle cx="88" cy="62" r="18" fill={`url(#${id}-g)`} />
      <Ellipse cx="46" cy="42" rx="10" ry="6" fill={palette.bodyLight} opacity={0.7} />
    </Svg>
  );
}

export function SproutBody({ size, palette, id }: BodyProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Grad id={id} palette={palette} />
      <Path d="M60 6 C60 6 48 18 52 30 C55 38 60 38 60 38 C60 38 65 38 68 30 C72 18 60 6 60 6 Z" fill={palette.accent} />
      <Path d="M60 38 L60 30" stroke={palette.bodyDark} strokeWidth={3} strokeLinecap="round" />
      <Ellipse cx="60" cy="76" rx="38" ry="36" fill={`url(#${id}-g)`} />
      <Ellipse cx="44" cy="54" rx="11" ry="7" fill={palette.bodyLight} opacity={0.65} />
    </Svg>
  );
}

export function BlobBody({ size, palette, id }: BodyProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Grad id={id} palette={palette} />
      <Path
        d="M60 22 C88 22 102 44 100 70 C98 96 82 108 60 108 C38 108 22 96 20 70 C18 44 32 22 60 22 Z"
        fill={`url(#${id}-g)`}
      />
      <Path d="M24 52 L96 52 L94 62 L26 62 Z" fill={palette.accent} opacity={0.9} />
      <Ellipse cx="44" cy="38" rx="12" ry="7" fill={palette.bodyLight} opacity={0.65} />
    </Svg>
  );
}

export function EmberBody({ size, palette, id }: BodyProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Grad id={id} palette={palette} />
      <Path
        d="M60 8 C66 26 84 30 88 50 C92 74 80 96 60 96 C40 96 28 74 32 50 C36 30 54 26 60 8 Z"
        fill={`url(#${id}-g)`}
      />
      <Path
        d="M60 34 C63 44 72 46 74 56 C76 70 70 80 60 80 C50 80 44 70 46 56 C48 46 57 44 60 34 Z"
        fill={palette.bodyLight}
        opacity={0.55}
      />
      <Ellipse cx="60" cy="104" rx="26" ry="8" fill={palette.bodyDark} opacity={0.5} />
    </Svg>
  );
}

export function EggBody({ size, palette, id }: BodyProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Grad id={id} palette={palette} />
      <Path
        d="M60 12 C82 12 96 44 96 70 C96 94 80 108 60 108 C40 108 24 94 24 70 C24 44 38 12 60 12 Z"
        fill={`url(#${id}-g)`}
      />
      <Path d="M36 70 L46 62 L54 72 L64 60 L74 72 L84 63" stroke={palette.accent} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      <Ellipse cx="46" cy="34" rx="10" ry="7" fill={palette.bodyLight} opacity={0.7} />
    </Svg>
  );
}

export function GemBody({ size, palette, id }: BodyProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Grad id={id} palette={palette} />
      <Path d="M60 14 L94 40 L84 100 L36 100 L26 40 Z" fill={`url(#${id}-g)`} />
      <Path d="M60 14 L74 40 L60 100 L46 40 Z" fill={palette.bodyLight} opacity={0.4} />
      <Path d="M26 40 L94 40" stroke={palette.bodyLight} strokeWidth={2} opacity={0.5} />
      <Ellipse cx="48" cy="30" rx="8" ry="5" fill={palette.bodyLight} opacity={0.8} />
    </Svg>
  );
}

export const bodyBySpecies: Record<
  CreatureSpecies,
  (props: BodyProps) => React.JSX.Element
> = {
  cloud: CloudBody,
  sprout: SproutBody,
  blob: BlobBody,
  ember: EmberBody,
  egg: EggBody,
  gem: GemBody,
};
