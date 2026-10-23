import {Ionicons} from "@expo/vector-icons";
import {useEffect, useState} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

export const DELETE_CONFIRM_PHRASE = "delete-my-account";

const DELETED_NOW = [
  "Account profile details (name, phone number, email, gender, saved address)",
  "Profile photo, face verification photo, and face data — removed from our storage and face-matching system",
  "Login sessions, refresh tokens, and push-notification tokens",
  "In-app notification records and device-link records for your account",
  "Registration and rejection records tied to your account (anonymized or removed)",
];

const RETAINED = [
  "Completed, cancelled, and historical booking records (pickup/drop-off details you entered for a delivery), kept for operations, disputes, and Philippine tax/accounting requirements (5 years from the relevant tax return's filing deadline, per BIR RR No. 7-2024; longer if a related tax dispute or refund claim is pending)",
  "Claimed and redeemed voucher/reward records (accounting — same 5-year retention rule)",
  "Chat history with your driver, with your identity shown as a deleted account (so their inbox is not wiped)",
  "Fraud-prevention records keyed to a device (not your profile), and email bounce suppression lists",
  "If your account was banned: your face verification photo and face data, kept for up to 3 years from the ban to stop repeat sign-ups, then deleted",
];

type Props = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
};

export default function DeleteAccountModal({
  isOpen,
  setIsOpen,
  onConfirm,
  loading = false,
}: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [view, setView] = useState<"confirm" | "info">("confirm");

  useEffect(() => {
    if (!isOpen) {
      setConfirmText("");
      setView("confirm");
    }
  }, [isOpen]);

  const canSubmit = confirmText.trim() === DELETE_CONFIRM_PHRASE && !loading;

  return (
    <Modal
      visible={isOpen}
      statusBarTranslucent
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (loading) return;
        if (view === "info") {
          setView("confirm");
          return;
        }
        setIsOpen(false);
      }}
    >
      <View className="items-center justify-center flex-1 bg-black/50 px-5">
        <View className="w-full max-w-md gap-4 p-6 bg-white rounded-2xl max-h-[85%]">
          {view === "confirm" ? (
            <>
              <View className="items-center self-center p-4 bg-red-100 rounded-full">
                <Ionicons name="warning-outline" size={36} color="#DC2626" />
              </View>

              <Text className="text-xl font-bold text-center text-gray-800">
                Delete Account
              </Text>

              <Text className="text-sm leading-5 text-center text-gray-600">
                Your account will be scheduled for deletion. You have 30 days to
                cancel by logging back in. After that, your personal data is
                permanently removed. Some records (e.g. transaction and booking
                history) are retained as required by law.
              </Text>

              <Pressable onPress={() => setView("info")}>
                <Text className="text-xs text-center text-blue-600 underline">
                  What data is deleted or retained?
                </Text>
              </Pressable>

              <Text className="text-sm text-gray-700">
                Type{" "}
                <Text className="font-bold text-red-600">
                  {DELETE_CONFIRM_PHRASE}
                </Text>{" "}
                to confirm:
              </Text>

              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                placeholder={DELETE_CONFIRM_PHRASE}
                className="px-4 py-3 text-base border border-gray-300 rounded-xl text-gray-800"
              />

              <Pressable
                disabled={!canSubmit}
                onPress={() => void onConfirm()}
                className={`items-center py-4 rounded-lg ${
                  canSubmit ? "bg-red-600 active:bg-red-700" : "bg-red-300"
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-base font-bold text-white">
                    Delete My Account
                  </Text>
                )}
              </Pressable>

              <Pressable
                disabled={loading}
                onPress={() => setIsOpen(false)}
                className="items-center py-3"
              >
                <Text className="text-base font-semibold text-gray-600">
                  Cancel
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text className="text-xl font-bold text-center text-gray-800">
                Your Data
              </Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text className="mb-1 text-base font-bold text-gray-800">
                  Deleted immediately
                </Text>
                <View className="gap-2 mb-4">
                  {DELETED_NOW.map((item) => (
                    <Text
                      key={item}
                      className="text-sm leading-5 text-gray-600"
                    >
                      • {item}
                    </Text>
                  ))}
                </View>

                <Text className="mb-1 text-base font-bold text-gray-800">
                  Retained
                </Text>
                <View className="gap-2">
                  {RETAINED.map((item) => (
                    <Text
                      key={item}
                      className="text-sm leading-5 text-gray-600"
                    >
                      • {item}
                    </Text>
                  ))}
                </View>
              </ScrollView>

              <Pressable
                onPress={() => setView("confirm")}
                className="items-center py-3"
              >
                <Text className="text-base font-semibold text-gray-600">
                  Back
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
