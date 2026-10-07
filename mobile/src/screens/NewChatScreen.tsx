"use client";

// Yeni sohbet: kullanıcı arama (GET /api/users?q=), çoklu seçimle grup kurma.
// (frontend/components/chat/NewChatModal.tsx karşılığı — mobilde modal ekran.)

import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatStore } from "@/providers/ChatStore";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/providers/ThemeProvider";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { truncate } from "@/lib/utils";
import type { User } from "@/lib/types";
import { fontSize } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { SearchIcon, UsersIcon } from "@/ui/Icon";
import { ButtonSpinner } from "@/ui/Skeleton";

export function NewChatScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toast } = useToast();
  const { upsertConversation, rememberUsers } = useChatStore();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [selected, setSelected] = useState<User[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Arama (300 ms geciktirmeli, önceki istek iptalli)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    debounceRef.current = setTimeout(async () => {
      if (!q) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const { users } = await api.searchUsers(q, controller.signal);
        setResults(users);
        rememberUsers(users);
      } catch (err) {
        if (
          typeof err === "object" &&
          err !== null &&
          (err as { name?: string }).name === "AbortError"
        ) {
          return;
        }
        toast(
          err instanceof ApiError
            ? err.friendly
            : "Arama sırasında bir sorun oluştu.",
          "error",
        );
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, toast, rememberUsers]);

  const toggleSelect = (user: User) => {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user],
    );
  };

  const startConversation = async (user: User | null) => {
    if (creating) return;
    setCreating(true);
    try {
      const isGroup = groupMode && selected.length >= 2;
      const participantIds = isGroup
        ? selected.map((u) => u.id)
        : user
          ? [user.id]
          : selected.map((u) => u.id);

      if (participantIds.length === 0) {
        setCreating(false);
        return;
      }

      const { conversation } = await api.createConversation({
        type: isGroup ? "group" : "direct",
        participantIds,
        ...(isGroup && groupTitle.trim() ? { title: groupTitle.trim() } : {}),
      });
      upsertConversation(conversation);
      rememberUsers(
        conversation.participants.map((p) => ({
          id: p.id,
          presence: p.presence,
          lastSeenAt: null,
        })),
      );
      // Modalı kapat, ardından sohbeti aç.
      router.back();
      setTimeout(() => {
        router.push({
          pathname: "/chats/[id]",
          params: { id: conversation.id },
        });
      }, 250);
    } catch (err) {
      toast(
        err instanceof ApiError
          ? err.friendly
          : "Sohbet oluşturulamadı. Tekrar dene.",
        "error",
      );
    } finally {
      setCreating(false);
    }
  };

  const selectableCount = selected.length;

  const renderResult = ({ item: u }: ListRenderItemInfo<User>) => {
    const isSelected = selected.some((s) => s.id === u.id);
    return (
      <Pressable
        onPress={() =>
          groupMode ? toggleSelect(u) : void startConversation(u)
        }
        accessibilityRole="button"
        accessibilityState={{ selected: groupMode ? isSelected : undefined }}
        style={({ pressed }) => [
          styles.resultRow,
          isSelected && {
            backgroundColor: colors.dark
              ? "rgba(49, 46, 129, 0.4)"
              : colors.brand50,
          },
          !isSelected && pressed && { backgroundColor: colors.panelAlt },
        ]}
      >
        <Avatar
          id={u.id}
          name={u.displayName}
          avatarUrl={u.avatarUrl}
          size="sm"
          presence={u.presence}
        />
        <View style={styles.resultBody}>
          <Text
            numberOfLines={1}
            style={[styles.resultName, { color: colors.text }]}
          >
            {u.displayName}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.resultUsername, { color: colors.textMuted }]}
          >
            @{u.username}
          </Text>
        </View>
        {groupMode && isSelected ? (
          <Text
            style={{
              color: colors.dark ? colors.brand300 : colors.brand600,
              fontSize: fontSize.xs,
              fontWeight: "600",
            }}
          >
            Seçildi
          </Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.panel }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Başlık */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>Yeni sohbet</Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          hitSlop={8}
          style={[styles.closeChip, { backgroundColor: colors.panelAlt }]}
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            Kapat
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Arama kutusu */}
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.inputBg, borderColor: colors.borderStrong },
          ]}
        >
          <SearchIcon size={18} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Kullanıcı adı veya görünen ad ara…"
            placeholderTextColor={colors.textFaint}
            accessibilityLabel="Kullanıcı ara"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        {/* Grup modu anahtarı */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <UsersIcon size={16} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              Grup sohbeti oluştur
            </Text>
          </View>
          <View style={styles.switchControls}>
            {groupMode ? (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                {selectableCount} kişi seçildi
              </Text>
            ) : null}
            <Switch
              value={groupMode}
              onValueChange={(v) => {
                setGroupMode(v);
                if (!v) setSelected([]);
              }}
              accessibilityLabel="Grup sohbeti oluştur"
              trackColor={{ false: colors.borderStrong, true: colors.brand500 }}
            />
          </View>
        </View>

        {groupMode ? (
          <TextInput
            value={groupTitle}
            onChangeText={setGroupTitle}
            placeholder="Grup adı (isteğe bağlı)"
            placeholderTextColor={colors.textFaint}
            maxLength={40}
            accessibilityLabel="Grup adı"
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.borderStrong,
                color: colors.text,
              },
            ]}
          />
        ) : null}

        {/* Seçilenler */}
        {groupMode && selected.length > 0 ? (
          <ScrollView
            horizontal
            contentContainerStyle={styles.chipsRow}
            showsHorizontalScrollIndicator={false}
          >
            {selected.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => toggleSelect(u)}
                accessibilityRole="button"
                accessibilityLabel={`${u.displayName} seçimini kaldır`}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.dark
                      ? "rgba(49, 46, 129, 0.4)"
                      : colors.brand50,
                  },
                ]}
              >
                <Avatar id={u.id} name={u.displayName} size="xs" />
                <Text
                  style={{
                    color: colors.dark ? colors.brand300 : colors.brand700,
                    fontSize: fontSize.xs,
                    fontWeight: "500",
                  }}
                >
                  {truncate(u.displayName, 18)}
                </Text>
                <Text
                  style={{
                    color: colors.dark ? colors.brand300 : colors.brand700,
                    opacity: 0.6,
                  }}
                >
                  ✕
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* Sonuçlar */}
        <View style={styles.resultsWrap}>
          {searching ? (
            <View style={styles.centered}>
              <ButtonSpinner color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {" "}
                Aranıyor…
              </Text>
            </View>
          ) : results.length === 0 ? (
            <Text
              style={[styles.centered, { color: colors.textMuted, fontSize: fontSize.sm }]}
            >
              {query.trim()
                ? "Kimse bulunamadı. Farklı bir arama dene."
                : "Sohbet etmek için bir kullanıcı ara."}
            </Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(u) => u.id}
              renderItem={renderResult}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 320 }}
            />
          )}
        </View>

        {groupMode ? (
          <Pressable
            onPress={() => void startConversation(null)}
            disabled={creating || selectableCount < 2}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor:
                  creating || selectableCount < 2
                    ? colors.dark
                      ? "#334155"
                      : "#cbd5e1"
                    : colors.brand600,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            {creating ? <ButtonSpinner /> : null}
            <Text style={styles.primaryButtonText}>
              {creating ? "Grup oluşturuluyor…" : "Grup sohbeti oluştur"}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  closeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    paddingVertical: 10,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: fontSize.base,
    minHeight: 44,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switchControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
  },
  resultsWrap: {
    marginTop: 4,
  },
  centered: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  resultBody: {
    flex: 1,
    minWidth: 0,
  },
  resultName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  resultUsername: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});