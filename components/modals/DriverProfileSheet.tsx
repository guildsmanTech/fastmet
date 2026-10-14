import ImageViewer from "@/components/ImageViewer";
import StarDisplay from "@/components/StarDisplay";
import {Driver} from "@/types/book";
import {Ionicons} from "@expo/vector-icons";
import {Image} from "expo-image";
import {useMemo, useState} from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  driver: Driver | null;
  onClose: () => void;
};

export default function DriverProfileSheet({visible, driver, onClose}: Props) {
  const insets = useSafeAreaInsets();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const vehicleImages = useMemo(
    () => (driver?.vehicleImages ?? []).filter(Boolean),
    [driver?.vehicleImages],
  );

  const profilePictureUrl = driver?.profilePictureUrl || "";

  /** Profile first (when present), then vehicle photos — one swipeable gallery. */
  const viewerSources = useMemo(() => {
    const urls = [
      ...(profilePictureUrl ? [profilePictureUrl] : []),
      ...vehicleImages,
    ];
    return urls.map((uri) => ({uri}));
  }, [profilePictureUrl, vehicleImages]);

  const profileViewerIndex = profilePictureUrl ? 0 : -1;
  const vehicleViewerOffset = profilePictureUrl ? 1 : 0;

  const openViewer = (index: number) => {
    if (index < 0 || index >= viewerSources.length) return;
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const closeAll = () => {
    setViewerVisible(false);
    onClose();
  };

  const totalBookings = driver?.totalBookings ?? 0;

  return (
    <>
      <Modal
        visible={visible && !!driver}
        animationType="slide"
        transparent
        onRequestClose={closeAll}
      >
        {driver ? (
          <View className="justify-end flex-1 bg-black/50">
            <Pressable
              className="flex-1"
              onPress={closeAll}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Close driver profile"
            />

            <View
              className="max-h-[85%] rounded-t-3xl bg-white"
              style={{paddingBottom: insets.bottom || 16}}
            >
              <View className="items-center justify-center py-4 border-b border-gray-200">
                <Pressable
                  onPress={closeAll}
                  className="absolute left-5"
                  hitSlop={20}
                >
                  <Ionicons
                    name="chevron-back"
                    size={Platform.OS === "ios" ? 32 : 28}
                    color="#6B7280"
                  />
                </Pressable>
                <Text className="text-xl font-bold text-gray-900">
                  Driver Profile
                </Text>
              </View>

              <ScrollView
                className="px-6"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{paddingTop: 24, paddingBottom: 24}}
              >
                <View className="items-center pb-6">
                  {profilePictureUrl ? (
                    <Pressable
                      className="overflow-hidden w-28 h-28 rounded-full border-2 border-orange-100 active:opacity-90"
                      onPress={() => openViewer(profileViewerIndex)}
                    >
                      <Image
                        source={{uri: profilePictureUrl}}
                        style={{width: "100%", height: "100%"}}
                        contentFit="cover"
                      />
                    </Pressable>
                  ) : (
                    <Ionicons name="person-circle" size={112} color="#F7931E" />
                  )}
                  <Text className="mt-4 text-2xl font-bold text-gray-900 capitalize">
                    {driver.name}
                  </Text>
                  <View className="flex-row gap-2 items-center mt-2">
                    <StarDisplay rating={driver.rating} />
                    <Text className="text-sm font-semibold text-gray-600">
                      {Number(driver.rating).toFixed(1)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1 p-4 rounded-2xl bg-orange-50">
                    <View className="flex-row items-center gap-2 mb-2">
                      <Ionicons name="car-outline" size={18} color="#F7931E" />
                      <Text className="text-xs font-semibold tracking-wide text-orange-600 uppercase">
                        Plate
                      </Text>
                    </View>
                    <Text className="text-lg font-bold tracking-widest text-gray-900">
                      {driver.plateNumber || "N/A"}
                    </Text>
                  </View>

                  <View className="flex-1 p-4 rounded-2xl bg-gray-50">
                    <View className="flex-row items-center gap-2 mb-2">
                      <Ionicons
                        name="checkmark-done-outline"
                        size={18}
                        color="#6B7280"
                      />
                      <Text className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                        Completed
                      </Text>
                    </View>
                    <Text className="text-lg font-bold text-gray-900">
                      {totalBookings}
                      <Text className="text-sm font-semibold text-gray-500">
                        {" "}
                        trip{totalBookings === 1 ? "" : "s"}
                      </Text>
                    </Text>
                  </View>
                </View>

                <View className="p-4 rounded-2xl bg-gray-50">
                  <Text className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    Vehicle Photos
                  </Text>
                  {vehicleImages.length > 0 ? (
                    <View className="flex-row gap-3">
                      {vehicleImages.map((uri, index) => (
                        <Pressable
                          key={`${uri}-${index}`}
                          className="overflow-hidden flex-1 bg-white rounded-xl active:opacity-90"
                          style={{aspectRatio: 4 / 3}}
                          onPress={() =>
                            openViewer(index + vehicleViewerOffset)
                          }
                        >
                          <Image
                            source={{uri}}
                            style={{width: "100%", height: "100%"}}
                            contentFit="cover"
                          />
                        </Pressable>
                      ))}
                      {vehicleImages.length === 1 && (
                        <View className="flex-1" />
                      )}
                    </View>
                  ) : (
                    <View className="items-center justify-center py-10 bg-white rounded-xl">
                      <Ionicons name="image-outline" size={36} color="#9CA3AF" />
                      <Text className="mt-2 text-sm text-gray-400">
                        No vehicle photos available
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        ) : null}
      </Modal>

      {/* Mount only while open so imageIndex is initial-only (no swipe flicker). */}
      {viewerVisible && viewerSources.length > 0 && (
        <ImageViewer
          images={viewerSources}
          imageIndex={viewerIndex}
          visible
          onRequestClose={() => setViewerVisible(false)}
          showCounter
        />
      )}
    </>
  );
}
