"use client";

import { ReactNode, useEffect, useState } from "react";
import { Command } from "cmdk";

type CommandItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  group?: string;
  action: () => void;
};

export function CommandPalette({ commands }: { commands: CommandItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const groups = new Map<string, CommandItem[]>();
  const ungrouped: CommandItem[] = [];

  for (const cmd of commands) {
    if (cmd.group) {
      const list = groups.get(cmd.group) ?? [];
      list.push(cmd);
      groups.set(cmd.group, list);
    } else {
      ungrouped.push(cmd);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="fixed inset-0 flex items-start justify-center pt-[20vh]">
        <Command
          className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        >
          <Command.Input
            placeholder="Befehl suchen..."
            className="w-full border-b border-slate-200 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-slate-400 dark:border-slate-700 dark:text-slate-100"
          />
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-6 text-center text-sm text-slate-500">
              Keine Ergebnisse gefunden.
            </Command.Empty>

            {Array.from(groups.entries()).map(([group, items]) => (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate-500"
              >
                {items.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.label}
                    onSelect={() => {
                      cmd.action();
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 aria-selected:bg-slate-100 dark:text-slate-300 dark:aria-selected:bg-slate-800"
                  >
                    {cmd.icon && (
                      <span className="flex h-5 w-5 items-center justify-center">
                        {cmd.icon}
                      </span>
                    )}
                    {cmd.label}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}

            {ungrouped.length > 0 && (
              <>
                {ungrouped.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.label}
                    onSelect={() => {
                      cmd.action();
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 aria-selected:bg-slate-100 dark:text-slate-300 dark:aria-selected:bg-slate-800"
                  >
                    {cmd.icon && (
                      <span className="flex h-5 w-5 items-center justify-center">
                        {cmd.icon}
                      </span>
                    )}
                    {cmd.label}
                  </Command.Item>
                ))}
              </>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
