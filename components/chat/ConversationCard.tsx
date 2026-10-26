import {ConversationResponse} from "@/types/chat";
import {formatLastMessageTime} from "@/utils/helpers/date";
import {openChat} from "@/utils/helpers/openChat";
import {Ionicons} from "@expo/vector-icons";
import {Image} from "expo-image";
import React from "react";
import {Pressable, Text, View} from "react-native";

const ConversationCard = ({item}: {item: ConversationResponse}) => {
  return (
    <Pressable
      className="flex-row items-center gap-4 px-4 py-2 active:bg-ctaSecondary"
      onPress={() => openChat(item._id)}
    >
      {item.driver.profilePictureUrl ? (
        <Image
          source={{uri: item.driver.profilePictureUrl}}
          style={{width: 50, height: 50, borderRadius: 999}}
          contentFit="cover"
        />
      ) : (
        <Ionicons name="person-circle" size={50} color="#F7931E" />
      )}
      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between">
          <Text
            className={`font-bold max-w-[70%] capitalize ${item.unreadCount.client > 0 ? "font-bold" : ""}`}
            numberOfLines={1}
          >
            {item.driver.firstName} {item.driver.lastName}
          </Text>
          <Text
            className={`text-xs text-gray-400 ${item.unreadCount.client > 0 ? "font-bold" : ""}`}
          >
            {formatLastMessageTime(item.lastMessageAt)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between pl-0.5">
          <Text
            className={`text-sm max-w-[80%] ${item.unreadCount.client > 0 ? "font-extrabold text-black" : "text-gray-600 font-medium"}`}
            numberOfLines={1}
          >
            {item.lastMessageBy === "client" ? "You: " : ""}
            {item.lastMessage}
          </Text>
          {item.unreadCount.client > 0 ? (
            <View className="bg-red-500 size-5 items-center justify-center rounded-full">
              <Text className="text-xs font-bold text-white">
                {item.unreadCount.client}
              </Text>
            </View>
          ) : item.unreadCount.driver === 0 &&
            item.lastMessageBy === "client" ? (
            <Text className="text-xs font-bold text-white">seen</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

export default ConversationCard;
