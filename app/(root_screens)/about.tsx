import React from "react";
import {ScrollView, View, Text} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";

type IconName = keyof typeof Ionicons.glyphMap;

const ORANGE = "#E8891D";

const VEHICLES: {need: string; vehicle: string; icon: IconName}[] = [
  {need: "Small parcel", vehicle: "Motorcycle", icon: "bicycle"},
  {need: "Multiple boxes", vehicle: "Car", icon: "car-sport"},
  {need: "Bulky items", vehicle: "Van", icon: "bus"},
  {need: "Commercial cargo", vehicle: "Truck", icon: "cube"},
];

const AUDIENCE: {title: string; text: string; icon: IconName}[] = [
  {
    title: "Users",
    text: "Need a simple and convenient delivery option.",
    icon: "person",
  },
  {
    title: "Businesses",
    text: "Need dependable support for daily operations.",
    icon: "storefront",
  },
  {
    title: "Partner-drivers",
    text: "Need flexible earning opportunities.",
    icon: "bicycle",
  },
];

const VALUES: {title: string; text: string; icon: IconName}[] = [
  {
    title: "Fast",
    icon: "flash",
    text: "We value your time. Every delivery is quick and efficient because every minute matters.",
  },
  {
    title: "Reliable",
    icon: "shield-checkmark",
    text: "Consistent service that customers, businesses, and partner-drivers can depend on.",
  },
  {
    title: "Easy",
    icon: "happy",
    text: "Delivery that is simple, convenient, and accessible for everyone.",
  },
  {
    title: "Empower",
    icon: "trending-up",
    text: "Opportunities that help Filipino partner-drivers earn and grow.",
  },
  {
    title: "Together",
    icon: "heart",
    text: "Growth is better when we grow together.",
  },
];

const FOUNDERS = [
  {
    name: "Joshua Estopia",
    initials: "JE",
    quote:
      "I believe technology matters most when it makes everyday life easier and creates real opportunities for people.",
  },
  {
    name: "Dexter Junio",
    initials: "DJ",
    quote:
      "I believe Filipino delivery drivers deserve more than opportunities to earn. They deserve to be valued, respected, and supported.",
  },
];

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <View className="p-5 mb-4 bg-white rounded-2xl">
      <View className="flex-row items-center gap-2 mb-3">
        <Ionicons name={icon} size={20} color={ORANGE} />
        <Text className="text-lg font-bold text-brand-navy">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function IconBadge({name, dark = false}: {name: IconName; dark?: boolean}) {
  return (
    <View
      className={`h-10 w-10 items-center justify-center rounded-full ${dark ? "bg-brand-navy" : "bg-brand-orange/15"}`}
    >
      <Ionicons name={name} size={18} color={dark ? "#fff" : ORANGE} />
    </View>
  );
}

export default function AboutScreen() {
  const inset = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-neutral-100"
      contentContainerClassName="p-4"
      contentContainerStyle={{paddingBottom: 16 + inset.bottom}}
    >
      {/* Intro */}
      <View className="p-5 mb-4 rounded-2xl bg-brand-navy">
        <Text className="text-2xl font-extrabold leading-8 text-brand-orange">
          Para sa Mas Mabilis at Mas Madaling Delivery
        </Text>
        <Text className="mt-3 text-sm leading-6 text-white/90">
          FastMet is an on-demand delivery platform for individuals, businesses,
          and partner-drivers. We connect users with the right vehicle and
          partner-driver for different delivery needs.
        </Text>
      </View>

      {/* Vehicles */}
      <Section title="The right vehicle for every delivery" icon="car-sport">
        <Text className="mb-3 text-sm leading-6 text-neutral-700">
          Hindi pare-pareho ang bawat delivery. FastMet brings different vehicle
          options into one platform so your item gets matched with the right
          ride.
        </Text>
        {VEHICLES.map((v, i) => (
          <View
            key={v.vehicle}
            className={`flex-row items-center gap-3 py-3 ${i > 0 ? "border-t border-neutral-200" : ""}`}
          >
            <IconBadge name={v.icon} dark />
            <Text className="flex-1 text-sm text-neutral-700">{v.need}</Text>
            <Ionicons name="arrow-forward" size={14} color={ORANGE} />
            <Text className="w-24 text-sm font-semibold text-right text-brand-navy">
              {v.vehicle}
            </Text>
          </View>
        ))}
      </Section>

      {/* Better route */}
      <Section title="A better route for everyone" icon="people">
        <Text className="text-sm leading-6 text-neutral-700">
          Sa Greater Manila, mabilis ang takbo ng buhay at negosyo. FastMet
          connects users, businesses, and partner-drivers so everyone can move
          forward together.
        </Text>
        <View className="gap-4 mt-4">
          {AUDIENCE.map((a) => (
            <View key={a.title} className="flex-row items-center gap-3">
              <IconBadge name={a.icon} />
              <View className="flex-1">
                <Text className="text-sm font-bold text-brand-navy">
                  {a.title}
                </Text>
                <Text className="text-sm leading-5 text-neutral-600">
                  {a.text}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      {/* Vision */}
      <Section title="Our vision" icon="eye">
        <Text className="text-sm font-semibold leading-6 text-brand-navy">
          To become one of the Philippines' most trusted on-demand delivery
          platforms, built on fast, fair, and reliable service.
        </Text>
        <Text className="mt-2 text-sm leading-6 text-neutral-600">
          Maging isa sa mga pinaka-pinagkakatiwalaang on-demand delivery
          platforms sa Pilipinas.
        </Text>
      </Section>

      {/* Mission */}
      <Section title="Our mission" icon="rocket">
        <Text className="text-sm font-semibold leading-6 text-brand-navy">
          To make every delivery faster, easier, and more reliable, while
          creating better opportunities for our partner-drivers.
        </Text>
        <Text className="mt-2 text-sm leading-6 text-neutral-600">
          Gawing mas mabilis, mas madali, at mas maasahan ang bawat pagpapadala.
        </Text>
      </Section>

      {/* Values */}
      <Section title="Our values" icon="star">
        <View className="gap-4">
          {VALUES.map((v) => (
            <View key={v.title} className="flex-row items-start gap-3">
              <IconBadge name={v.icon} />
              <View className="flex-1">
                <Text className="text-sm font-bold text-brand-navy">
                  {v.title}
                </Text>
                <Text className="text-sm leading-5 text-neutral-600">
                  {v.text}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      {/* Founders */}
      <Section title="Meet the founders" icon="ribbon">
        <View className="gap-5">
          {FOUNDERS.map((f) => (
            <View key={f.name} className="flex-row gap-3">
              <View className="items-center justify-center w-12 h-12 rounded-full bg-brand-navy">
                <Text className="font-bold text-brand-orange">
                  {f.initials}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-brand-navy">
                  {f.name}
                </Text>
                <Text className="mb-1 text-xs text-neutral-500">
                  Co-founder
                </Text>
                <Text className="text-sm italic leading-5 text-neutral-700">
                  “{f.quote}”
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      {/* Coverage */}
      <Section title="Where we deliver" icon="location">
        <Text className="text-sm leading-6 text-neutral-700">
          We accept delivery requests within Greater Manila and can deliver to
          any destination reachable by continuous land travel. Routes that need
          ferry or sea transport are not yet covered.
        </Text>
        <Text className="mt-3 text-xs leading-5 text-neutral-500">
          Availability may vary by route, vehicle type, cargo requirements, and
          available partner-drivers.
        </Text>
      </Section>

      <Text className="mt-2 text-xs text-center text-neutral-500">
        © 2026 FastMet. All rights reserved.
      </Text>
    </ScrollView>
  );
}
