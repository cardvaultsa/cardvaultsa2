import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetMarketSummary, useGetMarketHistory, useGetTopItems, useGetMarketMovers, useCreateMarketSnapshot, useRefreshMarketPrices } from "@workspace/api-client-react";
import { getGetMarketSummaryQueryKey, getGetMarketHistoryQueryKey, getGetTopItemsQueryKey, getGetMarketMoversQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, RefreshCw, Camera, BarChart3, Trophy, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return sign + n.toFixed(2) + "%";
}

function fmtChange(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return sign + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ChangeChip({ value, pct }: { value: number | null | undefined; pct: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground text-xs">No data</span>;
  const positive = value >= 0;
  const zero = value === 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", zero ? "text-muted-foreground" : positive ? "text-emerald-500" : "text-red-500")}>
      {zero ? <Minus className="h-3 w-3" /> : positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {fmtChange(value)} {pct != null && `(${fmtPct(pct)})`}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-1">
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

function ItemRow({ item, rank }: { item: { id: number; itemType: string; name: string; set?: string | null; cardNumber?: string | null; marketValue: number; purchasePrice?: number | null; gain?: number | null; gainPct?: number | null; coverImagePath?: string | null; status?: string; quantity?: number }; rank: number }) {
  const gain = item.gain;
  const gainPositive = gain != null && gain > 0;
  const gainNegative = gain != null && gain < 0;
  const qty = item.quantity ?? 1;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="w-6 text-center text-xs font-mono text-muted-foreground shrink-0">#{rank}</div>
      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {item.coverImagePath ? (
          <img src={`/api/storage/objects/${item.coverImagePath}`} alt="" className="h-10 w-10 object-cover rounded-md" loading="lazy" decoding="async" />
        ) : (
          <Camera className="h-4 w-4 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {item.set ?? "—"}{item.cardNumber ? ` · ${item.cardNumber}` : ""} · {item.itemType === "card" ? "Card" : "Sealed"} · ×{qty}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold tabular-nums">{fmt(item.marketValue * qty)}</div>
        {gain != null && (
          <div className={cn("text-xs tabular-nums", gainPositive ? "text-emerald-500" : gainNegative ? "text-red-500" : "text-muted-foreground")}>
            {gainPositive ? "+" : ""}{fmt(gain)} {item.gainPct != null ? `(${fmtPct(item.gainPct)})` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function MoverRow({ mover, type }: { mover: { id: number; itemType: string; name: string; set?: string | null; currentValue: number; previousValue: number; change: number; changePct: number; coverImagePath?: string | null }; type: "gainer" | "loser" }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", type === "gainer" ? "bg-emerald-500/10" : "bg-red-500/10")}>
        {type === "gainer" ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{mover.name}</div>
        <div className="text-xs text-muted-foreground">{mover.set ?? "—"} · {mover.itemType === "card" ? "Card" : "Sealed"}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold tabular-nums">{fmt(mover.currentValue)}</div>
        <div className={cn("text-xs tabular-nums", type === "gainer" ? "text-emerald-500" : "text-red-500")}>
          {type === "gainer" ? "+" : ""}{fmt(mover.change)} ({fmtPct(mover.changePct)})
        </div>
      </div>
    </div>
  );
}

const CHART_PERIODS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

export default function Market() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [chartDays, setChartDays] = useState(30);

  const { data: summary, isLoading: summaryLoading } = useGetMarketSummary();
  const { data: history = [], isLoading: historyLoading } = useGetMarketHistory({ days: chartDays });
  const { data: topItems = [], isLoading: topLoading } = useGetTopItems({ limit: 20 });
  const { data: movers, isLoading: moversLoading } = useGetMarketMovers();

  const snapshotMutation = useCreateMarketSnapshot({
    mutation: {
      onSuccess: () => {
        toast({ title: "Snapshot saved", description: "Today's portfolio value has been recorded." });
        queryClient.invalidateQueries({ queryKey: getGetMarketHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMarketSummaryQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to save snapshot.", variant: "destructive" }),
    },
  });

  const refreshMutation = useRefreshMarketPrices({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Prices refreshed",
          description: data.message ?? `Updated ${data.updated} prices.`,
        });
        queryClient.invalidateQueries({ queryKey: getGetMarketSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTopItemsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMarketMoversQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMarketHistoryQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to refresh prices.", variant: "destructive" }),
    },
  });

  const isRefreshing = refreshMutation.isPending;
  const isSnapshotting = snapshotMutation.isPending;

  // Format chart data
  const chartData = history.map((h) => ({
    date: h.snapshotDate,
    label: new Date(h.snapshotDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    total: Number(h.totalValue),
    cards: Number(h.cardsValue),
    sealed: Number(h.sealedValue),
  }));

  const currentValue = summary?.currentValue ?? 0;
  const hasHistory = history.length > 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Market</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Portfolio value tracking and price analytics</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => snapshotMutation.mutate()}
              disabled={isSnapshotting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              <BarChart3 className={cn("h-4 w-4", isSnapshotting && "animate-pulse")} />
              {isSnapshotting ? "Saving…" : "Save Snapshot"}
            </button>
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              {isRefreshing ? "Refreshing…" : "Refresh Prices"}
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Portfolio Value"
            value={summaryLoading ? "…" : fmt(currentValue)}
            sub={<ChangeChip value={summary?.change1d} pct={summary?.change1dPct} />}
          />
          <StatCard
            label="Cards Value"
            value={summaryLoading ? "…" : fmt(summary?.cardsValue)}
          />
          <StatCard
            label="Sealed Value"
            value={summaryLoading ? "…" : fmt(summary?.sealedValue)}
          />
          <StatCard
            label="Unrealized Gain"
            value={summaryLoading ? "…" : fmt(summary?.unrealizedGain)}
            sub={
              summary?.unrealizedGainPct != null ? (
                <span className={cn("text-xs font-medium", (summary.unrealizedGain ?? 0) >= 0 ? "text-emerald-500" : "text-red-500")}>
                  {fmtPct(summary.unrealizedGainPct)} vs cost basis
                </span>
              ) : null
            }
          />
        </div>

        {/* Period changes */}
        {!summaryLoading && summary && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Period Changes</div>
            <div className="grid grid-cols-3 divide-x divide-border">
              {[
                { label: "1 Day", value: summary.change1d, pct: summary.change1dPct },
                { label: "7 Days", value: summary.change7d, pct: summary.change7dPct },
                { label: "30 Days", value: summary.change30d, pct: summary.change30dPct },
              ].map((p) => (
                <div key={p.label} className="px-4 first:pl-0 last:pr-0 flex flex-col gap-1">
                  <div className="text-xs text-muted-foreground">{p.label}</div>
                  <ChangeChip value={p.value} pct={p.pct} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Value history chart */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold">Collection Value History</div>
            <div className="flex gap-1">
              {CHART_PERIODS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => setChartDays(p.days)}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                    chartDays === p.days
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {historyLoading ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : !hasHistory ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
              <div className="text-sm text-muted-foreground">No value history yet.</div>
              <div className="text-xs text-muted-foreground">Click <strong>Save Snapshot</strong> to record today's value, or <strong>Refresh Prices</strong> to fetch prices and snapshot automatically.</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => "$" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0))}
                  width={52}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                  formatter={(value: number, name: string) => [fmt(value), name === "total" ? "Total" : name === "cards" ? "Cards" : "Sealed"]}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
                />
                <Line type="monotone" dataKey="total" stroke="hsl(160 65% 50%)" strokeWidth={2} dot={false} name="total" />
                <Line type="monotone" dataKey="cards" stroke="hsl(220 80% 60%)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="cards" />
                <Line type="monotone" dataKey="sealed" stroke="hsl(30 80% 55%)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="sealed" />
              </LineChart>
            </ResponsiveContainer>
          )}

          {hasHistory && (
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded" style={{ background: "hsl(160 65% 50%)" }} /> Total</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded" style={{ background: "hsl(220 80% 60%)" }} /> Cards</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded" style={{ background: "hsl(30 80% 55%)" }} /> Sealed</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top items */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-amber-500" />
              <div className="text-sm font-semibold">Most Valuable</div>
              <div className="ml-auto text-xs text-muted-foreground">by total value</div>
            </div>
            {topLoading ? (
              <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
            ) : topItems.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No items with market values yet.</div>
            ) : (
              <div>
                {topItems.slice(0, 10).map((item, i) => (
                  <ItemRow key={`${item.itemType}-${item.id}`} item={item} rank={i + 1} />
                ))}
              </div>
            )}
          </div>

          {/* Movers */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <div className="text-sm font-semibold">Top Gainers</div>
                <div className="ml-auto text-xs text-muted-foreground">7-day change</div>
              </div>
              {moversLoading ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
              ) : !movers?.gainers?.length ? (
                <div className="text-sm text-muted-foreground py-6 text-center">No gainers tracked yet.<br />Refresh prices over multiple days to see changes.</div>
              ) : (
                movers.gainers.map((m) => (
                  <MoverRow key={`g-${m.itemType}-${m.id}`} mover={m} type="gainer" />
                ))
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <div className="text-sm font-semibold">Top Losers</div>
                <div className="ml-auto text-xs text-muted-foreground">7-day change</div>
              </div>
              {moversLoading ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
              ) : !movers?.losers?.length ? (
                <div className="text-sm text-muted-foreground py-6 text-center">No losers tracked yet.</div>
              ) : (
                movers.losers.map((m) => (
                  <MoverRow key={`l-${m.itemType}-${m.id}`} mover={m} type="loser" />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Cost basis summary */}
        {!summaryLoading && summary && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Portfolio Fundamentals</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Cost Basis", value: fmt(summary.totalCostBasis) },
                { label: "Market Value", value: fmt(summary.currentValue) },
                { label: "Unrealized Gain", value: fmt(summary.unrealizedGain) },
                { label: "Total Items", value: String(summary.itemCount) },
              ].map((f) => (
                <div key={f.label}>
                  <div className="text-xs text-muted-foreground">{f.label}</div>
                  <div className="text-base font-semibold tabular-nums mt-0.5">{f.value}</div>
                </div>
              ))}
            </div>
            {summary.lastSnapshotDate && (
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                Last snapshot: {new Date(summary.lastSnapshotDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
