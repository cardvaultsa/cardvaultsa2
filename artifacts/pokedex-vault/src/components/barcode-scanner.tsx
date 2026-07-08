import { useRef, useState } from "react";
import { ScanBarcode, X } from "lucide-react";

interface BarcodeScannerProps {
  onDetected: (value: string) => void;
  label?: string;
}

export function BarcodeScanner({ onDetected, label = "Scan Barcode" }: BarcodeScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("scanning");
    setErrorMsg("");
    try {
      if ("BarcodeDetector" in window) {
        const bd = new (window as unknown as { BarcodeDetector: new (opts: object) => { detect: (img: ImageBitmap) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
        });
        const bitmap = await createImageBitmap(file);
        const barcodes = await bd.detect(bitmap);
        if (barcodes.length > 0) {
          onDetected(barcodes[0].rawValue);
          setStatus("idle");
          if (inputRef.current) inputRef.current.value = "";
          return;
        }
      }
      setStatus("error");
      setErrorMsg("No barcode detected — enter the value manually.");
    } catch {
      setStatus("error");
      setErrorMsg("Scan failed — try entering the value manually.");
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "scanning"}
        className="flex items-center gap-2 border border-border text-sm font-medium px-3 py-2 rounded-md bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <ScanBarcode className="h-4 w-4" />
        {status === "scanning" ? "Scanning..." : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {status === "error" && (
        <span className="text-xs text-destructive flex items-center gap-1">
          {errorMsg}
          <button type="button" onClick={() => setStatus("idle")}>
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
    </div>
  );
}
