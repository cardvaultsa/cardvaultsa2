import { WifiOff, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!isOnline) {
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline) {
      setShowReconnected(true);
      timerRef.current = setTimeout(() => setShowReconnected(false), 3000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOnline, wasOffline]);

  if (isOnline && showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 px-4 text-sm font-medium shadow-lg animate-in slide-in-from-top duration-300">
        <Wifi className="h-4 w-4 shrink-0" />
        <span>Back online</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 bg-amber-600 text-white py-2 px-4 text-sm font-medium shadow-lg animate-in slide-in-from-top duration-300">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>Offline — showing cached data</span>
      </div>
    );
  }

  return null;
}
