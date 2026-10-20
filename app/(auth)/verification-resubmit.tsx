import {getActiveRejection, resubmitRejectedFields} from "@/api/profile";
import CaptureCard from "@/components/CaptureCard";
import CustomKeyAvoidingView from "@/components/CustomKeyAvoid";
import {useAuth} from "@/hooks/useAuth";
import {useAuthGuard} from "@/hooks/useAuthGuard";
import {useAppStore} from "@/store/useAppStore";
import {takePhoto} from "@/utils/helpers/imagePicker";
import {Ionicons} from "@expo/vector-icons";
import {router} from "expo-router";
import React, {useEffect, useState} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {SafeAreaView, useSafeAreaInsets} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const IMAGE_FIELDS = new Set([
  "images.idImage",
  "images.selfieWithId",
  "profilePictureUrl",
]);

const FIELD_LABELS: Record<string, string> = {
  "images.idImage": "Any ID with your name and photo",
  "images.selfieWithId": "Selfie with ID",
  profilePictureUrl: "Profile picture",
  fullName: "Full name",
  gender: "Gender",
};

export default function VerificationResubmit() {
  const inset = useSafeAreaInsets();
  const {isAuthenticated} = useAuthGuard();
  const {isLoggedIn} = useAuth();
  const setLoading = useAppStore((state) => state.setLoading);
  const loading = useAppStore((state) => state.isLoading);
  const name = useAppStore((state) => state.name);
  const gender = useAppStore((state) => state.gender);

  const [adminNote, setAdminNote] = useState("");
  const [flaggedFields, setFlaggedFields] = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [imageUris, setImageUris] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated()) {
        setFetching(false);
        return;
      }

      try {
        const data = await getActiveRejection();
        setAdminNote(data.adminNote);
        setFlaggedFields(data.flaggedFields);
        setTextValues({
          fullName: name ?? "",
          gender: gender ?? "",
        });
      } catch (error) {
        console.error("Failed to load rejection:", error);
        Alert.alert("Error", "No active rejection found.");
        router.replace("/(drawer)/book");
      } finally {
        setFetching(false);
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, isLoggedIn, name]);

  const captureImage = async (field: string) => {
    const uri = await takePhoto();
    if (uri) {
      setImageUris((prev) => ({...prev, [field]: uri}));
    }
  };

  const onSubmit = async () => {
    if (!isAuthenticated()) return;

    const payload: Record<
      string,
      string | {uri: string; type?: string; name?: string}
    > = {};

    for (const field of flaggedFields) {
      if (IMAGE_FIELDS.has(field)) {
        const uri = imageUris[field];
        if (!uri) {
          Alert.alert(
            "Missing photo",
            `Please capture: ${FIELD_LABELS[field] ?? field}`,
          );
          return;
        }
        payload[field] = {
          uri,
          type: "image/jpeg",
          name: `${field}.jpg`,
        };
      } else {
        const value = textValues[field]?.trim();
        if (!value) {
          Alert.alert(
            "Missing field",
            `Please fill in: ${FIELD_LABELS[field] ?? field}`,
          );
          return;
        }
        payload[field] = value;
      }
    }

    setLoading(true);
    try {
      const data = await resubmitRejectedFields(payload);
      if (data.success) {
        useAppStore.getState().setAuthData({approvalStatus: "pending"});

        Toast.show({
          type: "info",
          text1: "Resubmitted",
          text2: "Your documents are under review again.",
          position: "top",
          visibilityTime: 5000,
          topOffset: 50,
        });

        router.replace("/(drawer)/book");
      }
    } catch (error) {
      console.error("Resubmit error:", error);
      Alert.alert("Submit failed", "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <SafeAreaView className="items-center justify-center flex-1 bg-white">
        <ActivityIndicator size="large" color="#FFA840" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: "#fff"}}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.replace("/(drawer)/book")}
          hitSlop={20}
        >
          <Ionicons name="chevron-back" size={28} color="#FFA840" />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-center mr-7">
          Resubmit Verification
        </Text>
      </View>

      <CustomKeyAvoidingView>
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{paddingBottom: inset.bottom + 120, gap: 20}}
        >
          {adminNote ? (
            <View className="p-4 rounded-lg bg-red-50 border border-red-200">
              <Text className="text-sm font-semibold text-red-700">
                Admin note
              </Text>
              <Text className="mt-1 text-sm text-red-600">{adminNote}</Text>
            </View>
          ) : null}

          {flaggedFields.map((field) => {
            if (IMAGE_FIELDS.has(field)) {
              return (
                <CaptureCard
                  key={field}
                  label={FIELD_LABELS[field] ?? field}
                  uri={imageUris[field] ?? null}
                  onCapture={() => captureImage(field)}
                  onClear={() =>
                    setImageUris((prev) => {
                      const next = {...prev};
                      delete next[field];
                      return next;
                    })
                  }
                />
              );
            }

            return (
              <View key={field} className="gap-2">
                <Text className="text-sm font-medium text-gray-700">
                  {FIELD_LABELS[field] ?? field}{" "}
                  <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  value={textValues[field] ?? ""}
                  onChangeText={(text) =>
                    setTextValues((prev) => ({...prev, [field]: text}))
                  }
                  className="p-4 text-base bg-gray-100 rounded-lg"
                  placeholder={`Enter ${FIELD_LABELS[field] ?? field}`}
                />
              </View>
            );
          })}
        </ScrollView>
      </CustomKeyAvoidingView>

      <View
        className="absolute left-0 right-0 mx-6 bg-white"
        style={{bottom: inset.bottom + 10}}
      >
        <Pressable
          className={`items-center py-4 my-2 rounded-lg bg-lightPrimary active:bg-darkPrimary ${!imageUris["images.idImage"] || !imageUris["images.selfieWithId"] || !textValues["fullName"] || !textValues["gender"] ? "opacity-50" : ""}`}
          onPress={onSubmit}
          disabled={
            loading ||
            !imageUris["images.idImage"] ||
            !imageUris["images.selfieWithId"] ||
            !textValues["fullName"] ||
            !textValues["gender"]
          }
        >
          <Text className="text-base font-bold text-white">
            {loading ? "Resubmitting..." : "Resubmit"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
