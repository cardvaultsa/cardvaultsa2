import { useEffect } from "react";
import { toast } from "sonner";

const LAST_BACKUP_KEY = "pokevault_last_backup_ts";
const FIRST_SEEN_KEY = "pokevault_first_seen_ts";
const REMINDER_SHOWN_KEY = "pokevault_reminder_shown_ts";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function markBackupDone() {
  localStorage.setItem(LAST_BACKUP_KEY, Date.now().toString());
}

export function useBackupReminder() {
  useEffect(() => {
    const now = Date.now();

    const firstSeenRaw = localStorage.getItem(FIRST_SEEN_KEY);
    if (!firstSeenRaw) {
      localStorage.setItem(FIRST_SEEN_KEY, now.toString());
      return;
    }

    const firstSeen = parseInt(firstSeenRaw, 10);
    if (now - firstSeen < SEVEN_DAYS_MS) return;

    const lastShownRaw = localStorage.getItem(REMINDER_SHOWN_KEY);
    const lastShown = lastShownRaw ? parseInt(lastShownRaw, 10) : null;
    if (lastShown && now - lastShown < COOLDOWN_MS) return;

    const lastBackupRaw = localStorage.getItem(LAST_BACKUP_KEY);
    const lastBackup = lastBackupRaw ? parseInt(lastBackupRaw, 10) : null;
    if (lastBackup && now - lastBackup < SEVEN_DAYS_MS) return;

    const timer = setTimeout(() => {
      const daysSince = lastBackup
        ? Math.floor((now - lastBackup) / (24 * 60 * 60 * 1000))
        : null;

      const msg = lastBackup
        ? `Last backup was ${daysSince} day${daysSince !== 1 ? "s" : ""} ago.`
        : "No backup on record.";

      localStorage.setItem(REMINDER_SHOWN_KEY, now.toString());

      toast.warning("Backup Reminder", {
        description: `${msg} Export a full backup from the Export page to keep your collection safe.`,
        duration: 10000,
        action: { label: "Dismiss", onClick: () => {} },
      });
    }, 4000);

    return () => clearTimeout(timer);
  }, []);
}
