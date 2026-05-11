import React, { useEffect, useMemo } from "react";
import { View, ActivityIndicator, Platform, Linking, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";

export default function CloverPayment() {

  const { url } = useLocalSearchParams();
  const checkoutUrl = useMemo(() => {
    const rawUrl = Array.isArray(url) ? url[0] : url;

    try {
      const parsed = new URL(String(rawUrl));
      return parsed.protocol === "https:" ? parsed.toString() : null;
    } catch {
      return null;
    }
  }, [url]);

  useEffect(() => {
    if (Platform.OS === "web" && checkoutUrl) {
      Linking.openURL(checkoutUrl);
    }
  }, [checkoutUrl]);

  if (!checkoutUrl) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Unable to open payment checkout.</Text>
      </View>
    );
  }

  // If running on web
  if (Platform.OS === "web") {
    return null;
  }

  return (
    <WebView
      source={{ uri: checkoutUrl }}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#1A1A2E", fontWeight: "700" },
});
