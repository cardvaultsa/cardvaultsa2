import { Link, useRoute } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import {
  LayoutDashboard,
  CreditCard,
  Package,
  FileText,
  LogOut,
  Menu,
  X,
  Tag,
  Users,
  MapPin,
  Receipt,
  Layers,
  Download,
  Trash2,
  BarChart2,
  TrendingUp,
  LineChart,
} from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/bottom-nav";
import { OfflineBanner } from "@/components/offline-banner";
import { useBackupReminder } from "@/hooks/use-backup-reminder";

const navSections = [
  {
    label: "Inventory",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/cards", label: "Cards", icon: CreditCard },
      { href: "/sealed", label: "Sealed", icon: Package },
      { href: "/for-sale", label: "For Sale", icon: Tag },
      { href: "/collection", label: "Stats", icon: BarChart2 },
      { href: "/market", label: "Market", icon: TrendingUp },
      { href: "/analytics", label: "Analytics", icon: LineChart },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/pickups", label: "Pickups", icon: MapPin },
      { href: "/expenses", label: "Expenses", icon: Receipt },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/bulk-entry", label: "Bulk Add", icon: Layers },
      { href: "/listing", label: "Listing", icon: FileText },
      { href: "/export", label: "Export", icon: Download },
      { href: "/trash", label: "Trash", icon: Trash2 },
    ],
  },
];

function NavItem({
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
        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px]",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useBackupReminder();

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const initials =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((s) => s![0].toUpperCase())
      .join("") || "?";

  const sidebar = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-5 border-b border-sidebar-border">
        <div className="font-black text-xl tracking-tight text-sidebar-foreground">
          PokeVault
        </div>
        <div className="text-xs text-sidebar-foreground/40 mt-0.5 tracking-widest uppercase">
          Collection Tracker
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem key={item.href} {...item} onNavigate={closeMobile} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-accent-foreground shrink-0 overflow-hidden">
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-sidebar-foreground truncate">
              {user?.firstName || user?.email || "Owner"}
            </div>
          </div>
          <button
            onClick={logout}
            className="shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors p-1.5 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <OfflineBanner />

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-sidebar-border">
        {sidebar}
      </aside>

      {/* Mobile sidebar backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={closeMobile}
        >
          <div className="absolute inset-0 bg-black/70" />
        </div>
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 lg:hidden transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-foreground p-1.5 -ml-1.5 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="font-black text-lg tracking-tight">PokeVault</div>
        </header>

        {/* Main content - extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="pb-20 lg:pb-0">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav onMenuOpen={() => setMobileOpen(true)} />
    </div>
  );
}
