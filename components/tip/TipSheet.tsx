import {Ionicons} from "@expo/vector-icons";
import {useEffect, useMemo, useState} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";

const PRESETS = [20, 50, 100, 200];

const peso = (amount: number) => `₱${amount.toLocaleString("en-US")}`;

type Props = {
  visible: boolean;
  currentTip: number;
  maxTip: number;
  /** A driver has an offer the customer could accept: the tip can only go up. */
  locked: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
};

/**
 * Bottom sheet to add, change or remove a tip. Presets plus a custom amount,
 * capped at `maxTip`. While `locked`, amounts below the current tip and
 * "Remove tip" are disabled.
 */
export default function TipSheet({
  visible,
  currentTip,
  maxTip,
  locked,
  pending,
  onClose,
  onSubmit,
}: Props) {
  const inset = useSafeAreaInsets();
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");

  // Start from the current tip each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    if (currentTip > 0 && !PRESETS.includes(currentTip)) {
      setSelected(null);
      setCustom(String(currentTip));
    } else {
      setSelected(currentTip > 0 ? currentTip : null);
      setCustom("");
    }
  }, [visible, currentTip]);

  const presets = useMemo(() => PRESETS.filter((p) => p <= maxTip), [maxTip]);
  const minAllowed = locked ? currentTip : 0;

  const customValue = custom === "" ? null : Number(custom);
  const amount = customValue ?? selected;

  const error = (() => {
    if (customValue !== null) {
      if (!Number.isInteger(customValue) || customValue < 1) {
        return "Enter a whole peso amount.";
      }
      if (customValue > maxTip) return `Tips can be up to ${peso(maxTip)}.`;
    }
    // Also covers a preset picked before a driver offered.
    if (amount !== null && amount < minAllowed) {
      return `A driver is offering, so the tip can't go below ${peso(currentTip)}.`;
    }
    return null;
  })();

  const canSubmit =
    amount !== null && !error && amount !== currentTip && !pending;

  const submitLabel =
    amount === null
      ? "Choose an amount"
      : currentTip > 0
        ? amount === currentTip
          ? "No change"
          : `Change tip to ${peso(amount)}`
        : `Add ${peso(amount)} tip`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* A Modal isn't resized for the keyboard on Android (more so with
          statusBarTranslucent), so pad on both platforms. */}
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <Pressable
          className="flex-1 bg-black/50"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          className="px-5 pt-5 bg-white rounded-t-3xl"
          style={{paddingBottom: inset.bottom + 16}}
        >
          {/* Header */}
          <View className="flex-row justify-between items-start">
            <View className="flex-row flex-1 gap-3 items-center">
              <View className="justify-center items-center bg-green-100 rounded-full size-11">
                <Ionicons name="gift" size={22} color="#16A34A" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-900">
                  Tip your driver
                </Text>
                <Text className="text-xs text-gray-500">
                  100% goes to your driver, paid together with your fare.
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={16}>
              <Ionicons name="close" size={26} color="#6B7280" />
            </Pressable>
          </View>

          <View className="flex-row gap-2 items-center px-3 py-2 mt-4 bg-orange-50 rounded-xl">
            <Ionicons name="flash" size={16} color="#ED8718" />
            <Text className="flex-1 text-xs text-orange-800">
              Drivers see your tip right away. It can help you get a driver
              faster.
            </Text>
          </View>

          {locked && (
            <View className="flex-row gap-2 items-start px-3 py-2 mt-3 bg-amber-50 rounded-xl border border-amber-200">
              <Ionicons name="lock-closed" size={16} color="#B45309" />
              <Text className="flex-1 text-xs text-amber-800">
                A driver is offering on your current tip. You can raise it, but
                not lower or remove it.
              </Text>
            </View>
          )}

          {/* Presets */}
          <View className="flex-row gap-2 mt-4">
            {presets.map((preset) => {
              const disabled = preset < minAllowed;
              const active = customValue === null && selected === preset;
              return (
                <Pressable
                  key={preset}
                  disabled={disabled || pending}
                  onPress={() => {
                    setSelected(preset);
                    setCustom("");
                  }}
                  className={`flex-1 items-center py-3 rounded-xl border ${
                    active
                      ? "bg-green-500 border-green-500"
                      : disabled
                        ? "bg-gray-50 border-gray-200 opacity-40"
                        : "bg-white border-gray-300 active:bg-gray-50"
                  }`}
                >
                  <Text
                    className={`text-base font-bold ${
                      active ? "text-white" : "text-gray-800"
                    }`}
                  >
                    {peso(preset)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Custom amount */}
          <View
            className={`flex-row items-center px-4 mt-3 rounded-xl border ${
              error
                ? "border-red-400"
                : customValue !== null
                  ? "border-green-500"
                  : "border-gray-300"
            }`}
          >
            <Text className="text-base font-semibold text-gray-500">₱</Text>
            <TextInput
              value={custom}
              onChangeText={(text) => {
                setCustom(text.replace(/[^0-9]/g, "").slice(0, 6));
                setSelected(null);
              }}
              editable={!pending}
              keyboardType="number-pad"
              placeholder={`Other amount (up to ${peso(maxTip)})`}
              placeholderTextColor="#9CA3AF"
              className="flex-1 py-3 ml-2 text-base text-gray-900"
              returnKeyType="done"
            />
          </View>
          {error && <Text className="mt-1 text-xs text-red-500">{error}</Text>}

          {/* Actions */}
          <Pressable
            disabled={!canSubmit}
            onPress={() => amount !== null && onSubmit(amount)}
            className={`flex-row gap-2 justify-center items-center py-4 mt-5 rounded-2xl ${
              canSubmit ? "bg-green-500 active:bg-green-600" : "bg-gray-300"
            }`}
          >
            {pending && <ActivityIndicator size="small" color="white" />}
            <Text className="text-base font-bold text-white">
              {pending ? "Updating..." : submitLabel}
            </Text>
          </Pressable>

          {currentTip > 0 && !locked && (
            <Pressable
              disabled={pending}
              onPress={() => onSubmit(0)}
              className="items-center py-3 mt-2 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-red-500">
                Remove tip
              </Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
