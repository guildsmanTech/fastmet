import {useCallback, useState} from "react";
import {ActivityIndicator, Pressable, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {WebView, WebViewNavigation} from "react-native-webview";

const TERMS_AND_CONDITIONS_URL =
  "https://www.fastmet.com.ph/app-view/legal/terms/user";

const TermsAndConditions = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0);

  const allowOnlyBaseUrl = useCallback(
    (request: WebViewNavigation) => request.url === TERMS_AND_CONDITIONS_URL,
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      {error ? (
        <View className="flex-1 gap-3 justify-center items-center px-6">
          <Text className="text-gray-600">
            Couldn&apos;t load. Check your connection.
          </Text>
          <Pressable
            onPress={() => {
              setError(false);
              setLoading(true);
              setKey((k) => k + 1);
            }}
          >
            <Text className="font-semibold text-lightPrimary">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={key}
          source={{uri: TERMS_AND_CONDITIONS_URL}}
          style={{flex: 1}}
          originWhitelist={["https://*"]}
          onShouldStartLoadWithRequest={allowOnlyBaseUrl}
          setSupportMultipleWindows={false}
          onOpenWindow={() => {}}
          onLoadEnd={() => setLoading(false)}
          onError={() => setError(true)}
          onHttpError={() => setError(true)}
          startInLoadingState={false}
          bounces={false}
          pullToRefreshEnabled={false}
        />
      )}

      {loading && !error && (
        <ActivityIndicator
          style={{position: "absolute", top: "50%", left: "50%"}}
          size="large"
        />
      )}
    </SafeAreaView>
  );
};

export default TermsAndConditions;
