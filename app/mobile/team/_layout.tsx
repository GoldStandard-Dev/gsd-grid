import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { theme } from "../../../src/theme/theme";

const tabs = {
  jobs: ["Jobs", "briefcase-outline"],
  calendar: ["Calendar", "calendar-outline"],
  uploads: ["Uploads", "cloud-upload-outline"],
  account: ["Account", "person-circle-outline"],
} as const;

export default function TeamMobileLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.gold,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          minHeight: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800" },
        tabBarIcon: ({ color, size }) => {
          const icon = tabs[route.name as keyof typeof tabs]?.[1] ?? "ellipse-outline";
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      {Object.entries(tabs).map(([name, [title]]) => (
        <Tabs.Screen key={name} name={name} options={{ title }} />
      ))}
    </Tabs>
  );
}
