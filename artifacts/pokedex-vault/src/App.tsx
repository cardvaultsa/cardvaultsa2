import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, type LoginResult } from "@workspace/replit-auth-web";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Cards from "@/pages/cards";
import CardDetail from "@/pages/card-detail";
import Sealed from "@/pages/sealed";
import SealedDetail from "@/pages/sealed-detail";
import Listing from "@/pages/listing";
import Expenses from "@/pages/expenses";
import Customers from "@/pages/customers";
import Pickups from "@/pages/pickups";
import ForSale from "@/pages/for-sale";
import BulkEntry from "@/pages/bulk-entry";
import ExportData from "@/pages/export-data";
import Trash from "@/pages/trash";
import CollectionStats from "@/pages/collection-stats";
import Market from "@/pages/market";
import Analytics from "@/pages/analytics";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function LoginPage({
  login,
}: {
  login: (password?: string) => Promise<LoginResult>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login(password);
      if (!result.ok) {
        setError(result.error ?? "Sign in failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8 p-8">
        <div className="text-center">
          <div className="text-6xl font-black tracking-tight text-primary mb-2 glow-primary" style={{ textShadow: "0 0 40px hsl(160 65% 50% / 0.5)" }}>
            PokeVault
          </div>
          <div className="text-muted-foreground text-sm tracking-widest uppercase">Private Collection Tracker</div>
        </div>
        <div className="w-px h-12 bg-border" />
        <div className="text-center max-w-xs">
          <p className="text-sm text-muted-foreground mb-6">
            Track your Pokemon card collection - purchases, sales, profit, and photos - all in one place.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Admin password"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
              required
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 px-8 rounded-lg hover:opacity-90 transition-opacity glow-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Sign in to continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, login } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }
  if (!isAuthenticated) return <LoginPage login={login} />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/cards" component={Cards} />
      <Route path="/cards/:id" component={CardDetail} />
      <Route path="/sealed" component={Sealed} />
      <Route path="/sealed/:id" component={SealedDetail} />
      <Route path="/listing" component={Listing} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/customers" component={Customers} />
      <Route path="/pickups" component={Pickups} />
      <Route path="/for-sale" component={ForSale} />
      <Route path="/bulk-entry" component={BulkEntry} />
      <Route path="/export" component={ExportData} />
      <Route path="/trash" component={Trash} />
      <Route path="/collection" component={CollectionStats} />
      <Route path="/market" component={Market} />
      <Route path="/analytics" component={Analytics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGuard>
            <Router />
          </AuthGuard>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
