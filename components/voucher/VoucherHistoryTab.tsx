import {useMyRewards} from "@/queries/rewardQueries";
import {Ionicons} from "@expo/vector-icons";
import {ActivityIndicator, FlatList, Text, View} from "react-native";
import VoucherCard from "./VoucherCard";

export default function VoucherHistoryTab() {
  const {data: fulfilledData, isPending: isFulfilledPending, refetch: refetchFulfilled} = useMyRewards({
    status: "fulfilled",
    rewardType: "voucher",
  });

  const {data: expiredData, isPending: isExpiredPending, refetch: refetchExpired} = useMyRewards({
    status: "expired",
    rewardType: "voucher",
  });

  const {data: revokedData, isPending: isRevokedPending, refetch: refetchRevoked} = useMyRewards({
    status: "revoked",
    rewardType: "voucher",
  });

  const fulfilledVouchers = fulfilledData?.rewards || [];
  const expiredVouchers = expiredData?.rewards || [];
  const revokedVouchers = revokedData?.rewards || [];

  // Combine: fulfilled first, then revoked, then expired
  const historyVouchers = [...fulfilledVouchers, ...revokedVouchers, ...expiredVouchers];

  const isLoading = isFulfilledPending && isExpiredPending && isRevokedPending;
  const isRefreshing = isFulfilledPending || isExpiredPending || isRevokedPending;

  const handleRefresh = () => {
    refetchFulfilled();
    refetchExpired();
    refetchRevoked();
  };

  if (isLoading && historyVouchers.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#FFA840" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={historyVouchers}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: 40,
        }}
        renderItem={({item}) => (
          <VoucherCard reward={item} showFulfillment />
        )}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={() => (
          <View className="justify-center items-center px-8 py-12">
            <Ionicons name="time-outline" size={80} color="#9CA3AF" />
            <Text className="mt-6 text-2xl font-bold text-center text-gray-800">
              No History Yet
            </Text>
            <Text className="mt-2 text-base text-center text-gray-500">
              Used, revoked, and expired vouchers will appear here.
            </Text>
          </View>
        )}
      />
    </View>
  );
}
