"use client";

// İnce gezinme rayı: marka, tema, ayarlar, avatar, çıkış.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import {
  LogoMark,
  LogoutIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "@/components/ui/icons";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError } from "@/lib/errors";
import { SettingsModal } from "@/components/chat/SettingsModal";

interface NavRailProps {
  meName: string;
  meUsername: string;
  meId: string;
}

export function NavRail({ meName, meUsername, meId }: NavRailProps) {
  const { logout } = useAuth();
  const { resolved, toggle } = useTheme();
  const { toast } = useToast();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      toast(
        err instanceof ApiError ? err.friendly : "Çıkış yapılamadı, tekrar dene.",
        "error",
      );
    } finally {
      setLoggingOut(false);
      setLogoutConfirm(false);
    }
  };

  const railButton =
    "flex size-10 items-center justify-center rounded-xl text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-panelalt-dark dark:hover:text-slate-100";

  return (
    <nav
      aria-label="Uygulama gezinmesi"
      className="safe-top safe-bottom flex w-14 shrink-0 flex-col items-center justify-between border-r border-slate-200/80 bg-panel-light py-3 dark:border-slate-800 dark:bg-panel-dark"
    >
      <div className="flex flex-col items-center gap-1.5">
        <span
          className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-soft"
          title="Vira"
        >
          <LogoMark className="size-5" />
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label={
            resolved === "dark" ? "Açık temaya geç" : "Koyu temaya geç"
          }
          title={resolved === "dark" ? "Açık tema" : "Koyu tema"}
          className={railButton}
        >
          {resolved === "dark" ? (
            <SunIcon className="size-5" />
          ) : (
            <MoonIcon className="size-5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Ayarlar"
          title="Ayarlar"
          className={railButton}
        >
          <SettingsIcon className="size-5" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label={`Profilin: ${meName}`}
          title={`${meName} (@${meUsername})`}
          className="rounded-full transition-transform duration-150 hover:scale-105"
        >
          <Avatar id={meId} name={meName} size="sm" />
        </button>
        <button
          type="button"
          onClick={() => setLogoutConfirm(true)}
          aria-label="Oturumu kapat"
          title="Çıkış yap"
          className={`${railButton} hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-300`}
        >
          <LogoutIcon className="size-5" />
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        meName={meName}
        meUsername={meUsername}
        meId={meId}
        onLogout={() => {
          setSettingsOpen(false);
          setLogoutConfirm(true);
        }}
      />

      <Modal
        open={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        title="Oturumu kapat"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Bu cihazdan çıkış yapmak istediğine emin misin? Yeniden giriş yapman gerekecek.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setLogoutConfirm(false)}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-panelalt-dark"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={doLogout}
            disabled={loggingOut}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {loggingOut ? "Çıkış yapılıyor…" : "Çıkış yap"}
          </button>
        </div>
      </Modal>
    </nav>
  );
}