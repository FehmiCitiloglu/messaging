"use client";

// Mesaj baloncuğu: gönderene göre gruplanmış, kendi mesajımız sağda (vurgu),
// diğerleri solda; saat bilgisi, iletim durumu ikonları (gönderiliyor →
// gönderildi → okundu) ve başarısız gönderimde yeniden dene düğmesi.
// (frontend/components/chat/MessageBubble.tsx ile aynı davranış.)

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LocalMessage } from "@/lib/types";
import { formatClock } from "@/lib/format";
import { BUBBLE_RADIUS, fontSize, lineHeight, SHADOW_SOFT } from "@/theme";
import { useThemeColors } from "@/providers/ThemeProvider";
import { Avatar } from "@/ui/Avatar";
import {
  AlertIcon,
  CheckCheckIcon,
  CheckIcon,
  ClockIcon,
  RetryIcon,
} from "@/ui/Icon";

interface MessageBubbleProps {
  message: LocalMessage;
  own: boolean;
  /** Grupta gönderen adı gösterilsin mi (ilk baloncuk). */
  showSenderName: boolean;
  senderName?: string;
  senderId: string;
  /** Grup içindeki sıra: yuvarlatma kuyrukları için. */
  groupPos: "single" | "first" | "middle" | "last";
  showAvatar: boolean;
  isLastInStream: boolean;
  onRetry: (message: LocalMessage) => void;
}

function StatusIcon({
  message,
  onRetry,
}: {
  message: LocalMessage;
  onRetry: (m: LocalMessage) => void;
}) {
  const colors = useThemeColors();
  const retryRed = colors.dark ? "#fca5a5" : "#fecaca";

  if (message.status === "failed") {
    return (
      <View style={styles.statusRow}>
        <AlertIcon size={14} color={retryRed} />
        <Text style={[styles.statusText, { color: retryRed }]}>
          Gönderilemedi
        </Text>
        <Pressable
          onPress={() => onRetry(message)}
          accessibilityRole="button"
          accessibilityLabel="Mesajı yeniden gönder"
          hitSlop={8}
          style={styles.retryTouch}
        >
          <RetryIcon size={14} color={retryRed} />
        </Pressable>
      </View>
    );
  }
  if (message.status === "sending") {
    return (
      <ClockIcon
        size={14}
        color="rgba(255, 255, 255, 0.85)"
      />
    );
  }
  if (message.status === "read") {
    return <CheckCheckIcon size={16} color="#bae6fd" />;
  }
  return (
    <CheckIcon size={14} color="rgba(255, 255, 255, 0.85)" />
  );
}

function BubbleImpl({
  message,
  own,
  showSenderName,
  senderName,
  senderId,
  groupPos,
  showAvatar,
  isLastInStream,
  onRetry,
}: MessageBubbleProps) {
  const colors = useThemeColors();

  // Yuvarlatma kuyrukları: grup içindeki sıraya göre köşe yarıçapları.
  const tightCorner = own
    ? { borderBottomRightRadius: 6 }
    : { borderBottomLeftRadius: 6 };
  const midCorner = own
    ? { borderBottomRightRadius: 8, borderTopRightRadius: 8 }
    : { borderBottomLeftRadius: 8, borderTopLeftRadius: 8 };
  const corner =
    groupPos === "single" || groupPos === "first"
      ? tightCorner
      : groupPos === "middle"
        ? {
            borderTopRightRadius: own ? 8 : BUBBLE_RADIUS,
            borderTopLeftRadius: own ? BUBBLE_RADIUS : 8,
            ...midCorner,
          }
        : { borderTopRightRadius: own ? 8 : BUBBLE_RADIUS, borderTopLeftRadius: own ? BUBBLE_RADIUS : 8 };

  return (
    <View
      style={[
        styles.row,
        own ? styles.rowOwn : styles.rowTheirs,
        isLastInStream ? styles.rowLast : null,
      ]}
    >
      {/* Karşı tarafın avatarı (yalnızca grubun son baloncuğunda) */}
      {!own ? (
        <View style={styles.avatarSlot}>
          {showAvatar ? (
            <Avatar id={senderId} name={senderName ?? "?"} size="xs" />
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.bubbleWrap,
          own ? { alignItems: "flex-end" } : { alignItems: "flex-start" },
        ]}
      >
        {!own && showSenderName && senderName ? (
          <Text
            style={[
              styles.senderName,
              { color: colors.dark ? colors.brand300 : colors.brand600 },
            ]}
          >
            {senderName}
          </Text>
        ) : null}
        <View
          style={[
            styles.bubble,
            SHADOW_SOFT,
            corner,
            {
              backgroundColor: own
                ? colors.brand600
                : colors.bubbleAlt,
            },
          ]}
        >
          <Text
            style={[
              styles.content,
              { color: own ? "#ffffff" : colors.text },
            ]}
          >
            {message.content}
          </Text>
          <View style={styles.metaRow}>
            <Text
              style={[
                styles.meta,
                { color: own ? "rgba(255,255,255,0.85)" : colors.textFaint },
              ]}
            >
              {formatClock(new Date(message.createdAt))}
            </Text>
            {own ? <StatusIcon message={message} onRetry={onRetry} /> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

export const MessageBubble = memo(BubbleImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    width: "100%",
  },
  rowOwn: {
    justifyContent: "flex-end",
    paddingLeft: 40,
  },
  rowTheirs: {
    justifyContent: "flex-start",
    paddingRight: 40,
  },
  rowLast: {
    paddingBottom: 4,
  },
  avatarSlot: {
    width: 28,
    alignSelf: "flex-end",
  },
  bubbleWrap: {
    maxWidth: "78%",
    minWidth: 0,
  },
  senderName: {
    fontSize: fontSize["2xs"],
    fontWeight: "600",
    marginLeft: 4,
    marginBottom: 2,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BUBBLE_RADIUS,
  },
  content: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: 2,
  },
  meta: {
    fontSize: fontSize["2xs"],
    lineHeight: lineHeight["2xs"],
    fontVariant: ["tabular-nums"],
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 4,
  },
  statusText: {
    fontSize: fontSize["2xs"],
  },
  retryTouch: {
    padding: 2,
  },
});