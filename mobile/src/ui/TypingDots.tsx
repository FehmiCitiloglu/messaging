// 3 noktalı "yazıyor…" animasyonu (frontend/components/ui/TypingDots.tsx).

import { useEffect, useMemo } from "react";
import { Animated, StyleSheet, View } from "react-native";

function Dot({ delay, color }: { delay: number; color: string }) {
  // Animasyon değeri bileşen ömrü boyunca sabit (ref okuması yok).
  const anim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 360,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    }, delay);
    return () => {
      clearTimeout(timer);
      loop?.stop();
    };
  }, [anim, delay]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color, opacity, transform: [{ translateY }] }]}
    />
  );
}

export function TypingDots({ color }: { color: string }) {
  return (
    <View style={styles.row} accessibilityElementsHidden>
      <Dot delay={0} color={color} />
      <Dot delay={160} color={color} />
      <Dot delay={320} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
});