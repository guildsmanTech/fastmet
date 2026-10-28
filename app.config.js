const isPreview = process.env.APP_VARIANT === "preview";

export default {
  expo: {
    name: "FastMet",
    slug: "fastmet",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/fastmet/icon.png",
    scheme: "fastmet",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_IOS_MAP_KEY,
      },
      supportsTablet: true,
      bundleIdentifier: "com.guildsman.fastmet",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["location", "remote-notification"],
        NSLocationWhenInUseUsageDescription:
          "We need your location to show navigation.",
        NSLocationAlwaysUsageDescription:
          "We need your location in the background to track your deliveries.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "We need your location to show navigation and track deliveries.",
        NSPhotoLibraryUsageDescription:
          "We need access to your photos to upload pictures.",
        NSCameraUsageDescription:
          "FastMet uses your camera to take photos and to verify your identity with a live face scan.",
      },
    },
    android: {
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_ANDROID_MAP_KEY,
        },
      },
      adaptiveIcon: {
        foregroundImage: "./assets/fastmet/icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.guildsman.fastmet",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "NOTIFICATIONS",
        // Face verification webview (getUserMedia).
        "CAMERA",
      ],
      blockedPermissions: [
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
      ],
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/fastmet/icon.png",
    },
    notification: {
      icon: "./assets/fastmet/logo.png",
      color: "#FFA840",
      androidMode: "default",
      androidCollapsedTitle: "{{unread_count}} new notifications",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/fastmet/splash.png",
          resizeMode: "contain",
          backgroundColor: "#1C2B39",
        },
      ],
      "expo-font",
      "expo-web-browser",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/fastmet/logo.png",
          color: "#fff",
        },
      ],
      [
        "expo-contacts",
        {
          "contactsPermission":
            "Allow $(PRODUCT_NAME) to access your contacts.",
        },
      ],
      [
        "@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          project: "fastmet-client",
          organization: "guildsman-technology",
        },
      ],
      ...(isPreview ? ["./plugins/withChucker"] : []),
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    updates: {
      url: "https://u.expo.dev/177af201-fa0a-44b7-a20b-c22a01e455a7",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    extra: {
      router: {},
      eas: {
        projectId: "177af201-fa0a-44b7-a20b-c22a01e455a7",
      },
    },
  },
};
