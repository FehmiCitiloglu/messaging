"use client";

// Konuşma listesi: arama, okunmamış rozetleri, son mesaj önizlemesi, göreli
// zaman, çevrimiçi noktaları ve "yazıyor…" satırı.
// (frontend/components/chat/ConversationList.tsx karşılığı.)

import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  conversationTitle,
  otherParticipant,
  useChatStore,
} from "@/providers/ChatStore";
import { useAuth } from "@/providers/AuthProvider";
import { useThemeColors } from "@/providers/ThemeProvider";
import { formatRelative } from "@/lib/format";
import { truncate } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import { SHADOW_SOFT, fontSize, lineHeight } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { PencilIcon, SearchIcon, SettingsIcon, UsersIcon } from "@/ui/Icon";
import { ConversationListSkeleton } from "@/ui/Skeleton";
import { TypingDots } from "@/ui/TypingDots";

export function ConversationsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    conversations,
    loadingConversations,
    typingMap,
    activeConversationId,
  } = useChatStore();
  const { user } = useAuth();
  const meId = user?.id ?? "";

  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return conversations;
    return conversations.filter((c) => {
      const title = conversationTitle(c, meId).toLocaleLowerCase("tr-TR");
      const names = c.participants
        .map((p) => `${p.displayName} ${p.username}`)
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return title.includes(q) || names.includes(q);
    });
  }, [conversations, query, meId]);

  const totalUnread = conversations.reduce(
    (n, c) => n + (c.unreadCount ?? 0),
    0,
  );

  const openConversation = (c: Conversation) => {
    router.push({ pathname: "/chats/[id]", params: { id: c.id } });
  };

  const renderItem = ({ item: c }: ListRenderItemInfo<Conversation>) => {
    const title = conversationTitle(c, meId);
    const other = otherParticipant(c, meId);
    const isGroup = c.type === "group";
    const typingHere = (typingMap[c.id] ?? []).length > 0;
    const last = c.lastMessage;
    const mine = last?.senderId === meId;
    const unread = c.unreadCount ?? 0;
    const active = c.id === activeConversationId;

    return (
      <Pressable
        onPress={() => openConversation(c)}
        accessibilityRole="button"
        accessibilityLabel={`Sohbet: ${title}`}
        style={({ pressed }) => [
          styles.row,
          active && { backgroundColor: colors.dark ? "rgba(49, 46, 129, 0.35)" : colors.brand50 },
          !active && pressed && { backgroundColor: colors.panelAlt },
        ]}
      >
        {isGroup ? (
          <View
            style={[
              styles.groupAvatar,
              {
                backgroundColor: colors.dark ? "#4338ca" : "#818cf8",
              },
            ]}
          >
            <UsersIcon size={20} color="#ffffff" />
          </View>
        ) : (
          <Avatar
            id={other?.id ?? c.id}
            name={title}
            avatarUrl={other?.avatarUrl ?? null}
            size="md"
            presence={other?.presence ?? null}
          />
        )}

        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text
              numberOfLines={1}
              style={[
                styles.rowTitle,
                { color: colors.text },
                unread > 0 && { fontWeight: "700" },
              ]}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.rowTime,
                {
                  color:
                    unread > 0
                      ? colors.dark
                        ? colors.brand300
                        : colors.brand600
                      : colors.textFaint,
                },
                unread > 0 && { fontWeight: "600" },
              ]}
            >
              {formatRelative(last?.createdAt ?? c.createdAt)}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            {typingHere ? (
              <View style={styles.typingPreview}>
                <TypingDots
                  color={colors.dark ? colors.brand300 : colors.brand600}
                />
                <Text
                  style={[
                    styles.rowPreview,
                    {
                      color: colors.dark ? colors.brand300 : colors.brand600,
                      fontWeight: "500",
                    },
                  ]}
                >
                  yazıyor…
                </Text>
              </View>
            ) : (
              <Text
                numberOfLines={1}
                style={[
                  styles.rowPreview,
                  {
                    color:
                      unread > 0
                        ? colors.dark
                          ? "#e2e8f0"
                          : "#1e293b"
                        : colors.textMuted,
                  },
                  unread > 0 && { fontWeight: "500" },
                ]}
              >
                {last ? (
                  <>
                    {mine ? (
                      <Text style={{ color: colors.textFaint }}>Sen: </Text>
                    ) : null}
                    {truncate(last.content, 42)}
                  </>
                ) : (
                  "Henüz mesaj yok — ilk mesajı sen yaz!"
                )}
              </Text>
            )}
            {unread > 0 ? (
              <View
                accessibilityLabel={`${unread} okunmamış mesaj`}
                style={[styles.badge, { backgroundColor: colors.brand600 }]}
              >
                <Text style={styles.badgeText}>
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.panel, paddingTop: insets.top },
      ]}
    >
      {/* Başlık */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.h1, { color: colors.text }]}>Sohbetler</Text>
          <Text
            style={[styles.subtitle, { color: colors.textMuted }]}
            accessibilityLiveRegion="polite"
          >
            {totalUnread > 0
              ? `${totalUnread} okunmamış mesaj`
              : conversations.length > 0
                ? `${conversations.length} konuşma`
                : ""}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/chats/settings")}
            accessibilityRole="button"
            accessibilityLabel="Ayarlar"
            hitSlop={6}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && { backgroundColor: colors.panelAlt },
            ]}
          >
            <SettingsIcon size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/chats/new")}
            accessibilityRole="button"
            accessibilityLabel="Yeni sohbet başlat"
            style={({ pressed }) => [
              styles.newButton,
              SHADOW_SOFT,
              { backgroundColor: colors.brand600, transform: [{ scale: pressed ? 0.95 : 1 }] },
            ]}
          >
            <PencilIcon size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* Arama */}
      <View style={styles.searchWrap}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.inputBg, borderColor: colors.border },
          ]}
        >
          <SearchIcon size={16} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Konuşmalarda ara…"
            placeholderTextColor={colors.textFaint}
            accessibilityLabel="Konuşmalarda ara"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
      </View>

      {/* Liste */}
      {loadingConversations ? (
        <ConversationListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyList
          hasQuery={Boolean(query.trim())}
          onNewChat={() => router.push("/chats/new")}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

function EmptyList({
  hasQuery,
  onNewChat,
}: {
  hasQuery: boolean;
  onNewChat: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.empty}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: colors.dark ? colors.panelAlt : "#f1f5f9" },
        ]}
      >
        <SearchIcon size={24} color={colors.textFaint} />
      </View>
      <View style={{ alignItems: "center" }}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {hasQuery ? "Eşleşen konuşma yok" : "Henüz konuşma yok"}
        </Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {hasQuery
            ? "Farklı bir kelime deneyebilirsin."
            : "Yeni bir sohbet başlatarak işe koyul."}
        </Text>
      </View>
      {!hasQuery ? (
        <Pressable
          onPress={onNewChat}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.emptyButton,
            { backgroundColor: colors.brand600, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={styles.emptyButtonText}>Yeni sohbet başlat</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  h1: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    paddingVertical: 8,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  rowTime: {
    fontSize: fontSize["2xs"],
    fontVariant: ["tabular-nums"],
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  rowPreview: {
    flex: 1,
    fontSize: fontSize.xs,
    minWidth: 0,
  },
  typingPreview: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: fontSize["2xs"],
    fontWeight: "700",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: fontSize.xs,
    marginTop: 4,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 4,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: "#ffffff",
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});