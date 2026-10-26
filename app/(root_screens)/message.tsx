import ImageViewer from "@/components/ImageViewer";
import {
  ChatReadOnlyNotice,
  fullName,
  renderChatBubble,
  renderChatEmpty,
} from "@/components/chat/ChatParts";
import { useChatRoom } from "@/hooks/useChatRoom";
import { useConversationById } from "@/queries/conversation";
import { useAppStore } from "@/store/useAppStore";
import { pickChatImage } from "@/utils/helpers/imagePicker";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { GiftedChat } from "react-native-gifted-chat";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const Message = () => {
  const params = useLocalSearchParams();
  const conversationId = params.conversationId as string;
  const { data: conversation, isPending, isError } =
    useConversationById(conversationId);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [text, setText] = useState("");
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");

  const myId = useAppStore((s) => s.id) ?? "";
  const myName = useAppStore((s) => s.name);
  const myAvatar = useAppStore((s) => s.profilePictureUrl);
  const driver = conversation?.driver;
  const driverName = fullName(driver?.firstName, driver?.lastName, "Driver");

  const chat = useChatRoom({
    conversationId,
    enabled: !!conversationId,
    surface: "screen",
    me: { id: myId, name: myName || "Me", avatar: myAvatar || undefined },
    counterpart: {
      id: driver?._id ?? "",
      name: driverName,
      avatar: driver?.profilePictureUrl,
    },
  });
  const { canSendMessages, isSendingImage } = chat;

  // One chat covers every booking with this driver; name them when there are several.
  const sharedRefs = conversation?.activeBookingRefs ?? [];

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!isError && !chat.unavailable) return;
    Toast.show({
      type: "error",
      text1: "Chat unavailable",
      text2: "This conversation could not be opened.",
    });
    router.back();
  }, [isError, chat.unavailable]);

  const handleSendText = async () => {
    const value = text;
    if (!value.trim()) return;
    setText("");
    const sent = await chat.sendText(value);
    // Keep what the user typed if it did not go through.
    if (!sent) setText((current) => current || value);
  };

  const handleImage = async (source: "camera" | "gallery") => {
    try {
      const image = await pickChatImage(source);
      if (image) await chat.sendImage(image);
    } catch (e) {
      console.error("Error picking image:", e);
    }
  };

  const renderInputToolbar = () => {
    if (!canSendMessages) return <ChatReadOnlyNotice />;

    return (
      <View className="px-2 py-3 border-t border-gray-700 bg-secondary">
        <View className="flex-row gap-3 items-end">
          <View className="flex-row gap-3 items-center h-11">
            {/* Camera */}
            <Pressable
              onPress={() => handleImage("camera")}
              disabled={isSendingImage}
            >
              <Ionicons
                name="camera"
                size={Platform.OS === "ios" ? 32 : 28}
                color={isSendingImage ? "#666" : "#FFA840"}
              />
            </Pressable>

            {/* Gallery */}
            <Pressable
              onPress={() => handleImage("gallery")}
              disabled={isSendingImage}
            >
              <Ionicons
                name="image"
                size={Platform.OS === "ios" ? 32 : 28}
                color={isSendingImage ? "#666" : "#FFA840"}
              />
            </Pressable>
          </View>

          {/* Text input */}
          <View className="flex-1 px-2 bg-white rounded-2xl">
            <TextInput
              placeholder="Type a message..."
              placeholderTextColor="#9FABB4"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={2000}
              className="py-3 text-base"
              style={{
                maxHeight: 120,
                textAlignVertical: "top",
              }}
            />
          </View>

          <View className="flex-row gap-3 items-center h-11">
            {/* Send */}
            <Pressable
              disabled={!text.trim()}
              hitSlop={20}
              onPress={handleSendText}
            >
              <Ionicons
                name="send"
                size={Platform.OS === "ios" ? 32 : 28}
                color="#FFA840"
              />
            </Pressable>
          </View>
        </View>

        {isSendingImage && (
          <View className="flex-row gap-2 justify-center items-center mt-2">
            <ActivityIndicator size="small" color="#FFA840" />
            <Text className="text-sm text-gray-400">Sending image...</Text>
          </View>
        )}
      </View>
    );
  };

  const renderMessageImage = (props: any) => {
    return (
      <Pressable
        onPress={() => {
          setSelectedImageUrl(props.currentMessage.image);
          setImageViewerVisible(true);
        }}
      >
        <Image
          source={{ uri: props.currentMessage.image }}
          contentFit="contain"
          style={{
            width: 200,
            height: 200,
            borderRadius: 13,
            margin: 3,
            opacity: props.currentMessage.pending ? 0.6 : 1,
          }}
        />
      </Pressable>
    );
  };

  if (isPending) {
    return (
      <View className="flex-1 justify-center items-center bg-secondary">
        <ActivityIndicator size="large" color="#FFA840" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-secondary">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : keyboardVisible
              ? "height"
              : undefined
        }
        keyboardVerticalOffset={0}
      >
        <View className="flex-row justify-between items-center px-4 py-3 bg-secondary">
          <View className="flex-row flex-1 gap-2 items-center">
            <Pressable
              hitSlop={20}
              onPress={() => {
                router.back();
              }}
              className="p-2"
            >
              <Ionicons
                name="chevron-back"
                size={Platform.OS === "ios" ? 30 : 28}
                color="#FFA840"
              />
            </Pressable>

            {driver?.profilePictureUrl ? (
              <Image
                source={{ uri: driver.profilePictureUrl }}
                style={{ width: 40, height: 40, borderRadius: 999 }}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="person-circle" size={40} color="#F7931E" />
            )}

            <View className="flex-1">
              <Text className="text-base font-bold text-white capitalize">
                {driverName}
              </Text>
              <View className="flex-row gap-1 items-center">
                <Text className="text-xs ml-0.5 text-gray-300">Driver</Text>
                {driver?.gender ? (
                  <Ionicons
                    name={driver.gender === "male" ? "male" : "female"}
                    size={16}
                    color="#FFA840"
                  />
                ) : null}
              </View>
              {canSendMessages && sharedRefs.length > 1 && (
                <Text
                  className="text-[11px] ml-0.5 text-[#FFA840]"
                  numberOfLines={1}
                >
                  {sharedRefs.length} bookings · {sharedRefs.join(", ")}
                </Text>
              )}
            </View>
          </View>

          {canSendMessages && !!driver?.phoneNumber && (
            <Pressable
              hitSlop={20}
              onPress={() => {
                Linking.openURL(`tel:${driver.phoneNumber}`).catch(() => {
                  Alert.alert("Unable to place call", "Please try again.");
                });
              }}
            >
              <Ionicons
                name="call"
                size={Platform.OS === "ios" ? 28 : 24}
                color="#FFA840"
              />
            </Pressable>
          )}
        </View>

        <GiftedChat
          messages={chat.messages}
          user={{ _id: myId, name: myName || "Me" }}
          loadEarlier={chat.hasMore}
          onLoadEarlier={chat.loadEarlier}
          isLoadingEarlier={chat.isLoadingEarlier}
          renderBubble={renderChatBubble}
          renderInputToolbar={renderInputToolbar}
          renderSend={() => null}
          renderMessageImage={renderMessageImage}
          keyboardShouldPersistTaps="handled"
          isKeyboardInternallyHandled={false}
          renderChatEmpty={renderChatEmpty}
          listViewProps={
            {
              contentContainerStyle: {
                paddingTop: 10,
              },
            } as any
          }
        />
      </KeyboardAvoidingView>

      <ImageViewer
        images={[{ uri: selectedImageUrl }]}
        imageIndex={0}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
      />
    </SafeAreaView>
  );
};

export default Message;
