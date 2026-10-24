import { NotificationContent } from "@/components/NotifContentUI";
import { useMarkNotificationAsRead } from "@/mutations/notification";
import { useNotificationById } from "@/queries/notification";
import { formatDate } from "@/utils/helpers/date";
import { navigateToReportDetail } from "@/utils/helpers/notificationRouting";
import { getNotificationConfig, NotificationAction } from "@/utils/notification";
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

  if (isPending && notificationId) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#9CA3AF" />
      </View>
    );
  }

  if (error || !notification) {
    return (
      <View className="flex-1 justify-center items-center px-8 bg-white">
        <Ionicons name="notifications-off-outline" size={64} color="#9CA3AF" />
        <Text className="mt-4 text-lg text-center text-gray-400">
          {error ? error.message : "Notification not found"}
        </Text>
        <Pressable
          className="px-6 py-3 mt-4 rounded-full bg-darkPrimary active:opacity-80"
          onPress={() => router.back()}
        >
          <Text className="font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const config = getNotificationConfig(notification.type);
  const reportId = notification.data?.reportId as string | undefined;

  const runAction = (action: NotificationAction) => {
    if ("opensReport" in action) {
      if (reportId) navigateToReportDetail(reportId);
      return;
    }
    router.dismissTo(action.href);
  };
  const action =
    config.action && ("opensReport" in config.action ? !!reportId : true)
      ? config.action
      : undefined;

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
    >
      <View className="p-6">
        {/* Header */}
        <View className="items-center mb-6">
          <View
            className="justify-center items-center mb-4 rounded-full size-16"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Ionicons name={config.icon} size={32} color={config.color} />
          </View>
          <View
            className="px-3 py-1 mb-3 rounded-full"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: config.color }}
            >
              {config.label}
            </Text>
          </View>
          <Text className="mb-2 text-2xl font-bold text-center text-gray-900">
            {notification.title}
          </Text>
          <Text className="text-sm text-gray-500">
            {formatDate(notification.createdAt)}
          </Text>
        </View>

        {/* Message */}
        <View className="px-4 mb-6">
          <Text className="text-base leading-6 text-center text-gray-600">
            {notification.message}
          </Text>
        </View>

        {/* Type-specific details */}
        {notification.data && (
          <NotificationContent
            type={notification.type}
            data={notification.data}
            color={config.color}
          />
        )}

        {action && (
          <Pressable
            className="flex-row gap-2 justify-center items-center py-4 mt-6 rounded-2xl active:opacity-80"
            style={{ backgroundColor: config.color }}
            onPress={() => runAction(action)}
          >
            <Text className="text-base font-semibold text-white">
              {action.label}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
};

export default NotifViewer;
