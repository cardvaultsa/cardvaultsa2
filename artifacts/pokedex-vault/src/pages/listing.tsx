import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListCards,
  useListSealedProducts,
  useGenerateListing,
} from "@workspace/api-client-react";
import { Copy, Check, FileText } from "lucide-react";

export default function Listing() {
  const [itemType, setItemType] = useState<"card" | "sealed_product">("card");
  const [itemId, setItemId] = useState<number | null>(null);
  const [result, setResult] = useState<{ title: string; description: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: cards } = useListCards();
  const { data: sealed } = useListSealedProducts();

  const generate = useGenerateListing({
    mutation: {
      onSuccess: (data) => setResult(data),
    },
  });

  const items = itemType === "card" ? cards : sealed;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listing Generator</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate a Facebook Marketplace-style listing description</p>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Item Type
            </label>
            <div className="flex gap-2">
              {(["card", "sealed_product"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setItemType(t); setItemId(null); setResult(null); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    itemType === t
                      ? "bg-primary text-primary-foreground"
                      : "border border-border hover:bg-muted"
                  }`}
                >
                  {t === "card" ? "Card" : "Sealed Product"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Select Item
            </label>
            <select
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              value={itemId ?? ""}
              onChange={(e) => { setItemId(parseInt(e.target.value) || null); setResult(null); }}
            >
              <option value="">— Select a {itemType === "card" ? "card" : "product"} —</option>
              {items?.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              if (!itemId) return;
              generate.mutate({ data: { itemType, itemId } });
            }}
            disabled={!itemId || generate.isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-3 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <FileText className="h-4 w-4" />
            {generate.isPending ? "Generating..." : "Generate Listing"}
          </button>
        </div>

        {result && (
          <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Title</div>
              <div className="text-base font-bold">{result.title}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Description</div>
              <textarea
                className="w-full border border-input rounded-md px-3 py-3 text-sm bg-muted resize-none leading-relaxed"
                rows={12}
                readOnly
                value={result.description}
              />
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${result.title}\n\n${result.description}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
