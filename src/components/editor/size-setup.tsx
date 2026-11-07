"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PRESETS, Unit, mmToPx, toPx, fromPx } from "@/lib/editor/constants";
import { useEditorStore } from "@/stores/editor-store";
import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export function SizeSetup({ onDone }: { onDone: () => void }) {
  const { canvas, setCanvas, applyPreset, setSetupDone } = useEditorStore();
  const [preset, setPreset] = useState(canvas.preset);
  const [unit, setUnit] = useState<Unit>(canvas.unit);
  const [dpi, setDpi] = useState(canvas.dpi);
  const [w, setW] = useState(canvas.widthMm);
  const [h, setH] = useState(canvas.heightMm);

  const selectPreset = (key: string) => {
    setPreset(key);
    const p = PRESETS[key as keyof typeof PRESETS];
    if (p && key !== "custom") {
      setW(p.widthMm);
      setH(p.heightMm);
    }
  };

  const start = () => {
    const widthMm = unit === "mm" ? w : fromPx(toPx(w, unit, dpi), "mm", dpi);
    const heightMm = unit === "mm" ? h : fromPx(toPx(h, unit, dpi), "mm", dpi);
    const widthPx = toPx(w, unit, dpi);
    const heightPx = toPx(h, unit, dpi);
    const orientation =
      widthPx >= heightPx ? "landscape" : "portrait";

    setCanvas({
      widthPx,
      heightPx,
      widthMm: Math.round(widthMm * 100) / 100,
      heightMm: Math.round(heightMm * 100) / 100,
      unit,
      dpi,
      orientation: preset === "custom" ? "custom" : (orientation as "landscape" | "portrait"),
      preset,
    });
    setSetupDone(true);
    onDone();
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
      <Card className="w-full max-w-lg border-border/50 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <CreditCard className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle>Card Size & Orientation</CardTitle>
          <CardDescription>
            Choose portrait, landscape, or custom size before designing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => selectPreset(key)}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm transition-colors",
                  preset === key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                )}
              >
                <p className="font-medium">{p.label}</p>
                {key !== "custom" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.widthMm} × {p.heightMm} mm
                  </p>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Width</Label>
              <Input
                type="number"
                step="0.01"
                value={w}
                onChange={(e) => {
                  setW(parseFloat(e.target.value) || 0);
                  setPreset("custom");
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Height</Label>
              <Input
                type="number"
                step="0.01"
                value={h}
                onChange={(e) => {
                  setH(parseFloat(e.target.value) || 0);
                  setPreset("custom");
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">inch</option>
                <option value="px">px</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>DPI (print quality)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={dpi}
              onChange={(e) => setDpi(parseInt(e.target.value))}
            >
              <option value={150}>150 DPI</option>
              <option value={300}>300 DPI (recommended)</option>
              <option value={600}>600 DPI</option>
            </select>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Output ≈ {toPx(w, unit, dpi)} × {toPx(h, unit, dpi)} px
          </p>

          <Button className="w-full" size="lg" onClick={start}>
            Start Designing
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
