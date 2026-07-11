import { useRef, useState } from "react";
import { Camera, Check, X } from "lucide-react";

export interface IdentifiedCardCandidate {
  id: string;
  name: string;
  set: string | null;
  cardNumber: string | null;
  rarity: string | null;
  imageUrl: string | null;
  marketValue: number | null;
  score: number;
}

interface CardPhotoIdentifierProps {
  onUseCandidate: (candidate: IdentifiedCardCandidate) => void;
}

function getAuthHeaders(): HeadersInit {
  try {
    const token = window.sessionStorage.getItem("pokevault.sessionToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image."));
    };
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

export function CardPhotoIdentifier({ onUseCandidate }: CardPhotoIdentifierProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<IdentifiedCardCandidate[]>([]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setCandidates([]);
    setIsIdentifying(true);

    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const response = await fetch("/api/cards/identify-photo", {
        method: "POST",
        credentials: "include",
        headers: {
          ...getAuthHeaders(),
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = await response.json().catch(() => null) as
        | { candidates?: IdentifiedCardCandidate[]; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Card photo identification failed.");
      }

      const matches = data?.candidates ?? [];
      if (matches.length === 0) {
        setError("No online Pokemon TCG match found. Try a clearer front photo.");
        return;
      }
      setCandidates(matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Card photo identification failed.");
    } finally {
      setIsIdentifying(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isIdentifying}
          className="flex items-center gap-2 border border-border text-sm font-medium px-3 py-2 rounded-md bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          {isIdentifying ? "Identifying..." : "Photo Identify Card"}
        </button>
        <span className="text-xs text-muted-foreground">
          Uses a front photo, then matches online Pokemon TCG cards.
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {error ? (
        <div className="flex items-start gap-2 text-xs text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}
      {candidates.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => {
                onUseCandidate(candidate);
                setCandidates([]);
              }}
              className="flex items-center gap-3 rounded-md border border-border bg-card p-2 text-left hover:bg-muted transition-colors"
            >
              {candidate.imageUrl ? (
                <img
                  src={candidate.imageUrl}
                  alt={candidate.name}
                  className="h-16 w-12 rounded object-cover bg-muted"
                />
              ) : (
                <div className="h-16 w-12 rounded bg-muted" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{candidate.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[candidate.set, candidate.cardNumber ? `#${candidate.cardNumber}` : null, candidate.rarity]
                    .filter(Boolean)
                    .join(" / ")}
                </span>
                {candidate.marketValue != null ? (
                  <span className="block text-xs text-muted-foreground">
                    Market ${candidate.marketValue.toFixed(2)}
                  </span>
                ) : null}
              </span>
              <Check className="h-4 w-4 text-primary" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
