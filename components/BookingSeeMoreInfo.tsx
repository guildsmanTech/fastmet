import { LocationDetails, RouteData } from "@/types/book";
import { Service } from "@/types/vehicle";
import { BookingTimelineItem } from "@/utils/helpers/booking";
import { formatDate } from "@/utils/helpers/date";
import { formatLocation } from "@/utils/helpers/location";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Platform, Pressable, Text, View } from "react-native";

export const SeeMoreHeader = ({
  onClose,
  bookingType,
}: {
  onClose: () => void;
  bookingType: string;
}) => {
  return (
    <View className="flex-row justify-center items-center px-4 pt-2 pb-4">
      <Pressable
        onPress={onClose}
        className="absolute top-1 left-4"
        hitSlop={{ top: 20, left: 20, bottom: 20, right: 20 }}
      >
        <Ionicons
          name="chevron-back-outline"
          size={Platform.OS === "ios" ? 34 : 28}
          color="#FFA840"
        />
      </Pressable>
      <Text className="text-lg font-semibold uppercase">{bookingType}</Text>
    </View>
  );
};

export const LocationUI = ({
  pickUp,
  dropOff,
}: {
  pickUp: LocationDetails;
  dropOff: LocationDetails;
}) => {
  return (
    <View className="relative flex-row justify-between items-start pl-7 mr-2 ml-5 border-l border-dashed border-lightPrimary">
      <View className="flex-1 gap-5">
        {/* Pickup */}
        <View>
          <Text className="text-sm font-medium text-gray-900">
            {formatLocation(pickUp)}
          </Text>

          {pickUp?.additionalDetails && (
            <Text className="mt-1 text-xs text-gray-500" numberOfLines={3}>
              {pickUp.additionalDetails}
            </Text>
          )}
          {pickUp?.contactName && (
            <View className="flex-row items-center mt-2">
              <Ionicons
                name="person-circle-outline"
                size={15}
                color="#9CA3AF"
              />

              <Text
                className="flex-1 ml-1.5 text-xs text-gray-500"
                numberOfLines={1}
              >
                {pickUp.contactName}
              </Text>
            </View>
          )}
        </View>

        {/* Dropoff */}
        <View>
          <Text className="text-sm font-medium text-gray-900">
            {formatLocation(dropOff)}
          </Text>

          {dropOff?.additionalDetails && (
            <Text className="mt-1 text-xs text-gray-500" numberOfLines={3}>
              {dropOff.additionalDetails}
            </Text>
          )}
          {dropOff?.contactName && (
            <View className="flex-row items-center mt-2">
              <Ionicons
                name="person-circle-outline"
                size={15}
                color="#9CA3AF"
              />

              <Text
                className="flex-1 ml-1.5 text-xs text-gray-500"
                numberOfLines={1}
              >
                {dropOff.contactName}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons
        name="location-sharp"
        size={24}
        color="#FFA840"
        className="absolute -left-3.5 -top-1  bg-gray-50"
      />

      <Ionicons
        name="flag-outline"
        size={24}
        color="#FFA840"
        className="absolute -left-3.5 -bottom-3 pb-2  bg-gray-50"
      />
    </View>
  );
};

export const PaymentInfo = ({
  paymentMethod,
  routeData,
  paidBy,
  voucherApplied,
}: {
  paymentMethod: string;
  routeData: RouteData;
  paidBy?: "sender" | "receiver";
  voucherApplied?: {
    issuedRewardId: string;
    voucherTemplateId: string;
    discountAmount: number;
  } | null;
}) => {
  const netAmount = voucherApplied
    ? routeData.totalPrice - voucherApplied.discountAmount
    : routeData.totalPrice;

  return (
    <View className="p-5 bg-gray-50 rounded-2xl">
      <Text className="mb-3 text-base font-semibold text-gray-800">
        Payment Information (
        {paymentMethod === "cash" ? "Cash Payment" : "Gcash Manual Payment"})
      </Text>
      {paidBy && (
        <View className="flex-row justify-between items-center p-3 mb-2 bg-white rounded-lg">
          <Text className="text-sm text-gray-600">Paid by</Text>
          <Text className="text-sm font-bold text-gray-800 capitalize">
            {paidBy}
          </Text>
        </View>
      )}
      {/* Price Breakdown */}
      <View className="gap-2 p-4 bg-white rounded-xl">
        <View className="flex-row justify-between">
          <Text className="text-xs text-gray-500">Base Fare</Text>
          <Text className="text-xs font-semibold text-gray-700">
            Php{" "}
            {routeData.basePrice.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View className="flex-row justify-between">
          <Text className="text-xs text-gray-500">Distance Fee</Text>
          <Text className="text-xs font-semibold text-gray-700">
            Php{" "}
            {routeData.distanceFee.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View className="flex-row justify-between">
          <Text className="text-xs text-gray-500">Service Fee</Text>
          <Text className="text-xs font-semibold text-gray-700">
            {routeData.serviceFee > 0
              ? `Php ${routeData.serviceFee.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
              : "FREE"}
          </Text>
        </View>

        {/* Voucher Discount */}
        {voucherApplied && (
          <>
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-500">Gross Fare</Text>
              <Text className="text-xs font-semibold text-gray-700">
                Php{" "}
                {routeData.totalPrice.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-xs font-medium text-green-600">
                Voucher Discount
              </Text>
              <Text className="text-xs font-semibold text-green-600">
                - Php{" "}
                {voucherApplied.discountAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
          </>
        )}

        {/* Divider */}
        <View className="my-2 h-px bg-gray-200" />

        {/* Total */}
        <View className="flex-row justify-between">
          <Text className="text-base font-semibold text-gray-800">
            {voucherApplied ? "Amount" : "Total Amount"}
          </Text>
          <Text className="text-xl font-bold text-darkPrimary">
            Php{" "}
            {netAmount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const SelectedServices = ({
  addedServices,
  hasFreeServices,
  hasAddedServices,
  totalServicesPrice,
  freeServices,
}: {
  addedServices: Service[];
  hasFreeServices: boolean;
  hasAddedServices: boolean;
  totalServicesPrice: number;
  freeServices: Service[];
}) => {
  return (
    <View className="p-4 bg-white rounded-2xl border border-gray-200">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-base font-semibold text-gray-800">
          Selected Services
        </Text>
        <View className="px-2 py-1 bg-orange-100 rounded-full">
          <Text className="text-xs font-semibold text-lightPrimary">
            {addedServices?.length ?? 0} add-ons
          </Text>
        </View>
      </View>

      {/* Free Services */}
      {hasFreeServices && (
        <View className="gap-1">
          <Text className="mb-2 text-xs font-medium text-gray-500 uppercase">
            Included (Free)
          </Text>
          <View>
            {freeServices.map((service: Service) => (
              <View
                key={service.key}
                className="flex-row justify-between items-center py-2"
              >
                <View className="flex-row flex-1 gap-2 items-center">
                  <View className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <Text className="flex-1 text-sm text-gray-700">
                    {service.name}
                  </Text>
                </View>
                <Text className="text-xs font-medium text-green-600">FREE</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Paid Services */}
      {hasAddedServices && (
        <View className="pt-3 border-t border-gray-200">
          <Text className="mb-2 text-xs font-medium text-gray-500 uppercase">
            Add-ons
          </Text>
          <View>
            {addedServices.map((service: Service) => {
              const qty = service.quantity ?? 1;
              const hasMultiple = qty > 1;
              // service.price is already total (unit × quantity) from bookSlice
              const unitPrice = hasMultiple
                ? service.price / qty
                : service.price;

              return (
                <View
                  key={service.key}
                  className="flex-row justify-between items-center py-2"
                >
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-800">
                      {service.name}
                    </Text>
                    {hasMultiple && (
                      <Text className="text-xs text-gray-500">
                        Qty: {qty} × ₱{unitPrice.toLocaleString("en-US")}
                      </Text>
                    )}
                  </View>
                  <Text className="font-semibold text-lightPrimary">
                    {service.price > 0
                      ? `₱${service.price.toLocaleString("en-US")}`
                      : "-"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Total */}
      {hasAddedServices && (
        <View className="flex-row justify-between items-center pt-3 mt-3 border-t border-gray-300">
          <Text className="text-base font-semibold text-gray-800">
            Services Total
          </Text>
          <Text className="text-lg font-bold text-lightPrimary">
            {totalServicesPrice > 0
              ? `₱${totalServicesPrice.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
              : "FREE"}
          </Text>
        </View>
      )}
    </View>
  );
};

export const ItemType = ({ itemType }: { itemType: string }) => {
  return (
    <View className="p-5 bg-blue-50 rounded-2xl">
      <View className="flex-row items-center mb-2">
        <Ionicons name="cube-outline" size={20} color="#3B82F6" />
        <Text className="ml-2 text-base font-semibold text-gray-800">
          Item Type
        </Text>
      </View>
      <Text className="leading-5 text-gray-700">{itemType}</Text>
    </View>
  );
};

export const Note = ({ note }: { note: string }) => {
  return (
    <View className="p-5 bg-amber-50 rounded-2xl">
      <View className="flex-row items-center mb-2">
        <Ionicons name="document-text-outline" size={20} color="#FFA840" />
        <Text className="ml-2 text-base font-semibold text-gray-800">Note</Text>
      </View>
      <Text className="leading-5 text-gray-700">{note}</Text>
    </View>
  );
};

export const AttachedImages = ({
  photos,
  setImageViewerVisible,
  setSelectedImageUrl,
}: {
  photos: string[];
  setImageViewerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedImageUrl: React.Dispatch<React.SetStateAction<string>>;
}) => {
  return (
    <View className="p-5 bg-gray-50 rounded-2xl">
      <View className="flex-row items-center mb-3">
        <Ionicons name="image-outline" size={20} color="#666" />
        <Text className="ml-2 text-base font-semibold text-gray-800">
          Attached Images ({photos.length})
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {photos.map((img: any, index: number) => (
          <Pressable
            key={index}
            onPress={() => {
              setImageViewerVisible(true);
              setSelectedImageUrl(img);
            }}
            className="flex-1"
          >
            <Image
              source={{ uri: img }}
              style={{
                flex: 1,
                height: photos.length > 1 ? 100 : 200,
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
};

export const BookingTimeline = ({ items }: { items: BookingTimelineItem[] }) => {
  if (items.length <= 1) return null;

  return (
    <View className="p-5 bg-gray-50 rounded-2xl">
      <Text className="mb-4 text-base font-semibold text-gray-800">
        Timeline
      </Text>
      <View className="gap-4">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <View key={`${item.label}-${index}`} className="flex-row gap-3">
              <View className="items-center">
                <View
                  className={`size-2.5 rounded-full ${isLast ? "bg-lightPrimary" : "bg-gray-300"
                    }`}
                />
                {!isLast && <View className="flex-1 mt-1 w-px bg-gray-200" />}
              </View>
              <View className="flex-1 pb-1">
                <Text className="text-sm font-medium text-gray-800">
                  {item.label}
                </Text>
                <Text className="mt-0.5 text-xs text-gray-500">
                  {formatDate(item.date)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};
