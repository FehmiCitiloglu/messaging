import type { Metadata } from "next";
import LoginPage from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Giriş yap",
};

export default function LoginRoute() {
  return <LoginPage />;
}