"use client";

// Mesaj ekranı: başlık (ad, varlık satırı, yazıyor göstergesi), mesaj akışı
// (eski mesajlara sınırsız kaydırma, gün ayırıcıları, gruplama) ve besteci.
// Optimistik gönderim: clientId ile anında baloncuk, socket ack / message:new
// ile uzlaştırma (tekilleştirme), başarısızda yeniden dene.
// (frontend/components/chat/MessagePane.tsx karşılığı; mobilde akış
// ters (inverted) FlatList ile en yenisi altta durur.)

import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Composer } from "@/components/chat/Composer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import {
  conversationTitle,
  otherParticipant,
  useChatStore,
} from "@/providers/ChatStore";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/providers/ThemeProvider";
import { api } from "@/lib/api";
import { ApiError, friendlyMessage } from "@/lib/errors";
import {
  formatDayDivider,
  formatLastSeen,
  isSameDay,
} from "@/lib/format";
import { emitRead, sendMessage, subscribe } from "@/lib/socket";
import { newClientId, truncate } from "@/lib/utils";
import type { LocalMessage, Message } from "@/lib/types";
import { fontSize } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { ChevronLeftIcon, UsersIcon } from "@/ui/Icon";
import { ButtonSpinner, MessageStreamSkeleton } from "@/ui/Skeleton";
import { TypingDots } from "@/ui/TypingDots";

/** Aynı grupta mı? (gönderen + 5 dakika penceresi + aynı gün) */
function inSameGroup(a: LocalMessage, b: LocalMessage): boolean {
  return (
    a.senderId === b.senderId &&
    isSameDay(new Date(a.createdAt), new Date(b.createdAt)) &&
    Math.abs(
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ) <
      5 * 60_000
  );
}

/** clientId/id ile tekilleştirerek birleştirir; varsa günceller, yoksa ekler. */
function mergeMessage(
  items: LocalMessage[],
  incoming: LocalMessage,
  fallbackStatus?: LocalMessage["status"],
): LocalMessage[] {
  const idxById = items.findIndex((m) => m.id === incoming.id);
  const idxByClient =
    idxById === -1
      ? items.findIndex((m) => m.clientId && m.clientId === incoming.clientId)
      : idxById;
  if (idxByClient === -1) return [...items, incoming];

  const prev = items[idxByClient];
  const merged: LocalMessage = {
    ...prev,
    ...incoming,
    // Okunduysa geri düşürme.
    status:
      prev.status === "read"
        ? "read"
        : (incoming.status ?? fallbackStatus ?? prev.status ?? "sent"),
  };
  const next = [...items];
  next[idxByClient] = merged;
  return next;
}

/** FlatList satırları: gün ayırıcı + mesaj (en yeni başta → inverted). */
type Row =
  | { kind: "divider"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      message: LocalMessage;
      own: boolean;
      showSenderName: boolean;
      senderName?: string;
      senderId: string;
      groupPos: "single" | "first" | "middle" | "last";
      showAvatar: boolean;
    };

