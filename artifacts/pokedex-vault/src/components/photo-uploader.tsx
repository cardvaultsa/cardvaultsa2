import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { ImageInputLabel } from "@workspace/api-client-react";

export type PhotoLabel = typeof ImageInputLabel[keyof typeof ImageInputLabel];

export interface UploadedPhoto {
  objectPath: string;
  label: PhotoLabel;
}

interface PhotoUploaderProps {
  onPhotosUploaded: (photos: UploadedPhoto[]) => Promise<void>;
  onClose: () => void;
}

interface PendingFile {
  file: File;
  preview: string;
  label: PhotoLabel;
}

const LABELS: PhotoLabel[] = ["front", "back", "damage", "receipt", "sealed", "other"];

export function PhotoUploader({ onPhotosUploaded, onClose }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles: PendingFile[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      label: "front",
    }));
    setPending((prev) => [...prev, ...newFiles]);
  };

  const setLabel = (idx: number, label: PhotoLabel) => {
    setPending((prev) => prev.map((p, i) => (i === idx ? { ...p, label } : p)));
  };

  const remove = (idx: number) => {
    setPending((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleUpload = async () => {
    if (pending.length === 0) return;
    setUploading(true);
    setProgress(0);
    const results: UploadedPhoto[] = [];

    for (let i = 0; i < pending.length; i++) {
      const { file, label } = pending[i];
      try {
        // Get presigned URL
        const res = await fetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type || "image/jpeg",
          }),
        });
        if (!res.ok) throw new Error("Failed to get upload URL");
        const { uploadURL, objectPath } = await res.json();

        // Upload directly to GCS
        const uploadRes = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });
        if (!uploadRes.ok) throw new Error("Upload failed");

        results.push({ objectPath, label });
      } catch (err) {
        console.error("Upload error for file", file.name, err);
      }
      setProgress(Math.round(((i + 1) / pending.length) * 100));
    }

    await onPhotosUploaded(results);
    pending.forEach((p) => URL.revokeObjectURL(p.preview));
    setPending([]);
    setUploading(false);
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Tap to choose photos, or drag and drop
        </p>
        <p className="text-xs text-muted-foreground mt-1">Images only</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* File list with label pickers */}
      {pending.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {pending.map((p, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-muted rounded-lg px-3 py-2">
              <img
                src={p.preview}
                alt=""
                className="h-12 w-12 rounded object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{p.file.name}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {LABELS.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLabel(idx, l)}
                      className={`px-1.5 py-0.5 text-[10px] rounded capitalize transition-colors ${
                        p.label === l
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-border"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => remove(idx)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <div className="space-y-1">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">Uploading... {progress}%</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onClose}
          disabled={uploading}
          className="flex-1 border border-border text-sm font-medium py-2.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={uploading || pending.length === 0}
          className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {uploading ? `Uploading ${progress}%` : `Upload ${pending.length || ""} Photo${pending.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
