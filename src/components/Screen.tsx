// src/components/Screen.tsx
import { PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { theme } from "../theme/theme";

export default function Screen({
  children,
  padded = true,
}: PropsWithChildren<{ padded?: boolean }>) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.scroll, padded ? styles.pad : null]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wrap}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },

  scroll: {
    minHeight: "100%",
  },

  pad: {
    padding: 22,
  },

  wrap: {
    flex: 1,
  },
});