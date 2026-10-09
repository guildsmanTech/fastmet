import { LocationDetails } from "@/types/book";
import { formatLocation } from "@/utils/helpers/location";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Text, View } from "react-native";

// Reusable Delivery Route Card Component
export const DeliveryRouteCard = ({ 
  pickUp, 
  dropOff 
}: { 
  pickUp?: LocationDetails; 
  dropOff?: LocationDetails; 
}) => {
  if (!pickUp && !dropOff) return null;

  return (
    <View className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
      <Text className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide">
        Delivery Route
      </Text>

      <View className="gap-3">
        {/* Pick-up */}
        {pickUp && (
          <View className="flex-row items-start">
            <View className="items-center mr-3">
              <View className="bg-green-500 rounded-full size-10 justify-center items-center">
                <Ionicons name="location" size={20} color="#FFFFFF" />
              </View>
              {dropOff && <View className="w-0.5 h-16 bg-gray-300 my-1" />}
            </View>
            <View className="flex-1 pt-1">
              <Text className="text-xs text-gray-500 mb-1">Pick-up</Text>
              <Text className="text-base font-semibold text-gray-900">
                {pickUp.name}
              </Text>
              {formatLocation(pickUp) && (
                <Text className="text-sm text-gray-500 mt-0.5">
                  {formatLocation(pickUp)}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Drop-off */}
        {dropOff && (
          <View className="flex-row items-start">
            <View className="items-center mr-3">
              <View className="bg-red-500 rounded-full size-10 justify-center items-center">
                <Ionicons name="flag" size={20} color="#FFFFFF" />
              </View>
            </View>
            <View className="flex-1 pt-1">
              <Text className="text-xs text-gray-500 mb-1">Drop-off</Text>
              <Text className="text-base font-semibold text-gray-900">
                {dropOff.name}
              </Text>
              {formatLocation(dropOff) && (
                <Text className="text-sm text-gray-500 mt-0.5">
                  {formatLocation(dropOff)}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

// Driver Offer notification content
export const DriverOfferContent = ({ data }: { data: Record<string, any> }) => {
  const { drivers, pickUp, dropOff } = data;

  if (!drivers || Object.keys(drivers).length === 0) {
    return null;
  }

  const driverEntries = Object.entries(drivers);
  const driverCount = driverEntries.length;

  return (
    <View className="gap-4">
      {/* Route Card - Pick-up and Drop-off connected */}
      <View className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
        <Text className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          Delivery Route
        </Text>

        <View className="gap-3">
          {/* Pick-up */}
          {pickUp && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-green-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="location" size={20} color="#FFFFFF" />
                </View>
                {/* Connecting line */}
                {dropOff && <View className="w-0.5 h-16 bg-gray-300 my-1" />}
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Pick-up</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {pickUp.name}
                </Text>
                {formatLocation(pickUp) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(pickUp)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Drop-off */}
          {dropOff && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-red-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="flag" size={20} color="#FFFFFF" />
                </View>
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Drop-off</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {dropOff.name}
                </Text>
                {formatLocation(dropOff) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(dropOff)}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Drivers Section - Clearly separated */}
      <View className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
            Available Drivers
          </Text>
          <View className="bg-blue-200 rounded-full px-3 py-1">
            <Text className="text-xs font-bold text-blue-900">
              {driverCount}
            </Text>
          </View>
        </View>

        {driverEntries.map(([driverId, driver]: [string, any], index) => (
          <View
            key={driverId}
            className={index > 0 ? "mt-4 pt-4 border-t border-blue-200" : ""}
          >
            <View className="flex-row items-center">
              {driver.driverProfilePicture ? (
                <Image
                  source={{ uri: driver.driverProfilePicture }}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    borderWidth: 2,
                    borderColor: "#DBEAFE",
                    marginRight: 12,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    borderWidth: 2,
                    borderColor: "#DBEAFE",
                    marginRight: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <Ionicons name="person-circle" size={52} color="#F7931E" />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-900">
                  {driver.driverName}
                </Text>
                {driver.driverRating && (
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="star" size={16} color="#F59E0B" />
                    <Text className="text-sm font-semibold text-gray-700 ml-1">
                      {driver.driverRating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// Booking Expired notification content
export const BookingExpiredContent = ({
  data,
}: {
  data: Record<string, any>;
}) => {
  const { pickUp, dropOff } = data;
  return <DeliveryRouteCard pickUp={pickUp} dropOff={dropOff} />;
};

export const ScheduledChooseDriverContent = ({
  data,
}: {
  data: Record<string, any>;
}) => {
  const { pickUp, dropOff } = data;

  return (
    <View className="gap-4">
      {/* Action Banner */}
      <View className="bg-blue-50 rounded-2xl p-5 border border-blue-200">
        <View className="flex-row items-center">
          <View className="bg-blue-500 rounded-full size-12 justify-center items-center mr-4">
            <Ionicons name="people" size={24} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-blue-900">
              Action Required
            </Text>
            <Text className="text-xs text-blue-700 mt-1">
              Select your preferred driver from available offers
            </Text>
          </View>
        </View>
      </View>

      {/* Route Card */}
      <View className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
        <Text className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          Delivery Route
        </Text>

        <View className="gap-3">
          {/* Pick-up */}
          {pickUp && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-green-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="location" size={20} color="#FFFFFF" />
                </View>
                {dropOff && <View className="w-0.5 h-16 bg-gray-300 my-1" />}
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Pick-up</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {pickUp.name}
                </Text>
                {formatLocation(pickUp) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(pickUp)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Drop-off */}
          {dropOff && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-red-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="flag" size={20} color="#FFFFFF" />
                </View>
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Drop-off</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {dropOff.name}
                </Text>
                {formatLocation(dropOff) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(dropOff)}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// Scheduled No Drivers notification content
export const ScheduledNoDriversContent = ({
  data,
}: {
  data: Record<string, any>;
}) => {
  const { pickUp, dropOff } = data;

  return (
    <View className="gap-4">
      {/* Warning Banner */}
      <View className="bg-amber-50 rounded-2xl p-5 border border-amber-200">
        <View className="flex-row items-center">
          <View className="bg-amber-500 rounded-full size-12 justify-center items-center mr-4">
            <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-amber-900">
              No Offers Yet
            </Text>
            <Text className="text-xs text-amber-700 mt-1">
              Consider rescheduling or cancelling your booking
            </Text>
          </View>
        </View>
      </View>

      {/* Route Card */}
      <View className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
        <Text className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          Delivery Route
        </Text>

        <View className="gap-3">
          {/* Pick-up */}
          {pickUp && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-green-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="location" size={20} color="#FFFFFF" />
                </View>
                {dropOff && <View className="w-0.5 h-16 bg-gray-300 my-1" />}
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Pick-up</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {pickUp.name}
                </Text>
                {formatLocation(pickUp) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(pickUp)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Drop-off */}
          {dropOff && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-red-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="flag" size={20} color="#FFFFFF" />
                </View>
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Drop-off</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {dropOff.name}
                </Text>
                {formatLocation(dropOff) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(dropOff)}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// Scheduled Auto Assign Warning notification content
export const ScheduledAutoAssignWarningContent = ({
  data,
}: {
  data: Record<string, any>;
}) => {
  const { pickUp, dropOff } = data;

  return (
    <View className="gap-4">
      {/* Warning Banner */}
      <View className="bg-orange-50 rounded-2xl p-5 border border-orange-200">
        <View className="flex-row items-center">
          <View className="bg-orange-500 rounded-full size-12 justify-center items-center mr-4">
            <Ionicons name="time" size={24} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-orange-900">
              Auto-Assignment Soon
            </Text>
            <Text className="text-xs text-orange-700 mt-1">
              We&apos;ll assign the highest-rated driver in 1 hour
            </Text>
          </View>
        </View>
      </View>

      {/* Route Card */}
      <View className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
        <Text className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          Delivery Route
        </Text>

        <View className="gap-3">
          {/* Pick-up */}
          {pickUp && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-green-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="location" size={20} color="#FFFFFF" />
                </View>
                {dropOff && <View className="w-0.5 h-16 bg-gray-300 my-1" />}
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Pick-up</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {pickUp.name}
                </Text>
                {formatLocation(pickUp) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(pickUp)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Drop-off */}
          {dropOff && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-red-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="flag" size={20} color="#FFFFFF" />
                </View>
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Drop-off</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {dropOff.name}
                </Text>
                {formatLocation(dropOff) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(dropOff)}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// Scheduled Auto Assigned notification content
export const ScheduledAutoAssignedContent = ({
  data,
}: {
  data: Record<string, any>;
}) => {
  const { pickUp, dropOff, driverName, driverRating, driverProfilePicture } =
    data;

  return (
    <View className="gap-4">
      {/* Driver Card */}
      <View className="bg-green-50 rounded-2xl p-5 border border-green-200">
        <Text className="text-xs font-semibold text-green-700 mb-4 uppercase tracking-wide">
          Your Assigned Driver
        </Text>
        <View className="flex-row items-center">
          {driverProfilePicture ? (
            <Image
              source={{ uri: driverProfilePicture }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                borderWidth: 3,
                borderColor: "#D1FAE5",
                marginRight: 16,
              }}
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                borderWidth: 3,
                borderColor: "#D1FAE5",
                marginRight: 16,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <Ionicons name="person-circle" size={56} color="#F7931E" />
            </View>
          )}
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">
              {driverName || "Driver"}
            </Text>
            {driverRating && (
              <View className="flex-row items-center mt-1">
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text className="text-sm font-semibold text-gray-700 ml-1">
                  {driverRating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
          <View className="bg-green-500 rounded-full size-10 justify-center items-center">
            <Ionicons name="checkmark" size={24} color="#FFFFFF" />
          </View>
        </View>
      </View>

      {/* Route Card */}
      <View className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
        <Text className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          Delivery Route
        </Text>

        <View className="gap-3">
          {/* Pick-up */}
          {pickUp && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-green-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="location" size={20} color="#FFFFFF" />
                </View>
                {dropOff && <View className="w-0.5 h-16 bg-gray-300 my-1" />}
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Pick-up</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {pickUp.name}
                </Text>
                {formatLocation(pickUp) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(pickUp)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Drop-off */}
          {dropOff && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-red-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="flag" size={20} color="#FFFFFF" />
                </View>
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Drop-off</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {dropOff.name}
                </Text>
                {formatLocation(dropOff) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(dropOff)}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// Scheduled Auto Cancelled notification content
export const ScheduledAutoCancelledContent = ({
  data,
}: {
  data: Record<string, any>;
}) => {
  const { pickUp, dropOff } = data;

  return (
    <View className="gap-4">
      {/* Error Banner */}
      <View className="bg-red-50 rounded-2xl p-5 border border-red-200">
        <View className="flex-row items-center">
          <View className="bg-red-500 rounded-full size-12 justify-center items-center mr-4">
            <Ionicons name="close-circle" size={24} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-red-900">
              Booking Cancelled
            </Text>
            <Text className="text-xs text-red-700 mt-1">
              No drivers were available for your pickup
            </Text>
          </View>
        </View>
      </View>

      {/* Route Card */}
      <View className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
        <Text className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          Delivery Route
        </Text>

        <View className="gap-3">
          {/* Pick-up */}
          {pickUp && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-green-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="location" size={20} color="#FFFFFF" />
                </View>
                {dropOff && <View className="w-0.5 h-16 bg-gray-300 my-1" />}
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Pick-up</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {pickUp.name}
                </Text>
                {formatLocation(pickUp) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(pickUp)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Drop-off */}
          {dropOff && (
            <View className="flex-row items-start">
              <View className="items-center mr-3">
                <View className="bg-red-500 rounded-full size-10 justify-center items-center">
                  <Ionicons name="flag" size={20} color="#FFFFFF" />
                </View>
              </View>
              <View className="flex-1 pt-1">
                <Text className="text-xs text-gray-500 mb-1">Drop-off</Text>
                <Text className="text-base font-semibold text-gray-900">
                  {dropOff.name}
                </Text>
                {formatLocation(dropOff) && (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {formatLocation(dropOff)}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// Admin action notification content - reuses route card
export const AdminBookingActionContent = ({
  data,
}: {
  data: Record<string, any>;
}) => {
  const { pickUp, dropOff } = data;
  return <DeliveryRouteCard pickUp={pickUp} dropOff={dropOff} />;
};

// Default fallback content for unknown notification types
export const DefaultContent = ({ data }: { data: Record<string, any> }) => {
  const displayableData = Object.entries(data).filter(
    ([key, value]) =>
      key !== "bookingId" &&
      key !== "_id" &&
      key !== "driverId" &&
      value !== null &&
      value !== undefined &&
      typeof value !== "object",
  );

  if (displayableData.length === 0) return null;

  return (
    <View className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      {displayableData.map(([key, value], index) => (
        <View key={key}>
          <View className="py-2">
            <Text className="text-xs text-gray-500 mb-1">
              {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </Text>
            <Text className="text-base font-semibold text-gray-900">
              {String(value)}
            </Text>
          </View>
          {index < displayableData.length - 1 && (
            <View className="h-px bg-gray-200" />
          )}
        </View>
      ))}
    </View>
  );
};
