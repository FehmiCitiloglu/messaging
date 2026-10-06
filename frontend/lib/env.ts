// Yapılandırma: NEXT_PUBLIC_* değişkenleri derleme sırasında istemci paketine gömülür.
export const API_URL: string =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const SOCKET_URL: string =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";