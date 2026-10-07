# Vira — Mobil İstemci (Expo / React Native)

`frontend/` (web) ile aynı backend sözleşmesini konuşan çapraz platform
istemci: iOS, Android ve (react-native-web ile) web.

Web istemciyle birebir ortak davranış:

- Giriş / kayıt (alan doğrulamaları ve Türkçe hata mesajları aynı)
- Konuşma listesi: arama, okunmamış rozetleri, son mesaj önizlemesi,
  göreli zaman, çevrimiçi noktaları, "yazıyor…" satırı
- Mesaj akışı: optimistik gönderim (clock → check → check-check), gün
  ayırıcıları, 5 dakikalık gruplama, eski mesajlara sınırsız kaydırma,
  başarısız gönderimde yeniden deneme
- Gerçek zamanlı: Socket.IO (`message:new`, `message:read`, `typing:update`,
  `presence:update`), okundu bildirimi, yazıyor göstergesi
- Yeni sohbet: kullanıcı arama (300 ms debounce + iptal), grup sohbeti kurma
- Ayarlar: profil kartı, tema (Sistem / Açık / Koyu), çıkış (native onay)
- Erişilebilirlik: accessibilityLabel/role etiketleri, ekran okuyucu duyuruları

## Çalıştırma

```bash
cd mobile
npm install
npx expo start          # QR + Metro (Expo Go ile cihazda açın)
npx expo run:ios        # yerel derleme (simülatör)
npx expo run:android    # yerel derleme (emülatör)
npm run web             # tarayıcıda aynı kod tabanı
```

## Yapılandırma

REST ve Socket.IO uçları derleme zamanında gömülür (web'deki
`NEXT_PUBLIC_*` yerine `EXPO_PUBLIC_*`):

```bash
# .env (mobile/) — fiziksel cihazda localhost cihazın kendisidir,
# geliştirme makinesinin LAN adresini kullanın:
EXPO_PUBLIC_API_URL=http://192.168.1.20:3001
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.20:3001
```

Varsayılan: `http://localhost:3001` (simülatör/emülatör + web için uygun;
Android emülatörü için `http://10.0.2.2:3001`).

## Mimari

```
src/
  lib/          web'deki frontend/lib ile aynı API/socket/tip sözleşmesi
    api.ts        REST + 401'de tek seferlik refresh kilidi
    socket.ts     Socket.IO istemcisi + olay sarmalayıcıları
    tokens.ts     access=bellek, refresh=AsyncStorage (bkz. dosya notu)
    types.ts, errors.ts, format.ts, utils.ts, env.ts
  providers/    AuthProvider, ThemeProvider, ToastProvider, ChatStore
  ui/           Icon (web'deki SVG yollarının react-native-svg kopyası),
                Avatar, Skeleton, TypingDots
  components/   auth/AuthShell, chat/MessageBubble, chat/Composer
  screens/      Login, Register, Conversations, Chat, NewChat, Settings
  app/          expo-router rotaları (ekranlar route-un ince kabukları)
    index.tsx       → /chats veya /login yönlendirmesi
    login.tsx, register.tsx
    chats/_layout.tsx   yetki koruması + ChatStoreProvider
    chats/index.tsx     konuşma listesi
    chats/[id].tsx      mesaj akışı
    chats/new.tsx       yeni sohbet (modal)
    chats/settings.tsx  ayarlar (modal)
  theme.ts      globals.css ile aynı tasarım token'ları (renk/ölçü/tipo)
```

Yorumlar ve arayüz metinleri web istemcinin Türkçesiyle eşleşecek şekilde
yazılmıştır.

## Kontroller

```bash
npx tsc --noEmit     # tip denetimi
npx expo lint        # lint
npx expo-doctor      # bağımlılık/config sağlık kontrolü
```