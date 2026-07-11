import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useBulkCreateCards, type CardInput } from "@workspace/api-client-react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { CardPhotoIdentifier, type IdentifiedCardCandidate } from "@/components/card-photo-identifier";
import { Plus, Trash2, CheckCircle } from "lucide-react";

const CONDITIONS = ["mint", "near_mint", "lightly_played", "moderately_played", "heavily_played", "damaged"];

type RowData = Omit<CardInput, "quantity"> & { quantity: number };

function emptyRow(): RowData {
  return { name: "", set: "", status: "collection", quantity: 1 };
}

export default function BulkEntry() {
  const [, navigate] = useLocation();
  const [rows, setRows] = useState<RowData[]>([emptyRow()]);
  const [activeRow, setActiveRow] = useState(0);
  const [done, setDone] = useState(false);

  const bulkCreate = useBulkCreateCards({
    mutation: {
      onSuccess: (data) => {
        setDone(true);
        setTimeout(() => navigate("/cards"), 1500);
      },
    },
  });

  const setRow = (i: number, k: keyof RowData, v: unknown) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const applyIdentifiedCard = (candidate: IdentifiedCardCandidate) => {
    setRows((prev) =>
      prev.map((row, idx) =>
        idx === activeRow
          ? {
              ...row,
              name: candidate.name,
              set: candidate.set ?? row.set,
              cardNumber: candidate.cardNumber ?? row.cardNumber,
              rarity: candidate.rarity ?? row.rarity,
              marketValue: candidate.marketValue ?? row.marketValue,
            }
          : row,
      ),
    );
  };

  const validRows = rows.filter((r) => r.name.trim() && r.set.trim());

  const submit = () => {
    if (!validRows.length) return;
    bulkCreate.mutate({ data: { cards: validRows as CardInput[] } });
  };

  if (done) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center gap-4 py-16">
          <CheckCircle className="h-12 w-12 text-primary" />
          <div className="text-xl font-bold">{validRows.length} cards added!</div>
          <div className="text-sm text-muted-foreground">Redirecting to Cards...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bulk Card Entry</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Add many cards at once. Name + Set are required per row.</p>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3">
          <CardPhotoIdentifier onUseCandidate={applyIdentifiedCard} />
          <div className="flex items-center gap-3 flex-wrap">
            <BarcodeScanner
              label="Scan Sealed Barcode"
              onDetected={(val) => {
                setRow(activeRow, "name", val);
              }}
            />
            <span className="text-xs text-muted-foreground">
              Barcode scanning is mainly for sealed products. Photo ID fills row {activeRow + 1}.
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              onClick={() => setActiveRow(i)}
              className={`bg-card border rounded-lg p-3 transition-colors ${activeRow === i ? "border-primary/50 shadow-sm" : "border-card-border"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${activeRow === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.name && row.set ? `${row.name} / ${row.set}` : "Incomplete row"}
                </span>
                {rows.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); removeRow(i); }} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2">
                <div className="col-span-2">
                  <input
                    className="w-full border border-input rounded px-2 py-1.5 text-xs bg-input"
                    placeholder="Card name *"
                    value={row.name}
                    onChange={(e) => setRow(i, "name", e.target.value)}
                    onFocus={() => setActiveRow(i)}
                  />
                </div>
                <div>
                  <input
                    className="w-full border border-input rounded px-2 py-1.5 text-xs bg-input"
                    placeholder="Set *"
                    value={row.set}
                    onChange={(e) => setRow(i, "set", e.target.value)}
                    onFocus={() => setActiveRow(i)}
                  />
                </div>
                <div>
                  <input
                    className="w-full border border-input rounded px-2 py-1.5 text-xs bg-input"
                    placeholder="No."
                    value={row.cardNumber ?? ""}
                    onChange={(e) => setRow(i, "cardNumber", e.target.value || undefined)}
                    onFocus={() => setActiveRow(i)}
                  />
                </div>
                <div>
                  <input
                    className="w-full border border-input rounded px-2 py-1.5 text-xs bg-input"
                    placeholder="Rarity"
                    value={row.rarity ?? ""}
                    onChange={(e) => setRow(i, "rarity", e.target.value || undefined)}
                    onFocus={() => setActiveRow(i)}
                  />
                </div>
                <div>
                  <select
                    className="w-full border border-input rounded px-2 py-1.5 text-xs bg-input"
                    value={row.condition ?? ""}
                    onChange={(e) => setRow(i, "condition", e.target.value || undefined)}
                  >
                    <option value="">Condition</option>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <input
                    type="number" min={0} step={0.01}
                    className="w-full border border-input rounded px-2 py-1.5 text-xs bg-input"
                    placeholder="Cost"
                    value={row.purchasePrice ?? ""}
                    onChange={(e) => setRow(i, "purchasePrice", parseFloat(e.target.value) || undefined)}
                  />
                </div>
                <div>
                  <input
                    type="number" min={0} step={0.01}
                    className="w-full border border-input rounded px-2 py-1.5 text-xs bg-input"
                    placeholder="Mkt Value"
                    value={row.marketValue ?? ""}
                    onChange={(e) => setRow(i, "marketValue", parseFloat(e.target.value) || undefined)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={addRow}
            className="flex items-center gap-2 border border-border text-sm font-medium px-4 py-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">{validRows.length} of {rows.length} rows valid</span>
          <button
            onClick={submit}
            disabled={bulkCreate.isPending || !validRows.length}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 glow-primary"
          >
            {bulkCreate.isPending ? "Saving..." : `Add ${validRows.length} Card${validRows.length !== 1 ? "s" : ""}`}
          </button>
        </div>

        {bulkCreate.isError && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            Failed to save - please check your entries and try again.
          </div>
        )}
      </div>
    </Layout>
  );
}
