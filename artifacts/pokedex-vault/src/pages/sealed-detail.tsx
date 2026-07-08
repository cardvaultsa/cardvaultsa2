import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ImageGallery } from "@/components/image-gallery";
import { PhotoUploader } from "@/components/photo-uploader";
import {
  useGetSealedProduct,
  useUpdateSealedProduct,
  useDeleteSealedProduct,
  useListSealedProductImages,
  useAddSealedProductImage,
  useDeleteSealedProductImage,
  useGenerateListing,
  getGetSealedProductQueryKey,
  getListSealedProductImagesQueryKey,
  type SealedProductUpdate,
  SealedProductUpdateProductType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Trash2, Pencil, Copy, Check } from "lucide-react";
import { StatusBadge } from "./cards";

function fmt(n?: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

const PRODUCT_TYPES = Object.values(SealedProductUpdateProductType);
const STATUSES = ["collection", "for_sale", "trade_binder", "grading_pile", "sold", "wishlist"];
const CONDITIONS = ["mint", "near_mint", "lightly_played", "moderately_played", "heavily_played", "damaged"];

export default function SealedDetail() {
  const { id } = useParams<{ id: string }>();
  const productId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<SealedProductUpdate>({});
  const [showUploader, setShowUploader] = useState(false);
  const [showListing, setShowListing] = useState(false);
  const [listingResult, setListingResult] = useState<{ title: string; description: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: product, isLoading } = useGetSealedProduct(productId, {
    query: { enabled: !!productId, queryKey: getGetSealedProductQueryKey(productId) },
  });
  const { data: images } = useListSealedProductImages(productId, {
    query: { enabled: !!productId, queryKey: getListSealedProductImagesQueryKey(productId) },
  });

  const updateProduct = useUpdateSealedProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSealedProductQueryKey(productId) });
        setEditing(false);
      },
    },
  });

  const deleteProduct = useDeleteSealedProduct({
    mutation: { onSuccess: () => navigate("/sealed") },
  });

  const addImage = useAddSealedProductImage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSealedProductImagesQueryKey(productId) });
        queryClient.invalidateQueries({ queryKey: getGetSealedProductQueryKey(productId) });
      },
    },
  });

  const deleteImage = useDeleteSealedProductImage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSealedProductImagesQueryKey(productId) });
      },
    },
  });

  const generateListing = useGenerateListing({
    mutation: {
      onSuccess: (data) => {
        setListingResult(data);
        setShowListing(true);
      },
    },
  });

  if (isLoading) {
    return <Layout><div className="text-sm text-muted-foreground">Loading...</div></Layout>;
  }
  if (!product) {
    return <Layout><div className="text-sm text-muted-foreground">Product not found.</div></Layout>;
  }

  const isSold = product.status === "sold";
  const realizedProfit = isSold && product.purchasePrice != null && product.soldPrice != null
    ? product.soldPrice - product.purchasePrice
    : null;
  const unrealizedProfit = !isSold && product.purchasePrice != null && product.marketValue != null
    ? product.marketValue - product.purchasePrice
    : null;

  const startEdit = () => {
    setEditForm({
      name: product.name,
      productType: product.productType as SealedProductUpdate["productType"],
      set: product.set ?? undefined,
      condition: product.condition ?? undefined,
      quantity: product.quantity,
      purchasePrice: product.purchasePrice ?? undefined,
      marketValue: product.marketValue ?? undefined,
      askingPrice: product.askingPrice ?? undefined,
      soldPrice: product.soldPrice ?? undefined,
      soldDate: product.soldDate ?? undefined,
      purchaseDate: product.purchaseDate ?? undefined,
      purchaseSource: product.purchaseSource ?? undefined,
      tradeNotes: product.tradeNotes ?? undefined,
      status: product.status as SealedProductUpdate["status"],
      location: product.location ?? undefined,
      notes: product.notes ?? undefined,
    });
    setEditing(true);
  };

  const setField = (k: keyof SealedProductUpdate, v: string | number | undefined) =>
    setEditForm((f) => ({ ...f, [k]: v }));

  const editIsSold = editForm.status === "sold";
  const editIsTradeBinder = editForm.status === "trade_binder";
  const editProfit = !editIsSold && editForm.purchasePrice != null && editForm.marketValue != null
    ? editForm.marketValue - editForm.purchasePrice
    : null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/sealed")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold flex-1 min-w-0 truncate">{product.name}</h1>
          <StatusBadge status={product.status} />
          <button onClick={startEdit} className="text-muted-foreground hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => { if (confirm("Delete this product?")) deleteProduct.mutate({ id: productId }); }}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-card border border-card-border rounded-lg divide-y divide-border">
          {[
            ["Type", product.productType.replace(/_/g, " ")],
            ["Set", product.set],
            ["Condition", product.condition?.replace(/_/g, " ")],
            ["Quantity", product.quantity],
            ["Location", product.location],
            ["Purchase Price", fmt(product.purchasePrice)],
            ["Purchase Date", product.purchaseDate],
            ["Purchase Source", product.purchaseSource],
            ["Market Value", fmt(product.marketValue)],
            ["Asking Price", fmt(product.askingPrice)],
            ...(isSold ? [["Sold Price", fmt(product.soldPrice)], ["Sold Date", product.soldDate]] : []),
          ]
            .filter(([, v]) => v != null && v !== "")
            .map(([label, value]) => (
              <div key={label as string} className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-muted-foreground">{label as string}</span>
                <span className="text-sm font-medium capitalize">{String(value)}</span>
              </div>
            ))}

          {unrealizedProfit !== null && (
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Unrealized P&amp;L</span>
              <span className={`text-sm font-bold ${unrealizedProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                {unrealizedProfit >= 0 ? "+" : ""}{fmt(unrealizedProfit)}
              </span>
            </div>
          )}

          {realizedProfit !== null && (
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Realized P&amp;L</span>
              <span className={`text-sm font-bold ${realizedProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                {realizedProfit >= 0 ? "+" : ""}{fmt(realizedProfit)}
              </span>
            </div>
          )}

          {product.tradeNotes && (
            <div className="px-4 py-2.5">
              <div className="text-sm text-muted-foreground mb-1">Trade Notes</div>
              <div className="text-sm">{product.tradeNotes}</div>
            </div>
          )}

          {product.notes && (
            <div className="px-4 py-2.5">
              <div className="text-sm text-muted-foreground mb-1">Notes</div>
              <div className="text-sm">{product.notes}</div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowUploader(true)}
            className="flex-1 flex items-center justify-center gap-2 border border-border text-sm font-medium py-2.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Camera className="h-4 w-4" />
            Add Photos
          </button>
          <button
            onClick={() => generateListing.mutate({ data: { itemType: "sealed_product", itemId: productId } })}
            disabled={generateListing.isPending}
            className="flex-1 flex items-center justify-center gap-2 border border-border text-sm font-medium py-2.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            {generateListing.isPending ? "Generating..." : "Generate Listing"}
          </button>
        </div>

        <div>
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Photos</h2>
          <ImageGallery
            images={images ?? []}
            onDelete={(imageId) => deleteImage.mutate({ id: productId, imageId })}
          />
        </div>
      </div>

      {showUploader && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-background w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-4">Add Photos</h2>
            <PhotoUploader
              onPhotosUploaded={async (photos) => {
                for (const photo of photos) {
                  await addImage.mutateAsync({
                    id: productId,
                    data: { objectPath: photo.objectPath, label: photo.label },
                  });
                  if (!product.coverImagePath) {
                    updateProduct.mutate({ id: productId, data: { coverImagePath: photo.objectPath } });
                  }
                }
              }}
              onClose={() => setShowUploader(false)}
            />
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-background w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border px-5 py-4">
              <h2 className="font-semibold text-lg">Edit Product</h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</label>
                  <input
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={editForm.name ?? ""}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Product Type</label>
                  <select
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={editForm.productType ?? ""}
                    onChange={(e) => setField("productType", e.target.value as SealedProductUpdate["productType"])}
                  >
                    {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Set</label>
                  <input
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={editForm.set ?? ""}
                    onChange={(e) => setField("set", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Condition</label>
                  <select
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={editForm.condition ?? ""}
                    onChange={(e) => setField("condition", e.target.value)}
                  >
                    <option value="">—</option>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                  <select
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={editForm.status ?? ""}
                    onChange={(e) => setField("status", e.target.value as SealedProductUpdate["status"])}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Purchase Date</label>
                  <input
                    type="date"
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={editForm.purchaseDate ?? ""}
                    onChange={(e) => setField("purchaseDate", e.target.value || undefined)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Purchase Source</label>
                  <input
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={editForm.purchaseSource ?? ""}
                    onChange={(e) => setField("purchaseSource", e.target.value)}
                    placeholder="eBay, local shop..."
                  />
                </div>
                {[
                  { label: "Purchase Price", key: "purchasePrice" as const },
                  { label: "Market Value", key: "marketValue" as const },
                  { label: "Asking Price", key: "askingPrice" as const },
                  { label: "Sold Price", key: "soldPrice" as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                      value={(editForm[key] as number) ?? ""}
                      onChange={(e) => setField(key, parseFloat(e.target.value) || undefined)}
                    />
                  </div>
                ))}
                {editProfit !== null && (
                  <div className="col-span-2">
                    <div className={`text-sm font-medium ${editProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {editProfit >= 0 ? "+" : ""}{fmt(editProfit)} unrealized P&L
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</label>
                  <input
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    value={editForm.location ?? ""}
                    onChange={(e) => setField("location", e.target.value)}
                  />
                </div>
                {editIsSold && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sold Date</label>
                    <input
                      type="date"
                      className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                      value={editForm.soldDate ?? ""}
                      onChange={(e) => setField("soldDate", e.target.value)}
                    />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
                  <textarea
                    className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
                    rows={2}
                    value={editForm.notes ?? ""}
                    onChange={(e) => setField("notes", e.target.value)}
                  />
                </div>
                {editIsTradeBinder && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trade Notes</label>
                    <textarea
                      className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
                      rows={2}
                      value={editForm.tradeNotes ?? ""}
                      onChange={(e) => setField("tradeNotes", e.target.value || undefined)}
                      placeholder="What are you looking for in trade?"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="sticky bottom-0 bg-background border-t border-border px-5 py-4 flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 border border-border text-sm font-medium py-2.5 rounded-md hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={() => updateProduct.mutate({ id: productId, data: editForm })}
                disabled={updateProduct.isPending}
                className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {updateProduct.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showListing && listingResult && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-lg rounded-xl">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Facebook Marketplace Listing</h2>
              <button onClick={() => setShowListing(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Title</div>
                <div className="text-sm font-semibold">{listingResult.title}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Description</div>
                <textarea
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-muted resize-none"
                  rows={10}
                  readOnly
                  value={listingResult.description}
                />
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${listingResult.title}\n\n${listingResult.description}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-md hover:opacity-90"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
