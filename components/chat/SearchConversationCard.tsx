import { ConversationResponse } from "@/types/chat";
import { pushOnce } from "@/utils/helpers/navigation";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

const SearchConversationCard = ({ item }: { item: ConversationResponse }) => {
    return (
        <Pressable className="flex-row items-center gap-4 px-4 py-2 active:bg-ctaSecondary" onPress={() =>
            pushOnce({
                pathname: "/message",
                params: { conversationId: item._id },
            })
        }>
            {item.driver.profilePictureUrl ? (
                <Image
                    source={{ uri: item.driver.profilePictureUrl }}
                    style={{ width: 40, height: 40, borderRadius: 999 }}
                    contentFit="cover"
                />
            ) : (
                <Ionicons name="person-circle" size={40} color="#F7931E" />
            )}
            <View className="flex-1 gap-1">
                <Text className="font-bold max-w-[60%] capitalize" numberOfLines={1}>{item.driver.firstName} {item.driver.lastName}</Text>
            </View>
        </Pressable>
    );
};

export default SearchConversationCard;
