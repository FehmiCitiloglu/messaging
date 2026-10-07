// Parıltılı iskelet blokları: konuşma listesi + mesaj akışı yüklenirken.
// (frontend/components/ui/Skeleton.tsx karşılığı; RN'de soluk nabız animasyonu.)

import { useEffect, useMemo } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useThemeColors } from "@/providers/ThemeProvider";

function Pulse({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useThemeColors();
  // Animasyon değeri bileşen ömrü boyunca sabit (ref okuması yok).
  const opacity = useMemo(() => new Animated.Value(0.4), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        { backgroundColor: colors.skeleton, opacity },
        style,
      ]}
    />
  );
}

export function ConversationListSkeleton() {
  return (
    <View style={styles.list} accessibilityLabel="Konuşmalar yükleniyor">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.row}>
          <Pulse style={styles.avatarBlock} />
          <View style={styles.lines}>
            <Pulse style={{ height: 14, width: i % 2 ? "40%" : "60%" }} />
            <Pulse style={{ height: 12, width: "80%" }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function MessageStreamSkeleton() {
  return (
    <View style={styles.stream} accessibilityLabel="Mesajlar yükleniyor">
      {[0, 1, 2, 3].map((i) => {
        const own = i % 2 === 1;
        return (
          <View
            key={i}
            style={[styles.streamRow, own ? styles.own : styles.theirs]}
          >
            <Pulse
              style={{
                height: 48,
                width: own ? 208 : 256,
                borderRadius: 18,
                borderBottomRightRadius: own ? 6 : 18,
                borderBottomLeftRadius: own ? 18 : 6,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

export function ButtonSpinner({ color = "#ffffff" }: { color?: string }) {
  const rotation = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      style={[styles.spinner, { borderColor: color, transform: [{ rotate }] }]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 6,
  },
  list: {
    paddingHorizontal: 8,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  avatarBlock: {
    width: 44,
    height: 44,
    borderRadius: 999,
  },
  lines: {
    flex: 1,
    gap: 6,
  },
  stream: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 20,
    gap: 12,
    overflow: "hidden",
  },
  streamRow: {
    flexDirection: "row",
  },
  own: {
    justifyContent: "flex-end",
  },
  theirs: {
    justifyContent: "flex-start",
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderTopColor: "transparent",
  },
});