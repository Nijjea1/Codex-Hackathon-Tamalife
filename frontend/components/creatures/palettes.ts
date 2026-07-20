import { CreatureMood, CreatureSpecies } from "../../types/subscription";

export type CreaturePalette = {
  body: string;
  bodyDark: string;
  bodyLight: string;
  accent: string;
  cheek: string;
};

const basePalettes: Record<CreatureSpecies, CreaturePalette> = {
  cloud: { body: "#9FB8FF", bodyDark: "#6D86E8", bodyLight: "#D6E2FF", accent: "#B8AEFF", cheek: "#F3A6C0" },
  sprout: { body: "#7FD98F", bodyDark: "#4CA96A", bodyLight: "#C2F2CB", accent: "#55D6BE", cheek: "#F3A6A6" },
  blob: { body: "#B48CF2", bodyDark: "#8560C9", bodyLight: "#DFC9FF", accent: "#8B7CFF", cheek: "#F3A6C0" },
  ember: { body: "#FFA36B", bodyDark: "#D9704A", bodyLight: "#FFD1AE", accent: "#F6C453", cheek: "#F08080" },
  egg: { body: "#F2E4C4", bodyDark: "#CBB78E", bodyLight: "#FCF6E5", accent: "#F6C453", cheek: "#F3B6A6" },
  gem: { body: "#7CD4E8", bodyDark: "#4E9FBF", bodyLight: "#C8F0FA", accent: "#B8AEFF", cheek: "#F3A6C0" },
  penny: { body: "#F3A6C0", bodyDark: "#D9789B", bodyLight: "#FFD5E1", accent: "#55D6BE", cheek: "#F7BBCB" },
  milo: { body: "#B9825C", bodyDark: "#815139", bodyLight: "#EBC29E", accent: "#F6C453", cheek: "#EAA28B" },
  nori: { body: "#F2C879", bodyDark: "#C58D45", bodyLight: "#FFE9B9", accent: "#55D6BE", cheek: "#F0A18C" },
  benny: { body: "#A87557", bodyDark: "#724631", bodyLight: "#E0AE84", accent: "#55D6BE", cheek: "#E79D87" },
  tilly: { body: "#86CFA0", bodyDark: "#4C9B6D", bodyLight: "#C7F1CF", accent: "#F6C453", cheek: "#F3A6A6" },
  rory: { body: "#9DA3B7", bodyDark: "#656B82", bodyLight: "#D9DDEA", accent: "#B8AEFF", cheek: "#F2A5B9" },
  pip: { body: "#7184AF", bodyDark: "#3E4F7B", bodyLight: "#DCE7FF", accent: "#F6C453", cheek: "#F3A6A6" },
};

function mix(hex: string, target: string, amount: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(target.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - amount) + ((b >> 16) & 255) * amount);
  const g = Math.round(((a >> 8) & 255) * (1 - amount) + ((b >> 8) & 255) * amount);
  const bl = Math.round((a & 255) * (1 - amount) + (b & 255) * amount);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

// Sick/critical creatures lose saturation; resolved creatures gain a calm violet cast.
export function paletteFor(species: CreatureSpecies, mood: CreatureMood): CreaturePalette {
  const base = basePalettes[species];
  const grey = "#8A8FA3";
  if (mood === "sick") {
    return {
      body: mix(base.body, grey, 0.45),
      bodyDark: mix(base.bodyDark, grey, 0.45),
      bodyLight: mix(base.bodyLight, grey, 0.35),
      accent: mix(base.accent, grey, 0.4),
      cheek: mix(base.cheek, grey, 0.5),
    };
  }
  if (mood === "critical") {
    return {
      body: mix(base.body, grey, 0.65),
      bodyDark: mix(base.bodyDark, grey, 0.65),
      bodyLight: mix(base.bodyLight, grey, 0.55),
      accent: mix(base.accent, grey, 0.6),
      cheek: mix(base.cheek, grey, 0.7),
    };
  }
  if (mood === "concerned") {
    return {
      body: mix(base.body, grey, 0.18),
      bodyDark: mix(base.bodyDark, grey, 0.18),
      bodyLight: mix(base.bodyLight, grey, 0.12),
      accent: mix(base.accent, grey, 0.15),
      cheek: mix(base.cheek, grey, 0.2),
    };
  }
  if (mood === "resolved") {
    return {
      body: mix(base.body, "#B8AEFF", 0.15),
      bodyDark: mix(base.bodyDark, "#8B7CFF", 0.15),
      bodyLight: mix(base.bodyLight, "#E4DEFF", 0.2),
      accent: base.accent,
      cheek: base.cheek,
    };
  }
  return base;
}
