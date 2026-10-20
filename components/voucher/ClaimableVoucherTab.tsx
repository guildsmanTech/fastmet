import {
  useClaimPendingReward,
  useClaimPublicVoucher,
} from "@/mutations/rewardMutation";
import {queryClient} from "@/lib/queryClient";
import {
  rewardKeys,
  useClaimableVouchers,
  useMyRewards,
} from "@/queries/rewardQueries";
import {IssuedReward, VoucherTemplate} from "@/types/voucher";
import {getVoucherClaimErrorToast} from "@/utils/helpers/voucher";
import {Ionicons} from "@expo/vector-icons";
import {useState} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import VoucherCard from "./VoucherCard";

type ClaimableVoucherTabProps = {
  onCodeClaimSuccess?: () => void;
};

export default function ClaimableVoucherTab({
  onCodeClaimSuccess,
}: ClaimableVoucherTabProps) {
  const [voucherCode, setVoucherCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Fetch pending assigned rewards
  const {
    data: pendingData,
    isPending: isPendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = useMyRewards({status: "pending", rewardType: "voucher"});

  // Fetch public claimable vouchers
  const {
    data: claimableData,
    isPending: isClaimableLoading,
    error: claimableError,
    refetch: refetchClaimable,
  } = useClaimableVouchers();

  const claimPendingMutation = useClaimPendingReward();
  const claimPublicMutation = useClaimPublicVoucher();

  const pendingRewards = pendingData?.rewards || [];
  const claimableVouchers = claimableData?.vouchers || [];

  const isLoading = isPendingLoading || isClaimableLoading;
  const error = pendingError || claimableError;
  const isRefreshing = isPendingLoading || isClaimableLoading;

  // Combined list: pending rewards first, then claimable vouchers
  const combinedList = [
    ...pendingRewards.map((r) => ({type: "reward" as const, data: r})),
    ...claimableVouchers.map((v) => ({type: "template" as const, data: v})),
  ];

  const handleClaimPending = (rewardId: string) => {
    setClaimingId(rewardId);
    claimPendingMutation.mutate(rewardId, {
      onSettled: () => setClaimingId(null),
    });
  };

  const handleClaimPublic = (templateId: string) => {
    setClaimingId(templateId);
    claimPublicMutation.mutate(
      {templateId},
      {
        onError: (error) => {
          const {title, message} = getVoucherClaimErrorToast(error, "template");
          Toast.show({type: "error", text1: title, text2: message});
          // The card is likely gone (claimed out / already yours): refresh lists.
          void queryClient.invalidateQueries({queryKey: rewardKeys.all});
        },
        onSettled: () => setClaimingId(null),
      },
    );
  };

  const handleClaimByCode = () => {
    if (!voucherCode.trim()) return;

    const code = voucherCode.trim().toUpperCase();
    setCodeError("");
    setClaimingId("code-claim");
    claimPublicMutation.mutate(
      {code},
      {
        onSuccess: (data) => {
          if (data.success) {
            setVoucherCode("");
            setCodeError("");
            onCodeClaimSuccess?.();
          } else {
            const {message} = getVoucherClaimErrorToast(
              {response: {data: {error: data.error}}},
              "code",
            );
            setCodeError(message);
          }
        },
        onError: (error) => {
          const {message} = getVoucherClaimErrorToast(error, "code");
          setCodeError(message);
        },
        onSettled: () => {
          setClaimingId(null);
        },
      },
    );
  };

  const handleRefresh = () => {
    refetchPending();
    refetchClaimable();
  };

  if (isLoading && combinedList.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#FFA840" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center px-4 bg-white">
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="mt-4 text-lg font-semibold text-center text-gray-700">
          Failed to load vouchers
        </Text>
        <Text className="mt-2 text-sm text-center text-gray-500">
          {error.message}
        </Text>
        <Pressable
          onPress={handleRefresh}
          className="px-6 py-3 mt-4 rounded-lg bg-lightPrimary active:bg-darkPrimary"
        >
          <Text className="font-semibold text-white">Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Voucher Code Input */}
      <View className="px-4 pt-4 pb-2 bg-gray-50 border-b border-gray-200">
        <Text className="mb-2 text-sm font-semibold text-gray-700">
          Have a voucher code?
        </Text>
        <View className="flex-row gap-2 items-center">
          <TextInput
            className={`flex-1 bg-white border rounded-lg px-4 py-3 text-base ${
              codeError ? "border-red-400" : "border-gray-300"
            }`}
            placeholder="Enter code (e.g., WELCOME50)"
            value={voucherCode}
            onChangeText={(text) => {
              setVoucherCode(text.toUpperCase());
              if (codeError) setCodeError("");
            }}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Pressable
            onPress={handleClaimByCode}
            disabled={
              !voucherCode.trim() ||
              claimingId === "code-claim" ||
              claimPublicMutation.isPending
            }
            className={`px-4 py-3 rounded-lg ${
              !voucherCode.trim() || claimingId === "code-claim"
                ? "bg-gray-300"
                : "bg-lightPrimary active:bg-darkPrimary"
            }`}
          >
            {claimingId === "code-claim" ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text className="font-semibold text-white">Claim</Text>
            )}
          </Pressable>
        </View>
        {codeError ? (
          <Text className="mt-2 text-sm text-red-600">{codeError}</Text>
        ) : null}
      </View>

      {/* Voucher List */}
      <FlatList
        data={combinedList}
        keyExtractor={(item) =>
          item.type === "reward"
            ? `reward-${item.data._id}`
            : `template-${(item.data as VoucherTemplate)._id}`
        }
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: 40,
        }}
        renderItem={({item}) => {
          if (item.type === "reward") {
            const reward = item.data as IssuedReward;
            return (
              <VoucherCard
                reward={reward}
                isClaimable
                isClaiming={claimingId === reward._id}
                onClaim={() => handleClaimPending(reward._id)}
              />
            );
          } else {
            const template = item.data as VoucherTemplate;
            return (
              <VoucherCard
                template={template}
                isClaimable
                isClaiming={claimingId === template._id}
                onClaim={() => handleClaimPublic(template._id)}
              />
            );
          }
        }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={() => (
          <View className="justify-center items-center px-8 py-12">
            <Ionicons name="gift-outline" size={80} color="#9CA3AF" />
            <Text className="mt-6 text-2xl font-bold text-center text-gray-800">
              No Vouchers Available
            </Text>
            <Text className="mt-2 text-base text-center text-gray-500">
              Check back later for new vouchers and rewards!
            </Text>
          </View>
        )}
      />
    </View>
  );
}
