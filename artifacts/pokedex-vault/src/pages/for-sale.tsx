import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListCards, useListSealedProducts } from "@workspace/api-client-react";
import { CreditCard, Package, Tag } from "lucide-react";

function fmt(n: number | null | undefined) {
  if (n == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function ForSale() {
  const { data: cards, isLoading: cardsLoading } = useListCards({ status: "for_sale" });
  const { data: sealed, isLoading: sealedLoading } = useListSealedProducts({ status: "for_sale" });

  const isLoading = cardsLoading || sealedLoading;

  const items = [
    ...(cards ?? []).map((c) => ({ ...c, itemType: "card" as const, href: `/cards/${c.id}` })),
    ...(sealed ?? []).map((s) => ({ ...s, itemType: "sealed" as const, href: `/sealed/${s.id}` })),
  ].sort((a, b) => (b.askingPrice ?? 0) - (a.askingPrice ?? 0));

  const totalAskingValue = items.reduce((sum, i) => sum + (i.askingPrice ?? i.marketValue ?? 0), 0);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">For Sale</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {items.length} item{items.length !== 1 ? "s" : ""} · asking {fmt(totalAskingValue) ?? "—"} total
          </p>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : !items.length ? (
          <div className="bg-card border border-card-border rounded-lg p-8 text-center">
            <Tag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-1">Nothing listed for sale yet.</p>
            <p className="text-xs text-muted-foreground">Set a card or sealed product's status to "For Sale" to list it here.</p>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-lg divide-y divide-border">
            {items.map((item) => (
              <Link key={`${item.itemType}-${item.id}`} href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors card-hover">
                <div className={`h-12 w-9 rounded bg-muted shrink-0 overflow-hidden border border-border`}>
                  {item.coverImagePath ? (
                    <img src={`/api/storage${item.coverImagePath}`} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      {item.itemType === "card" ? <CreditCard className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.itemType === "card" ? (
                      <>Card{(item as typeof cards extends Array<infer T> ? T : never) ? "" : ""} · {(item as { set?: string }).set ?? ""}</>
                    ) : (
                      <>{(item as { productType?: string }).productType?.replace("_", " ") ?? "Sealed"}</>
                    )}
                    {(item.quantity ?? 1) > 1 && <> · qty {item.quantity}</>}
                  </div>
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  {item.askingPrice != null && (
                    <div className="text-sm font-bold tabular-nums text-accent">{fmt(item.askingPrice)}</div>
                  )}
                  {item.marketValue != null && (
                    <div className="text-xs text-muted-foreground tabular-nums">mkt {fmt(item.marketValue)}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
