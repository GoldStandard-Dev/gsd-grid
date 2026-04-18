import { Pressable, Text } from "react-native";
import { ui } from "../theme/ui";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  loadingTitle?: string;
};

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  loadingTitle,
}: Props) {
  const isDisabled = loading || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        ui.primaryBtn,
        isDisabled ? ui.primaryBtnDisabled : null,
        pressed && !isDisabled ? { opacity: 0.9 } : null,
      ]}
    >
      <Text style={ui.primaryBtnText}>
        {loading ? (loadingTitle ?? "Loading...") : title}
      </Text>
    </Pressable>
  );
}
