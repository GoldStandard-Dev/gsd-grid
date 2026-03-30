// src/components/GoldButton.tsx
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { theme } from "../theme/theme";

type GoldButtonVariant = "solid" | "outline" | "ghost";

export default function GoldButton({
  label,
  onPress,
  disabled,
  style,
  variant = "solid",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: GoldButtonVariant;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === "outline" ? styles.outline : null,
        variant === "ghost" ? styles.ghost : null,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === "outline" ? styles.textOutline : null,
          variant === "ghost" ? styles.textGhost : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.goldDark,
    ...theme.shadow.gold,
  },

  outline: {
    backgroundColor: "transparent",
    borderColor: theme.colors.gold,
    shadowOpacity: 0,
    elevation: 0,
  },

  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },

  pressed: {
    opacity: 0.88,
    transform: [{ translateY: 1 }],
  },

  disabled: {
    opacity: 0.45,
  },

  text: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.3,
  },

  textOutline: {
    color: theme.colors.gold,
  },

  textGhost: {
    color: theme.colors.gold,
  },
});
