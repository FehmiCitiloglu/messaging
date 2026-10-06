"use client";

// Ayarlar: profil kartı, tema tercihi, çıkış.

import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { MonitorIcon, MoonIcon, SunIcon, LogoutIcon } from "@/components/ui/icons";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cx } from "@/lib/utils";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  meName: string;
  meUsername: string;
  meId: string;
  onLogout: () => void;
}

export function SettingsModal({
  open,
  onClose,
  meName,
  meUsername,
  meId,
  onLogout,
}: SettingsModalProps) {
  const { mode, setMode } = useTheme();

  const options = [
    { value: "system", label: "Sistem", Icon: MonitorIcon },
    { value: "light", label: "Açık", Icon: SunIcon },
    { value: "dark", label: "Koyu", Icon: MoonIcon },
  ] as const;

  return (
    <Modal open={open} onClose={onClose} title="Ayarlar">
      <div className="flex items-center gap-4">
        <Avatar id={meId} name={meName} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{meName}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">@{meUsername}</p>
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-medium">Görünüm</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema seçimi">
          {options.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cx(
                "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-all duration-150",
                mode === value
                  ? "border-brand-500 bg-brand-50 text-brand-700 shadow-soft dark:bg-brand-900/40 dark:text-brand-200"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-panelalt-dark",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={onLogout}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/50"
      >
        <LogoutIcon className="size-4.5" />
        Oturumu kapat
      </button>
    </Modal>
  );
}