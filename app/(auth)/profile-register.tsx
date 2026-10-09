import CustomKeyAvoidingView from "@/components/CustomKeyAvoid";
import AddressInput from "@/components/inputs/AddressInput";
import { useAllowedDomains } from "@/hooks/useAllowedDomains";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import api from "@/lib/axios";
import { ProfileSchema } from "@/schemas/authSchema";
import { useAppStore } from "@/store/useAppStore";
import { NewUser, UserAddress } from "@/types/user";
import {
  allowedDomainsMessage,
  isAllowedEmailDomain,
} from "@/utils/helpers/emailDomain";
import { openGallery } from "@/utils/helpers/imagePicker";
import { validateForm } from "@/utils/helpers/validateForm";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileRegistration() {
  const [form, setForm] = useState<NewUser>({
    fullName: "",
    address: null,
    gender: "",
    email: "",
    profilePictureUrl: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { isAuthenticated } = useAuthGuard();
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const setLoading = useAppStore((state) => state.setLoading);
  const loading = useAppStore((state) => state.isLoading);
  const allowedDomains = useAllowedDomains();

  const pickProfilePic = async () => {
    const result = await openGallery();
    if (result && !result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedAsset(asset);
      setForm({ ...form, profilePictureUrl: asset.uri });
    }
  };
  const onFormChange = (name: string, value: string) => {
    setForm({ ...form, [name]: value });
  };

  const onAddressChange = useCallback((address: UserAddress) => {
    setForm((prev) => ({ ...prev, address }));
  }, []);

  const onSubmit = async () => {
    const result = validateForm(ProfileSchema, {
      email: form.email,
      fullName: form.fullName,
      address: form.address?.fullAddress,
      street: form.address?.street,
      barangay: form.address?.barangay,
      city: form.address?.city,
      province: form.address?.province,
    });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    if (
      !form.email?.trim() ||
      !isAllowedEmailDomain(form.email, allowedDomains)
    ) {
      setErrors({ email: allowedDomainsMessage(allowedDomains) });
      return;
    }
    setErrors({});

    if (!isAuthenticated()) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("fullName", form.fullName.trim());
    formData.append("gender", form.gender);
    if (form.email) formData.append("email", form.email);
    if (form.address) {
      formData.append("addressName", form.address.name);
      formData.append("addressFullAddress", form.address.fullAddress);
      formData.append("addressLat", String(form.address.coords.lat));
      formData.append("addressLng", String(form.address.coords.lng));
      if (form.address.street)
        formData.append("addressStreet", form.address.street);
      if (form.address.barangay)
        formData.append("addressBarangay", form.address.barangay);
      if (form.address.city) formData.append("addressCity", form.address.city);
      if (form.address.province)
        formData.append("addressProvince", form.address.province);
    }

    if (selectedAsset) {
      formData.append("profilePicture", {
        uri: selectedAsset.uri,
        type: selectedAsset.mimeType || "image/jpeg",
        name: selectedAsset.fileName || "profile.jpg",
      } as any);
    }

    try {
      const response = await api.post("/profile/register-profile", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${useAppStore.getState().token}`,
        },
      });

      if (response.data.success) {
        const user = response.data.user;

        useAppStore.getState().setAuthData({
          name: user.fullName,
          email: user.email,
          registrationStep: user.registrationStep ?? 2,
          approvalStatus: user.approvalStatus ?? "pending",
          profilePictureUrl: user.profilePictureUrl,
          address: user.address,
          gender: user.gender,
        });

        router.replace("/(auth)/id-verification" as Href);
      }
    } catch (error) {
      console.error("Error registering profile:", error);
      Alert.alert("Error", "Failed to register profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <CustomKeyAvoidingView>
        <View className="flex-1 gap-6 p-6">
          <View className="items-center gap-3">
            <Pressable
              className="items-center justify-center border rounded-full size-40 border-lightPrimary active:border-2"
              onPress={pickProfilePic}
            >
              {form.profilePictureUrl ? (
                <View className="items-center justify-center bg-gray-100 rounded-full size-36">
                  <Image
                    source={{ uri: form.profilePictureUrl }}
                    style={{ width: 120, height: 120, borderRadius: 999 }}
                    contentFit="cover"
                  />
                  <Pressable
                    className="absolute right-0 p-1 bg-white rounded-full top-2"
                    onPress={() =>
                      setForm((prev) => ({ ...prev, profilePictureUrl: "" }))
                    }
                  >
                    <Ionicons name="close-outline" size={20} color="red" />
                  </Pressable>
                </View>
              ) : (
                <View className="items-center justify-center bg-gray-100 rounded-full size-36">
                  <Ionicons name="camera" size={24} color="#FFA840" />
                </View>
              )}
            </Pressable>
            <Text className="text-lg font-bold text-gray-700">Profile</Text>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium text-gray-700">
              Full Name <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={form.fullName}
              onChangeText={(text) => onFormChange("fullName", text)}
              placeholder="Enter Name"
              placeholderTextColor="#9CA3AF"
              className={`p-4 text-base bg-gray-100 rounded-lg ${errors.fullName ? "border border-red-500" : ""
                }`}
            />
            {errors.fullName && (
              <Text className="ml-2 text-xs text-red-500">
                {errors.fullName}
              </Text>
            )}
          </View>

          <View>
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Email <Text className="text-red-500">*</Text>
            </Text>

            <TextInput
              value={form.email}
              returnKeyType="done"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(text) => onFormChange("email", text)}
              placeholder="name@gmail.com"
              placeholderTextColor="#9CA3AF"
              className={`px-4 text-gray-800 bg-gray-50 border rounded-xl ${errors.email ? "border-red-500" : "border-gray-200"
                }`}
              style={{ height: Platform.OS === "ios" ? 48 : 46 }}
            />

            {errors.email ? (
              <Text className="mt-1 ml-1 text-xs text-red-500">
                {errors.email}
              </Text>
            ) : (
              <Text className="mt-1 ml-1 text-xs text-gray-400">
                {allowedDomainsMessage(allowedDomains)}.
              </Text>
            )}
          </View>

          <AddressInput
            value={form.address}
            onChange={onAddressChange}
            error={
              errors.address ||
                errors.street ||
                errors.barangay ||
                errors.city ||
                errors.province
                ? "All fields in address are required and must be valid."
                : undefined
            }
          />

          <View className="gap-2">
            <Text className="text-sm font-medium text-gray-700">
              Gender<Text className="text-red-500">*</Text>
            </Text>

            <Dropdown
              dropdownPosition="top"
              style={{
                backgroundColor: "#F3F4F6",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 10,
              }}
              placeholderStyle={{ color: "#9CA3AF" }}
              selectedTextStyle={{ color: "#111827" }}
              data={[
                { label: "Male", value: "male" },
                { label: "Female", value: "female" },
              ]}
              labelField="label"
              valueField="value"
              placeholder="Select Gender"
              value={form.gender}
              onChange={(item) => onFormChange("gender", item.value)}
            />
          </View>
          <View>
            <Pressable
              className="items-center py-4 my-2 rounded-lg bg-lightPrimary active:bg-darkPrimary"
              onPress={onSubmit}
              disabled={loading}
            >
              <Text className="text-base font-bold text-white">Create</Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace("/(drawer)/book")}
              className="items-center py-4 my-2 bg-white border rounded-lg border-lightPrimary active:bg-gray-100"
            >
              <Text className="text-base font-bold text-lightPrimary">
                Skip for now
              </Text>
            </Pressable>
          </View>
        </View>
      </CustomKeyAvoidingView>
    </SafeAreaView>
  );
}
