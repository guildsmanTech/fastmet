import NotificationDetailSheet from "@/components/NotificationDetailSheet";
import {useAnnouncements} from "@/queries/announcementQueries";
import {formatLastMessageTime} from "@/utils/helpers/date";
import {getTypeBadgeStyle} from "@/utils/notif";
import {Ionicons} from "@expo/vector-icons";
import {Image} from "expo-image";
import {router} from "expo-router";
import {useState} from "react";
import {ActivityIndicator, FlatList, Pressable, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";

type Tab = "All" | "News";

const ICON_TILE_COLORS: Record<string, {bg: string; icon: string}> = {
  announcement: {bg: "#FFEDD5", icon: "#C2410C"},
  update: {bg: "#DBEAFE", icon: "#1D4ED8"},
  promotion: {bg: "#DCFCE7", icon: "#15803D"},
  alert: {bg: "#FEE2E2", icon: "#B91C1C"},
};
const DEFAULT_TILE = {bg: "#F3F4F6", icon: "#374151"};
const tileFor = (type: string) => ICON_TILE_COLORS[type] ?? DEFAULT_TILE;

export default function AnnouncementsScreen() {
  const [tab, setTab] = useState<Tab>("All");
  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  const {data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading} =
    useAnnouncements();

  const items = (data?.pages.flatMap((p) => p.items) ?? []).filter((item) =>
    tab === "All" ? true : item.source === "news",
  );

  const hasUnreadNews = items.some(
    (item) => item.source === "news" && !item.isRead,
  );

  const renderItem = ({item}: {item: any}) => {
    if (item.source === "news") {
      return (
        <Pressable
          className="flex-row gap-3 px-4 py-3.5 border-b border-gray-100 active:bg-gray-50"
          onPress={() => router.push(`/announcements/news/${item._id}`)}
        >
          <View className="relative">
            <Image
              source={{uri: item.heroImage}}
              style={{width: 72, height: 72, borderRadius: 10}}
              contentFit="cover"
            />

            {!item.isRead && (
              <View className="absolute top-1 right-1 size-2.5 rounded-full bg-green-500 border-2 border-white" />
            )}
          </View>

          <View className="flex-1 justify-center">
            <View className="flex-row gap-2 items-center">
              <View className="px-2 py-0.5 rounded-full bg-orange-100">
                <Text className="text-xs font-medium text-orange-700">
                  {item.tag}
                </Text>
              </View>

              <Text className="text-xs text-gray-400">
                {formatLastMessageTime(item.createdAt)}
              </Text>
            </View>

            <Text
              className="mt-1 font-semibold text-gray-900"
              numberOfLines={1}
            >
              {item.title}
            </Text>

            <Text className="text-sm text-gray-500" numberOfLines={2}>
              {item.excerpt}
            </Text>

            <Text className="mt-1 text-xs text-gray-400">
              {item.readTime} min read
            </Text>
          </View>
        </Pressable>
      );
    }

    const badge = getTypeBadgeStyle(item.type);
    const tile = tileFor(item.type);

    return (
      <Pressable
        className="flex-row gap-3 px-4 py-3.5 border-b border-gray-100 active:bg-gray-50"
        onPress={() => setSelectedNotification(item)}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 10,
            backgroundColor: tile.bg,
          }}
          className="justify-center items-center"
        >
          <Ionicons name={badge.icon} size={30} color={tile.icon} />
          {!item.isRead && (
            <View
              className="absolute bg-green-500 rounded-full size-2.5 border-2 border-white"
              style={{top: 4, right: 4}}
            />
          )}
        </View>
        <View className="flex-1 justify-center">
          <View className="flex-row justify-between items-center">
            <View className={`px-2 py-0.5 rounded-full ${badge.bg}`}>
              <Text className={`text-xs font-medium ${badge.text} capitalize`}>
                {item.type}
              </Text>
            </View>
            <Text className="text-xs text-gray-400">
              {formatLastMessageTime(item.createdAt)}
            </Text>
          </View>
          <Text className="mt-1 font-semibold text-gray-900" numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-sm text-gray-500" numberOfLines={2}>
            {item.message}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row justify-between items-center px-4 py-3">
        <View className="flex-row gap-2">
          {(["All", "News"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className={`relative px-4 py-1.5 rounded-full ${
                tab === t ? "bg-[#FFA840]" : "bg-gray-100"
              }`}
            >
              <Text
                className={
                  tab === t ? "text-white font-medium" : "text-gray-600"
                }
              >
                {t}
              </Text>

              {t === "News" && hasUnreadNews && (
                <View className="absolute top-1 right-1 size-2.5 rounded-full bg-red-500 border-2 border-white" />
              )}
            </Pressable>
          ))}
        </View>

        <Pressable
          className="p-1.5 items-center justify-center active:bg-gray-200 bg-gray-100 rounded-full"
          onPress={() => router.back()}
          hitSlop={20}
        >
          <Ionicons name="close-outline" size={20} color="black" />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-10" />
      ) : items.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <View className="flex-1 justify-center items-center px-8">
            <View className="bg-[#FFF3E0] rounded-full p-5 mb-6">
              <Ionicons
                name={
                  tab === "All"
                    ? "notifications-off-outline"
                    : "newspaper-outline"
                }
                size={54}
                color="#FFA840"
              />
            </View>
            <Text className="mb-2 text-xl font-semibold text-center text-gray-600">
              No {tab === "All" ? "Notifications" : "News"}
            </Text>
            <Text className="text-base text-center text-gray-400">
              Looks like we don&apos;t have any{" "}
              {tab === "All" ? "notifications" : "news"} yet.
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null
          }
        />
      )}

      <NotificationDetailSheet
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
      />
    </SafeAreaView>
  );
}
