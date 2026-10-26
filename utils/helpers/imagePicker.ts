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

export type PickedImage = { uri: string; width: number; height: number };

/** Camera with the permission flow; null when denied or cancelled. */
export const takePhotoAsset = async (): Promise<PickedImage | null> => {
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

  const { uri, width, height } = result.assets[0];
  return { uri, width, height };
};

export const takePhoto = async (): Promise<string | null> =>
  (await takePhotoAsset())?.uri ?? null;

/** One image for a chat message, from the camera or the photo library. */
export const pickChatImage = async (
  source: "camera" | "gallery"
): Promise<PickedImage | null> => {
  if (source === "camera") return takePhotoAsset();

  const result = await openGallery();
  if (result.canceled || !result.assets?.[0]) return null;
  const { uri, width, height } = result.assets[0];
  return { uri, width, height };
};

const CHAT_IMAGE_MAX_SIDE = 1600;

/**
 * JPEG file for a chat upload: longest side capped (never enlarged), so tall
 * screenshots stay small too. Also converts HEIC.
 */
export const prepareChatImage = async ({
  uri,
  width,
  height,
}: PickedImage): Promise<string> => {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > CHAT_IMAGE_MAX_SIDE) {
    context.resize(
      width >= height
        ? { width: CHAT_IMAGE_MAX_SIDE }
        : { height: CHAT_IMAGE_MAX_SIDE }
    );
  }
  const imageRef = await context.renderAsync();
  const result = await imageRef.saveAsync({
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
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
