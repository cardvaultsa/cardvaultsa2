import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListPickups,
  useCreatePickup,
  useUpdatePickup,
  useDeletePickup,
  getListPickupsQueryKey,
  type PickupInput,
  type Pickup,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, MapPin, Clock, DollarSign } from "lucide-react";

const STATUSES = [
  { value: "scheduled", label: "Scheduled", cls: "bg-yellow-500/15 text-yellow-400" },
  { value: "completed", label: "Completed", cls: "bg-primary/15 text-primary" },
  { value: "cancelled", label: "Cancelled", cls: "bg-muted text-muted-foreground" },
  { value: "no_show", label: "No-show", cls: "bg-destructive/15 text-destructive" },
];

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDT(dt: string | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

interface PickupFormProps {
  initial?: Partial<PickupInput>;
  onSubmit: (data: PickupInput) => void;
  onCancel: () => void;
  isLoading: boolean;
  title: string;
}

function PickupForm({ initial, onSubmit, onCancel, isLoading, title }: PickupFormProps) {
  const [form, setForm] = useState<PickupInput>({
    buyerName: initial?.buyerName ?? "",
    location: initial?.location ?? "",
    meetingDatetime: initial?.meetingDatetime ?? undefined,
    itemDescription: initial?.itemDescription ?? "",
    amountDue: initial?.amountDue ?? undefined,
    amountPaid: initial?.amountPaid ?? undefined,
    status: (initial?.status ?? "scheduled") as PickupInput["status"],
    notes: initial?.notes ?? "",
  });
  const set = (k: keyof PickupInput, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card border border-card-border w-full sm:max-w-md rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4">
          <h2 className="font-semibold text-lg">{title}</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Buyer Name *</label>
            <input className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input" value={form.buyerName} onChange={(e) => set("buyerName", e.target.value)} placeholder="John Smith" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</label>
            <input className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="Starbucks on 5th Ave" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Meeting Date & Time</label>
            <input type="datetime-local" className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input"
              value={form.meetingDatetime ? new Date(form.meetingDatetime as string).toISOString().slice(0, 16) : ""}
              onChange={(e) => set("meetingDatetime", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Items</label>
            <textarea className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input resize-none" rows={2} value={form.itemDescription ?? ""} onChange={(e) => set("itemDescription", e.target.value)} placeholder="Charizard VMAX, 2x ETBs..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount Due</label>
              <input type="number" min={0} step={0.01} className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input" value={form.amountDue ?? ""} onChange={(e) => set("amountDue", parseFloat(e.target.value) || undefined)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount Paid</label>
              <input type="number" min={0} step={0.01} className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input" value={form.amountPaid ?? ""} onChange={(e) => set("amountPaid", parseFloat(e.target.value) || undefined)} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
            <select className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input" value={form.status} onChange={(e) => set("status", e.target.value as PickupInput["status"])}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
            <textarea className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input resize-none" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-border text-sm font-medium py-2.5 rounded-md hover:bg-muted transition-colors">Cancel</button>
          <button onClick={() => { if (!form.buyerName) return; onSubmit(form); }} disabled={isLoading || !form.buyerName} className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50">
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Pickups() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Pickup | null>(null);

  const { data: pickups, isLoading } = useListPickups(filterStatus ? { status: filterStatus } : undefined);

  const createPickup = useCreatePickup({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListPickupsQueryKey() }); setShowAdd(false); } },
  });
  const updatePickup = useUpdatePickup({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListPickupsQueryKey() }); setEditing(null); } },
  });
  const deletePickup = useDeletePickup({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListPickupsQueryKey() }) },
  });

  const scheduledCount = pickups?.filter((p) => p.status === "scheduled").length ?? 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Local Pickups</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {scheduledCount > 0 ? `${scheduledCount} scheduled` : "Track in-person meetups"}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity glow-primary">
            <Plus className="h-4 w-4" />
            Add Pickup
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[{ value: "", label: "All" }, ...STATUSES].map((s) => (
            <button key={s.value} onClick={() => setFilterStatus(s.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterStatus === s.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {s.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : !pickups?.length ? (
          <div className="bg-card border border-card-border rounded-lg p-8 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No pickups yet.</p>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-lg divide-y divide-border">
            {pickups.map((p) => {
              const statusInfo = STATUSES.find((s) => s.value === p.status);
              const balance = (p.amountDue ?? 0) - (p.amountPaid ?? 0);
              return (
                <div key={p.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-semibold text-sm">{p.buyerName}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo?.cls}`}>{statusInfo?.label}</span>
                      </div>
                      <div className="space-y-0.5">
                        {p.meetingDatetime && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />{fmtDT(p.meetingDatetime)}
                          </div>
                        )}
                        {p.location && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{p.location}
                          </div>
                        )}
                        {p.itemDescription && <div className="text-xs text-muted-foreground line-clamp-1">{p.itemDescription}</div>}
                        {(p.amountDue != null || p.amountPaid != null) && (
                          <div className="text-xs flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Due: {fmtMoney(p.amountDue)} · Paid: {fmtMoney(p.amountPaid)}</span>
                            {balance > 0 && <span className="text-destructive font-medium">· Owes {fmtMoney(balance)}</span>}
                            {balance <= 0 && p.amountDue != null && <span className="text-primary font-medium">· Paid in full</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setEditing(p)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => { if (confirm("Delete this pickup?")) deletePickup.mutate({ id: p.id }); }} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <PickupForm title="Add Pickup" onSubmit={(data) => createPickup.mutate({ data })} onCancel={() => setShowAdd(false)} isLoading={createPickup.isPending} />
      )}
      {editing && (
        <PickupForm
          title="Edit Pickup"
          initial={{
            buyerName: editing.buyerName,
            customerId: editing.customerId ?? undefined,
            location: editing.location ?? undefined,
            meetingDatetime: editing.meetingDatetime ?? undefined,
            itemDescription: editing.itemDescription ?? undefined,
            amountDue: editing.amountDue ?? undefined,
            amountPaid: editing.amountPaid ?? undefined,
            status: editing.status as PickupInput["status"],
            notes: editing.notes ?? undefined,
          }}
          onSubmit={(data) => updatePickup.mutate({ id: editing.id, data })}
          onCancel={() => setEditing(null)}
          isLoading={updatePickup.isPending}
        />
      )}
    </Layout>
  );
}
