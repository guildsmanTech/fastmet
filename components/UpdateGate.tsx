import {useAppUpdateCheck} from "@/hooks/useAppUpdateCheck";
import {useAppStore} from "@/store/useAppStore";
import * as Application from "expo-application";
import {Linking, Modal, Pressable, Text, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";

async function openStore(storeUrl: string) {
  const packageId = Application.applicationId;
  if (packageId) {
    try {
      // Opens the Play Store app directly. canOpenURL is not used: on
      // Android 11+ it needs a <queries> entry.
      await Linking.openURL(`market://details?id=${packageId}`);
      return;
    } catch {
      // fall through to the web listing
    }
  }
  try {
    await Linking.openURL(storeUrl);
  } catch {
    // nothing else to try
  }
}

function UpdateDialog({
  title,
  message,
  onUpdate,
  onLater,
}: {
  title: string;
  message: string;
  onUpdate: () => void;
  onLater?: () => void;
}) {
  return (
    <View className="items-center justify-center flex-1 px-6 bg-black/50">
      <View className="w-full p-6 bg-white rounded-2xl">
        <Text className="mb-2 text-lg text-center text-secondary font-montserrat-bold">
          {title}
        </Text>
        <Text className="mb-6 text-sm text-center text-neutral-600 font-montserrat">
          {message}
        </Text>
        <Pressable
          onPress={onUpdate}
          className="items-center py-3 rounded-full bg-lightPrimary active:bg-darkPrimary"
        >
          <Text className="text-white font-montserrat-bold">Update</Text>
        </Pressable>
        {onLater && (
          <Pressable onPress={onLater} className="items-center py-3 mt-2">
            <Text className="text-neutral-500 font-montserrat">Later</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * App update prompts, driven by the backend policy (useAppUpdateCheck) and by
 * 426 / socket rejections. Rendered outside the router Stack so it covers
 * every screen without touching the route guards.
 */
export default function UpdateGate() {
  useAppUpdateCheck();
  const insets = useSafeAreaInsets();

  const updateRequired = useAppStore((state) => state.updateRequired);
  const softUpdate = useAppStore((state) => state.softUpdate);
  const dismissSoftUpdate = useAppStore((state) => state.dismissSoftUpdate);

  const forceVisible = !!updateRequired && !updateRequired.deferred;
  const bannerVisible = !!updateRequired && updateRequired.deferred;
  const softVisible = !updateRequired && !!softUpdate;

  return (
    <>
      {bannerVisible && (
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 px-4"
          style={{top: insets.top + 8}}
        >
          <Pressable
            onPress={() => void openStore(updateRequired.storeUrl)}
            className="px-4 py-3 rounded-xl bg-secondary"
          >
            <Text className="text-sm text-center text-white font-montserrat">
              An app update is required once your current booking is complete.
            </Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={forceVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        // Android back button must not dismiss a forced update.
        onRequestClose={() => {}}
      >
        {updateRequired && (
          <UpdateDialog
            title="Update required"
            message="This version of FastMet is no longer supported. Please update to continue."
            onUpdate={() => void openStore(updateRequired.storeUrl)}
          />
        )}
      </Modal>

      <Modal
        visible={softVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissSoftUpdate}
      >
        {softUpdate && (
          <UpdateDialog
            title="Update available"
            message="A new version of FastMet is available with the latest fixes and features."
            onUpdate={() => void openStore(softUpdate.storeUrl)}
            onLater={dismissSoftUpdate}
          />
        )}
      </Modal>
    </>
  );
}
