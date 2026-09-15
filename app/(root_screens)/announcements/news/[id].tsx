import {useMarkAnnouncementAsRead} from "@/mutations/announcementMutation";
import {useNews} from "@/queries/announcementQueries";
import {Ionicons} from "@expo/vector-icons";
import {Image} from "expo-image";
import {router, useLocalSearchParams} from "expo-router";
import {useEffect} from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import RenderHTML from "react-native-render-html";
import {useSafeAreaInsets} from "react-native-safe-area-context";

const tagsStyles = {
  body: {
    color: "#111827",
    fontSize: 15,
    lineHeight: 22,
  },
  p: {marginTop: 0, marginBottom: 12},
  strong: {fontWeight: "700" as const},
  b: {fontWeight: "700" as const},
  em: {fontStyle: "italic" as const},
  i: {fontStyle: "italic" as const},
  u: {textDecorationLine: "underline" as const},
  a: {color: "#FFA840", textDecorationLine: "underline" as const},
  h1: {
    fontSize: 20,
    fontWeight: "700" as const,
    marginTop: 16,
    marginBottom: 8,
  },
  h2: {
    fontSize: 18,
    fontWeight: "700" as const,
    marginTop: 16,
    marginBottom: 8,
  },
  h3: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginTop: 12,
    marginBottom: 6,
  },
  ul: {marginTop: 0, marginBottom: 12},
  ol: {marginTop: 0, marginBottom: 12},
  li: {marginBottom: 4},
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#FFA840",
    paddingLeft: 12,
    marginLeft: 0,
    fontStyle: "italic" as const,
  },
};

export default function NewsDetailScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const {data: news, isLoading} = useNews(id!);
  const {mutate: markAsRead} = useMarkAnnouncementAsRead();

  useEffect(() => {
    if (news && !news.isRead) {
      markAsRead({id: news._id, contentType: "news"});
    }
  }, [news, markAsRead]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!news) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-400">News not found</Text>
      </View>
    );
  }

  const handleCtaPress = () => {
    if (news.cta?.url?.startsWith("/")) {
      router.push(news.cta.url);
    } else if (news.cta?.url) {
      Linking.openURL(news.cta.url);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{paddingBottom: 24 + insets.bottom}}>
        <View className="relative">
          <Image
            source={{uri: news.heroImage}}
            style={{width: "100%", height: 220}}
            contentFit="cover"
          />

          <Pressable
            onPress={() => router.back()}
            className="absolute left-4 z-10 p-2 rounded-full bg-black/30"
            style={{top: insets.top + 8}}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
        </View>

        <View className="px-4 pt-4">
          <View className="flex-row gap-2 items-center">
            <View className="px-2 py-0.5 rounded-full bg-orange-100">
              <Text className="text-xs font-medium text-orange-700">
                {news.tag}
              </Text>
            </View>

            <Text className="text-xs text-gray-400">
              {news.readTime} min read
            </Text>
          </View>

          <Text className="mt-2 text-xl font-bold text-gray-900">
            {news.title}
          </Text>

          <View className="mt-4">
            <RenderHTML
              contentWidth={width - 32}
              source={{html: news.content}}
              tagsStyles={tagsStyles}
              enableExperimentalMarginCollapsing
            />
          </View>

          {(news.cta?.title || news.cta?.url) && (
            <View className="p-4 mt-6 bg-gray-50 rounded-xl">
              {news.cta?.title && (
                <Text className="font-semibold text-gray-900">
                  {news.cta.title}
                </Text>
              )}

              {news.cta?.description && (
                <Text className="mt-1 text-sm text-gray-500">
                  {news.cta.description}
                </Text>
              )}

              {news.cta?.url && (
                <Pressable
                  className="items-center py-3 mt-3 rounded-full bg-[#FFA840]"
                  onPress={handleCtaPress}
                >
                  <Text className="font-semibold text-white">
                    {news.cta.label ?? "Learn more"}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
