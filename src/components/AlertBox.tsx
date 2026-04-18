import { Text, View } from "react-native";
import { ui } from "../theme/ui";

type Props = {
  type: "error" | "success";
  message: string;
};

export default function AlertBox({ type, message }: Props) {
  if (!message) return null;
  return (
    <View style={type === "error" ? ui.alertError : ui.alertSuccess}>
      <Text style={type === "error" ? ui.alertErrorText : ui.alertSuccessText}>
        {message}
      </Text>
    </View>
  );
}
