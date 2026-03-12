// src/components/GoldButton.tsx
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { theme } from "../theme/theme";

export default function GoldButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.goldDark,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  pressed: {
    opacity: 0.94,
    transform: [{ translateY: 1 }],
  },

  disabled: {
    opacity: 0.55,
  },

  text: {
    color: "#0F0F10",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.2,
  },
});