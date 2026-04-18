import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme/theme";

type WOStatus = "new" | "scheduled" | "in_progress" | "blocked" | "completed" | "canceled";

const STATUS_CONFIG: Record<WOStatus, { label: string; bg: string; color: string; border: string }> = {
  new: { label: "New", bg: "#EEF2FF", color: "#3730A3", border: "#C7D2FE" },
  scheduled: { label: "Scheduled", bg: "#FFF7ED", color: "#9A3412", border: "#FED7AA" },
  in_progress: { label: "In Progress", bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" },
  blocked: { label: "Blocked", bg: "#FFF1F2", color: "#9F1239", border: "#FECDD3" },
  completed: { label: "Completed", bg: "#F0FDF4", color: "#166534", border: "#BBF7D0" },
  canceled: { label: "Canceled", bg: "#F9FAFB", color: "#374151", border: "#E5E7EB" },
};

type Props = {
  status: string;
};

export default function StatusChip({ status }: Props) {
  const config = STATUS_CONFIG[status as WOStatus] ?? {
    label: status,
    bg: theme.colors.surface2,
    color: theme.colors.muted,
    border: theme.colors.border,
  };

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: config.bg, borderColor: config.border },
      ]}
    >
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
  },
});
