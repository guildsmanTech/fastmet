import CustomKeyAvoidingView from "@/components/CustomKeyAvoid";
import AddressInput from "@/components/inputs/AddressInput";
import {useAllowedDomains} from "@/hooks/useAllowedDomains";
import {useAuthGuard} from "@/hooks/useAuthGuard";
import api from "@/lib/axios";
import {ProfileSchema} from "@/schemas/authSchema";
import {useAppStore} from "@/store/useAppStore";
import {NewUser, UserAddress} from "@/types/user";
import {
  allowedDomainsMessage,
  isAllowedEmailDomain,
} from "@/utils/helpers/emailDomain";
import {openGallery} from "@/utils/helpers/imagePicker";
import {validateForm} from "@/utils/helpers/validateForm";
import {Ionicons} from "@expo/vector-icons";
import {Image} from "expo-image";
import {router, useFocusEffect} from "expo-router";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {
  findNodeHandle,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import {Dropdown} from "react-native-element-dropdown";
import {SafeAreaView, useSafeAreaInsets} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const EditProfile = () => {
  const {isAuthenticated} = useAuthGuard();
  const allowedDomains = useAllowedDomains();

  const inset = useSafeAreaInsets();

  const numRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [form, setForm] = useState<NewUser>({
    fullName: "",
    address: null,
    gender: "",
    profilePictureUrl: "",
    email: "",
  });
  // Store original values to compare against
  const [originalForm, setOriginalForm] = useState<NewUser>({
    fullName: "",
    address: null,
    gender: "",
    profilePictureUrl: "",
    email: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const setLoading = useAppStore((state) => state.setLoading);
  const loading = useAppStore((state) => state.isLoading);

  const name = useAppStore((state) => state.name);
  const profilePictureUrl = useAppStore((state) => state.profilePictureUrl);
  const address = useAppStore((state) => state.address);
  const gender = useAppStore((state) => state.gender);
  const email = useAppStore((state) => state.email);

  const input1Ref = useRef<TextInput>(null);

  useEffect(() => {
    const initialData = {
      fullName: name,
      profilePictureUrl: profilePictureUrl,
      address: address,
      gender: gender || "",
      email: email || "",
    };

    setForm(initialData);
    setOriginalForm(initialData); // Store original values
  }, [name, profilePictureUrl, address, gender, email]);

  // Track keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => setKeyboardVisible(true),
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => setKeyboardVisible(false),
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      // optional: reset on focus
      // setErrors({});

      return () => {
        // this runs when screen is unfocused (leaving)
        setErrors({});
      };
    }, []),
  );

  // Check if form has changes
  const hasChanges = () => {
    // Check if image was deleted
    if (
      form.profilePictureUrl === "" &&
      originalForm.profilePictureUrl !== ""
    ) {
      return true;
    }

    // Check if new image was selected
    if (selectedAsset) {
      return true;
    }

    // Check text fields
    const addressChanged =
      (form.address?.fullAddress || "") !==
      (originalForm.address?.fullAddress || "");
    return (
      form.fullName !== originalForm.fullName ||
      addressChanged ||
      form.gender !== originalForm.gender ||
      form.email !== originalForm.email
    );
  };

  const isButtonDisabled = loading || !hasChanges();

  const onFormChange = (name: string, value: string) => {
    setForm({...form, [name]: value});
  };

  const onAddressChange = useCallback((address: UserAddress) => {
    setForm((prev) => ({...prev, address}));
  }, []);

  const scrollToInput = (ref: React.RefObject<TextInput | null>) => {
    setTimeout(() => {
      if (ref.current && scrollRef.current) {
        const node = findNodeHandle(ref.current);
        if (node) {
          UIManager.measureLayout(
            node,
            findNodeHandle(scrollRef.current) as number,
            () => {},
            (x, y) => {
              scrollRef.current?.scrollTo({y: y, animated: true});
            },
          );
        }
      }
    }, 100);
  };
  const pickProfilePic = async () => {
    setLoading(true);
    const result = await openGallery();
    if (result && !result.canceled && result.assets[0]) {
      setSelectedAsset(result.assets[0]); // Store the asset
      setForm({...form, profilePictureUrl: result.assets[0].uri});
    }
    setLoading(false);
  };

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
      setErrors({email: allowedDomainsMessage(allowedDomains)});
      return;
    }
    setErrors({});

    if (!isAuthenticated()) return;

    setLoading(true);

    const formData = new FormData();
    formData.append("fullName", form.fullName);
    formData.append("gender", form.gender);
    formData.append("email", form.email || "");
    // Send structured address data
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

    // Handle profile picture deletion
    if (!form.profilePictureUrl) {
      formData.append("deleteProfilePicture", "true");
    }
    // Handle new profile picture upload
    else if (selectedAsset) {
      formData.append("profilePicture", {
        uri: selectedAsset.uri,
        type: selectedAsset.mimeType || "image/jpeg",
        name: selectedAsset.fileName || "profile.jpg",
      } as any);
    }

    try {
      const response = await api.patch("/profile/update-profile", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${useAppStore.getState().token}`,
        },
      });

      if (response.data.success) {
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "Profile updated successfully",
          position: "top",
          visibilityTime: 5_000,
          swipeable: true,
          topOffset: 50,
        });

        const updatedData = {
          name: response.data.user.fullName,
          profilePictureUrl: response.data.user.profilePictureUrl || "",
          address: response.data.user.address,
          gender: response.data.user.gender,
          email: response.data.user.email,
        };

        useAppStore.getState().setAuthData(updatedData);

        router.back();
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2:
          error.response?.data?.message ||
          "Failed to update profile. Please try again.",
        position: "top",
        visibilityTime: 5_000,
        swipeable: true,
        topOffset: 50,
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate bottom padding based on keyboard visibility
  const bottomPadding = keyboardVisible ? inset.bottom + 80 : 200;

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: "#fff"}} edges={["bottom"]}>
      <CustomKeyAvoidingView ref={scrollRef}>
        <View
          className="flex-1 gap-6 px-6 pt-6"
          style={{paddingBottom: bottomPadding}}
        >
          {/* profile picture */}
          <Pressable
            className="border border-[#FFA840] rounded-full p-2 self-center active:bg-gray-100"
            onPress={pickProfilePic}
          >
            {form.profilePictureUrl ? (
              <Image
                source={{uri: form.profilePictureUrl}}
                style={{width: 128, height: 128, borderRadius: 999}}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="person-circle" size={128} color="#F7931E" />
            )}

            {form.profilePictureUrl && (
              <Pressable
                className="absolute p-1 bg-white rounded-full top-2 right-2"
                onPress={() =>
                  setForm((prev) => ({...prev, profilePictureUrl: ""}))
                }
              >
                <Ionicons name="close-outline" size={24} color="red" />
              </Pressable>
            )}

            <View
              className="absolute p-2 bg-white rounded-full right-2 bottom-2"
              style={{
                shadowColor: "#000", // color of the shadow
                shadowOffset: {width: 0, height: 2}, // x/y offset
                shadowOpacity: 0.25, // opacity 0–1
                shadowRadius: 3.84, // blur radius
                elevation: 5, // Android only
              }}
            >
              <Ionicons name="camera" size={24} color="#FFA840" />
            </View>
          </Pressable>

          {/* full name */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-gray-700">
              Full Name <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              ref={input1Ref}
              onFocus={() => scrollToInput(input1Ref)}
              value={form.fullName}
              onChangeText={(text) => onFormChange("fullName", text)}
              onSubmitEditing={() => numRef.current?.focus()}
              returnKeyType="next"
              submitBehavior="submit"
              placeholder="Enter Name"
              placeholderTextColor="#9CA3AF"
              className={`p-4 text-base bg-gray-100 rounded-lg ${
                errors.fullName ? "border border-red-500" : ""
              }`}
            />
            {errors.fullName && (
              <Text className="ml-2 text-xs text-red-500">
                {errors.fullName}
              </Text>
            )}
          </View>

          {/* Email */}
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
              className={`px-4 text-gray-800 bg-gray-50 border rounded-xl ${
                errors.email ? "border-red-500" : "border-gray-200"
              }`}
              style={{height: Platform.OS === "ios" ? 48 : 46}}
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

          {/* Address */}
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

          {/* Gender Dropdown */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-gray-700">Gender</Text>

            <Dropdown
              style={{
                backgroundColor: "#F3F4F6",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 10,
              }}
              placeholderStyle={{color: "#9CA3AF", fontSize: 14}}
              selectedTextStyle={{color: "#111827"}}
              data={[
                {label: "Male", value: "male"},
                {label: "Female", value: "female"},
              ]}
              dropdownPosition="top"
              labelField="label"
              valueField="value"
              placeholder="Select Gender"
              value={form.gender}
              onChange={(item) => onFormChange("gender", item.value)}
            />
          </View>
        </View>
      </CustomKeyAvoidingView>

      {/* Fixed buttons at bottom - only show when keyboard is hidden */}
      {!keyboardVisible && (
        <View
          className="absolute left-0 right-0 px-6 bg-white border-t border-gray-100"
          style={{
            bottom: inset.bottom,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <Pressable
            className={`items-center py-4 rounded-lg bg-lightPrimary  ${isButtonDisabled || form.fullName === "" ? "opacity-65" : "active:bg-darkPrimary"}`}
            disabled={isButtonDisabled || form.fullName === ""}
            onPress={onSubmit}
          >
            <Text className="text-base font-bold text-white">
              Update Profile
            </Text>
          </Pressable>
          <Pressable
            className="items-center py-4 my-2 border-gray-200 rounded-lg bg-ctaSecondary active:bg-ctaSecondaryActive"
            onPress={() => router.back()}
          >
            <Text className="text-base font-bold">Back</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
};

export default EditProfile;
