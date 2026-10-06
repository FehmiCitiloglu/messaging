import type { Metadata } from "next";
import RegisterPage from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Kayıt ol",
};

export default function RegisterRoute() {
  return <RegisterPage />;
}