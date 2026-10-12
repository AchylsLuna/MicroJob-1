import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";

const OUTPUT_SIZE = 512;

type Props = {
  file: File;
  saving?: boolean;
  onCancel: () => void;
  onSave: (file: File) => Promise<void> | void;
};

/**
 * A square avatar editor. The canvas is both the editing surface and the final
 * preview, which keeps the image users see identical to the uploaded crop.
 */
export function ProfilePhotoEditor({ file, saving = false, onCancel, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      imageRef.current = image;
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setReady(true);
    };
    image.onerror = () => setReady(false);
    image.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const radians = (rotation * Math.PI) / 180;
    const cosine = Math.abs(Math.cos(radians));
    const sine = Math.abs(Math.sin(radians));
    const rotatedWidth = image.naturalWidth * cosine + image.naturalHeight * sine;
    const rotatedHeight = image.naturalWidth * sine + image.naturalHeight * cosine;
    const scale = Math.max(OUTPUT_SIZE / rotatedWidth, OUTPUT_SIZE / rotatedHeight) * zoom;
    // Keep the crop covered as the photo is dragged. Rotation is intentionally
    // in quarter turns, so this axis-aligned bound exactly matches the image.
    const maxX = Math.max(0, (rotatedWidth * scale - OUTPUT_SIZE) / 2);
    const maxY = Math.max(0, (rotatedHeight * scale - OUTPUT_SIZE) / 2);
    const x = Math.max(-maxX, Math.min(maxX, position.x));
    const y = Math.max(-maxY, Math.min(maxY, position.y));

    context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.save();
    context.translate(OUTPUT_SIZE / 2 + x, OUTPUT_SIZE / 2 + y);
    context.rotate(radians);
    context.drawImage(
      image,
      (-image.naturalWidth * scale) / 2,
      (-image.naturalHeight * scale) / 2,
      image.naturalWidth * scale,
      image.naturalHeight * scale,
    );
    context.restore();
    // `draw` reads rotation, zoom and position, so it has to be memoised on
    // them rather than recreated on every render -- otherwise the effect below cannot
    // list it as a dependency without re-running on every render.
  }, [rotation, zoom, position]);

  useEffect(() => { draw(); }, [ready, draw]);

  const move = (clientX: number, clientY: number) => {
    const start = dragRef.current;
    const canvas = canvasRef.current;
    if (!start || !canvas) return;
    const scale = OUTPUT_SIZE / canvas.getBoundingClientRect().width;
    dragRef.current = { x: clientX, y: clientY };
    setPosition((previous) => ({
      x: previous.x + (clientX - start.x) * scale,
      y: previous.y + (clientY - start.y) * scale,
    }));
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;
    await onSave(new File([blob], "profile-photo.jpg", { type: "image/jpeg" }));
  };

  return (
    <div className="space-y-5">
      <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl bg-slate-100 shadow-inner">
        <canvas
          ref={canvasRef}
          width={OUTPUT_SIZE}
          height={OUTPUT_SIZE}
          aria-label="Profile photo crop preview. Drag the image to reposition it."
          className="aspect-square w-full touch-none cursor-grab select-none active:cursor-grabbing"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => move(event.clientX, event.clientY)}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }}
        />
      </div>
      <p className="text-center text-sm text-slate-500">Drag to reposition your photo. The square above is your final profile picture.</p>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <ZoomOut className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <label className="sr-only" htmlFor="profile-photo-zoom">Zoom photo</label>
          <input
            id="profile-photo-zoom"
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-brand"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button type="button" onClick={() => setRotation((value) => value - 90)} className="inline-flex min-h-10 items-center gap-2 rounded-control border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" disabled={!ready || saving}>
            <RotateCcw className="h-4 w-4" /> Rotate left
          </button>
          <button type="button" onClick={() => setRotation((value) => value + 90)} className="inline-flex min-h-10 items-center gap-2 rounded-control border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" disabled={!ready || saving}>
            <RotateCw className="h-4 w-4" /> Rotate right
          </button>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={saving} className="min-h-11 rounded-control border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={() => void save()} disabled={!ready || saving} aria-busy={saving} className="min-h-11 rounded-control bg-brand px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">{saving ? "Saving photo..." : "Save photo"}</button>
      </div>
    </div>
  );
}
