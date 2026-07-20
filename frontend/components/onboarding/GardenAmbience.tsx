import { useAudioPlayer } from "expo-audio";
import { Volume2, VolumeX } from "lucide-react-native";
import React, { createContext, useContext, useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useUIStore } from "../../store/useUIStore";

const AMBIENCE_VOLUME = 0.09;

type AmbienceContextValue = {
  enabled: boolean;
  toggle: () => void;
  playSelectClick: () => void;
  playContinueClick: () => void;
  fadeOutAmbience: () => void;
};
const AmbienceContext = createContext<AmbienceContextValue | null>(null);

export function GardenAmbienceProvider({ children }: { children: React.ReactNode }) {
  const enabled = useUIStore((s) => s.ambienceEnabled);
  const setEnabled = useUIStore((s) => s.setAmbienceEnabled);
  const player = useAudioPlayer(require("../../assets/onboarding-theme.mp3"));
  // Short "picking/toggling something" tone — used for selections that keep you on the same screen.
  const selectPlayer = useAudioPlayer(require("../../assets/select-click.wav"));
  // Crisper "moving forward" tone — used for continue/next-page actions, so it reads differently from selecting.
  const continuePlayer = useAudioPlayer(require("../../assets/continue-click.wav"));
  const fadeInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    player.loop = true;
    player.volume = AMBIENCE_VOLUME;
    selectPlayer.volume = 0.24;
    continuePlayer.volume = 0.3;
  }, [continuePlayer, player, selectPlayer]);

  useEffect(() => () => {
    if (fadeInterval.current) clearInterval(fadeInterval.current);
  }, []);

  const playSelectClick = () => {
    void selectPlayer.seekTo(0);
    selectPlayer.play();
  };

  const playContinueClick = () => {
    void continuePlayer.seekTo(0);
    continuePlayer.play();
  };

  const toggle = () => {
    if (enabled) {
      player.pause();
      setEnabled(false);
    } else {
      player.play();
      setEnabled(true);
    }
  };

  // Ramps the background music down to silence and pauses it — used when the
  // user leaves the welcome screen so the theme doesn't just cut off abruptly.
  const fadeOutAmbience = () => {
    if (!enabled) return;
    if (fadeInterval.current) clearInterval(fadeInterval.current);
    const steps = 14;
    const stepDuration = 50;
    let step = 0;
    fadeInterval.current = setInterval(() => {
      step += 1;
      player.volume = Math.max(0, AMBIENCE_VOLUME * (1 - step / steps));
      if (step >= steps) {
        if (fadeInterval.current) clearInterval(fadeInterval.current);
        fadeInterval.current = null;
        player.pause();
        player.volume = AMBIENCE_VOLUME;
        setEnabled(false);
      }
    }, stepDuration);
  };

  return (
    <AmbienceContext.Provider value={{ enabled, toggle, playSelectClick, playContinueClick, fadeOutAmbience }}>
      {children}
    </AmbienceContext.Provider>
  );
}

export function useGardenClickSound() {
  return useContext(AmbienceContext)?.playSelectClick ?? (() => undefined);
}

export function useGardenContinueSound() {
  return useContext(AmbienceContext)?.playContinueClick ?? (() => undefined);
}

export function useGardenAmbienceFadeOut() {
  return useContext(AmbienceContext)?.fadeOutAmbience ?? (() => undefined);
}

export function AmbienceButton({ compact = false }: { compact?: boolean }) {
  const context = useContext(AmbienceContext);
  const isDay = useUIStore((s) => s.onboardingTheme === "day");
  if (!context) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={context.enabled ? "Mute garden ambience" : "Play garden ambience"}
      onPress={() => {
        context.playSelectClick();
        context.toggle();
      }}
      style={({ pressed }) => [styles.button, !isDay && styles.buttonNight, compact && styles.compact, pressed && styles.pressed]}
    >
      {context.enabled ? <Volume2 size={compact ? 15 : 17} color={isDay ? "#31543c" : "#f2eaff"} /> : <VolumeX size={compact ? 15 : 17} color={isDay ? "#31543c" : "#f2eaff"} />}
      {!compact && <Text style={[styles.label, !isDay && styles.labelNight]}>{context.enabled ? "SOUND ON" : "SOUND OFF"}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 36, paddingHorizontal: 10, borderRadius: 18, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,248,209,0.94)", borderWidth: 2, borderColor: "#568b61" },
  buttonNight: { backgroundColor: "rgba(42,27,75,0.94)", borderColor: "#a99ae9" },
  compact: { width: 36, paddingHorizontal: 0 },
  pressed: { transform: [{ translateY: 2 }] },
  label: { color: "#31543c", fontFamily: "monospace", fontWeight: "900", fontSize: 9 },
  labelNight: { color: "#f2eaff" },
});