export function ChatScreen({ conversationId }: { conversationId: string }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const meId = user?.id ?? "";
  const { toast, announce } = useToast();
  const {
    conversations,
    typingMap,
    presenceMap,
    clearUnread,
    patchMessageIntoConversation,
    setActiveConversationId,
  } = useChatStore();

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId) ?? null,
    [conversations, conversationId],
  );

  const [items, setItems] = useState<LocalMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const itemsRef = useRef<LocalMessage[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Aktif konuşma kaydı (okunmamış sayaçları ve liste vurgusu için).
  useEffect(() => {
    setActiveConversationId(conversationId);
    return () => setActiveConversationId(null);
  }, [conversationId, setActiveConversationId]);

  // ---- İlk yükleme / konuşma değişimi ----
  const loadInitial = useCallback(async () => {
    setInitialLoading(true);
    setItems([]);
    setHasMore(false);
    setLoadError(null);
    try {
      const res = await api.messages(conversationId, { limit: 50 });
      // Sözleşme: NEWEST-first → kronolojik sıraya çeviriyoruz.
      const ascending = [...res.messages].reverse();
      setItems(ascending);
      setHasMore(res.hasMore);
      clearUnread(conversationId);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.friendly : "Mesajlar yüklenemedi.",
      );
    } finally {
      setInitialLoading(false);
    }
  }, [conversationId, clearUnread]);

  useEffect(() => {
    const t = setTimeout(() => void loadInitial(), 0);
    return () => clearTimeout(t);
  }, [loadInitial]);

  // ---- Okundu bildirimi ----
  const markReadLatest = useCallback(() => {
    const list = itemsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.senderId !== meId && !m.id.startsWith("local:")) {
        emitRead(conversationId, m.id);
        clearUnread(conversationId);
        return;
      }
    }
    clearUnread(conversationId);
  }, [conversationId, meId, clearUnread]);

  // Uygulama öne gelince (web'deki window focus karşılığı) okundu bildir.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") markReadLatest();
    });
    return () => sub.remove();
  }, [markReadLatest]);

  // ---- Socket olayları (bu konuşma) ----
  useEffect(() => {
    const offNew = subscribe("message:new", (message: Message) => {
      if (message.conversationId !== conversationId) return;
      if (message.senderId !== meId) {
        announce(`Yeni mesaj geldi: ${truncate(message.content, 60)}`);
      }
      setItems((prev) =>
        mergeMessage(prev, {
          ...message,
          status: message.senderId === meId ? "sent" : undefined,
        }),
      );
      // Kendi mesajımız geri geldiyse gönderiliyor → gönderildi.
      if (message.senderId === meId) {
        setItems((prev) =>
          prev.map((m) =>
            m.clientId === message.clientId && m.status === "sending"
              ? { ...m, status: "sent" }
              : m,
          ),
        );
      }
      markReadLatest();
    });

    const offRead = subscribe("message:read", (receipt) => {
      if (receipt.conversationId !== conversationId) return;
      if (receipt.readerId === meId) return;
      setItems((prev) => {
        const refIdx = prev.findIndex((m) => m.id === receipt.messageId);
        return prev.map((m, i) => {
          if (m.senderId !== meId || !m.status) return m;
          const covered = refIdx === -1 ? true : i <= refIdx;
          return covered && m.status !== "read"
            ? { ...m, status: "read" }
            : m;
        });
      });
    });

    return () => {
      offNew();
      offRead();
    };
  }, [conversationId, meId, conversation, announce, markReadLatest]);

  // ---- Daha eski mesajlar (inverted listenin sonu = akışın başı) ----
  const loadOlder = useCallback(async () => {
    const list = itemsRef.current;
    if (!hasMore || loadingOlder || list.length === 0) return;
    setLoadingOlder(true);
    try {
      const res = await api.messages(conversationId, {
        before: list[0].id,
        limit: 50,
      });
      const olderAscending = [...res.messages].reverse();
      setItems((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = olderAscending.filter((m) => !seen.has(m.id));
        return [...fresh, ...prev];
      });
      setHasMore(res.hasMore);
    } catch (err) {
      toast(
        err instanceof ApiError ? err.friendly : "Daha eski mesajlar yüklenemedi.",
        "error",
      );
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadingOlder, toast]);

  // ---- Gönderim (optimistik) ----
  const dispatchMessage = useCallback(
    (content: string, clientId: string, replaceId: string) => {
      const optimistic: LocalMessage = {
        id: replaceId,
        conversationId,
        senderId: meId,
        clientId,
        content,
        type: "text",
        createdAt: new Date().toISOString(),
        editedAt: null,
        status: "sending",
      };

      setItems((prev) => mergeMessage(prev, optimistic, "sending"));

      const timeout = setTimeout(() => {
        setItems((prev) =>
          prev.map((m) =>
            m.clientId === clientId && m.status === "sending"
              ? { ...m, status: "failed", errorCode: "NETWORK" }
              : m,
          ),
        );
      }, 10_000);

      const ok = sendMessage(
        { conversationId, clientId, content, type: "text" },
        (response) => {
          clearTimeout(timeout);
          if (response.ok && response.message) {
            patchMessageIntoConversation(response.message);
            setItems((prev) =>
              mergeMessage(
                prev,
                { ...response.message, status: "sent" } as LocalMessage,
                "sent",
              ),
            );
          } else {
            const code = response.error?.code;
            setItems((prev) =>
              prev.map((m) =>
                m.clientId === clientId
                  ? { ...m, status: "failed", errorCode: code }
                  : m,
              ),
            );
            toast(friendlyMessage(code), "error");
          }
        },
      );

      if (!ok) {
        clearTimeout(timeout);
        setItems((prev) =>
          prev.map((m) =>
            m.clientId === clientId
              ? { ...m, status: "failed", errorCode: "NETWORK" }
              : m,
          ),
        );
        toast(friendlyMessage("NETWORK"), "error");
      }
    },
    [conversationId, meId, patchMessageIntoConversation, toast],
  );

  const onSend = useCallback(
    (content: string) => {
      const clientId = newClientId();
      dispatchMessage(content, clientId, `local:${clientId}`);
    },
    [dispatchMessage],
  );

  const onRetry = useCallback(
    (message: LocalMessage) => {
      setItems((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, status: "sending", errorCode: undefined }
            : m,
        ),
      );
      dispatchMessage(message.content, message.clientId, message.id);
    },
    [dispatchMessage],
  );

  // ---- Başlık bilgileri ----
  const other = conversation ? otherParticipant(conversation, meId) : null;
  const title = conversation
    ? conversationTitle(conversation, meId)
    : "Sohbet";
  const typingUserIds = (typingMap[conversationId] ?? []).filter(
    (id) => id !== meId,
  );
  const typingNames = typingUserIds.map((id) => {
    const p = conversation?.participants.find((x) => x.id === id);
    return p?.displayName ?? "Birisi";
  });
  const isGroup = conversation?.type === "group";
  const onlineCount =
    conversation?.participants.filter((p) => p.presence === "online").length ??
    0;
  const presenceInfo = other ? presenceMap[other.id] : undefined;

  let presenceLine: string;
  if (typingNames.length === 1) presenceLine = "yazıyor…";
  else if (typingNames.length > 1)
    presenceLine = `${typingNames.length} kişi yazıyor…`;
  else if (isGroup)
    presenceLine = `${conversation?.participants.length ?? 0} üye · ${onlineCount} çevrimiçi`;
  else if (other?.presence === "online") presenceLine = "çevrimiçi";
  else if (presenceInfo?.lastSeenAt)
    presenceLine = `son görülme ${formatLastSeen(presenceInfo.lastSeenAt)}`;
  else presenceLine = "çevrimdışı";

  // ---- Akışın çizimi: gün ayırıcı + gruplama (kronolojik) ----
  const chronologicalRows = useMemo(() => {
    const out: Row[] = [];
    items.forEach((m, i) => {
      const prev = items[i - 1];
      const next = items[i + 1];
      const newDay =
        !prev ||
        !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
      const startsGroup = !prev || !inSameGroup(prev, m) || newDay;
      const endsGroup = !next || !inSameGroup(m, next);
      const groupPos =
        startsGroup && endsGroup
          ? "single"
          : startsGroup
            ? "first"
            : endsGroup
              ? "last"
              : "middle";
      const own = m.senderId === meId;

      if (newDay) {
        out.push({
          kind: "divider",
          key: `day-${m.id}`,
          label: formatDayDivider(m.createdAt),
        });
      }

      const senderName = conversation?.participants.find(
        (p) => p.id === m.senderId,
      )?.displayName;
      out.push({
        kind: "message",
        key: m.id,
        message: m,
        own,
        showSenderName: Boolean(isGroup && !own && startsGroup),
        senderName,
        senderId: m.senderId,
        groupPos,
        showAvatar: Boolean(!own && isGroup && endsGroup),
      });
    });
    return out;
  }, [items, meId, isGroup, conversation]);

  // Inverted FlatList: data[0] en altta → kronolojik satırları ters çeviriyoruz.
  const rows = useMemo(
    () => [...chronologicalRows].reverse(),
    [chronologicalRows],
  );

  const renderRow = useCallback(
    ({ item, index }: ListRenderItemInfo<Row>) => {
      if (item.kind === "divider") {
        return (
          <View style={styles.dividerRow} accessibilityRole="header">
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
            <View
              style={[
                styles.dividerChip,
                {
                  backgroundColor: colors.dark ? colors.panelAlt : "#f1f5f9e6",
                },
              ]}
            >
              <Text
                style={[
                  styles.dividerText,
                  { color: colors.dark ? colors.textMuted : "#64748b" },
                ]}
              >
                {item.label}
              </Text>
            </View>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
          </View>
        );
      }
      return (
        <MessageBubble
          message={item.message}
          own={item.own}
          showSenderName={item.showSenderName}
          senderName={item.senderName}
          senderId={item.senderId}
          groupPos={item.groupPos}
          showAvatar={item.showAvatar}
          isLastInStream={index === 0 && item.kind === "message"}
          onRetry={onRetry}
        />
      );
    },
    [colors, onRetry],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ---- Başlık ---- */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.panel,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Konuşma listesine dön"
          hitSlop={8}
          style={({ pressed }) => [
            styles.backButton,
            pressed && { backgroundColor: colors.panelAlt },
          ]}
        >
          <ChevronLeftIcon size={22} color={colors.textMuted} />
        </Pressable>

        {isGroup ? (
          <View
            style={[
              styles.groupAvatar,
              { backgroundColor: colors.dark ? "#4338ca" : "#818cf8" },
            ]}
          >
            <UsersIcon size={20} color="#ffffff" />
          </View>
        ) : (
          <Avatar
            id={other?.id ?? conversationId}
            name={title}
            avatarUrl={other?.avatarUrl ?? null}
            size="md"
            presence={other?.presence ?? null}
          />
        )}

        <View style={styles.headerBody}>
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: colors.text }]}
          >
            {title}
          </Text>
          <View style={styles.presenceRow} accessibilityLiveRegion="polite">
            {typingNames.length > 0 ? (
              <>
                <TypingDots
                  color={colors.dark ? colors.brand300 : colors.brand600}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.presenceLine,
                    {
                      color: colors.dark ? colors.brand300 : colors.brand600,
                      fontWeight: "500",
                    },
                  ]}
                >
                  {typingNames.length === 1
                    ? `${typingNames[0]} yazıyor…`
                    : `${typingNames[0]} ve ${typingNames.length - 1} kişi yazıyor…`}
                </Text>
              </>
            ) : (
              <Text
                numberOfLines={1}
                style={[
                  styles.presenceLine,
                  {
                    color:
                      !isGroup && other?.presence === "online"
                        ? colors.success
                        : colors.textMuted,
                  },
                  !isGroup && other?.presence === "online"
                    ? { fontWeight: "500" }
                    : null,
                ]}
              >
                {presenceLine}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* ---- Mesaj akışı ---- */}
      {initialLoading ? (
        <MessageStreamSkeleton />
      ) : rows.length === 0 ? (
        loadError ? null : (
          <View style={styles.emptyWrap}>
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Henüz mesaj yok
              </Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Bu konuşmadaki ilk mesajı sen yaz — sohbet başlasın!
              </Text>
            </View>
          </View>
        )
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          inverted
          style={styles.stream}
          contentContainerStyle={[
            styles.streamContent,
            rows.length === 0 && { flexGrow: 1, justifyContent: "center" },
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          onEndReached={() => {
            if (hasMore && !loadingOlder) void loadOlder();
          }}
          onEndReachedThreshold={0.2}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.olderWrap}>
                {loadingOlder ? (
                  <View style={styles.olderLoading}>
                    <ButtonSpinner color={colors.textMuted} />
                    <Text style={{ color: colors.textFaint, fontSize: fontSize.xs }}>
                      Daha eski mesajlar yükleniyor…
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => void loadOlder()}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.olderButton,
                      {
                        backgroundColor: colors.panel,
                        borderColor: colors.border,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: fontSize.xs,
                        fontWeight: "500",
                      }}
                    >
                      Daha eski mesajları göster
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null
          }
        />
      )}

      {loadError ? (
        <View
          style={[
            styles.loadError,
            {
              backgroundColor: colors.warnSoftBg,
              borderColor: colors.warnSoftBorder,
            },
          ]}
        >
          <Text style={{ color: colors.warnSoftText, fontSize: fontSize.sm }}>
            {loadError}
          </Text>
          <Pressable
            onPress={() => void loadInitial()}
            accessibilityRole="button"
          >
            <Text
              style={{
                color: colors.warnSoftText,
                fontSize: fontSize.sm,
                fontWeight: "600",
                textDecorationLine: "underline",
              }}
            >
              Tekrar dene
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Composer conversationId={conversationId} onSend={onSend} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  backButton: {
    marginLeft: -4,
    padding: 6,
    borderRadius: 8,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  presenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  presenceLine: {
    fontSize: fontSize.xs,
  },
  stream: {
    flex: 1,
  },
  streamContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
  },
  dividerChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dividerText: {
    fontSize: fontSize["2xs"],
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  olderWrap: {
    alignItems: "center",
    paddingBottom: 12,
  },
  olderLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  olderButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: fontSize.xs,
    textAlign: "center",
  },
  loadError: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});