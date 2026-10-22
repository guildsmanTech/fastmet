import {
  PENDING_REPORTS_AGAINST_ME_KEY,
  usePendingReportsAgainstMeCount,
  useReports,
} from "@/queries/reportQueries";
import {Report} from "@/types/report";
import {Ionicons} from "@expo/vector-icons";
import {useQueryClient} from "@tanstack/react-query";
import {Image} from "expo-image";
import {router} from "expo-router";
import React, {useState} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

type ReportType = "filed" | "received";

export default function MyReportsTab() {
  const [activeType, setActiveType] = useState<ReportType>("filed");
  const queryClient = useQueryClient();
  const {data: pendingAgainstMeCount = 0} = usePendingReportsAgainstMeCount();

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useReports(activeType);

  const reports = data?.pages.flatMap((page) => page.reports) ?? [];

  const handleRefresh = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({queryKey: PENDING_REPORTS_AGAINST_ME_KEY}),
    ]);
  };

  return (
    <View className="flex-1">
      {/* Type Toggle */}
      <View className="flex-row gap-2 px-5 py-3 bg-white">
        <Pressable
          onPress={() => setActiveType("filed")}
          className={`flex-1 py-2 px-4 rounded-xl ${
            activeType === "filed" ? "bg-lightPrimary" : "bg-gray-100"
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              activeType === "filed" ? "text-white" : "text-gray-600"
            }`}
          >
            My Filed Reports
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveType("received")}
          className={`flex-1 py-2 px-4 rounded-xl ${
            activeType === "received" ? "bg-lightPrimary" : "bg-gray-100"
          }`}
        >
          <View className="flex-row justify-center items-center gap-1.5">
            <Text
              className={`text-center font-semibold ${
                activeType === "received" ? "text-white" : "text-gray-600"
              }`}
            >
              Reports Against Me
            </Text>
            {pendingAgainstMeCount > 0 && (
              <View
                className={`size-2 rounded-full ${
                  activeType === "received" ? "bg-white" : "bg-red-500"
                }`}
              />
            )}
          </View>
        </Pressable>
      </View>

      {/* Reports List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FFA840" />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-5">
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text className="mt-4 text-lg font-semibold text-gray-900">
            Failed to load reports
          </Text>
          <Text className="mt-2 text-center text-gray-500">
            {(error as Error).message}
          </Text>
          <Pressable
            onPress={() => handleRefresh()}
            className="px-6 py-3 mt-4 bg-orange-500 rounded-xl"
          >
            <Text className="font-semibold text-white">Retry</Text>
          </Pressable>
        </View>
      ) : reports.length === 0 ? (
        <View className="flex-1 justify-center items-center px-5">
          <Ionicons name="document-outline" size={64} color="#9CA3AF" />
          <Text className="mt-4 text-lg font-semibold text-gray-900">
            No Reports Yet
          </Text>
          <Text className="mt-2 text-center text-gray-500">
            {activeType === "filed"
              ? "You haven't filed any reports"
              : "No reports have been filed against you"}
          </Text>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={reports}
          keyExtractor={(report) => report._id}
          renderItem={({item}) => <ReportCard report={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40}}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={handleRefresh}
              tintColor="#FFA840"
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color="#FFA840" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function ReportCard({report}: {report: Report}) {
  const statusConfig: Record<
    Report["status"],
    {color: string; bg: string; icon: keyof typeof Ionicons.glyphMap}
  > = {
    pending: {color: "#B45309", bg: "#FEF3C7", icon: "time-outline"},
    resolved: {color: "#15803D", bg: "#DCFCE7", icon: "checkmark-circle"},
    dismissed: {color: "#4B5563", bg: "#F3F4F6", icon: "close-circle"},
  };

  const status = statusConfig[report.status];
  const bookingRef =
    typeof report.bookingId === "object" ? report.bookingId.bookingRef : "N/A";

  const penaltyLabel: Record<NonNullable<Report["penaltyApplied"]>, string> = {
    none: "No action",
    warning: "Warning issued",
    suspension: "Suspended",
    deactivation: "Deactivated",
  };

  const hasImages = report.images.length > 0;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(root_screens)/reportDetail",
          params: {reportId: report._id},
        })
      }
      className="p-4 pb-2 mb-3 bg-white rounded-2xl border border-gray-200 active:bg-gray-50"
    >
      {/* Top content */}
      <View className="flex-row gap-2">
        {/* Left content */}
        <View className="flex-1 min-w-0">
          {/* Category + Status */}
          <View className="flex-row items-start">
            <View className="flex-1 min-w-0 pr-2">
              <Text
                className="text-base font-bold text-gray-900"
                numberOfLines={1}
              >
                {report.categoryLabel}
              </Text>

              <Text className="mt-1 text-xs text-gray-500" numberOfLines={1}>
                #{bookingRef}
              </Text>
            </View>

            <View
              className="flex-row shrink-0 items-center gap-1 px-2.5 py-1 rounded-full"
              style={{backgroundColor: status.bg}}
            >
              <Ionicons name={status.icon} size={12} color={status.color} />

              <Text
                className="text-xs font-semibold capitalize"
                style={{color: status.color}}
              >
                {report.status}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text
            className="mt-3 text-sm leading-5 text-gray-600"
            numberOfLines={2}
          >
            {report.description}
          </Text>
        </View>

        {/* Image sneak peek */}
        {hasImages && (
          <View className="overflow-hidden justify-center items-center w-16 h-16 rounded-xl">
            <Image
              source={{uri: report.images[0]}}
              className="w-full h-full"
              style={{
                width: "100%",
                height: "100%",
              }}
              contentFit="cover"
            />
            <View className="absolute inset-0 justify-center items-center bg-black/50">
              <Ionicons name="image" size={14} color="#fff" />
              <Text className="text-xs font-bold text-white">
                {report.images.length}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Footer */}
      <View className="flex-row items-center pt-2 mt-3 border-t border-gray-100">
        <Text className="flex-1 text-xs text-gray-400">
          {new Date(report.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Text>

        <View className="flex-row items-center gap-3">
          {report.penaltyApplied && report.penaltyApplied !== "none" && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="shield-outline" size={13} color="#DC2626" />

              <Text className="text-xs font-medium text-red-600">
                {penaltyLabel[report.penaltyApplied]}
              </Text>
            </View>
          )}

          {report.reply && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="chatbox" size={13} color="#10B981" />

              <Text className="text-xs font-medium text-green-600">
                Replied
              </Text>
            </View>
          )}

          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </View>
      </View>
    </Pressable>
  );
}
