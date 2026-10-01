import SheetButton from "@/components/maps/SheetButton";
import TollWebViewModal from "@/components/modals/tollWebViewModal";
import {
  drivingDistanceQueryKey,
  useDrivingDistance,
} from "@/queries/bookingQueries";
import {useAppStore} from "@/store/useAppStore";
import {Service} from "@/types/vehicle";
import {
  applyVehicleDuration,
  computeDistanceFee,
  fetchDrivingDistance,
} from "@/utils/helpers/calculatePrice";
import {Ionicons} from "@expo/vector-icons";
import {useQueryClient} from "@tanstack/react-query";
import {router} from "expo-router";
import React, {useEffect, useMemo, useState} from "react";
import {Platform, Pressable, ScrollView, Text, View} from "react-native";
import Popover, {PopoverPlacement} from "react-native-popover-view";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const Services = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const pickUp = useAppStore((state) => state.pickUp);
  const dropOff = useAppStore((state) => state.dropOff);
  const addedServices = useAppStore((state) => state.addedServices);
  const toggleService = useAppStore((state) => state.toggleService);
  const updateServiceQuantity = useAppStore(
    (state) => state.updateServiceQuantity,
  );
  const selectedVehicle = useAppStore((state) => state.selectedVehicle);
  const bookingType = useAppStore((state) => state.bookingType);
  const setRouteData = useAppStore((state) => state.setRouteData);
  const setLoading = useAppStore((state) => state.setLoading);

  const allowExpressway = useMemo(
    () => addedServices.some((s) => s.key === "toll_fee"),
    [addedServices],
  );

  const {data: route, isFetching} = useDrivingDistance(
    pickUp,
    dropOff,
    allowExpressway,
  );

  // Prefetch expressway route once so first toll_fee toggle is cache-hit
  useEffect(() => {
    if (!pickUp || !dropOff) return;

    void queryClient.prefetchQuery({
      queryKey: drivingDistanceQueryKey(pickUp, dropOff, true),
      queryFn: () => fetchDrivingDistance(pickUp, dropOff, true),
      staleTime: Infinity,
    });
  }, [pickUp, dropOff, queryClient]);

  // Reprice distance/duration when active route variant changes (cached after first fetch)
  useEffect(() => {
    if (!route || !selectedVehicle?.variant || !bookingType) return;

    const {routeData, addedServices: services} = useAppStore.getState();
    const distanceFee = computeDistanceFee(
      route.distanceKm,
      selectedVehicle.variant,
      bookingType.priceModifier,
    );
    const serviceFee = services.reduce((sum, s) => sum + s.price, 0);
    const {basePrice, surgeMultiplier = 1} = routeData;
    const duration = applyVehicleDuration(
      route.durationMin,
      selectedVehicle.key,
    );
    const totalPrice = Math.round(
      (basePrice + distanceFee + serviceFee) * surgeMultiplier,
    );

    setRouteData({
      ...routeData,
      distance: Math.round(route.distanceKm),
      duration,
      distanceFee,
      serviceFee,
      totalPrice,
    });
  }, [route, selectedVehicle, bookingType, setRouteData]);

  useEffect(() => {
    setLoading(isFetching);
    return () => setLoading(false);
  }, [isFetching, setLoading]);

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: "white"}}>
      <View className="relative flex-row items-center justify-center px-6 pt-2 pb-4">
        <Pressable
          className="absolute left-5 top-1.5"
          onPress={() => router.back()}
          hitSlop={20}
        >
          <Ionicons
            name="chevron-back"
            size={Platform.OS === "ios" ? 32 : 28}
            color="#FFA840"
          />
        </Pressable>
        <Text className="text-lg font-semibold">Services</Text>
        <Text className="absolute text-sm font-semibold right-5 top-3.5">
          Step 2/4
        </Text>
      </View>
      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + (insets.bottom === 0 ? 120 : 70),
        }}
      >
        {/* Free Services */}
        {selectedVehicle?.freeServices &&
          selectedVehicle.freeServices.length > 0 && (
            <>
              <Text className="mb-3 text-lg font-bold">Included Services</Text>
              <View className="gap-3 mb-6">
                {selectedVehicle.freeServices.map((service) => (
                  <View
                    key={service.key}
                    className="flex-row items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <View className="flex-1 gap-1 pr-3">
                      <View className="flex-row items-center gap-1">
                        <Text className="text-sm font-semibold text-gray-700">
                          {service.name}
                        </Text>
                        <Popover
                          placement={PopoverPlacement.AUTO}
                          from={
                            <Pressable className="p-1">
                              <Ionicons
                                name="information-circle-outline"
                                size={20}
                                color="#9CA3AF"
                              />
                            </Pressable>
                          }
                        >
                          <View className="px-3 py-2 bg-white rounded-lg">
                            <Text className="text-sm text-gray-700 leading-relaxed">
                              {service.desc}
                            </Text>
                          </View>
                        </Popover>
                      </View>
                      <Text className="text-xs font-medium text-green-600">
                        Free
                      </Text>
                    </View>
                    <View className="items-center justify-center w-6 h-6 rounded bg-green-500">
                      <Ionicons name="checkmark" size={16} color="white" />
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

        {/* Paid Services Add-ons */}
        <Text className="mb-3 text-lg font-bold">Additional Services</Text>
        <View className="gap-3 mb-6">
          {selectedVehicle?.paidServices.map((service) => {
            // Hide extra helper service if booking type is pooling
            if (service.key === "extra_helper" && bookingType?.type === "pooling")
              return;

            const addedService = addedServices.find(
              (s) => s.key === service.key,
            );
            const isSelected = !!addedService;
            const quantity = addedService?.quantity ?? 1;

            return (
              <ServiceCard
                key={service.key}
                service={service}
                isSelected={isSelected}
                quantity={quantity}
                toggleService={toggleService}
                updateServiceQuantity={updateServiceQuantity}
              />
            );
          })}
        </View>
      </ScrollView>

      <SheetButton
        next={() => router.push("/(root_screens)/booking/additionalInfo")}
      />
    </SafeAreaView>
  );
};

export default Services;

export const ServiceCard = ({
  service,
  isSelected,
  quantity,
  toggleService,
  updateServiceQuantity,
}: {
  service: Service;
  isSelected: boolean;
  quantity: number;
  toggleService: (service: Service) => void;
  updateServiceQuantity: (
    serviceKey: string,
    originalPrice: number,
    quantity: number,
  ) => void;
}) => {
  const [tollModalVisible, setTollModalVisible] = useState(false);
  const isTollService = service.key === "toll_fee";
  const handleIncrement = () => {
    if (service.maxQuantity && quantity >= service.maxQuantity) return;
    updateServiceQuantity(service.key, service.price, quantity + 1);
  };

  const handleDecrement = () => {
    if (quantity <= 1) {
      toggleService(service);
    } else {
      updateServiceQuantity(service.key, service.price, quantity - 1);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => toggleService(service)}
        className={`flex-row items-center justify-between p-3 border rounded-lg ${
          isSelected
            ? "border-lightPrimary bg-orange-50"
            : "border-gray-300 active:bg-gray-50"
        }`}
        disabled={!!(service.maxQuantity && quantity >= service.maxQuantity)}
      >
        <View className="flex-row items-center flex-1 gap-2 pr-3">
          <View className="flex-1 gap-1">
            <View className="flex-row items-center">
              <Text className="text-sm font-semibold">{service.name} </Text>
              <Popover
                placement={PopoverPlacement.AUTO}
                from={
                  <Pressable className="p-1">
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color="#9CA3AF"
                    />
                  </Pressable>
                }
              >
                <View className="px-3 py-2 bg-white rounded-lg">
                  <Text className="text-sm text-gray-700 leading-relaxed">
                    {service.desc}
                  </Text>
                </View>
              </Popover>
            </View>
            <View className="flex-row items-center gap-2 flex-wrap">
              {service.price > 0 ? (
                <>
                  <Text className="text-sm font-semibold text-darkPrimary">
                    ₱{service.price}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    • {service.unit}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-xs font-medium text-blue-600">
                    Actual Cost
                  </Text>

                  {isTollService && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setTollModalVisible(true);
                      }}
                      hitSlop={8}
                      className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 active:bg-blue-100"
                    >
                      <Ionicons
                        name="receipt-outline"
                        size={12}
                        color="#1D4ED8"
                      />
                      <Text className="text-xs font-medium text-blue-700">
                        Toll rates
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </View>
        </View>

        {service.isQuantifiable ? (
          // Quantifiable service - show quantity controls or checkbox
          isSelected ? (
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={handleDecrement}
                className="items-center justify-center w-8 h-8 rounded-lg border border-lightPrimary active:bg-gray-100"
                hitSlop={8}
              >
                <Ionicons name="remove" size={18} />
              </Pressable>
              <Text className="w-6 text-sm font-semibold text-center">
                {quantity}
              </Text>
              <Pressable
                onPress={handleIncrement}
                className={`w-8 h-8 rounded-lg items-center bg-lightPrimary justify-center ${
                  service.maxQuantity && quantity >= service.maxQuantity
                    ? "opacity-50"
                    : " active:bg-darkPrimary"
                }`}
                hitSlop={8}
                disabled={
                  !!(service.maxQuantity && quantity >= service.maxQuantity)
                }
              >
                <Ionicons name="add" size={18} color="white" />
              </Pressable>
            </View>
          ) : (
            <View className="items-center justify-center w-6 h-6 bg-gray-300 rounded">
              {/* Empty checkbox */}
            </View>
          )
        ) : (
          // Non-quantifiable service - simple checkbox
          <View
            className={`w-6 h-6 rounded items-center justify-center ${
              isSelected ? "bg-lightPrimary" : "bg-gray-300"
            }`}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={16} color="white" />
            )}
          </View>
        )}
      </Pressable>
      {isTollService && (
        <TollWebViewModal
          visible={tollModalVisible}
          onClose={() => setTollModalVisible(false)}
        />
      )}
    </>
  );
};
