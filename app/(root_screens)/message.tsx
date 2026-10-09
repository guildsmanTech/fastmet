import ImageViewer from "@/components/ImageViewer";
import { queryClient } from "@/lib/queryClient";
import { useConversationById } from "@/queries/conversation";
import { useSocket } from "@/sockets/context/SocketProvider";
import { useAppStore } from "@/store/useAppStore";
import { ConversationResponse, MessagesLoadedData } from "@/types/chat";
import {
  convertImageToBase64,
  openGallery,
  takePhoto,
} from "@/utils/helpers/imagePicker";
import { Ionicons } from "@expo/vector-icons";
import { InfiniteData } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { Bubble, GiftedChat, IMessage } from "react-native-gifted-chat";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const Message = () => {
  const params = useLocalSearchParams();
  const conversationId = params.conversationId as string;
  const {
    data: conversation,
    isPending,
    isError,
    error,
  } = useConversationById(conversationId);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [messages, setMessages] = useState<IMessage[]>([]);
  const messagesRef = useRef<IMessage[]>([]);
  const [text, setText] = useState("");
  const socket = useSocket();

  const [loadEarlier, setLoadEarlier] = useState(false);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [skip, setSkip] = useState(0);

  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [canSendMessages, setCanSendMessages] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    if (conversation?.hasActiveBooking != null) {
      setCanSendMessages(conversation.hasActiveBooking === true);
    }
  }, [conversation?.hasActiveBooking]);

  // Format message for GiftedChat
  const formatMessage = useCallback(
    (msg: any): IMessage => {
      const isMyMessage = msg.senderId === useAppStore.getState().id;

      return {
        _id: msg._id,
        text: msg.text || "",
        image: msg.image,
        createdAt: new Date(msg.createdAt),
        user: isMyMessage
          ? {
            _id: useAppStore.getState().id || "unknown",
            name: useAppStore.getState().name || "Me",
            avatar: useAppStore.getState().profilePictureUrl || "",
          }
          : {
            _id: conversation?.driver._id || "unknown",
            name:
              `${conversation?.driver.firstName} ${conversation?.driver.lastName}` ||
              "Driver",
            avatar: conversation?.driver.profilePictureUrl || "",
          },
      };
    },
    [conversation],
  );

  const handleLoadEarlier = () => {
    if (!conversationId || isLoadingEarlier) return;

    setIsLoadingEarlier(true);

    socket.emit("get_messages", {
      conversationId,
      limit: 20,
      skip,
    });
  };

  // Socket listeners
  useEffect(() => {
    if (!conversationId || !conversation) return;

    const driverId = conversation.driver._id;

    console.log("Opening chat, joining room...");

    // Join conversation room
    socket.emit("join_room", { clientId: useAppStore.getState().id, driverId });

    // Handle room joined
    const handleRoomJoined = (data: {
      conversationId: string;
      success: boolean;
      canSendMessages?: boolean;
    }) => {
      console.log("Room joined:", data.conversationId);

      if (typeof data.canSendMessages === "boolean") {
        setCanSendMessages(data.canSendMessages);
      }

      // Request message history
      socket.emit("get_messages", {
        conversationId: data.conversationId,
        limit: 20,
        skip: 0,
      });
    };

    // Handle message history loaded
    const handleMessagesLoaded = (data: MessagesLoadedData): void => {
      const formatted = data.messages.map(formatMessage);

      // If skip > 0, prepend older messages
      if (data.skip > 0) {
        setMessages((prev) => [...prev, ...formatted]);
      } else {
        // Initial load
        setMessages(formatted);
      }

      setSkip((prev) => prev + data.messages.length);
      setLoadEarlier(data.hasMore);
      setIsLoadingEarlier(false);
    };

    // Handle incoming messages
    const handleReceiveMessage = (msg: any) => {
      console.log("New message received:", msg);
      const formattedMessage = formatMessage(msg);
      setMessages((prev) => GiftedChat.append(prev, [formattedMessage]));
      setIsUploadingImage(false);
    };

    // Handle errors
    const handleMessageError = (error: { error?: string }) => {
      console.error("Message error:", error);
      setIsUploadingImage(false);
      Toast.show({
        type: "error",
        text1: "Message not sent",
        text2: error?.error || "Unable to send message",
      });
    };

    const handleChatReadonly = (data: {
      conversationId: string;
      canSendMessages: boolean;
    }) => {
      if (data.conversationId !== conversationId) return;
      setCanSendMessages(data.canSendMessages);
    };

    // Register listeners
    socket.on("room_joined", handleRoomJoined);
    socket.on("messages_loaded", handleMessagesLoaded);
    socket.on("receive_message", handleReceiveMessage);
    socket.on("message_error", handleMessageError);
    socket.on("chat_readonly", handleChatReadonly);

    // Cleanup
    return () => {
      console.log("Cleaning up chat listeners");
      socket.off("room_joined", handleRoomJoined);
      socket.off("messages_loaded", handleMessagesLoaded);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_error", handleMessageError);
      socket.off("chat_readonly", handleChatReadonly);
    };
  }, [conversationId, conversation, socket, formatMessage]);

  // Send message via socket
  const onSend = useCallback(
    (newMessages: IMessage[] = []) => {
      if (!conversation || !conversationId || !canSendMessages) {
        console.error("Missing required data for sending message");
        return;
      }

      newMessages.forEach((message) => {
        if (message.image) setIsUploadingImage(true);

        // Emit to socket
        socket.emit("send_message", {
          conversationId,
          senderId: useAppStore.getState().id,
          name: useAppStore.getState().name,
          receiverId: conversation.driver._id,
          text: message.text || "",
          image: message.image,
          profilePictureUrl: useAppStore.getState().profilePictureUrl,
        });
      });
    },
    [conversation, conversationId, socket, canSendMessages],
  );

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });
    useAppStore.getState().setIsInMessageScreen(true);
    useAppStore.getState().setActiveConversationId(conversationId);

    return () => {
      showSub.remove();
      hideSub.remove();
      useAppStore.getState().setIsInMessageScreen(false);
      useAppStore.getState().setActiveConversationId(null);
    };
  }, [conversationId]);

  // Keep ref in sync so beforeRemove has access to the latest messages
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      socket.emit("leave_room", { conversationId });

      // Reset unread count in conversations cache for this conversation
      type ConversationsPage = {
        conversations: ConversationResponse[];
        nextPage: number | null;
      };

      const latestMsg = messagesRef.current[0];
      const driverId = useAppStore.getState().id;

      queryClient.setQueriesData<InfiniteData<ConversationsPage>>(
        { queryKey: ["conversations"] },
        (old) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              conversations: page.conversations.map((c) => {
                if (c._id !== conversationId) return c;
                const updated = {
                  ...c,
                  unreadCount: { ...c.unreadCount, client: 0 },
                };
                if (latestMsg) {
                  updated.lastMessage =
                    latestMsg.text ||
                    (latestMsg.image ? "Sent an image" : c.lastMessage);
                  updated.lastMessageAt = new Date(
                    latestMsg.createdAt,
                  ).toISOString();
                  updated.lastMessageBy =
                    latestMsg.user._id === driverId ? "client" : "driver";
                }
                return updated;
              }),
            })),
          };
        },
      );
    });

    return () => unsubscribe();
  }, [navigation, conversationId, socket]);

  useEffect(() => {
    if (isError) {
      console.log(error);
      router.back();
    }
  }, [error, isError]);

  // Pick image from gallery
  const handlePickImage = async () => {
    const result = await openGallery();

    if (result && !result.canceled && result.assets[0]) {
      try {
        const base64data = await convertImageToBase64(result.assets[0].uri);

        const newMessage: IMessage = {
          _id: Date.now().toString(),
          text: "",
          createdAt: new Date(),
          user: {
            _id: useAppStore.getState().id!,
            name: useAppStore.getState().name || "Me",
          },
          image: base64data,
        };
        onSend([newMessage]);
      } catch (error) {
        console.error("Error converting image:", error); // What's the exact error?
      }
    } else {
      console.log("No image selected or cancelled"); // ADD THIS
    }
  };

  // not working, socket getting disconnected when sending image
  const handleTakePhoto = async () => {
    const imageUri = await takePhoto();

    if (!imageUri) return;

    try {
      const base64data = await convertImageToBase64(imageUri);

      const newMessage: IMessage = {
        _id: Date.now().toString(),
        text: "",
        createdAt: new Date(),
        user: {
          _id: useAppStore.getState().id!,
          name: useAppStore.getState().name || "Me",
        },
        image: base64data,
      };

      onSend([newMessage]);
    } catch (e) {
      console.error("Error converting image:", e);
    }
  };

  const renderInputToolbar = () => {
    if (!canSendMessages) {
      return (
        <View className="px-4 py-4 border-t border-gray-700 bg-secondary">
          <Text className="text-center text-gray-400">
            This chat is now read-only. The booking has been completed.
          </Text>
        </View>
      );
    }

    return (
      <View className="px-2 py-3 border-t border-gray-700 bg-secondary">
        <View className="flex-row gap-3 items-end">
          <View className="flex-row gap-3 items-center h-11">
            {/* Camera */}
            <Pressable
              onPress={handleTakePhoto}
              disabled={isUploadingImage} // Disable while uploading
            >
              <Ionicons
                name="camera"
                size={Platform.OS === "ios" ? 32 : 28}
                color={isUploadingImage ? "#666" : "#FFA840"}
              />
            </Pressable>

            {/* Gallery */}
            <Pressable
              onPress={handlePickImage}
              disabled={isUploadingImage} // Disable while uploading
            >
              <Ionicons
                name="image"
                size={Platform.OS === "ios" ? 32 : 28}
                color={isUploadingImage ? "#666" : "#FFA840"}
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
              editable={!isUploadingImage} // Disable while uploading
              className="py-3 text-base"
              style={{
                maxHeight: 120,
                textAlignVertical: "top",
              }}
            />
          </View>

          <View className="flex-row gap-3 items-center h-11">
            {/* Show spinner while uploading */}
            {isUploadingImage ? (
              <ActivityIndicator size="small" color="#FFA840" />
            ) : (
              <>
                {/* Send */}
                <Pressable
                  disabled={!text.trim()}
                  hitSlop={20}
                  onPress={() => {
                    if (!text.trim()) return;
                    onSend([
                      {
                        _id: Date.now(),
                        text,
                        createdAt: new Date(),
                        user: { _id: useAppStore.getState().id! },
                      },
                    ]);
                    setText("");
                  }}
                >
                  <Ionicons
                    name="send"
                    size={Platform.OS === "ios" ? 32 : 28}
                    color="#FFA840"
                  />
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Optional: Show uploading text */}
        {isUploadingImage && (
          <Text className="mt-2 text-sm text-center text-gray-400">
            Uploading image...
          </Text>
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

            {conversation?.driver?.profilePictureUrl ? (
              <Image
                source={{ uri: conversation.driver.profilePictureUrl }}
                style={{ width: 40, height: 40, borderRadius: 999 }}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="person-circle" size={40} color="#F7931E" />
            )}

            <View className="flex-1">
              <Text className="text-base font-bold text-white">
                {conversation?.driver.firstName} {conversation?.driver.lastName}
              </Text>
              <View className="flex-row gap-1 items-center">
                <Text className="text-xs ml-0.5 text-gray-300">Driver</Text>
                {conversation?.driver.gender ? (
                  <Ionicons
                    name={
                      conversation.driver.gender === "male" ? "male" : "female"
                    }
                    size={16}
                    color="#FFA840"
                  />
                ) : null}
              </View>
            </View>
          </View>

          {canSendMessages && (
            <Pressable
              hitSlop={20}
              onPress={() => {
                const phoneNumber = conversation?.driver.phoneNumber;
                if (!phoneNumber) return;
                Linking.openURL(`tel:${phoneNumber}`).catch(() => {
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
          messages={messages}
          onSend={(messages) => onSend(messages)}
          user={{
            _id: useAppStore.getState().id!,
            name: useAppStore.getState().name || "Me",
          }}
          loadEarlier={loadEarlier}
          onLoadEarlier={handleLoadEarlier}
          isLoadingEarlier={isLoadingEarlier}
          renderBubble={renderBubble}
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

// Custom Bubble
const renderBubble = (props: any) => {
  return (
    <Bubble
      {...props}
      wrapperStyle={{
        right: {
          backgroundColor: "#FFA840",
        },
        left: {
          backgroundColor: "#E5E5E5",
        },
      }}
      textStyle={{
        right: {
          color: "white",
          fontSize: 15,
        },
        left: {
          color: "#1F2937",
          fontSize: 15,
        },
      }}
    />
  );
};

export const renderChatEmpty = () => {
  return (
    <View
      className="items-center px-6 pb-20"
      style={{
        transform: [{ scaleY: -1 }, { scaleX: Platform.OS === "android" ? -1 : 1 }],
      }}
    >
      <Ionicons name="chatbubbles-outline" size={100} color="#9CA3AF" />
      <Text className="mt-4 text-xl font-semibold text-gray-300">
        No conversation yet
      </Text>
      <Text className="mt-2 text-base text-center text-gray-400">
        Start a conversation with the customer
      </Text>
    </View>
  );
};
