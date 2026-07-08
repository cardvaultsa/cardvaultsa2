import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  getListCustomersQueryKey,
  type CustomerInput,
  type Customer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Users, Phone, Mail, Bell } from "lucide-react";

function today() {
  return new Date().toISOString().split("T")[0];
}

function isPastDue(date: string | null | undefined) {
  if (!date) return false;
  return date <= today();
}

interface CustomerFormProps {
  initial?: Partial<CustomerInput>;
  onSubmit: (data: CustomerInput) => void;
  onCancel: () => void;
  isLoading: boolean;
  title: string;
}

function CustomerForm({ initial, onSubmit, onCancel, isLoading, title }: CustomerFormProps) {
  const [form, setForm] = useState<CustomerInput>({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    preferences: initial?.preferences ?? "",
    notes: initial?.notes ?? "",
    followUpDate: initial?.followUpDate ?? "",
  });
  const set = (k: keyof CustomerInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card border border-card-border w-full sm:max-w-md rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4">
          <h2 className="font-semibold text-lg">{title}</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name *</label>
            <input className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</label>
              <input className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="555-0100" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
              <input className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preferences / Wants</label>
            <textarea className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input resize-none" rows={2} value={form.preferences ?? ""} onChange={(e) => set("preferences", e.target.value)} placeholder="Looking for Base Set holos, Charizard..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
            <textarea className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input resize-none" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional notes..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Follow-up Date</label>
            <input type="date" className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input" value={form.followUpDate ?? ""} onChange={(e) => set("followUpDate", e.target.value)} />
          </div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-border text-sm font-medium py-2.5 rounded-md hover:bg-muted transition-colors">Cancel</button>
          <button onClick={() => { if (!form.name) return; onSubmit(form); }} disabled={isLoading || !form.name} className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50">
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const { data: customers, isLoading } = useListCustomers(search ? { search } : undefined);

  const createCustomer = useCreateCustomer({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListCustomersQueryKey() }); setShowAdd(false); } },
  });
  const updateCustomer = useUpdateCustomer({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListCustomersQueryKey() }); setEditing(null); } },
  });
  const deleteCustomer = useDeleteCustomer({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListCustomersQueryKey() }) },
  });

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Buyers & contact list</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity glow-primary">
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        </div>

        <input
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-input"
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : !customers?.length ? (
          <div className="bg-card border border-card-border rounded-lg p-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No customers yet.</p>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-lg divide-y divide-border">
            {customers.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-sm">{c.name}</div>
                      {isPastDue(c.followUpDate) && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground flex items-center gap-0.5">
                          <Bell className="h-2.5 w-2.5" /> Follow-up
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      {c.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                    </div>
                    {c.preferences && <div className="text-xs text-muted-foreground mt-1 line-clamp-1">Wants: {c.preferences}</div>}
                    {c.notes && <div className="text-xs text-muted-foreground line-clamp-1">{c.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setEditing(c)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => { if (confirm("Delete this customer?")) deleteCustomer.mutate({ id: c.id }); }} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <CustomerForm title="Add Customer" onSubmit={(data) => createCustomer.mutate({ data })} onCancel={() => setShowAdd(false)} isLoading={createCustomer.isPending} />
      )}
      {editing && (
        <CustomerForm
          title="Edit Customer"
          initial={{
            name: editing.name,
            phone: editing.phone ?? undefined,
            email: editing.email ?? undefined,
            preferences: editing.preferences ?? undefined,
            notes: editing.notes ?? undefined,
            followUpDate: editing.followUpDate ?? undefined,
          }}
          onSubmit={(data) => updateCustomer.mutate({ id: editing.id, data })}
          onCancel={() => setEditing(null)}
          isLoading={updateCustomer.isPending}
        />
      )}
    </Layout>
  );
}
