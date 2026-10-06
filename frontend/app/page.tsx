import { redirect } from "next/navigation";

// Ana sayfa sohbet deneyimine yönlendirir; yetkilendirme kontrolünü
// proxy.ts (iyimser) + istemci koruması (yetkili) yapar.
export default function Home() {
  redirect("/chat");
}