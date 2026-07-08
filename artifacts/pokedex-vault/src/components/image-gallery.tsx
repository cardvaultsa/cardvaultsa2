import { useState } from "react";
import { Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { ItemImage } from "@workspace/api-client-react";

const labelColors: Record<string, string> = {
  front: "bg-primary/15 text-primary",
  back: "bg-blue-500/15 text-blue-700",
  damage: "bg-destructive/15 text-destructive",
  receipt: "bg-purple-500/15 text-purple-700",
  sealed: "bg-green-500/15 text-green-700",
  other: "bg-muted text-muted-foreground",
};

interface ImageGalleryProps {
  images: ItemImage[];
  onDelete?: (imageId: number) => void;
}

export function ImageGallery({ images, onDelete }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
        No photos yet
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {images.map((img, idx) => (
          <div
            key={img.id}
            className="relative group aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer border border-border"
            onClick={() => setLightboxIndex(idx)}
          >
            <img
              src={`/api/storage${img.objectPath}`}
              alt={img.label}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            <span
              className={`absolute bottom-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${
                labelColors[img.label] ?? labelColors.other
              }`}
            >
              {img.label}
            </span>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(img.id);
                }}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-destructive text-white rounded p-1"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="h-6 w-6" />
          </button>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 text-white/70 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
              }}
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}

          <img
            src={`/api/storage${images[lightboxIndex].objectPath}`}
            alt={images[lightboxIndex].label}
            className="max-h-full max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {lightboxIndex < images.length - 1 && (
            <button
              className="absolute right-4 text-white/70 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
              }}
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          <div className="absolute bottom-4 left-0 right-0 text-center">
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${labelColors[images[lightboxIndex].label] ?? labelColors.other}`}>
              {images[lightboxIndex].label}
            </span>
            {images[lightboxIndex].caption && (
              <p className="text-white/70 text-sm mt-1">{images[lightboxIndex].caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
