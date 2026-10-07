"use client";

// Besteci: otomatik büyüyen giriş, gönder düğmesi, sınır yaklaşınca karakter
// sayacı, yazıyor… bildirimi (typing:start/stop).
// (frontend/components/chat/Composer.tsx karşılığı; mobil klavyede Enter satır
// atlar — gönderim sağdaki düğmeden yapılır.)

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from "react-native";
import { emitTypingStart, emitTypingStop } from "@/lib/socket";
import { SHADOW_SOFT, fontSize, lineHeight } from "@/theme";
import { useThemeColors } from "@/providers/ThemeProvider";
import { SendIcon } from "@/ui/Icon";

const MAX_LENGTH = 2000;
const COUNTER_THRESHOLD = 200;
const MAX_INPUT_HEIGHT = 152;

interface ComposerProps {
  conversationId: string;
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function Composer({ conversationId, onSend, disabled }: ComposerProps) {
  const colors = useThemeColors();
  const [value, setValue] = useState("");
  const [inputHeight, setInputHeight] = useState(44);
  const typingSentRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    if (typingSentRef.current) {
      emitTypingStop(conversationId);
      typingSentRef.current = false;
    }
  }, [conversationId]);

  // Konuşma değişince ya da bileşen kalkınca yazıyor durumunu kapat.
  useEffect(() => stopTyping, [stopTyping]);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    setInputHeight(44);
    stopTyping();
  }, [value, disabled, onSend, stopTyping]);

  const onChange = (next: string) => {
    setValue(next);
    if (!typingSentRef.current && next.trim().length > 0) {
      emitTypingStart(conversationId);
      typingSentRef.current = true;
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(stopTyping, 2000);
  };

  const onContentSizeChange = (
    e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    setInputHeight(Math.min(Math.max(e.nativeEvent.contentSize.height, 44), MAX_INPUT_HEIGHT));
  };

  const remaining = MAX_LENGTH - value.length;
  const showCounter = remaining <= COUNTER_THRESHOLD;
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.panel, borderTopColor: colors.border },
      ]}
    >
      {showCounter ? (
        <View
          style={styles.counterRow}
          accessibilityLabel={`${remaining} karakter kaldı`}
        >
          <CounterText remaining={remaining} />
        </View>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          onContentSizeChange={onContentSizeChange}
          onBlur={stopTyping}
          placeholder="Mesaj yaz…"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Mesaj yaz"
          multiline
          editable={!disabled}
          maxLength={MAX_LENGTH}
          style={[
            styles.input,
            {
              height: inputHeight,
              backgroundColor: colors.inputBg,
              borderColor: colors.borderStrong,
              color: colors.text,
            },
          ]}
        />
        <Pressable
          onPress={submit}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Gönder"
          style={({ pressed }) => [
            styles.sendButton,
            SHADOW_SOFT,
            {
              backgroundColor: canSend
                ? colors.brand600
                : colors.dark
                  ? "#334155"
                  : "#cbd5e1",
              transform: [{ scale: pressed && canSend ? 0.95 : 1 }],
            },
          ]}
        >
          <SendIcon size={20} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

function CounterText({ remaining }: { remaining: number }) {
  const colors = useThemeColors();
  const color =
    remaining <= 0
      ? colors.danger
      : remaining <= 50
        ? colors.dark
          ? "#fbbf24"
          : "#d97706"
        : colors.textFaint;
  return (
    <Text style={[styles.counter, { color }]}>
      {remaining} karakter kaldı
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  counterRow: {
    alignItems: "flex-end",
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  counter: {
    fontSize: fontSize["2xs"],
    fontVariant: ["tabular-nums"],
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    maxHeight: MAX_INPUT_HEIGHT,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
});