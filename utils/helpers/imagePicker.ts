import { apiUrl } from "@/lib/axios";
import { useAppStore } from "@/store/useAppStore";
import { versionHeaders } from "@/utils/appVersion";
import axios from "axios";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";

export const openGallery = async () => {
  // Android Photo Picker — no READ_MEDIA_* / storage permission needed
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 1,
  });
};

export const takePhoto = async (): Promise<string | null> => {
  // Check current status first
  const { status: currentStatus } =
    await ImagePicker.getCameraPermissionsAsync();

  let finalStatus = currentStatus;

  // Request permission if not already granted
  if (currentStatus !== "granted") {
    const { status: requestedStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    finalStatus = requestedStatus;
  }

  // Only show alert if permission is still denied after request
  if (finalStatus !== "granted") {
    Alert.alert(
      "Camera Permission Required",
      "Please enable camera access in your device settings to take photos.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]
    );
    return null;
  }

  // Take the photo
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  return result.assets[0].uri;
};

export const convertImageToBase64 = async (uri: string): Promise<string> => {
  // First, convert and compress the image (handles HEIC -> JPEG conversion)
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }], // Resize to max 1200px width (keeps aspect ratio)
    {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG, // Force JPEG format
      base64: true,
    }
  );

  const response = await fetch(manipResult.uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const uploadBookingImages = async (
  images: string[],
  bookingRef: string
): Promise<{ success: boolean; images: string[] }> => {
  if (images.length === 0) return { success: true, images: [] };
  const form = new FormData();

  form.append("bookingRef", bookingRef);

  images.forEach((image, index) => {
    form.append("images", {
      uri: image,
      type: "image/jpeg",
      name: `${index}.jpg`,
    } as any);
    form.append("types", `${index}`); // maps to same index
  });

  const res = await axios.post(`${apiUrl}/booking/upload-image`, form, {
    headers: {
      "Content-Type": "multipart/form-data",
      Authorization: `Bearer ${useAppStore.getState().token}`,
      ...versionHeaders(),
    },
  });

  return res.data;
};
