import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListExpenses,
  useCreateExpense,
  useDeleteExpense,
  getListExpensesQueryKey,
  type ExpenseInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Receipt } from "lucide-react";

const CATEGORIES = [
  { value: "supplies", label: "Supplies" },
  { value: "shipping", label: "Shipping" },
  { value: "platform_fees", label: "Platform Fees" },
  { value: "gas", label: "Gas" },
  { value: "packaging", label: "Packaging" },
  { value: "grading", label: "Grading" },
  { value: "purchase", label: "Purchase" },
  { value: "other", label: "Other" },
];

const CATEGORY_COLORS: Record<string, string> = {
  supplies: "bg-blue-500/15 text-blue-400",
  shipping: "bg-purple-500/15 text-purple-400",
  platform_fees: "bg-orange-500/15 text-orange-400",
  gas: "bg-yellow-500/15 text-yellow-400",
  packaging: "bg-teal-500/15 text-teal-400",
  grading: "bg-pink-500/15 text-pink-400",
  purchase: "bg-primary/15 text-primary",
  other: "bg-muted text-muted-foreground",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function today() {
  return new Date().toISOString().split("T")[0];
}

interface AddExpenseFormProps {
  onSubmit: (data: ExpenseInput) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function AddExpenseForm({ onSubmit, onCancel, isLoading }: AddExpenseFormProps) {
  const [form, setForm] = useState<ExpenseInput>({
    category: "other",
    description: "",
    amount: 0,
    date: today(),
  });
  const set = (k: keyof ExpenseInput, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card border border-card-border w-full sm:max-w-md rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4">
          <h2 className="font-semibold text-lg">Add Expense</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</label>
            <select
              className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input"
              value={form.category}
              onChange={(e) => set("category", e.target.value as ExpenseInput["category"])}
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description *</label>
            <input
              className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. TopLoaders from Amazon"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount *</label>
              <input
                type="number" min={0} step={0.01}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input"
                value={form.amount || ""}
                onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date *</label>
              <input
                type="date"
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
            <textarea
              className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-input resize-none"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-border text-sm font-medium py-2.5 rounded-md hover:bg-muted transition-colors">Cancel</button>
          <button
            onClick={() => { if (!form.description || !form.amount) return; onSubmit(form); }}
            disabled={isLoading || !form.description || !form.amount}
            className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Add Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Expenses() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");

  const params = filterCategory ? { category: filterCategory } : undefined;
  const { data: expenses, isLoading } = useListExpenses(params);

  const createExpense = useCreateExpense({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListExpensesQueryKey() }); setShowForm(false); },
    },
  });

  const deleteExpense = useDeleteExpense({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListExpensesQueryKey() }) },
  });

  const total = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;

  const monthlyTotal = expenses?.reduce<Record<string, number>>((acc, e) => {
    const month = e.date.slice(0, 7);
    acc[month] = (acc[month] ?? 0) + e.amount;
    return acc;
  }, {}) ?? {};

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthTotal = monthlyTotal[currentMonth] ?? 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Business costs & overhead</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity glow-primary"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">This Month</div>
            <div className="text-2xl font-bold text-destructive tabular-nums">{fmt(thisMonthTotal)}</div>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">All Time</div>
            <div className="text-2xl font-bold tabular-nums text-foreground">{fmt(total)}</div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory("")}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!filterCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilterCategory(filterCategory === c.value ? "" : c.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterCategory === c.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : !expenses?.length ? (
          <div className="bg-card border border-card-border rounded-lg p-8 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No expenses yet.</p>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-lg divide-y divide-border">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS.other}`}>
                      {CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}
                    </span>
                    <span className="text-xs text-muted-foreground">{e.date}</span>
                  </div>
                  <div className="text-sm font-medium truncate">{e.description}</div>
                  {e.notes && <div className="text-xs text-muted-foreground truncate">{e.notes}</div>}
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-destructive">{fmt(e.amount)}</span>
                  <button
                    onClick={() => deleteExpense.mutate({ id: e.id })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <AddExpenseForm
          onSubmit={(data) => createExpense.mutate({ data })}
          onCancel={() => setShowForm(false)}
          isLoading={createExpense.isPending}
        />
      )}
    </Layout>
  );
}
