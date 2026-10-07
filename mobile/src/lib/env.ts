// Yapılandırma: EXPO_PUBLIC_* değişkenleri derleme sırasında pakete gömülür.
//
// Fiziksel cihazda `localhost` cihazın kendisidir — geliştirme makinesinin LAN
// adresini verin (örn. EXPO_PUBLIC_API_URL=http://192.168.1.20:3001).
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export const SOCKET_URL: string =
  process.env.EXPO_PUBLIC_SOCKET_URL ?? "http://localhost:3001";