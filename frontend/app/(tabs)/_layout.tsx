import { Tabs, useRouter } from "expo-router";
import { ChartPie, Flower2, House, Plus, UserRound } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors } from "../../constants/theme";

function TabIcon({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, { damping: 10 });
  }, [focused, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primaryLight,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.backgroundRaised,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 84,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 11 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <House size={22} color={color} />
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
              <Flower2 size={22} color={color} />
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
                onPress={() => router.push("/add")}
                style={({ pressed }) => [styles.addBtn, pressed && { transform: [{ scale: 0.94 }] }]}
              >
                <Plus size={26} color="#fff" strokeWidth={2.5} />
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
              <ChartPie size={22} color={color} />
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
              <UserRound size={22} color={color} />
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
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
