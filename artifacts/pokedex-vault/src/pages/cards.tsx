import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  useListCards,
  useCreateCard,
  getListCardsQueryKey,
  type CardInput,
  CardInputStatus,
  ListCardsSort,
  ListCardsOrder,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, CreditCard, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal } from "lucide-react";

const CONDITIONS = ["mint", "near_mint", "lightly_played", "moderately_played", "heavily_played", "damaged"];
const STATUSES = ["collection", "for_sale", "trade_binder", "grading_pile", "sold", "wishlist"] as const;
const RARITIES = ["Common", "Uncommon", "Rare", "Rare Holo", "Rare Holo V", "Rare Holo VMAX", "Rare Holo EX", "Rare Holo GX", "Rare Ultra", "Rare Secret", "Double Rare", "Illustration Rare", "Special Illustration Rare", "Hyper Rare"];

function fmt(n?: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "sold" ? "bg-muted text-muted-foreground"
    : status === "for_sale" ? "bg-accent/20 text-accent-foreground"
    : status === "wishlist" ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
    : status === "trade_binder" ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
    : status === "grading_pile" ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
    : "bg-primary/10 text-primary";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

interface CardFormProps {
  onSubmit: (data: CardInput) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function CardForm({ onSubmit, onCancel, isLoading }: CardFormProps) {
  const [form, setForm] = useState<CardInput>({
    name: "",
    set: "",
    status: CardInputStatus.collection,
    quantity: 1,
  });

  const setF = (k: keyof CardInput, v: string | number | undefined) =>
    setForm((f) => ({ ...f, [k]: v }));

  const profit =
    form.purchasePrice != null && form.marketValue != null
      ? form.marketValue - form.purchasePrice
      : null;

  const isWishlist = form.status === "wishlist";
  const isTradeBinder = form.status === "trade_binder";

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-background w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border px-5 py-4">
          <h2 className="font-semibold text-lg">Add Card</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <select
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.status ?? "collection"}
                onChange={(e) => setF("status", e.target.value as CardInput["status"])}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
              {isWishlist && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Wishlist = cards you want to acquire.</p>
              )}
              {isTradeBinder && (
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Trade binder = cards available for trade.</p>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name *</label>
              <input
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.name}
                onChange={(e) => setF("name", e.target.value)}
                placeholder="Charizard VMAX"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Set *</label>
              <input
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.set}
                onChange={(e) => setF("set", e.target.value)}
                placeholder="Sword & Shield"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Card #</label>
              <input
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.cardNumber ?? ""}
                onChange={(e) => setF("cardNumber", e.target.value)}
                placeholder="020/202"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rarity</label>
              <input
                list="rarity-list"
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.rarity ?? ""}
                onChange={(e) => setF("rarity", e.target.value)}
                placeholder="Rare Holo V"
              />
              <datalist id="rarity-list">
                {RARITIES.map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Condition</label>
              <select
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.condition ?? ""}
                onChange={(e) => setF("condition", e.target.value)}
              >
                <option value="">—</option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            {!isWishlist && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Grade</label>
                  <input
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={form.grade ?? ""}
                    onChange={(e) => setF("grade", e.target.value)}
                    placeholder="9.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Grader</label>
                  <input
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={form.grader ?? ""}
                    onChange={(e) => setF("grader", e.target.value)}
                    placeholder="PSA / BGS / CGC"
                  />
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.quantity ?? 1}
                onChange={(e) => setF("quantity", parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{isWishlist ? "Target Price" : "Purchase Price"}</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.purchasePrice ?? ""}
                onChange={(e) => setF("purchasePrice", parseFloat(e.target.value) || undefined)}
                placeholder="0.00"
              />
            </div>
            {!isWishlist && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Market Value</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.marketValue ?? ""}
                  onChange={(e) => setF("marketValue", parseFloat(e.target.value) || undefined)}
                  placeholder="0.00"
                />
              </div>
            )}
            {profit !== null && (
              <div className="col-span-2">
                <div className={`text-sm font-medium ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {profit >= 0 ? "+" : ""}{fmt(profit)} estimated profit
                </div>
              </div>
            )}
            {!isWishlist && !isTradeBinder && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Asking Price</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.askingPrice ?? ""}
                  onChange={(e) => setF("askingPrice", parseFloat(e.target.value) || undefined)}
                  placeholder="0.00"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Purchase Date</label>
              <input
                type="date"
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.purchaseDate ?? ""}
                onChange={(e) => setF("purchaseDate", e.target.value || undefined)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Purchase Source</label>
              <input
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.purchaseSource ?? ""}
                onChange={(e) => setF("purchaseSource", e.target.value)}
                placeholder="eBay, local shop..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</label>
              <input
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={form.location ?? ""}
                onChange={(e) => setF("location", e.target.value)}
                placeholder="Binder A, Box 2..."
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
              <textarea
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => setF("notes", e.target.value)}
                placeholder="Any notes..."
              />
            </div>
            {isTradeBinder && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trade Notes</label>
                <textarea
                  className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
                  rows={2}
                  value={form.tradeNotes ?? ""}
                  onChange={(e) => setF("tradeNotes", e.target.value || undefined)}
                  placeholder="What are you looking for in trade?"
                />
              </div>
            )}
          </div>
        </div>
        <div className="sticky bottom-0 bg-background border-t border-border px-5 py-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 border border-border text-sm font-medium py-2.5 rounded-md hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!form.name || !form.set) return;
              onSubmit(form);
            }}
            disabled={isLoading || !form.name || !form.set}
            className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Add Card"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Cards() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [condition, setCondition] = useState("");
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState<string>(ListCardsSort.createdAt);
  const [order, setOrder] = useState<string>(ListCardsOrder.desc);
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);

  const params = {
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(condition ? { condition } : {}),
    ...(rarity ? { rarity } : {}),
    sort: sort as typeof ListCardsSort[keyof typeof ListCardsSort],
    order: order as typeof ListCardsOrder[keyof typeof ListCardsOrder],
  };

  useEffect(() => { setDisplayLimit(50); }, [search, status, condition, rarity, sort, order]);

  const { data: cards, isLoading } = useListCards(params);
  const createCard = useCreateCard({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCardsQueryKey() });
        setShowForm(false);
      },
    },
  });

  function toggleOrder() {
    setOrder((o) => o === ListCardsOrder.desc ? ListCardsOrder.asc : ListCardsOrder.desc);
  }

  const SortIcon = order === ListCardsOrder.asc ? ArrowUp : ArrowDown;
  const hasActiveFilters = status || condition || rarity;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Cards</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Add Card
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full border border-input rounded-md pl-9 pr-3 py-2 text-sm bg-background"
              placeholder="Search name, set, card #, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border border-input rounded-md px-3 py-2 text-sm bg-background"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 border border-input rounded-md px-3 py-2 text-sm transition-colors ${
              hasActiveFilters
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted"
            }`}
            title="More filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {hasActiveFilters && <span className="text-xs font-medium">Filtered</span>}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg border border-border">
            <select
              className="border border-input rounded-md px-3 py-1.5 text-sm bg-background"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              <option value="">All conditions</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </select>
            <input
              list="filter-rarity-list"
              className="border border-input rounded-md px-3 py-1.5 text-sm bg-background min-w-40"
              placeholder="Filter by rarity..."
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
            />
            <datalist id="filter-rarity-list">
              {RARITIES.map((r) => <option key={r} value={r} />)}
            </datalist>
            {(condition || rarity) && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => { setCondition(""); setRarity(""); }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>Sort by:</span>
          {[
            { value: ListCardsSort.createdAt, label: "Date added" },
            { value: ListCardsSort.name, label: "Name" },
            { value: ListCardsSort.set, label: "Set" },
            { value: ListCardsSort.quantity, label: "Qty" },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => {
                if (sort === value) { toggleOrder(); } else { setSort(value); setOrder(ListCardsOrder.desc); }
              }}
              className={`px-2 py-0.5 rounded transition-colors ${
                sort === value
                  ? "bg-primary/15 text-primary font-medium"
                  : "hover:bg-muted"
              }`}
            >
              {label}
              {sort === value && <SortIcon className="inline h-3 w-3 ml-0.5" />}
            </button>
          ))}
          {cards && (
            <span className="ml-auto">{cards.length} card{cards.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : !cards?.length ? (
          <div className="text-sm text-muted-foreground bg-card border border-card-border rounded-lg p-8 text-center">
            No cards found.{" "}
            {(search || status || condition || rarity) && (
              <button
                className="text-primary hover:underline"
                onClick={() => { setSearch(""); setStatus(""); setCondition(""); setRarity(""); }}
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-card border border-card-border rounded-lg divide-y divide-border">
              {cards.slice(0, displayLimit).map((card) => (
                <Link
                  key={card.id}
                  href={`/cards/${card.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors min-h-[60px]"
                >
                  <div className="h-12 w-9 rounded bg-muted shrink-0 overflow-hidden border border-border">
                    {card.coverImagePath ? (
                      <img
                        src={`/api/storage${card.coverImagePath}`}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                        <CreditCard className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{card.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {card.set}{card.cardNumber ? ` · #${card.cardNumber}` : ""}
                      {card.rarity ? ` · ${card.rarity}` : ""}
                      {card.grade ? ` · ${card.grader ?? ""} ${card.grade}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right space-y-0.5 hidden sm:block">
                    {card.marketValue != null && (
                      <div className="text-sm font-semibold tabular-nums">{fmt(card.marketValue)}</div>
                    )}
                    {card.purchasePrice != null && (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {card.status === "wishlist" ? "target" : "cost"} {fmt(card.purchasePrice)}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={card.status} />
                </Link>
              ))}
            </div>
            {cards.length > displayLimit && (
              <div className="flex flex-col items-center gap-1 py-2">
                <button
                  onClick={() => setDisplayLimit((l) => l + 50)}
                  className="text-sm text-primary hover:underline font-medium px-4 py-2 rounded-md hover:bg-primary/10 transition-colors"
                >
                  Show {Math.min(50, cards.length - displayLimit)} more
                  <span className="text-muted-foreground font-normal ml-1">
                    ({cards.length - displayLimit} remaining)
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showForm && (
        <CardForm
          onSubmit={(data) => createCard.mutate({ data })}
          onCancel={() => setShowForm(false)}
          isLoading={createCard.isPending}
        />
      )}
    </Layout>
  );
}
