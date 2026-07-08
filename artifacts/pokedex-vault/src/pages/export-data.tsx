import { Layout } from "@/components/layout";
import { Download, CreditCard, Package, Receipt, Users, Database } from "lucide-react";
import { markBackupDone } from "@/hooks/use-backup-reminder";

function downloadCsv(type: string) {
  const url = `/api/export/csv?type=${type}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `pokevault-${type}.csv`;
  a.click();
  if (type === "all") {
    markBackupDone();
  }
}

interface ExportCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  type: string;
  color: string;
}

function ExportCard({ icon: Icon, title, description, type, color }: ExportCardProps) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 flex items-start gap-4 card-hover">
      <div className={`shrink-0 p-2.5 rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm mb-0.5">{title}</div>
        <div className="text-xs text-muted-foreground mb-3">{description}</div>
        <button
          onClick={() => downloadCsv(type)}
          className="flex items-center gap-2 bg-muted hover:bg-secondary text-sm font-medium px-3 py-1.5 rounded-md transition-colors text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </button>
      </div>
    </div>
  );
}

export default function ExportData() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Export & Backup</h1>
          <p className="text-muted-foreground text-sm mt-1">Download your data as CSV files for safekeeping or spreadsheet analysis.</p>
        </div>

        <div className="space-y-3">
          <ExportCard
            icon={Database}
            title="Full Export"
            description="All cards, sealed products, expenses, customers, and pickups in one file."
            type="all"
            color="bg-primary/15 text-primary"
          />
          <ExportCard
            icon={CreditCard}
            title="Cards"
            description="All card inventory — name, set, grade, prices, status, and notes."
            type="cards"
            color="bg-blue-500/15 text-blue-400"
          />
          <ExportCard
            icon={Package}
            title="Sealed Products"
            description="All sealed inventory — ETBs, booster boxes, tins, and more."
            type="sealed"
            color="bg-purple-500/15 text-purple-400"
          />
          <ExportCard
            icon={Receipt}
            title="Expenses"
            description="All business expenses — supplies, shipping, fees, and other costs."
            type="expenses"
            color="bg-orange-500/15 text-orange-400"
          />
          <ExportCard
            icon={Users}
            title="Customers"
            description="Your full customer list with contact info, preferences, and notes."
            type="customers"
            color="bg-teal-500/15 text-teal-400"
          />
        </div>

        <div className="bg-muted/50 border border-border rounded-lg p-4 text-xs text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> Import CSV files into Google Sheets or Excel for custom reporting, charts, or offline backups. Photos are stored in Replit Object Storage and are not included in CSV exports.
        </div>
      </div>
    </Layout>
  );
}
