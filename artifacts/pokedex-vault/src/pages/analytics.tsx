import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetSetsPerformance,
  useGetAcquisitions,
  useGetSoldPerformance,
  useGetInventoryBreakdown,
  useGetWishlistItems,
} from "@workspace/api-client-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ComposedChart,
  Line,
  Cell,
} from "recharts";
import {
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  Award,
  ShoppingBag,
  BarChart3,
  Star,
  ListTodo,
  ChevronUp,
  ChevronDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}
function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}
function shortDollar(v: number) {
  if (v >= 1000) return "$" + (v / 1000).toFixed(1) + "k";
  return "$" + v.toFixed(0);
}
function csvUrl(type: string) {
  return `/api/export/csv?type=${type}`;
}

// ─── Small UI pieces ─────────────────────────────────────────────────────────

function TabButton({ label, icon: Icon, active, onClick }: { label: string; icon: React.ElementType; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-1", accent ? "bg-primary/5 border-primary/20" : "bg-card border-border")}>
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="text-sm font-semibold">{title}</div>
      {action}
    </div>
  );
}

function ExportButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-accent transition-colors"
    >
      <Download className="h-3 w-3" />
      {label}
    </a>
  );
}

function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-accent transition-colors"
    >
      <Printer className="h-3 w-3" />
      Print
    </button>
  );
}

