import HeaderDrawer from "@/components/headers/HeaderDrawer";
import LogoutModal from "@/components/modals/logoutModal";
import NotLoggedInModal from "@/components/modals/notLoggedInModal";
import {useAuth} from "@/hooks/useAuth";
import {usePushNotifications} from "@/hooks/usePushNotification";
import {useAnnouncementUnreadCount} from "@/queries/announcementQueries";
import {useUnreadChatCount} from "@/queries/conversation";
import {useUnreadNotificationCount} from "@/queries/notification";
import {usePendingReportsAgainstMeCount} from "@/queries/reportQueries";
import {useVoucherBadgeCount} from "@/queries/rewardQueries";
import {useAppStore} from "@/store/useAppStore";
import {hasProfile} from "@/utils/helpers/onboarding";
import {Ionicons} from "@expo/vector-icons";
import {DrawerContentScrollView, DrawerItem} from "@react-navigation/drawer";
import {router, useFocusEffect} from "expo-router";
import {Drawer} from "expo-router/drawer";
import {useCallback, useEffect, useState} from "react";
import {Pressable, Text, View} from "react-native";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import {useSafeAreaInsets} from "react-native-safe-area-context";

export const unstable_settings = {
  initialRouteName: "book",
};

const CustomDrawerContent = (props: any) => {
  const inset = useSafeAreaInsets();
  const {isLoggedIn} = useAuth();
  const registrationStep = useAppStore((state) => state.registrationStep);

  const {state, descriptors, navigation} = props;

  const handlePress = (routeName: string) => {
    if (!isLoggedIn && routeName !== "book") {
      props.setShowNotLoggedInModal(true);
      return;
    }
    if (!hasProfile(registrationStep) && routeName === "profile") {
      router.replace("/(auth)/profile-register");
      return;
    }
    navigation.navigate(routeName);
  };

  return (
    <View className="flex-1">
      <DrawerContentScrollView {...props}>
        {state.routes.map((route: any, index: number) => {
          const {options} = descriptors[route.key];

          // Hide index route
          if (route.name === "index") return null;

          const focused = state.index === index;

          return (
            <DrawerItem
              key={route.key}
              label={options.drawerLabel ?? route.name}
              icon={({color, size}) =>
                options.drawerIcon?.({focused, color, size})
              }
              focused={focused}
              activeTintColor="#FFA840"
              inactiveTintColor="#FFFFFF"
              activeBackgroundColor="#1a3a4f"
              onPress={() => handlePress(route.name)}
            />
          );
        })}

        {/* Login / Logout action */}
        <Pressable
          className="flex-row gap-3 items-center px-5 py-4"
          onPress={() =>
            isLoggedIn
              ? props.setShowLogoutModal(true)
              : props.navigation.navigate("(auth)")
          }
        >
          <Ionicons
            name={isLoggedIn ? "log-out-outline" : "log-in-outline"}
            size={24}
            color="white"
          />
          <Text className="font-semibold text-white">
            {isLoggedIn ? "Logout" : "Register / Login"}
          </Text>
        </Pressable>
      </DrawerContentScrollView>

      {/* Footer */}
      <View style={{marginBottom: inset.bottom + 10}}>
        <Text className="text-sm tracking-widest text-center text-gray-400">
          www.fastmet.com.ph
        </Text>
      </View>
    </View>
  );
};

