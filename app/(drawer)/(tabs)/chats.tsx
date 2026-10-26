import ConversationCard from "@/components/chat/ConversationCard";
import NotLoggedIn from "@/components/notLoggedIn";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/queries/conversation";
import { pushOnce } from "@/utils/helpers/navigation";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Button,
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View
} from "react-native";

const Chats = () => {
  const { isLoggedIn } = useAuth();

  const {
    data,
    isPending,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversations(10);

  if (!isLoggedIn) {
    return <NotLoggedIn />;
  }

  if (isPending)
    return (
      <View className="flex-1 items-center bg-white justify-center">
        <ActivityIndicator size="large" color="#FFA840" />
      </View>
    );
  if (error)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg font-semibold text-gray-500">
          {error.message}
        </Text>
        <Button title="Retry" onPress={() => refetch()} />
      </View>
    );

  // Pages are offset-based, so a chat that moved up can appear twice.
  const seen = new Set<string>();
  const conversations = (data?.pages.flatMap((page) => page.conversations) ?? [])
    .filter((c) => !seen.has(c._id) && !!seen.add(c._id));

  const handleSearchPress = () => {
    pushOnce("/searchChat");
  };

  return (
    <View className="flex-1 gap-6 py-6 bg-white">
      {conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="bg-[#FFF3E0] rounded-full p-5 mb-6">
            <Ionicons name="chatbubble-ellipses-outline" size={54} color="#FFA840" />
          </View>
          <Text className="text-center text-xl font-semibold text-gray-600 mb-2">
            No Messages
          </Text>
          <Text className="text-center text-base text-gray-400">
            Looks like you don&apos;t have any conversations yet. Start a new chat to see messages here!
          </Text>
        </View>
      ) : (
        <>
          <Pressable
            className="flex-row items-center bg-ctaSecondary mx-4 px-4 rounded-full"
            style={{
              height: Platform.OS === "ios" ? 54 : 46,
            }}
            onPress={handleSearchPress}
          >
            <TextInput
              placeholder="Search..."
              placeholderTextColor="#9FABB4"
              className="flex-1 text-base text-black leading-[18px]"
              editable={false}
              pointerEvents="none"
            />
            <Ionicons
              name="search"
              size={Platform.OS === "ios" ? 24 : 20}
              color="#9FABB4"
            />
          </Pressable>

          <View>
            <FlatList
              data={conversations}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <ConversationCard item={item} />}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ gap: 3, paddingBottom: 60 }}
              // pull to refresh
              refreshing={isPending}
              onRefresh={refetch}
              // infinite scroll
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.3}
              // Loading indicator at bottom
              ListFooterComponent={() => {
                if (isFetchingNextPage) {
                  return (
                    <View className="py-4">
                      <ActivityIndicator size="small" color="#FFA840" />
                    </View>
                  );
                }
                return null;
              }}
            />
          </View>
        </>
      )}
    </View>
  );
};

export default Chats;
