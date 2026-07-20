import { LinearGradient } from "expo-linear-gradient";
import { Tabs, useRouter } from "expo-router";
import { ChartPie, Flower2, House, Plus, UserRound } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useGardenPalette } from "../../constants/garden";
import { useGardenContinueSound } from "../../components/onboarding/GardenAmbience";

function TabIcon({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.18 : 1, { damping: 10 });
    lift.value = withSpring(focused ? -3 : 0, { damping: 12 });
  }, [focused, scale, lift]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: lift.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function TabsLayout() {
  const router = useRouter();
  const p = useGardenPalette();
  const playContinue = useGardenContinueSound();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: p.isDay ? "#31543c" : "#fff4c8",
        tabBarInactiveTintColor: p.isDay ? "#8aa07f" : "#8f83b8",
        tabBarStyle: {
          backgroundColor: p.isDay ? "#fbf6dd" : "#20183f",
          borderTopColor: p.cardBorder,
          borderTopWidth: 2,
          height: 86,
          paddingTop: 10,
          paddingBottom: 18,
        },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarLabelStyle: { fontFamily: "PixelifySans_500Medium", fontSize: 11, letterSpacing: 0.5 },
        sceneStyle: { backgroundColor: p.bgDeep },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <House size={22} color={color} strokeWidth={2.4} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="garden"
        options={{
          title: "Garden",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Flower2 size={22} color={color} strokeWidth={2.4} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="add-placeholder"
        options={{
          title: "",
          tabBarButton: () => (
            <View style={styles.addWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add subscription"
                onPress={() => {
                  playContinue();
                  router.push("/add");
                }}
                style={({ pressed }) => [pressed && { transform: [{ scale: 0.93 }] }]}
              >
                <LinearGradient
                  colors={[p.goldLight, p.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.addBtn, { borderColor: p.goldBorder, shadowColor: p.gold }]}
                >
                  <Plus size={26} color={p.onGold} strokeWidth={3} />
                </LinearGradient>
              </Pressable>
            </View>
          ),
        }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <ChartPie size={22} color={color} strokeWidth={2.4} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <UserRound size={22} color={color} strokeWidth={2.4} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  addBtn: {
    width: 56,
    height: 56,
    borderRadius: 20,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 9,
  },
});
