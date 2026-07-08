import { Link, useRoute } from "wouter";
import {
  LayoutDashboard,
  CreditCard,
  Package,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY_NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/sealed", label: "Sealed", icon: Package },
  { href: "/market", label: "Market", icon: TrendingUp },
] as const;

function BottomNavItem({
  href,
  label,
  icon: Icon,
  exact,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  onNavigate?: () => void;
}) {
  const [active] = useRoute(exact ? href : `${href}*`);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2 flex-1 min-w-0 transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="text-[10px] font-medium leading-tight truncate">{label}</span>
    </Link>
  );
}

export function BottomNav({
  onMenuOpen,
}: {
  onMenuOpen: () => void;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t border-border bg-card/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-14">
        {PRIMARY_NAV.map((item) => (
          <BottomNavItem key={item.href} {...item} />
        ))}
        <button
          onClick={onMenuOpen}
          className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1 min-w-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" />
          <span className="text-[10px] font-medium leading-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
