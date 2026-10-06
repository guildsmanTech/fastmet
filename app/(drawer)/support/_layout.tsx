import HeaderDrawer from "@/components/headers/HeaderDrawer";
import HeaderProfile from "@/components/headers/HeaderProfile";
import {Stack} from "expo-router";

export default function SupportLayout() {
  return (
    <Stack
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
