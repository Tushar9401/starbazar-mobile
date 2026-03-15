import React from "react";
import { View, ActivityIndicator, Platform, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";

export default function CloverPayment() {

  const { url } = useLocalSearchParams();

  // If running on web
  if (Platform.OS === "web") {
    Linking.openURL(String(url));
    return null;
  }

  return (
    <WebView
      source={{ uri: String(url) }}
      startInLoadingState
      renderLoading={() => (
        <View style={{flex:1, justifyContent:"center", alignItems:"center"}}>
          <ActivityIndicator size="large" />
        </View>
      )}
    />
  );
}