function GainChip({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  const pos = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", pos ? "text-emerald-500" : "text-red-500")}>
      {pos ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {fmtPct(value)}
    </span>
  );
}

const CHART_COLORS = ["hsl(160 65% 50%)", "hsl(220 80% 60%)", "hsl(30 80% 55%)", "hsl(280 70% 60%)", "hsl(0 70% 60%)"];

// ─── Tab: Overview ───────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: sets = [], isLoading: setsLoading } = useGetSetsPerformance();
  const { data: acqData = [], isLoading: acqLoading } = useGetAcquisitions();
  const { data: sold, isLoading: soldLoading } = useGetSoldPerformance();
  const { data: inv, isLoading: invLoading } = useGetInventoryBreakdown();
  const { data: wishlist, isLoading: wlLoading } = useGetWishlistItems();

  const totalCostBasis = sets.reduce((s, r) => s + (r.totalCost ?? 0), 0);
  const totalMarketValue = sets.reduce((s, r) => s + (r.totalMarketValue ?? 0), 0);
  const totalGain = totalMarketValue - totalCostBasis;
  const gainPct = totalCostBasis > 0 ? (totalGain / totalCostBasis) * 100 : null;
  const totalAcquired = acqData.reduce((s, m) => s + (m.cardCount ?? 0) + (m.sealedCount ?? 0), 0);
  const isLoading = setsLoading || acqLoading || soldLoading || invLoading || wlLoading;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Cost Basis" value={isLoading ? "…" : fmt(totalCostBasis)} />
        <StatCard label="Market Value" value={isLoading ? "…" : fmt(totalMarketValue)} accent />
        <StatCard
          label="Unrealized Gain"
          value={isLoading ? "…" : fmt(totalGain)}
          sub={gainPct != null ? fmtPct(gainPct) + " vs cost" : undefined}
        />
        <StatCard label="Total Sets" value={isLoading ? "…" : fmtNum(sets.length)} sub={`${fmtNum(totalAcquired)} items acquired`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Sold Revenue" value={isLoading ? "…" : fmt(sold?.totalRevenue)} />
        <StatCard label="Sold P&L" value={isLoading ? "…" : fmt(sold?.totalProfit)} sub={`${sold?.totalSold ?? 0} items sold`} />
        <StatCard label="Graded Cards" value={isLoading ? "…" : fmtNum(inv?.graded.count)} sub={fmt(inv?.graded.totalValue) + " value"} />
        <StatCard label="Wishlist Items" value={isLoading ? "…" : fmtNum(wishlist?.totalItems)} sub={`~${fmt(wishlist?.estimatedCost)} estimated`} />
      </div>

      {/* Cost vs Value bar comparison */}
      {!setsLoading && sets.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeader title="Top 8 Sets — Cost vs Market Value" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sets.slice(0, 8).map((s) => ({ name: s.set.length > 18 ? s.set.slice(0, 16) + "…" : s.set, cost: Number(s.totalCost.toFixed(2)), value: Number(s.totalMarketValue.toFixed(2)) }))} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={shortDollar} width={48} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(v: number, n: string) => [fmt(v), n === "cost" ? "Cost Basis" : "Market Value"]} />
              <Bar dataKey="cost" fill="hsl(var(--muted-foreground) / 0.4)" radius={[3, 3, 0, 0]} name="cost" />
              <Bar dataKey="value" fill="hsl(160 65% 50%)" radius={[3, 3, 0, 0]} name="value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Sets Performance ────────────────────────────────────────────────────

function SetsTab() {
  const { data: sets = [], isLoading } = useGetSetsPerformance();
  const [sortBy, setSortBy] = useState<"value" | "gain" | "gainPct" | "cost">("value");

  const sorted = [...sets].sort((a, b) => {
    if (sortBy === "value") return (b.totalMarketValue ?? 0) - (a.totalMarketValue ?? 0);
    if (sortBy === "gain") return (b.totalGain ?? 0) - (a.totalGain ?? 0);
    if (sortBy === "gainPct") return (b.gainPct ?? -9999) - (a.gainPct ?? -9999);
    return (b.totalCost ?? 0) - (a.totalCost ?? 0);
  });

  const top10 = sorted.slice(0, 10).map((s) => ({
    name: s.set.length > 20 ? s.set.slice(0, 18) + "…" : s.set,
    value: Number((s.totalMarketValue ?? 0).toFixed(2)),
    gain: Number((s.totalGain ?? 0).toFixed(2)),
  }));

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-xl p-4">
        <SectionHeader title="Top 10 Sets by Market Value" action={<ExportButton href={csvUrl("sets-summary")} label="Export CSV" />} />
        {isLoading ? (
          <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : top10.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">No data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={shortDollar} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(v: number, n: string) => [fmt(v), n === "value" ? "Market Value" : "Gain"]} />
              <Bar dataKey="value" fill="hsl(160 65% 50%)" radius={[0, 3, 3, 0]} name="value" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">All Sets</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort:</span>
            {(["value", "cost", "gain", "gainPct"] as const).map((k) => (
              <button key={k} onClick={() => setSortBy(k)} className={cn("text-xs px-2 py-0.5 rounded transition-colors", sortBy === k ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground")}>
                {k === "value" ? "Value" : k === "cost" ? "Cost" : k === "gain" ? "Gain $" : "Gain %"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Set</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Cards</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Sealed</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Cost Basis</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Market Value</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Gain</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Loading…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No sets yet.</td></tr>
              ) : sorted.map((s) => (
                <tr key={s.set} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{s.set}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{s.cardCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{s.sealedCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(s.totalCost)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmt(s.totalMarketValue)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={cn("text-xs tabular-nums font-medium", (s.totalGain ?? 0) >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {(s.totalGain ?? 0) >= 0 ? "+" : ""}{fmt(s.totalGain)}
                      </span>
                      <GainChip value={s.gainPct} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Acquisitions ────────────────────────────────────────────────────────

function AcquisitionsTab() {
  const { data: months = [], isLoading } = useGetAcquisitions();

  const last12 = months.slice(-12);
  const totalCards = months.reduce((s, m) => s + (m.cardCount ?? 0), 0);
  const totalSealed = months.reduce((s, m) => s + (m.sealedCount ?? 0), 0);
  const totalCost = months.reduce((s, m) => s + (m.totalCost ?? 0), 0);

  const chartData = last12.map((m) => ({
    label: m.label.replace(/\s\d{4}$/, ""),
    cards: m.cardCount ?? 0,
    sealed: m.sealedCount ?? 0,
    cost: Number((m.totalCost ?? 0).toFixed(2)),
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Cards Acquired" value={fmtNum(totalCards)} />
        <StatCard label="Total Sealed Acquired" value={fmtNum(totalSealed)} />
        <StatCard label="Total Cost (all time)" value={fmt(totalCost)} />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <SectionHeader title="Monthly Acquisitions (last 12 months)" action={<ExportButton href={csvUrl("all")} label="Export All CSV" />} />
        {isLoading ? (
          <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No acquisition data. Add purchase dates to cards to track this.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="count" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
              <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={shortDollar} width={44} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(v: number, n: string) => [n === "cost" ? fmt(v) : v, n === "cost" ? "Spent" : n === "cards" ? "Cards" : "Sealed"]} />
              <Bar yAxisId="count" dataKey="cards" fill="hsl(160 65% 50%)" radius={[3, 3, 0, 0]} stackId="items" />
              <Bar yAxisId="count" dataKey="sealed" fill="hsl(30 80% 55%)" radius={[3, 3, 0, 0]} stackId="items" />
              <Line yAxisId="cost" type="monotone" dataKey="cost" stroke="hsl(220 80% 60%)" strokeWidth={2} dot={{ r: 3 }} name="cost" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        {chartData.length > 0 && (
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded" style={{ background: "hsl(160 65% 50%)" }} /> Cards</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded" style={{ background: "hsl(30 80% 55%)" }} /> Sealed</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded" style={{ background: "hsl(220 80% 60%)" }} /> Spent ($)</span>
          </div>
        )}
      </div>

      {/* Monthly detail table */}
      {months.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold">Monthly Detail</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Month</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Cards</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Sealed</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Spent</th>
                </tr>
              </thead>
              <tbody>
                {[...months].reverse().map((m) => (
                  <tr key={m.label} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{m.label}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{m.cardCount ?? 0}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{m.sealedCount ?? 0}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmt(m.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Sold Performance ────────────────────────────────────────────────────

function SoldTab() {
  const { data: sold, isLoading } = useGetSoldPerformance();

  const byMonth = sold?.byMonth ?? [];
  const topSellers = sold?.topSellers ?? [];

  const chartData = byMonth.slice(-12).map((m) => ({
    label: m.label.replace(/\s\d{4}$/, ""),
    revenue: Number((m.revenue ?? 0).toFixed(2)),
    cost: Number((m.cost ?? 0).toFixed(2)),
    profit: Number((m.profit ?? 0).toFixed(2)),
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value={isLoading ? "…" : fmt(sold?.totalRevenue)} />
        <StatCard label="Cost of Goods" value={isLoading ? "…" : fmt(sold?.totalCost)} />
        <StatCard label="Total Profit" value={isLoading ? "…" : fmt(sold?.totalProfit)} accent />
        <StatCard label="Items Sold" value={isLoading ? "…" : fmtNum(sold?.totalSold)} />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <SectionHeader title="Monthly Sold Revenue vs Cost (last 12 months)" action={<ExportButton href={csvUrl("sold-performance")} label="Export CSV" />} />
        {isLoading ? (
          <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No sold items with dates yet.<br />Set a sold date on sold items to see monthly performance.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={shortDollar} width={48} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(v: number, n: string) => [fmt(v), n === "revenue" ? "Revenue" : n === "cost" ? "Cost" : "Profit"]} />
              <Bar dataKey="revenue" fill="hsl(160 65% 50% / 0.6)" radius={[3, 3, 0, 0]} name="revenue" />
              <Bar dataKey="cost" fill="hsl(var(--muted-foreground) / 0.4)" radius={[3, 3, 0, 0]} name="cost" />
              <Line type="monotone" dataKey="profit" stroke="hsl(160 65% 50%)" strokeWidth={2} dot={{ r: 3 }} name="profit" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {topSellers.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold">Top Sellers by Profit</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Item</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Cost</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Sold For</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Profit</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">ROI</th>
              </tr>
            </thead>
            <tbody>
              {topSellers.map((s) => (
                <tr key={`${s.itemType}-${s.id}`} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium truncate max-w-[180px]">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.set ?? "—"} · {s.itemType === "card" ? "Card" : "Sealed"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(s.purchasePrice)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(s.soldPrice)}</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums font-medium", (s.profit ?? 0) >= 0 ? "text-emerald-500" : "text-red-500")}>
                    {(s.profit ?? 0) >= 0 ? "+" : ""}{fmt(s.profit)}
                  </td>
                  <td className="px-4 py-2.5 text-right"><GainChip value={s.profitPct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Categories ──────────────────────────────────────────────────────────

function CategoriesTab() {
  const { data: inv, isLoading: invLoading } = useGetInventoryBreakdown();
  const { data: wishlist, isLoading: wlLoading } = useGetWishlistItems();

  const gradedTotal = (inv?.graded.count ?? 0) + (inv?.raw.count ?? 0);
  const byValueTier = inv?.byValueTier ?? [];
  const tierTotal = byValueTier.reduce((s, t) => s + t.count, 0);
  const byGrade = inv?.byGrade ?? [];

  return (
    <div className="space-y-5">
      {/* Graded vs Raw */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeader title="Graded vs Raw Cards" />
          {invLoading ? (
            <div className="text-muted-foreground text-sm py-8 text-center">Loading…</div>
          ) : (
            <div className="space-y-3">
              {[
                { label: "Graded", count: inv?.graded.count ?? 0, value: inv?.graded.totalValue ?? 0, color: "bg-primary" },
                { label: "Raw (ungraded)", count: inv?.raw.count ?? 0, value: inv?.raw.totalValue ?? 0, color: "bg-muted-foreground/40" },
              ].map((row) => {
                const pct = gradedTotal > 0 ? (row.count / gradedTotal) * 100 : 0;
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-muted-foreground tabular-nums">{row.count} · {fmt(row.value)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-2 rounded-full", row.color)} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground">{pct.toFixed(1)}% of inventory</div>
                  </div>
                );
              })}
              {byGrade.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground font-semibold mb-2">By Grade</div>
                  {byGrade.map((g) => (
                    <div key={g.grade} className="flex justify-between text-xs py-0.5">
                      <span className="font-medium">{g.grade}</span>
                      <span className="text-muted-foreground tabular-nums">{g.count} cards · {fmt(g.totalValue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Value tiers */}
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeader title="Cards by Value Tier" />
          {invLoading ? (
            <div className="text-muted-foreground text-sm py-8 text-center">Loading…</div>
          ) : (
            <div className="space-y-3">
              {byValueTier.map((t, i) => {
                const pct = tierTotal > 0 ? (t.count / tierTotal) * 100 : 0;
                return (
                  <div key={t.tier} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{t.label}</span>
                      <span className="text-muted-foreground tabular-nums">{t.count} cards · {fmt(t.totalValue)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                    <div className="text-xs text-muted-foreground">{pct.toFixed(1)}% of active cards</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Wishlist */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">Wishlist ({wishlist?.totalItems ?? 0} items · ~{fmt(wishlist?.estimatedCost)} estimated)</div>
          <ExportButton href={csvUrl("portfolio")} label="Export Portfolio CSV" />
        </div>
        {wlLoading ? (
          <div className="text-muted-foreground text-sm py-8 text-center">Loading…</div>
        ) : !wishlist?.items.length ? (
          <div className="text-muted-foreground text-sm py-8 text-center">No wishlist items yet. Set a card or sealed product status to "wishlist" to track it here.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Item</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Est. Price</th>
              </tr>
            </thead>
            <tbody>
              {wishlist.items.map((item) => (
                <tr key={`${item.itemType}-${item.id}`} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.set ?? "—"} · {item.itemType === "card" ? "Card" : "Sealed"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{item.purchasePrice != null ? fmt(item.purchasePrice) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "sets", label: "Sets", icon: Award },
  { id: "acquisitions", label: "Acquisitions", icon: ShoppingBag },
  { id: "sold", label: "Sold", icon: TrendingUp },
  { id: "categories", label: "Categories", icon: Star },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Analytics() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <Layout>
      <style>{`
        @media print {
          aside, header, .no-print { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Deep insights into your collection performance</p>
          </div>
          <div className="flex gap-2 no-print">
            <ExportButton href={csvUrl("portfolio")} label="Portfolio CSV" />
            <PrintButton />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 no-print">
          {TABS.map((t) => (
            <TabButton key={t.id} label={t.label} icon={t.icon} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && <OverviewTab />}
        {tab === "sets" && <SetsTab />}
        {tab === "acquisitions" && <AcquisitionsTab />}
        {tab === "sold" && <SoldTab />}
        {tab === "categories" && <CategoriesTab />}
      </div>
    </Layout>
  );
}
