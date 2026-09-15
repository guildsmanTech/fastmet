import {useMarkAnnouncementAsRead} from "@/mutations/announcementMutation";
import {getTypeBadgeStyle} from "@/utils/notif";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import {useEffect, useRef} from "react";
import {Dimensions, Text, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";

type Props = {
  notification: any;
  onClose: () => void;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.5;

export default function NotificationDetailSheet({
  notification,
  onClose,
}: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  const {mutate} = useMarkAnnouncementAsRead();

  useEffect(() => {
    if (notification) {
      if (!notification.isRead) {
        mutate({id: notification._id, contentType: "announcement"});
      }
    } else {
      sheetRef.current?.close();
    }
  }, [mutate, notification]);

  if (!notification) return null;

  const badge = getTypeBadgeStyle(notification.type);
  const fullDate = new Date(notification.createdAt).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      enableDynamicSizing
      maxDynamicContentSize={MAX_SHEET_HEIGHT}
      topInset={insets.top}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      )}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: (insets.bottom || 16) + 10,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className={`px-2 py-0.5 rounded-full ${badge.bg}`}>
            <Text className={`text-xs font-medium ${badge.text} capitalize`}>
              {notification.type}
            </Text>
          </View>
          <Text className="text-xs text-gray-400">{fullDate}</Text>
        </View>
        <Text className="mt-3 text-lg font-bold text-gray-900">
          {notification.title}
        </Text>
        <Text className="mt-2 text-base text-gray-600">
          {notification.message}
        </Text>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
