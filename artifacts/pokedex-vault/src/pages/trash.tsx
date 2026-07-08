import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Trash2, RotateCcw, X } from "lucide-react";

interface TrashItem {
  id: number;
  name: string;
  type: "card" | "sealed_product";
  status: string;
  coverImagePath: string | null;
  deletedAt: string;
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export default function Trash() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, error } = useQuery<TrashItem[]>({
    queryKey: ["trash"],
    queryFn: () => apiFetch("/api/trash"),
  });

  const restore = useMutation({
    mutationFn: ({ id, type }: { id: number; type: "card" | "sealed_product" }) =>
      apiFetch(`/api/trash/${type === "card" ? "cards" : "sealed-products"}/${id}/restore`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries();
    },
  });

  const hardDelete = useMutation({
    mutationFn: ({ id, type }: { id: number; type: "card" | "sealed_product" }) =>
      apiFetch(`/api/trash/${type === "card" ? "cards" : "sealed-products"}/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
    },
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-muted-foreground" />
            Trash
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deleted cards and sealed products. Restore them or permanently remove them.
          </p>
        </div>

        {isLoading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        )}

        {error && (
          <div className="text-sm text-destructive py-4">{(error as Error).message}</div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trash2 className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">Trash is empty</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Deleted items appear here and can be recovered.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      item.type === "card"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-purple-500/10 text-purple-400"
                    }`}>
                      {item.type === "card" ? "Card" : "Sealed"}
                    </span>
                    <span>·</span>
                    <span>Deleted {formatDate(item.deletedAt)}</span>
                  </div>
                </div>

                <button
                  onClick={() => restore.mutate({ id: item.id, type: item.type })}
                  disabled={restore.isPending || hardDelete.isPending}
                  title="Restore"
                  className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </button>

                <button
                  onClick={() => {
                    if (window.confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) {
                      hardDelete.mutate({ id: item.id, type: item.type });
                    }
                  }}
                  disabled={restore.isPending || hardDelete.isPending}
                  title="Delete permanently"
                  className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
