import {
  fetchDeletionEligibility,
  requestAccountDeletion,
  sendOTPAccountDeletion,
  type DeletionEligibility,
} from "@/api/accountDeletion";
import DeleteAccountModal from "@/components/modals/deleteAccountModal";
import DeleteAccountOtpModal from "@/components/modals/DeleteAccountOtpModal";
import LogoutModal from "@/components/modals/logoutModal";
import NotLoggedIn from "@/components/notLoggedIn";
import {getExpoPushToken, savePushTokenToBackend} from "@/hooks/pushToken";
import {useAuth} from "@/hooks/useAuth";
import {useDrawerFallbackBack} from "@/hooks/useDrawerFallbackBack";
import api, {performLogout} from "@/lib/axios";
import {useAppStore} from "@/store/useAppStore";
import {pushOnce} from "@/utils/helpers/navigation";
import {Ionicons} from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Pressable,
  Switch,
  Text,
  View,
  type AppStateStatus,
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const Settings = () => {
  useDrawerFallbackBack();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [eligibility, setEligibility] = useState<DeletionEligibility | null>(
    null,
  );
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const {isLoggedIn} = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [osPermissionStatus, setOsPermissionStatus] = useState<
    "granted" | "denied" | "undetermined"
  >("undetermined");
  const appState = useRef(AppState.currentState);
  const lastOsStatus = useRef(osPermissionStatus);
  const isLoggedInRef = useRef(isLoggedIn);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const phoneNumber = useAppStore((s) => s.phoneNumber);

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  useEffect(() => {
    lastOsStatus.current = osPermissionStatus;
  }, [osPermissionStatus]);

  // Fetch notification settings on mount
  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    fetchNotificationSettings();
    void loadDeletionEligibility();
  }, [isLoggedIn]);

  const loadDeletionEligibility = async () => {
    try {
      setEligibilityLoading(true);
      const result = await fetchDeletionEligibility();
      setEligibility(result);
    } catch (error) {
      console.error("Error fetching deletion eligibility:", error);
    } finally {
      setEligibilityLoading(false);
    }
  };

  const fetchNotificationSettings = async () => {
    try {
      // Check OS permission
      const {status} = await Notifications.getPermissionsAsync();
      setOsPermissionStatus(status);
      lastOsStatus.current = status;

      // Check backend setting
      const response = await api.get("/notifications/settings");
      if (response.data.success) {
        const backendEnabled = response.data.data.enabled;
        const hasToken = response.data.data.hasToken;
        // Only enabled if OS allows, backend allows, and a token is registered
        setNotificationsEnabled(
          backendEnabled && hasToken && status === "granted",
        );
      }
    } catch (error) {
      console.error("Error fetching notification settings:", error);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const enableNotificationsWithToken = async () => {
    const token = await getExpoPushToken();
    if (!token) {
      throw new Error("Failed to get push token");
    }

    const saved = await savePushTokenToBackend(token);
    if (!saved) {
      throw new Error("Failed to save push token");
    }

    return api.post("/notifications/enable");
  };

  // Resume from OS settings: cheap permission check; sync only if status changed.
  useEffect(() => {
    const onAppStateChange = async (nextState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active" &&
        isLoggedInRef.current
      ) {
        try {
          const {status} = await Notifications.getPermissionsAsync();
          if (status === lastOsStatus.current) {
            appState.current = nextState;
            return;
          }

          lastOsStatus.current = status;
          setOsPermissionStatus(status);

          if (status === "granted") {
            setIsLoadingNotifications(true);
            try {
              await enableNotificationsWithToken();
              setNotificationsEnabled(true);
              Toast.show({
                type: "success",
                text1: "✅ Notifications Enabled",
                text2: "You will receive alerts for booking updates",
              });
            } catch (error) {
              console.error("Error enabling notifications on resume:", error);
              await fetchNotificationSettings();
            } finally {
              setIsLoadingNotifications(false);
            }
          } else {
            setNotificationsEnabled(false);
          }
        } catch (error) {
          console.error(
            "Error checking notification permission on resume:",
            error,
          );
        }
      }

      appState.current = nextState;
    };

    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => sub.remove();
  }, []);

  const handleNotificationToggle = async (value: boolean) => {
    try {
      if (value) {
        // User wants to ENABLE notifications
        const {status} = await Notifications.getPermissionsAsync();

        if (status === "denied") {
          // OS permission was denied - send to device settings
          Alert.alert(
            "Notifications Blocked",
            "To receive trip alerts, please enable notifications in your device settings.",
            [
              {text: "Cancel", style: "cancel"},
              {
                text: "Open Settings",
                onPress: () => Linking.openSettings(),
              },
            ],
          );
          setNotificationsEnabled(false);
          return;
        }

        if (status === "undetermined") {
          // Haven't asked for permission yet - request it
          Alert.alert(
            "🔔 Enable Notifications",
            "Allow notifications to receive alerts about scheduled trips and booking updates.",
            [
              {
                text: "Not Now",
                style: "cancel",
              },
              {
                text: "Allow",
                onPress: async () => {
                  const {status: newStatus} =
                    await Notifications.requestPermissionsAsync();

                  if (newStatus === "granted") {
                    try {
                      setIsLoadingNotifications(true);
                      await enableNotificationsWithToken();

                      setOsPermissionStatus("granted");
                      setNotificationsEnabled(true);

                      Toast.show({
                        type: "success",
                        text1: "✅ Notifications Enabled",
                        text2: "You will receive alerts for scheduled trips",
                      });
                    } catch (error: any) {
                      console.error("Error toggling notifications:", error);
                      Toast.show({
                        type: "error",
                        text1: "Error",
                        text2:
                          error.response?.data?.error ||
                          error.message ||
                          "Failed to update settings",
                      });
                    } finally {
                      setIsLoadingNotifications(false);
                    }
                  } else {
                    // User denied permission
                    setOsPermissionStatus("denied");
                    Toast.show({
                      type: "error",
                      text1: "Permission Denied",
                      text2: "You can enable it later in device settings",
                    });
                  }
                },
              },
            ],
          );
          return;
        }

        // Permission already granted - save token, then enable on backend
        setIsLoadingNotifications(true);
        const response = await enableNotificationsWithToken();

        if (response.data.success) {
          setNotificationsEnabled(true);
          Toast.show({
            type: "info",
            text1: "✅ Notifications Enabled",
            text2: "You will receive alerts for booking updates",
            visibilityTime: 4000,
          });
        }
      } else {
        // User wants to DISABLE notifications
        setIsLoadingNotifications(true);
        const response = await api.post("/notifications/disable");

        if (response.data.success) {
          setNotificationsEnabled(false);
          Toast.show({
            type: "info",
            text1: "🔕 Notifications Disabled",
            text2: "You won't receive booking update notifications",
            visibilityTime: 4000,
          });
        }
      }
    } catch (error: any) {
      console.error("Error toggling notifications:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2:
          error.response?.data?.error ||
          error.message ||
          "Failed to update settings",
      });
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const menuItems = useMemo(
    () => [
      {
        label: "Privacy Policy",
        onPress: () => pushOnce("/(public_screens)/privacyPolicy"),
      },
      {
        label: "Terms & Conditions",
        onPress: () => pushOnce("/(public_screens)/terms&conditions"),
      },

      {
        label: "About Us",
        onPress: () => pushOnce("/(root_screens)/about"),
      },
      {
        label: isLoggedIn ? "Logout" : "Register / Login",
        onPress: () =>
          isLoggedIn ? setShowLogoutModal(true) : pushOnce("/(auth)/auth"),
      },
    ],
    [isLoggedIn],
  );

  const canDelete = eligibility?.canDelete === true;
  const deleteBlockedMessage =
    eligibility?.message ||
    "Complete or cancel your booking(s) before deleting your account.";

  const handleSendDeletionOtp = async () => {
    try {
      setOtpSending(true);
      await sendOTPAccountDeletion();
      setShowDeleteModal(false);
      setShowOtpModal(true);
    } catch (error: any) {
      console.error("Error sending deletion OTP:", error);
      Toast.show({
        type: "error",
        text1: "Couldn't send code",
        text2: error.response?.data?.error ?? "Please try again",
        topOffset: 50,
      });
    } finally {
      setOtpSending(false);
    }
  };

  const handleOpenDelete = () => {
    if (eligibilityLoading) return;
    if (!canDelete) {
      Alert.alert("Cannot Delete Account", deleteBlockedMessage);
      return;
    }
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async (verifyToken: string) => {
    try {
      setDeleteLoading(true);
      const result = await requestAccountDeletion(verifyToken);
      setShowOtpModal(false);
      const date = new Date(result.scheduledAt);
      const formatted = Number.isNaN(date.getTime())
        ? "the scheduled date"
        : date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
      Toast.show({
        type: "info",
        text1: "Deletion scheduled",
        text2: `Your account will be deleted on ${formatted}.`,
        visibilityTime: 5000,
        topOffset: 50,
      });
      await performLogout();
    } catch (error: any) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to schedule account deletion";
      Toast.show({
        type: "error",
        text1: "Delete failed",
        text2: message,
        topOffset: 50,
      });
      void loadDeletionEligibility();
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isLoggedIn) {
    return <NotLoggedIn />;
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-3 px-4">
        <Pressable
          onPress={() =>
            !isLoadingNotifications &&
            handleNotificationToggle(!notificationsEnabled)
          }
          className="flex-row items-center px-5 py-4 bg-gray-100 rounded-2xl active:opacity-70"
          disabled={isLoadingNotifications}
        >
          <Ionicons
            name={notificationsEnabled ? "notifications" : "notifications-off"}
            size={24}
            color={notificationsEnabled ? "#FFA840" : "#9CA3AF"}
          />
          <View className="flex-1 ml-4">
            <Text className="text-base font-semibold text-gray-800">
              Notifications
            </Text>
            {osPermissionStatus === "denied" && (
              <Text className="mt-1 text-xs text-orange-600">
                Enable in device settings
              </Text>
            )}
          </View>
          {isLoadingNotifications ? (
            <ActivityIndicator size="small" color="#FFA840" />
          ) : (
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              disabled={isLoadingNotifications}
              trackColor={{false: "#D1D5DB", true: "#FFA840"}}
              thumbColor={notificationsEnabled ? "#fff" : "#f4f3f4"}
              ios_backgroundColor="#D1D5DB"
            />
          )}
        </Pressable>
        {menuItems.map((item, index) => (
          <Pressable
            key={index}
            onPress={item.onPress}
            className="flex-row items-center px-5 py-4 bg-gray-100 rounded-2xl active:opacity-70"
          >
            <Text className="flex-1 ml-4 text-base font-semibold text-gray-800">
              {item.label}
            </Text>

            <Ionicons name="chevron-forward" size={24} color="#FFA840" />
          </Pressable>
        ))}

        <View className="mt-4 mb-2">
          <Text className="mb-2 ml-1 text-xs font-semibold tracking-wide text-red-500 uppercase">
            Danger Zone
          </Text>
          <Pressable
            onPress={handleOpenDelete}
            disabled={eligibilityLoading}
            className={`flex-row items-center px-5 py-4 border rounded-2xl ${
              canDelete
                ? "bg-red-50 border-red-200 active:opacity-70"
                : "bg-gray-100 border-gray-200 opacity-70"
            }`}
          >
            <Ionicons
              name="trash-outline"
              size={22}
              color={canDelete ? "#DC2626" : "#9CA3AF"}
            />
            <View className="flex-1 ml-4">
              <Text
                className={`text-base font-semibold ${
                  canDelete ? "text-red-600" : "text-gray-500"
                }`}
              >
                Delete Account
              </Text>
              {!canDelete && !eligibilityLoading && (
                <Text className="mt-1 text-xs text-gray-500">
                  {deleteBlockedMessage}
                </Text>
              )}
            </View>
            {eligibilityLoading ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : null}
          </Pressable>
        </View>
      </View>
      <LogoutModal isOpen={showLogoutModal} setIsOpen={setShowLogoutModal} />
      <DeleteAccountModal
        isOpen={showDeleteModal}
        setIsOpen={setShowDeleteModal}
        onConfirm={handleSendDeletionOtp}
        loading={otpSending}
      />
      <DeleteAccountOtpModal
        isOpen={showOtpModal}
        setIsOpen={setShowOtpModal}
        phoneNumber={phoneNumber}
        onVerifySuccess={handleConfirmDelete}
        loading={deleteLoading}
      />
    </SafeAreaView>
  );
};

export default Settings;
