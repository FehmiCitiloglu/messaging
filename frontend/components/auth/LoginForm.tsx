"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import {
  AuthShell,
  FieldError,
  inputClass,
  primaryButtonClass,
} from "@/components/auth/AuthShell";
import { ButtonSpinner } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/errors";

export default function LoginPage() {
  const { status, login } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Zaten giriş yapılmışsa sohbete git.
  useEffect(() => {
    if (status === "authed") router.replace("/chat");
  }, [status, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (!username.trim()) errors.username = "Kullanıcı adı gerekli.";
    if (!password) errors.password = "Şifre gerekli.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ username: username.trim().toLowerCase(), password });
      router.replace("/chat");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.friendly : "Giriş yapılamadı. Tekrar dene.";
      setFormError(message);
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Tekrar hoş geldin"
      subtitle="Sohbetlerine kaldığın yerden devam et."
      footer={
        <>
          Henüz hesabın yok mu?{" "}
          <Link
            href="/register"
            className="font-semibold text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline dark:text-brand-300 dark:hover:text-brand-200"
          >
            Hemen kayıt ol
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300"
          >
            {formError}
          </p>
        ) : null}

        <div>
          <label htmlFor="username" className="mb-1.5 block text-sm font-medium">
            Kullanıcı adı
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={fieldErrors.username ? "username-error" : undefined}
            placeholder="ornekkullanici"
            className={inputClass}
          />
          <FieldError id="username-error" message={fieldErrors.username} />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Şifre
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            placeholder="••••••••"
            className={inputClass}
          />
          <FieldError id="password-error" message={fieldErrors.password} />
        </div>

        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? <ButtonSpinner /> : null}
          {submitting ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </AuthShell>
  );
}