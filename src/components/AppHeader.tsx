"use client";

import { IconBell, IconHistory, IconNewChat } from "./icons";

export default function AppHeader({
  title,
  badge,
  onNewChat,
}: {
  title: string;
  badge?: string;
  onNewChat?: () => void;
}) {
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6">
      <h1 className="text-[17px] font-bold text-slate-900">{title}</h1>
      {badge && (
        <span className="rounded-md bg-brand-pale px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
          {badge}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        {onNewChat && (
          <button
            onClick={onNewChat}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <IconNewChat size={15} />
            Nuova chat
          </button>
        )}
        <button
          className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          title="Storico conversazioni"
        >
          <IconHistory size={16} />
        </button>
        <button
          className="relative rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          title="Notifiche"
        >
          <IconBell size={16} />
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand text-[8px] font-bold text-white">
            1
          </span>
        </button>
      </div>
    </header>
  );
}
