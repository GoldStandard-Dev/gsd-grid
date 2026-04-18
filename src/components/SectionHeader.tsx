import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme/theme";

type Props = {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
};

export default function SectionHeader({ title, subtitle, action }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null]}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.ink,
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.muted,
  },
  actionBtn: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.primaryHover,
  },
  pressed: {
    opacity: 0.85,
  },
});
