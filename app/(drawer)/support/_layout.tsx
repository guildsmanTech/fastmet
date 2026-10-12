import HeaderDrawer from "@/components/headers/HeaderDrawer";
import HeaderProfile from "@/components/headers/HeaderProfile";
import {StackActions, useNavigation} from "@react-navigation/native";
import {Stack} from "expo-router";
import {useEffect} from "react";

export default function SupportLayout() {
  const navigation = useNavigation();

  useEffect(() => {
    const drawer = navigation.getParent();
    if (!drawer) return;

    return drawer.addListener("blur", () => {
      navigation.dispatch(StackActions.popToTop());
    });
  }, [navigation]);

  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerStyle: {backgroundColor: "#0F2535"},
        headerLeft: () => null,
        headerBackVisible: false, // <- disables built-in back
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Customer Support",
          headerTitle: ({children}) => <HeaderDrawer title={children} />,
        }}
      />
      <Stack.Screen
        name="fileReport"
        options={{
          title: "File Report",
          headerTitle: ({children}) => (
            <HeaderProfile title={children} fallbackHref="/(drawer)/support" />
          ),
        }}
      />
      <Stack.Screen
        name="reportDetail"
        options={{
          title: "Report Detail",
          headerTitle: ({children}) => (
            <HeaderProfile title={children} fallbackHref="/(drawer)/support" />
          ),
        }}
      />
    </Stack>
  );
}
