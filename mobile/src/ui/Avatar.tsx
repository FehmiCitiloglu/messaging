// Deterministik kimlik görseli: avatarUrl varsa resim, yoksa kimlikten
// türetilen tonlu zemin üzerinde baş harfler. presence noktası isteğe bağlı.
// (frontend/components/ui/Avatar.tsx ile aynı davranış.)

import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import type { Presence } from "@/lib/types";
import { hueFromId, initialsOf } from "@/lib/utils";
import { useThemeColors } from "@/providers/ThemeProvider";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 64,
};

const FONT_PX: Record<AvatarSize, number> = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 18,
};

interface AvatarProps {
  id: string;
  name: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  presence?: Presence | null;
}

export function Avatar({ id, name, avatarUrl, size = "md", presence }: AvatarProps) {
  const colors = useThemeColors();
  const hue = hueFromId(id);
  const px = SIZE_PX[size];
  // Dark modda da okunur kalsın diye baş harf rengi hafifçe aydınlatılır.
  const initialColor = colors.dark
    ? `hsl(${hue} 75% 78%)`
    : `hsl(${hue} 72% 28%)`;

  return (
    <View style={{ width: px, height: px }}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.circle, { width: px, height: px }]}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            styles.circle,
            {
              width: px,
              height: px,
              backgroundColor: colors.dark
                ? `hsl(${hue} 45% 22%)`
                : `hsl(${hue} 70% 93%)`,
            },
          ]}
        >
          <Text
            style={{
              color: initialColor,
              fontSize: FONT_PX[size],
              fontWeight: "600",
            }}
          >
            {initialsOf(name)}
          </Text>
        </View>
      )}
      {presence ? <PresenceDot presence={presence} /> : null}
    </View>
  );
}

export function PresenceDot({ presence }: { presence: Presence }) {
  const colors = useThemeColors();
  return (
    <View
      accessibilityLabel={presence === "online" ? "çevrimiçi" : "çevrimdışı"}
      style={[
        styles.dot,
        {
          backgroundColor:
            presence === "online" ? "#10b981" : colors.dark ? "#334155" : "#94a3b8",
          borderColor: colors.panel,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  dot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
  },
});