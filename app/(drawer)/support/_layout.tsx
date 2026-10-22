import HeaderDrawer from "@/components/headers/HeaderDrawer";
import HeaderProfile from "@/components/headers/HeaderProfile";
import {Stack} from "expo-router";

// The drawer's popToTopOnBlur resets this stack when Support loses focus.
export default function SupportLayout() {
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
    </Stack>
  );
}
