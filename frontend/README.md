# Vira — Gerçek Zamanlı Mesajlaşma (Frontend)

Next.js 16.3.4 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · Socket.IO 4.8 · yarn

Backend sözleşmesi: REST `http://localhost:3001/api` + Socket.IO aynı host/port.
Bu dizin yalnızca istemciyi içerir; sahte/mock veri katmanı YOKTUR — API/socket
katmanı (`lib/api.ts`, `lib/socket.ts`) paylaşılan sözleşmeye birebir bağlıdır ve
backend ayağa kalktığı anda uçtan uca çalışır.

## Çalıştırma

```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL / NEXT_PUBLIC_SOCKET_URL
yarn install
yarn dev        # http://localhost:3000
yarn build      # üretim derlemesi
yarn start      # üretim sunucusu
yarn lint       # eslint (react-hooks v6 kuralları dahil)
```

## Yapı

- `proxy.ts` — Next.js 16'da middleware'in yeni adı. `/chat/*` için iyimser
  oturum kontrolü (`ah` işaret çerezi), `/login|/register` için geri yönlendirme.
- `lib/` — REST istemcisi (401 → tek seferlik `POST /api/auth/refresh`, kuyruklu
  yeniden deneme), Socket.IO yöneticisi (sözleşme olayları), token deposu,
  hata kodu → Türkçe mesaj eşlemesi, Türkçe tarih/saat biçimleri.
- `components/providers/` — Auth (oturum geri yükleme dahil), Theme (sınıf
  tabanlı, localStorage + sistem tercihi), Toast (bildirim + aria-live duyuru).
- `components/chat/` — üç bölmeli sohbet kabuğu: gezinme rayı, konuşma listesi
  (arama, okunmamış rozetleri, göreli zaman, klavye gezinmesi), mesaj bölmesi
  (optimistik gönderim, okundu bilgisi, sonsuz yukarı kaydırma, gün ayırıcıları,
  yazıyor göstergesi), yeni sohbet modalı (kullanıcı arama + grup kurma).

## Kimlik saklama kararı

Access token yalnızca bellekte; refresh token localStorage'da (sayfa
yenilenince oturum geri yüklenir). Bu proje için kabul edilen ticarettir;
ayrıntılar `lib/tokens.ts` yorumundadır.