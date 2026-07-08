import { Layout } from "@/components/layout";
import { useGetDashboardSummary, useGetDashboardRecent } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  Package,
  CreditCard,
  Tag,
  Archive,
  DollarSign,
  PiggyBank,
  ShoppingBag,
  BookOpen,
  Star,
  Heart,
} from "lucide-react";

function fmt(n: number | undefined | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function StatCard({
  label,
  value,
  sub,
  positive,
  negative,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  negative?: boolean;
  icon?: React.ElementType;
  accent?: boolean;
}) {
  const valueColor = positive
    ? "text-green-600 dark:text-green-400"
    : negative
    ? "text-destructive"
    : accent
    ? "text-accent"
    : "text-foreground";

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 flex items-start justify-between gap-2 card-hover">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      {Icon && (
        <div className="shrink-0 p-2 bg-muted rounded-lg text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: recent, isLoading: recentLoading } = useGetDashboardRecent();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your collection at a glance</p>
        </div>

        {summaryLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : summary ? (
          <div className="space-y-5">

            {/* P&L overview */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Profit & Loss</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Realized P&L"
                  value={fmt(summary.realizedProfit)}
                  sub={`${summary.soldCount} sold`}
                  icon={summary.realizedProfit >= 0 ? TrendingUp : TrendingDown}
                  positive={summary.realizedProfit >= 0}
                  negative={summary.realizedProfit < 0}
                />
                <StatCard
                  label="Unrealized P&L"
                  value={fmt(summary.unrealizedProfit)}
                  sub="market vs cost"
                  icon={summary.unrealizedProfit >= 0 ? TrendingUp : TrendingDown}
                  positive={summary.unrealizedProfit >= 0}
                  negative={summary.unrealizedProfit < 0}
                />
                <StatCard
                  label="Net Profit"
                  value={fmt(summary.netProfit)}
                  sub="after expenses"
                  icon={summary.netProfit >= 0 ? TrendingUp : TrendingDown}
                  positive={summary.netProfit >= 0}
                  negative={summary.netProfit < 0}
                />
                <StatCard
                  label="Total Expenses"
                  value={fmt(summary.totalExpenses)}
                  icon={Archive}
                  negative={summary.totalExpenses > 0}
                />
              </div>
            </div>

            {/* Inventory buckets */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Inventory</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard
                  label="Personal Collection"
                  value={fmt(summary.collectionValue)}
                  sub={`${summary.collectionCount} items`}
                  icon={ShoppingBag}
                  accent
                />
                <StatCard
                  label="For Sale"
                  value={fmt(summary.forSaleValue)}
                  sub={`${summary.forSaleCount} listed`}
                  icon={Tag}
                />
                <StatCard
                  label="Trade Binder"
                  value={fmt(summary.tradeBinderValue)}
                  sub={`${summary.tradeBinderCount} items`}
                  icon={BookOpen}
                />
                <StatCard
                  label="Grading Pile"
                  value={fmt(summary.gradingPileValue)}
                  sub={`${summary.gradingPileCount} items`}
                  icon={Star}
                />
                <StatCard
                  label="Wishlist"
                  value={fmt(summary.wishlistValue)}
                  sub={`${summary.wishlistCount} items · target cost`}
                  icon={Heart}
                />
                <StatCard
                  label="Sold Revenue"
                  value={fmt(summary.soldRevenue)}
                  sub={`${summary.soldCount} sold`}
                  icon={Archive}
                  positive
                />
              </div>
            </div>

            {/* Totals */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Totals</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard
                  label="Total Items"
                  value={String(summary.totalItems)}
                  sub={`${summary.totalCards} cards · ${summary.totalSealedProducts} sealed`}
                  icon={Package}
                />
                <StatCard
                  label="Total Cost Basis"
                  value={fmt(summary.totalCost)}
                  icon={CreditCard}
                />
                <StatCard
                  label="Total Market Value"
                  value={fmt(summary.totalMarketValue)}
                  icon={DollarSign}
                />
                <StatCard
                  label="Cards · Sealed Split"
                  value={`${summary.totalCards} / ${summary.totalSealedProducts}`}
                  sub={`${fmt(summary.cardCollectionValue)} · ${fmt(summary.sealedCollectionValue)}`}
                  icon={PiggyBank}
                />
              </div>
            </div>

          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Recent Items
            </h2>
          </div>
          {recentLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : recent?.items?.length ? (
            <div className="bg-card border border-card-border rounded-xl divide-y divide-border">
              {recent.items.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.type === "card" ? `/cards/${item.id}` : `/sealed/${item.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted shrink-0 overflow-hidden border border-border">
                    {item.coverImagePath ? (
                      <img
                        src={`/api/storage${item.coverImagePath}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                        {item.type === "card" ? (
                          <CreditCard className="h-4 w-4" />
                        ) : (
                          <Package className="h-4 w-4" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {item.type.replace("_", " ")}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 capitalize ${
                      item.status === "sold"
                        ? "bg-muted text-muted-foreground"
                        : item.status === "for_sale"
                        ? "bg-accent/15 text-accent"
                        : item.status === "trade_binder"
                        ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                        : item.status === "grading_pile"
                        ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                        : item.status === "wishlist"
                        ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {item.status.replace(/_/g, " ")}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground bg-card border border-card-border rounded-xl p-6 text-center">
              No items yet.{" "}
              <Link href="/cards" className="text-primary hover:underline">
                Add your first card
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
