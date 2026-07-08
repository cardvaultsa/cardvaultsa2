import { useState } from "react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { BarChart2, Star, Shield, Layers, Copy, CheckSquare } from "lucide-react";

interface StatusRow { status: string; count: number }
interface SetRow { set: string; cardRows: number; totalOwned: number; uniqueCardNumbers: number; setTotal: number | null; completion: number | null }
interface RarityRow { rarity: string | null; count: number }
interface ConditionRow { condition: string | null; count: number }
interface ProductTypeRow { productType: string; count: number }
interface DuplicateGroup { name: string; set: string; rowCount: number; totalQuantity: number; ids: number[]; statuses: string[] }

interface CollectionStats {
  cards: {
    total: number; wishlist: number;
    byStatus: StatusRow[]; bySet: SetRow[];
    byRarity: RarityRow[]; byCondition: ConditionRow[];
  };
  sealed: {
    total: number; wishlist: number;
    byStatus: StatusRow[]; byProductType: ProductTypeRow[];
    byCondition: ConditionRow[];
  };
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function pct(n: number | null) {
  if (n == null) return null;
  return n.toFixed(1) + "%";
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{title}</h2>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "wishlist" ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
    : status === "collection" ? "bg-primary/10 text-primary"
    : status === "for_sale" ? "bg-accent/20 text-accent-foreground"
    : "bg-muted text-muted-foreground";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function BarRow({ label, count, total, color = "bg-primary" }: { label: string; count: number; total: number; color?: string }) {
  const pctVal = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate max-w-[60%]">{label}</span>
        <span className="text-muted-foreground tabular-nums shrink-0">{fmt(count)}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pctVal, 2)}%` }} />
      </div>
    </div>
  );
}

export default function CollectionStats() {
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSet, setEditingSet] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  useState(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${BASE}/api/collection/stats`).then((r) => r.json()),
      fetch(`${BASE}/api/cards/duplicates`).then((r) => r.json()),
    ]).then(([s, d]) => {
      if (!cancelled) { setStats(s); setDuplicates(d); setLoading(false); }
    }).catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  });

  async function saveSetTotal(setName: string, total: number) {
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/collection/set-totals/${encodeURIComponent(setName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalCards: total }),
      });
      if (r.ok) {
        const updated = await r.json();
        setStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            cards: {
              ...prev.cards,
              bySet: prev.cards.bySet.map((row) =>
                row.set === setName
                  ? {
                      ...row,
                      setTotal: updated.totalCards,
                      completion: updated.totalCards > 0 && row.uniqueCardNumbers > 0
                        ? Math.round((row.uniqueCardNumbers / updated.totalCards) * 1000) / 10
                        : null,
                    }
                  : row
              ),
            },
          };
        });
        setEditingSet(null);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  if (error || !stats) {
    return (
      <Layout>
        <div className="text-sm text-destructive">Failed to load stats.</div>
      </Layout>
    );
  }

  const totalCardRows = stats.cards.total;
  const totalSealedRows = stats.sealed.total;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collection Stats</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {fmt(totalCardRows)} cards · {fmt(totalSealedRows)} sealed · {fmt(stats.cards.wishlist + stats.sealed.wishlist)} on wishlist
          </p>
        </div>

        {/* ── Overview row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Cards", value: fmt(totalCardRows), icon: Layers },
            { label: "Unique Sets", value: fmt(stats.cards.bySet.length), icon: Star },
            { label: "Wishlist Items", value: fmt(stats.cards.wishlist + stats.sealed.wishlist), icon: CheckSquare },
            { label: "Duplicate Groups", value: fmt(duplicates?.length ?? 0), icon: Copy },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-2xl font-bold tabular-nums">{value}</div>
                </div>
                <div className="p-2 bg-muted rounded-lg text-muted-foreground shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Cards by Status ── */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <SectionHeader title="Cards by Status" icon={Shield} />
            <div className="space-y-3">
              {stats.cards.byStatus.map((r) => (
                <BarRow key={r.status} label={r.status.replace(/_/g, " ")} count={r.count} total={totalCardRows}
                  color={r.status === "wishlist" ? "bg-yellow-500" : r.status === "sold" ? "bg-muted-foreground" : r.status === "for_sale" ? "bg-accent" : "bg-primary"} />
              ))}
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-4">
            <SectionHeader title="Cards by Rarity" icon={Star} />
            {stats.cards.byRarity.length === 0 ? (
              <div className="text-sm text-muted-foreground">No rarity data yet.</div>
            ) : (
              <div className="space-y-3">
                {stats.cards.byRarity.slice(0, 8).map((r) => (
                  <BarRow key={r.rarity ?? "—"} label={r.rarity ?? "Unknown"} count={r.count} total={totalCardRows} />
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-card-border rounded-xl p-4">
            <SectionHeader title="Cards by Condition" icon={Shield} />
            {stats.cards.byCondition.length === 0 ? (
              <div className="text-sm text-muted-foreground">No condition data yet.</div>
            ) : (
              <div className="space-y-3">
                {stats.cards.byCondition.map((r) => (
                  <BarRow key={r.condition ?? "—"} label={(r.condition ?? "Unknown").replace(/_/g, " ")} count={r.count} total={totalCardRows} />
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-card-border rounded-xl p-4">
            <SectionHeader title="Sealed by Type" icon={Layers} />
            <div className="space-y-3">
              {stats.sealed.byProductType.map((r) => (
                <BarRow key={r.productType} label={r.productType.replace(/_/g, " ")} count={r.count} total={totalSealedRows} color="bg-accent" />
              ))}
            </div>
          </div>
        </div>

        {/* ── Set completion ── */}
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title="Cards by Set" icon={BarChart2} />
            <span className="text-xs text-muted-foreground">Click total to edit set size</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Set</th>
                  <th className="text-right py-2 px-2 font-medium">Rows</th>
                  <th className="text-right py-2 px-2 font-medium">Owned</th>
                  <th className="text-right py-2 px-2 font-medium">Unique #s</th>
                  <th className="text-right py-2 px-2 font-medium">Set Total</th>
                  <th className="text-right py-2 pl-2 font-medium">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stats.cards.bySet.map((row) => (
                  <tr key={row.set} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/cards?set=${encodeURIComponent(row.set)}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {row.set}
                      </Link>
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums text-muted-foreground">{fmt(row.cardRows)}</td>
                    <td className="text-right py-2 px-2 tabular-nums">{fmt(row.totalOwned)}</td>
                    <td className="text-right py-2 px-2 tabular-nums">{fmt(row.uniqueCardNumbers)}</td>
                    <td className="text-right py-2 px-2">
                      {editingSet === row.set ? (
                        <form
                          className="flex items-center gap-1 justify-end"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const val = parseInt(editVal);
                            if (!isNaN(val) && val >= 0) saveSetTotal(row.set, val);
                          }}
                        >
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            className="w-16 border border-input rounded px-1.5 py-0.5 text-xs text-right bg-background"
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                          />
                          <button
                            type="submit"
                            disabled={saving}
                            className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded hover:opacity-90 disabled:opacity-50"
                          >
                            {saving ? "…" : "✓"}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground px-1 py-0.5"
                            onClick={() => setEditingSet(null)}
                          >
                            ✕
                          </button>
                        </form>
                      ) : (
                        <button
                          className="tabular-nums text-muted-foreground hover:text-foreground transition-colors"
                          title="Click to set total"
                          onClick={() => { setEditingSet(row.set); setEditVal(String(row.setTotal ?? "")); }}
                        >
                          {row.setTotal != null ? fmt(row.setTotal) : <span className="text-border">—</span>}
                        </button>
                      )}
                    </td>
                    <td className="text-right py-2 pl-2">
                      {row.completion != null ? (
                        <span className={`font-medium tabular-nums ${row.completion >= 100 ? "text-primary" : row.completion >= 50 ? "text-accent-foreground" : "text-muted-foreground"}`}>
                          {pct(row.completion)}
                        </span>
                      ) : (
                        <span className="text-border text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Duplicates ── */}
        {duplicates && duplicates.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <SectionHeader title={`Duplicate Groups (${duplicates.length})`} icon={Copy} />
            <p className="text-xs text-muted-foreground mb-3">
              Cards with the same name and set recorded in multiple rows. Click to view them.
            </p>
            <div className="divide-y divide-border/50">
              {duplicates.map((d) => (
                <div key={`${d.name}-${d.set}`} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.set}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex gap-1">
                      {d.statuses?.map((s, i) => <StatusBadge key={i} status={s} />)}
                    </div>
                    <span className="text-xs text-muted-foreground">{d.rowCount} rows · qty {d.totalQuantity}</span>
                    <div className="flex gap-1">
                      {d.ids.map((id) => (
                        <Link
                          key={id}
                          href={`/cards/${id}`}
                          className="text-xs bg-muted px-2 py-0.5 rounded hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          #{id}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Sealed breakdown ── */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <SectionHeader title="Sealed by Status" icon={Shield} />
            <div className="space-y-3">
              {stats.sealed.byStatus.map((r) => (
                <BarRow key={r.status} label={r.status.replace(/_/g, " ")} count={r.count} total={totalSealedRows}
                  color={r.status === "wishlist" ? "bg-yellow-500" : r.status === "sold" ? "bg-muted-foreground" : r.status === "for_sale" ? "bg-accent" : "bg-primary"} />
              ))}
            </div>
          </div>

          {stats.sealed.byCondition.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-4">
              <SectionHeader title="Sealed by Condition" icon={Shield} />
              <div className="space-y-3">
                {stats.sealed.byCondition.map((r) => (
                  <BarRow key={r.condition ?? "—"} label={(r.condition ?? "Unknown").replace(/_/g, " ")} count={r.count} total={totalSealedRows} color="bg-accent" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
