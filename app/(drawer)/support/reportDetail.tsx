import {reportAPI} from "@/api/reports";
import CustomKeyAvoidingView from "@/components/CustomKeyAvoid";
import ImageViewer from "@/components/ImageViewer";
import {useReplyToReportMutation} from "@/mutations/reportMutation";
import {Ionicons} from "@expo/vector-icons";
import {useQuery} from "@tanstack/react-query";
import {Image} from "expo-image";
import {router, useLocalSearchParams} from "expo-router";
import React, {useState} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const STATUS_CONFIG = {
  pending: {color: "#B45309", bg: "#FEF3C7", icon: "time-outline" as const},
  resolved: {
    color: "#15803D",
    bg: "#DCFCE7",
    icon: "checkmark-circle" as const,
  },
  dismissed: {color: "#4B5563", bg: "#F3F4F6", icon: "close-circle" as const},
};

export default function ReportDetailScreen() {
  const {reportId} = useLocalSearchParams<{reportId: string}>();
  const [replyMessage, setReplyMessage] = useState("");
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const {data, isLoading, error, refetch} = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => reportAPI.getReportById(reportId!),
    enabled: !!reportId,
  });

  const report = data?.report;
  const replyMutation = useReplyToReportMutation();

  const handleSubmitReply = () => {
    if (!replyMessage.trim()) {
      Toast.show({
        type: "error",
        text1: "Required",
        text2: "Please enter a reply message",
      });
      return;
    }
    if (replyMessage.length > 2000) {
      Toast.show({
        type: "error",
        text1: "Too Long",
        text2: "Reply must be 2000 characters or less",
      });
      return;
    }

    Alert.alert(
      "Submit Reply?",
      "You can only reply once. Make sure your message is complete.",
      [
        {text: "Cancel", style: "cancel"},
        {
          text: "Submit",
          onPress: () => {
            replyMutation.mutate(
              {id: reportId!, message: replyMessage.trim()},
              {
                onSuccess: () => {
                  setReplyMessage("");
                  refetch();
                },
              },
            );
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FFA840" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !report) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
        <View className="flex-1 justify-center items-center px-5">
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text className="mt-4 text-lg font-semibold text-gray-900">
            Failed to load report
          </Text>
          <Pressable
            onPress={() => refetch()}
            className="px-6 py-3 mt-4 bg-orange-500 rounded-xl"
          >
            <Text className="font-semibold text-white">Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS_CONFIG[report.status];
  const canReply = report.reportedAgainst === "client" && report.reply === null;
  const reportImages = report.images ?? [];
  const bookingStatus =
    typeof report.bookingId === "object" ? report.bookingId.status : "N/A";

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <CustomKeyAvoidingView>
        <View className="flex-1 px-5 py-3">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(drawer)/support");
                }
              }}
              className="p-2 -ml-2"
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </Pressable>
            <View
              className="flex-row items-center gap-1 px-3 py-1 rounded-full"
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

          <Text className="mb-1 text-2xl font-bold text-gray-900">
            {report.categoryLabel}
          </Text>
          <View className="flex-row items-center mb-6">
            <Text className="text-sm text-gray-500">
              Report ID: {report.reportId}
            </Text>
          </View>

          {/* Booking Info */}
          <View className="p-4 mb-4 bg-white rounded-xl">
            <Text className="mb-1 text-xs font-semibold text-gray-500">
              BOOKING
            </Text>
            <View className="flex-row justify-between items-center">
              <Text className="text-base font-semibold text-gray-900">
                {typeof report.bookingId === "object"
                  ? report.bookingId.bookingRef
                  : "N/A"}
              </Text>
              <Text className="text-xs font-medium text-gray-600 capitalize">
                {bookingStatus}
              </Text>
            </View>
          </View>

          {/* Report Details */}
          <View className="p-4 mb-4 bg-white rounded-xl">
            <Text className="mb-2 text-xs font-semibold text-gray-500">
              DESCRIPTION
            </Text>
            <Text className="leading-6 text-gray-900">
              {report.description}
            </Text>

            {reportImages.length > 0 && (
              <View className="mt-4">
                <Text className="mb-2 text-xs font-semibold text-gray-500">
                  ATTACHED PHOTOS ({reportImages.length})
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{gap: 8}}
                >
                  {reportImages.map((img, index) => (
                    <Pressable
                      key={index}
                      onPress={() => {
                        setImageIndex(index);
                        setImageViewerVisible(true);
                      }}
                    >
                      <Image
                        source={{uri: img}}
                        style={{width: 128, height: 128}}
                        contentFit="cover"
                        className="rounded-lg"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text className="mt-4 text-xs text-gray-400">
              Filed on{" "}
              {new Date(report.createdAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
          </View>

          {/* Reply Section */}
          {report.reply ? (
            <View className="p-4 mb-4 bg-blue-50 rounded-xl border border-blue-200">
              <View className="flex-row items-center mb-2">
                <Ionicons name="chatbox" size={16} color="#3B82F6" />
                <Text className="ml-1 text-xs font-semibold text-blue-700">
                  REPLY FROM {report.reply.repliedBy.toUpperCase()}
                </Text>
              </View>
              <Text className="leading-6 text-gray-900">
                {report.reply.message}
              </Text>
              <Text className="mt-2 text-xs text-blue-600">
                Replied on{" "}
                {new Date(report.reply.repliedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
          ) : canReply ? (
            <View className="flex-col gap-3 p-4 mb-4 bg-white rounded-xl">
              <Text className="text-sm font-semibold text-gray-700">
                Submit Your Reply (One-Time Only)
              </Text>
              <View className="overflow-hidden bg-white rounded-xl border border-gray-200">
                <TextInput
                  value={replyMessage}
                  onChangeText={setReplyMessage}
                  placeholder="Explain your side of the story..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  maxLength={2000}
                  className="p-4 text-gray-900 min-h-[140px]"
                />
                <View className="flex-row justify-end items-center px-4 py-2 bg-gray-50 border-t border-gray-100">
                  <Text
                    className={`text-xs ${
                      replyMessage.length >= 1900
                        ? "text-orange-500"
                        : "text-gray-400"
                    }`}
                  >
                    {replyMessage.length}/2000
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleSubmitReply}
                disabled={replyMutation.isPending || !replyMessage.trim()}
                className={`p-3 rounded-xl items-center ${
                  replyMutation.isPending || !replyMessage.trim()
                    ? "bg-gray-300"
                    : "bg-lightPrimary active:bg-darkPrimary"
                }`}
              >
                {replyMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="py-1 font-bold text-white">
                    Submit Reply
                  </Text>
                )}
              </Pressable>

              <View className="flex-row gap-2 items-start p-3 bg-amber-50 rounded-lg">
                <Ionicons name="warning-outline" size={14} color="#B45309" />
                <Text className="flex-1 text-xs text-amber-700">
                  You can only reply once. Admin will review both sides before
                  taking action.
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex-row gap-2 justify-center items-center p-4 mb-4 bg-gray-100 rounded-xl">
              <Ionicons name="hourglass-outline" size={16} color="#6B7280" />
              <Text className="text-sm text-center text-gray-600">
                {report.reportedAgainst === "client"
                  ? "Waiting for reply or admin review"
                  : "Reported party has not replied yet"}
              </Text>
            </View>
          )}

          {/* Admin Notes (if resolved) */}
          {report.status !== "pending" && report.adminNotes && (
            <View className="p-4 mb-4 bg-gray-900 rounded-xl">
              <Text className="mb-2 text-xs font-semibold text-gray-400">
                ADMIN RESOLUTION
              </Text>
              <Text className="leading-6 text-white">{report.adminNotes}</Text>
              {report.penaltyApplied && report.penaltyApplied !== "none" && (
                <View className="flex-row justify-between items-center pt-3 mt-3 border-t border-gray-700">
                  <Text className="text-xs text-gray-400">Penalty applied</Text>
                  <Text className="text-sm font-semibold text-red-400 capitalize">
                    {report.penaltyApplied}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </CustomKeyAvoidingView>

      <ImageViewer
        images={reportImages.map((uri) => ({uri}))}
        imageIndex={imageIndex}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
        showCounter={reportImages.length > 1}
      />
    </SafeAreaView>
  );
}