export default function DrawerLayout() {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showNotLoggedInModal, setShowNotLoggedInModal] = useState(false);

  usePushNotifications();
  const {isLoggedIn} = useAuth();

  // Fetch and sync unread counts
  useUnreadNotificationCount();
  useAnnouncementUnreadCount();
  useUnreadChatCount();

  // Fetch voucher badge count
  const {data: voucherBadgeCount, refetch: refetchVoucherBadge} =
    useVoucherBadgeCount();
  const {data: pendingReportsAgainstMeCount = 0} =
    usePendingReportsAgainstMeCount();

  // Refetch voucher badge when drawer/voucher screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        refetchVoucherBadge();
      }
    }, [isLoggedIn, refetchVoucherBadge]),
  );

  useEffect(() => {
    useAppStore.getState().fetchBookingTypes();
    useAppStore.getState().fetchVehicles();
  }, []);

  // useEffect(() => {
  //   if (notification) {
  //     // Invalidate notification queries to refresh the list and count
  //     queryClient.invalidateQueries({
  //       queryKey: ["notifications"],
  //     });
  //     queryClient.invalidateQueries({
  //       queryKey: ["notificationUnreadCount"],
  //     });

  //     if (notification.request?.content?.data?.type === "booking_completed") {
  //       // show modal or something

  //       queryClient.invalidateQueries({
  //         queryKey: ["userBookings", "active"],
  //         exact: false,
  //       });

  //       queryClient.invalidateQueries({
  //         queryKey: ["userBookings", "completed"],
  //         exact: false,
  //       });

  //       queryClient.invalidateQueries({
  //         queryKey: ["userBookingCounts"],
  //       });
  //     }
  //   }
  // }, [notification]);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <Drawer
        backBehavior="history"
        drawerContent={(props) => (
          <CustomDrawerContent
            {...props}
            setShowLogoutModal={setShowLogoutModal}
            setShowNotLoggedInModal={setShowNotLoggedInModal}
          />
        )}
        screenOptions={{
          headerShown: false,
          drawerStyle: {
            backgroundColor: "#0F2535",
          },
          drawerActiveTintColor: "#FFA840",
          drawerInactiveTintColor: "#FFFFFF",
          drawerActiveBackgroundColor: "#1a3a4f",
          drawerItemStyle: {
            borderRadius: 8,
          },

          headerStyle: {backgroundColor: "#0F2535"},
          headerLeft: () => null,
          headerTitle: ({children}) => <HeaderDrawer title={children} />,
        }}
      >
        <Drawer.Screen
          name="index"
          options={{drawerItemStyle: {display: "none"}}}
        />
        <Drawer.Screen
          name="book"
          options={{
            drawerLabel: "Book Now",
            title: "Book",
            drawerIcon: ({focused}) => (
              <Ionicons
                name={focused ? "navigate" : "navigate-outline"}
                size={24}
                color={focused ? "#FFA840" : "#FFFFFF"}
              />
            ),
          }}
        />
        <Drawer.Screen
          name="(tabs)"
          options={{
            drawerLabel: "Dashboard",
            title: "Home",
            drawerIcon: ({focused}) => (
              <Ionicons
                name={focused ? "speedometer" : "speedometer-outline"}
                size={24}
                color={focused ? "#FFA840" : "#FFFFFF"}
              />
            ),
          }}
        />
        <Drawer.Screen
          name="voucher"
          options={{
            drawerLabel: ({focused}) => {
              const count = voucherBadgeCount || 0;
              const displayCount = count > 9 ? "9+" : count.toString();
              const showBadge = count > 0;

              return (
                <View className="relative flex-row flex-1 justify-between items-center">
                  <Text
                    style={{
                      color: focused ? "#FFA840" : "#FFFFFF",
                      fontWeight: "500",
                    }}
                  >
                    Vouchers
                  </Text>
                  {showBadge && (
                    <View
                      className={`-top-0 -right-5 justify-center items-center ${count > 9 ? "w-7 h-6" : "w-6 h-6"} bg-red-500 rounded-full`}
                    >
                      <Text className="text-xs font-bold text-white">
                        {displayCount}
                      </Text>
                    </View>
                  )}
                </View>
              );
            },
            title: "Vouchers",
            headerShown: true,
            drawerIcon: ({focused}) => (
              <Ionicons
                name={focused ? "ticket" : "ticket-outline"}
                size={24}
                color={focused ? "#FFA840" : "#FFFFFF"}
              />
            ),
          }}
        />
        <Drawer.Screen
          name="profile"
          options={{
            popToTopOnBlur: true,
            drawerLabel: "My Profile",
            title: "My Profile",
            // headerShown: true,
            drawerIcon: ({focused}) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={24}
                color={focused ? "#FFA840" : "#FFFFFF"}
              />
            ),
          }}
        />
        <Drawer.Screen
          name="support"
          options={{
            popToTopOnBlur: true,
            drawerLabel: ({focused}) => (
              <View className="relative flex-row flex-1 justify-between items-center">
                <Text
                  style={{
                    color: focused ? "#FFA840" : "#FFFFFF",
                    fontWeight: "500",
                  }}
                >
                  Customer Support
                </Text>
                {pendingReportsAgainstMeCount > 0 && (
                  <View className="-top-0 -right-3 justify-center items-center bg-red-500 rounded-full size-2" />
                )}
              </View>
            ),
            title: "Customer Support",
            // headerShown: true,
            drawerIcon: ({focused}) => (
              <Ionicons
                name={focused ? "headset" : "headset-outline"}
                size={24}
                color={focused ? "#FFA840" : "#FFFFFF"}
              />
            ),
          }}
        />
        <Drawer.Screen
          name="settings"
          options={{
            drawerLabel: "Settings",
            title: "Settings",
            headerShown: true,
            drawerIcon: ({focused}) => (
              <Ionicons
                name={focused ? "settings" : "settings-outline"}
                size={24}
                color={focused ? "#FFA840" : "#FFFFFF"}
              />
            ),
          }}
        />
      </Drawer>
      <LogoutModal isOpen={showLogoutModal} setIsOpen={setShowLogoutModal} />
      <NotLoggedInModal
        visible={showNotLoggedInModal}
        setVisible={setShowNotLoggedInModal}
      />
    </GestureHandlerRootView>
  );
}
