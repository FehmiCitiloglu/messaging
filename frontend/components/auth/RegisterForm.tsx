"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { cx } from "@/lib/utils";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function RegisterForm() {
  const { status, register } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    displayName?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authed") router.replace("/chat");
  }, [status, router]);

  const usernameOk = useMemo(() => USERNAME_RE.test(username), [username]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (!USERNAME_RE.test(username)) {
      errors.username =
        "3-20 karakter; yalnızca küçük harf, rakam ve alt çizgi kullanabilirsin.";
    }
    const dn = displayName.trim();
    if (dn.length < 1 || dn.length > 40) {
      errors.displayName = "Görünen ad 1-40 karakter olmalı.";
    }
    if (password.length < 8) {
      errors.password = "Şifre en az 8 karakter olmalı.";
    }
    if (confirm !== password) {
      errors.confirm = "Şifreler birbiriyle eşleşmiyor.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await register({ username, displayName: dn, password });
      router.replace("/chat");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.friendly : "Kayıt oluşturulamadı. Tekrar dene.";
      setFormError(message);
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Vira'ya katıl"
      subtitle="Saniyeler içinde hesabını aç, sohbet etmeye başla."
      footer={
        <>
          Zaten hesabın var mı?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline dark:text-brand-300 dark:hover:text-brand-200"
          >
            Giriş yap
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
          <label htmlFor="reg-username" className="mb-1.5 block text-sm font-medium">
            Kullanıcı adı
          </label>
          <input
            id="reg-username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLocaleLowerCase("tr-TR"))}
            aria-invalid={username.length > 0 && !usernameOk}
            aria-describedby="reg-username-help reg-username-error"
            placeholder="ornekkullanici"
            className={inputClass}
          />
          <p id="reg-username-help" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            3-20 karakter · küçük harf, rakam ve alt çizgi ({username.length}/20)
          </p>
          <FieldError id="reg-username-error" message={fieldErrors.username} />
        </div>

        <div>
          <label htmlFor="reg-displayname" className="mb-1.5 block text-sm font-medium">
            Görünen ad
          </label>
          <input
            id="reg-displayname"
            name="displayName"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.displayName)}
            aria-describedby={fieldErrors.displayName ? "reg-displayname-error" : undefined}
            placeholder="Ayşe Yılmaz"
            maxLength={40}
            className={inputClass}
          />
          <FieldError id="reg-displayname-error" message={fieldErrors.displayName} />
        </div>

        <div>
          <label htmlFor="reg-password" className="mb-1.5 block text-sm font-medium">
            Şifre
          </label>
          <input
            id="reg-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby="reg-password-help reg-password-error"
            placeholder="En az 8 karakter"
            className={inputClass}
          />
          <div className="mt-1.5 flex items-center gap-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cx(
                  "h-1 flex-1 rounded-full transition-colors duration-200",
                  password.length >= (i + 1) * 3
                    ? "bg-brand-500"
                    : "bg-slate-200 dark:bg-slate-700",
                )}
              />
            ))}
          </div>
          <p id="reg-password-help" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            En az 8 karakter
          </p>
          <FieldError id="reg-password-error" message={fieldErrors.password} />
        </div>

        <div>
          <label htmlFor="reg-confirm" className="mb-1.5 block text-sm font-medium">
            Şifre (tekrar)
          </label>
          <input
            id="reg-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={Boolean(fieldErrors.confirm)}
            aria-describedby={fieldErrors.confirm ? "reg-confirm-error" : undefined}
            placeholder="••••••••"
            className={inputClass}
          />
          <FieldError id="reg-confirm-error" message={fieldErrors.confirm} />
        </div>

        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? <ButtonSpinner /> : null}
          {submitting ? "Hesap oluşturuluyor…" : "Hesap oluştur"}
        </button>
      </form>
    </AuthShell>
  );
}