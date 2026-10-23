import {getActiveRejection} from "@/api/profile";
import RestrictedScreen from "@/components/RestrictedScreen";
import {SUPPORT_EMAIL} from "@/utils/constants";
import {router} from "expo-router";
import React, {useEffect, useState} from "react";
import {Alert, Linking} from "react-native";

export default function VerificationRejectedScreen() {
  const [adminNote, setAdminNote] = useState<string | undefined>();

  useEffect(() => {
    getActiveRejection()
      .then((data) => setAdminNote(data.adminNote))
      .catch(() => setAdminNote(undefined));
  }, []);

  const handleEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() =>
      Alert.alert("Error", "Unable to open mail app."),
    );
  };

  return (
    <RestrictedScreen
      iconName="shield-outline"
      iconColor="#DC2626"
      iconBgClass="bg-red-100"
      title="Verification Not Approved"
      description="We couldn't approve your FastMet account. You can still browse the app, but booking is not available."
      reasonText={adminNote}
      infoBoxText="If you believe this is a mistake, please contact our support team."
      infoBoxVariant="error"
      actions={[
        {
          label: "Email Support",
          icon: "mail-outline",
          onPress: handleEmail,
          variant: "filled",
        },
        {
          label: "Back to home",
          icon: "arrow-back-outline",
          onPress: () => router.replace("/(drawer)/book"),
          variant: "ghost",
        },
      ]}
    />
  );
}
