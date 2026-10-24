import RestrictedScreen from "@/components/RestrictedScreen";
import { SUPPORT_EMAIL } from "@/utils/constants";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Linking } from "react-native";

export default function AccountBannedScreen() {
  const { banReason } = useLocalSearchParams<{ banReason?: string }>();

  const handleEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() =>
      Alert.alert("Error", "Unable to open mail app."),
    );
  };

  return (
    <RestrictedScreen
      iconName="ban-outline"
      iconColor="#DC2626"
      iconBgClass="bg-red-100"
      title="Account Banned"
      description="Your Fastmet account has been banned by an administrator."
      reasonText={banReason || undefined}
      infoBoxText="You cannot sign in or receive OTP with this account unless the ban is lifted. If you believe this is a mistake, please contact our support team."
      infoBoxVariant="error"
      actions={[
        {
          label: "Email Support",
          icon: "mail-outline",
          onPress: handleEmail,
          variant: "filled",
        },
        {
          label: "Go back to login",
          icon: "arrow-back-outline",
          onPress: () => router.replace("/(auth)/auth"),
          variant: "ghost",
        },
      ]}
    />
  );
}
