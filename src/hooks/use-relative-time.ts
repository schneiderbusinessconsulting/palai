"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/format-relative-time";

export function useRelativeTime(date: string | Date): string {
  const [relativeTime, setRelativeTime] = useState(() =>
    formatRelativeTime(date)
  );

  useEffect(() => {
    setRelativeTime(formatRelativeTime(date));

    const d = typeof date === "string" ? new Date(date) : date;
    const diffMs = Date.now() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Only auto-update for times less than 24 hours old
    if (diffHours < 24) {
      const interval = setInterval(() => {
        setRelativeTime(formatRelativeTime(date));
      }, 60_000);
      return () => clearInterval(interval);
    }
  }, [date]);

  return relativeTime;
}
