import { AdminBookingActionContent, BookingExpiredContent, DefaultContent, DriverOfferContent, ScheduledAutoAssignedContent, ScheduledAutoAssignWarningContent, ScheduledAutoCancelledContent, ScheduledChooseDriverContent, ScheduledNoDriversContent } from "@/components/NotifContentUI";
import { useMarkNotificationAsRead } from "@/mutations/notification";
import { useNotificationById } from "@/queries/notification";
import { formatDate } from "@/utils/helpers/date";
import { getNotificationConfig, NOTIFICATION_TYPES } from "@/utils/notification";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const NotifViewer = () => {
  const { notificationId } = useLocalSearchParams<{ notificationId: string }>();
  const insets = useSafeAreaInsets();

  const { mutate: markAsRead } = useMarkNotificationAsRead();
  const { data: notification, isPending, error } = useNotificationById(notificationId);


  // Mark as read when viewing
  useEffect(() => {
    if (notification && !notification.isRead && notificationId) {
      markAsRead(notificationId);
    }
  }, [markAsRead, notification, notificationId]);

  if (isPending) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#9CA3AF" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Ionicons name="notifications-off-outline" size={64} color="#9CA3AF" />
        <Text className="mt-4 text-lg text-gray-400">
          {error ? error.message : "Notification not found"}
        </Text>
        <Pressable
          className="px-6 py-3 mt-4 rounded-full bg-primary"
          onPress={() => router.back()}
        >
          <Text className="font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const config = getNotificationConfig(notification.type);

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingBottom: insets.bottom }}
    >
      <View className="p-6">
        {/* Header */}
        <View className="items-center mb-8">
          <View
            className="justify-center items-center mb-4 rounded-full size-16"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Ionicons name={config.icon as any} size={32} color={config.color} />
          </View>
          <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
            {notification.title}
          </Text>
          <Text className="text-sm text-gray-500">
            {formatDate(notification.createdAt)}
          </Text>
        </View>

        {/* Message */}
        <View className="mb-6 px-4">
          <Text className="text-base leading-6 text-gray-600 text-center">
            {notification.message}
          </Text>
        </View>

        {/* Type-specific details */}
        {renderNotificationContent(notification.type, notification.data)}
      </View>
    </ScrollView>
  );
};

export default NotifViewer;

// Type-specific content renderers
// Add new notification types here
const renderNotificationContent = (
  type: NOTIFICATION_TYPES,
  data: Record<string, any> | undefined
) => {
  if (!data) return null;

  switch (type) {
    case "driver_offer":
      return <DriverOfferContent data={data} />;
    case "booking_expired":
      return <BookingExpiredContent data={data} />;
    case "scheduled_choose_driver":
      return <ScheduledChooseDriverContent data={data} />;
    case "scheduled_no_drivers":
      return <ScheduledNoDriversContent data={data} />;
    case "scheduled_auto_assign_warning":
      return <ScheduledAutoAssignWarningContent data={data} />;
    case "scheduled_auto_assigned":
      return <ScheduledAutoAssignedContent data={data} />;
    case "scheduled_auto_cancelled":
      return <ScheduledAutoCancelledContent data={data} />;
    case "driver_started_scheduled_trip":
      return <DefaultContent data={data} />;
    case "booking_cancelled_admin":
    case "booking_cancelled_driver_unavailable":
    case "driver_account_restricted":
    case "booking_force_completed_admin":
    case "voucher_released_admin":
      return <AdminBookingActionContent data={data} />;
    default:
      return <DefaultContent data={data} />;
  }
};
