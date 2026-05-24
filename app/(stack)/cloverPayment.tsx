import React, { useEffect, useMemo, useState } from "react";
import { View, ActivityIndicator, Platform, Linking, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { router, useLocalSearchParams } from "expo-router";

export default function CloverPayment() {

  const { url } = useLocalSearchParams();
  const [loadError, setLoadError] = useState("");
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

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: checkoutUrl }}
      startInLoadingState
      onNavigationStateChange={({ url: currentUrl }) => {
        try {
          const parsed = new URL(currentUrl);
          const paymentStatus = parsed.searchParams.get("payment");

          if (paymentStatus === "success") {
            router.replace("/orders");
          } else if (paymentStatus === "failed") {
            router.replace("/checkout");
          }
        } catch {
          // Ignore non-standard URLs emitted during the payment flow.
        }
      }}
      onError={() => setLoadError("Unable to load payment checkout.")}
      onHttpError={({ nativeEvent }) => {
        if (nativeEvent.statusCode >= 400) {
          setLoadError("Payment checkout returned an error.");
        }
      }}
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
