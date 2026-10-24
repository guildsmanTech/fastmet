import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
} from "@/mutations/notification";
import {useNotifications} from "@/queries/notification";
import {Notification} from "@/types/notification";
import {formatLastMessageTime} from "@/utils/helpers/date";
import {navigateToReportDetail} from "@/utils/helpers/notificationRouting";
import {pushOnce} from "@/utils/helpers/navigation";
import {getNotificationConfig} from "@/utils/notification";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Button,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";

const NotificationScreen = () => {

  const {
    data,
    isPending,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications(15);

  const { mutate: markAllAsRead, isPending: isMarkingAll } =
    useMarkAllNotificationsAsRead();

  const notifications = useMemo(() => {
    return data?.pages
      .flatMap((page) => page?.notifications ?? [])
      .filter((n): n is Notification => Boolean(n)) ?? [];
  }, [data]);

  const hasUnread = notifications.some((n) => n && !n.isRead);

  if (isPending)
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#FFA840" />
      </View>
    );

  if (error)
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-lg font-semibold text-gray-500">
          {error.message}
        </Text>
        <Button title="Retry" onPress={() => refetch()} />
      </View>
    );

  return (
    <View className="flex-1 gap-4 py-4 bg-white">
      {notifications.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <View className="flex-1 items-center justify-center px-8">
            <View className="bg-[#FFF3E0] rounded-full p-5 mb-6">
              <Ionicons name="notifications-off-outline" size={54} color="#FFA840" />
            </View>
            <Text className="text-center text-xl font-semibold text-gray-600 mb-2">
              No Notifications
            </Text>
            <Text className="text-center text-base text-gray-400">
              Looks like you don&apos;t have any notifications yet.
            </Text>
          </View>
        </View>
      ) : (
        <>
          {/* Mark all as read button */}
          {hasUnread && (
            <Pressable
              className="flex-row gap-2 items-center self-end px-4 py-2 mr-4 rounded-full bg-ctaSecondary active:opacity-70"
              onPress={() => markAllAsRead()}
              disabled={isMarkingAll}
            >
              {isMarkingAll ? (
                <ActivityIndicator size="small" color="#FFA840" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color="#FFA840" />
                  <Text className="text-sm font-medium text-darkPrimary">
                    Mark all as read
                  </Text>
                </>
              )}
            </Pressable>
          )}

          <FlatList
            data={notifications}
            // showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <NotificationCard item={item} />}
            keyExtractor={(item, index) => item?._id ?? `notification-${index}`}
            // contentContainerStyle={{ paddingBottom: 60 }}
            // pull to refresh
            refreshing={isPending}
            onRefresh={refetch}
            // infinite scroll
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.3}
            // Loading indicator at bottom
            ListFooterComponent={() => {
              if (isFetchingNextPage) {
                return (
                  <View className="py-4">
                    <ActivityIndicator size="small" color="#FFA840" />
                  </View>
                );
              }
              return null;
            }}
          />
        </>
      )}
    </View>
  );
};

export default NotificationScreen;

const NotificationCard = ({ item }: { item: Notification }) => {
  const config = getNotificationConfig(item.type);
  const {mutate: markAsRead} = useMarkNotificationAsRead();
  const reportId = item.data?.reportId as string | undefined;
  const isReport =
    (item.type === "report" || item.type === "report_reply") && !!reportId;

  return (
    <Pressable
      className={`flex-row items-center gap-4 px-4 py-3 active:bg-ctaSecondary ${!item.isRead ? "bg-orange-50" : ""}`}
      onPress={() => {
        if (!item.isRead) markAsRead(item._id);
        if (isReport && reportId) {
          navigateToReportDetail(reportId);
          return;
        }
        pushOnce({
          pathname: "/(root_screens)/notifViewer",
          params: { notificationId: item._id },
        });
      }}
    >
      <View
        className="justify-center items-center rounded-full size-12"
        style={{ backgroundColor: `${config.color}20` }}
      >
        <Ionicons name={config.icon} size={24} color={config.color} />
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row justify-between items-center">
          <Text
            className={`max-w-[70%] ${!item.isRead ? "font-bold" : "font-semibold"}`}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <View className="flex-row gap-1 items-center">
            {!item.isRead && (
              <View className="bg-orange-500 rounded-full size-2" />
            )}
            <Text className="text-xs text-gray-400">
              {formatLastMessageTime(item.createdAt)}
            </Text>
          </View>
        </View>
        <Text
          className={`text-sm max-w-[90%] ${!item.isRead ? "text-gray-700" : "text-gray-500"}`}
          numberOfLines={2}
        >
          {item.message}
        </Text>
      </View>
    </Pressable>
  );
};
