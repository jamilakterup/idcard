"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { templateService } from "@/services/template.service";
import { extractFieldsFromDesign, autoMapHeaders, applyRowToDesign } from "@/lib/bulk/mapping";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { Check, ChevronLeft, ChevronRight, FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type GenMode = "both" | "front" | "back";

export default function BulkPage() {
  const [step, setStep] = useState<Step>(1);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [mode, setMode] = useState<GenMode>("both");
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({}); // normalized name -> dataUrl
  const [zipName, setZipName] = useState("");
  const [photoMatchStats, setPhotoMatchStats] = useState({ matched: 0, missing: 0, extra: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => templateService.getAll(),
  });
  const templates = data?.data?.templates || [];

  const selected = useMemo(
    () => templates.find((t) => t._id === templateId) || null,
    [templates, templateId]
  );

  const designFields = useMemo(() => {
    if (!selected) return [];
    return [
      ...extractFieldsFromDesign(selected.frontDesign, "front"),
      ...extractFieldsFromDesign(selected.backDesign, "back"),
    ];
  }, [selected]);

  const uniqueTitles = useMemo(() => {
    const s = new Set<string>();
    designFields.filter((f) => f.isDynamic).forEach((f) => s.add(f.fieldTitle));
    return Array.from(s);
  }, [designFields]);

  const frontTitles = useMemo(
    () =>
      Array.from(
        new Set(
          designFields.filter((f) => f.side === "front" && f.isDynamic).map((f) => f.fieldTitle)
        )
      ),
    [designFields]
  );
  const backTitles = useMemo(
    () =>
      Array.from(
        new Set(
          designFields.filter((f) => f.side === "back" && f.isDynamic).map((f) => f.fieldTitle)
        )
      ),
    [designFields]
  );

  useEffect(() => {
    if (uniqueTitles.length && headers.length) {
      setMapping(autoMapHeaders(uniqueTitles, headers));
    }
  }, [uniqueTitles, headers]);

  useEffect(() => {
    if (mode === "front") setPreviewSide("front");
    if (mode === "back") setPreviewSide("back");
  }, [mode]);

  useEffect(() => {
    if (step !== 5 || !selected || !rows[previewIdx]) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { fabric } = await import("fabric");
        const raw =
          previewSide === "front" ? selected.frontDesign || {} : selected.backDesign || {};
        const design = applyRowToDesign(raw, rows[previewIdx], mapping);
        const cfg = (selected.canvasConfig || {}) as { widthPx?: number; heightPx?: number };
        const w = cfg.widthPx || 638;
        const h = cfg.heightPx || 1011;
        const el = document.createElement("canvas");
        const c = new fabric.Canvas(el, { width: w, height: h, backgroundColor: "#fff" });
        await new Promise<void>((resolve) => {
          c.loadFromJSON(design, () => {
            c.renderAll();
            resolve();
          });
        });
        const url = c.toDataURL({ format: "png", multiplier: 0.5 });
        c.dispose();
        if (!cancelled) setPreviewUrl(url);
      } catch (err) {
        console.error(err);
        if (!cancelled) setPreviewUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, selected, rows, previewIdx, mapping, previewSide]);

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
      if (!data.length) {
        toast.error("File is empty");
        return;
      }
      setHeaders(Object.keys(data[0]));
      setRows(data);
      setFileName(file.name);
      setStep(3);
      toast.success(`${data.length} rows loaded`);
    } catch {
      toast.error("Failed to parse file");
    }
  };

  const downloadSample = () => {
    const cols = uniqueTitles.length ? uniqueTitles : ["Name", "ID", "Department"];
    const sample = cols.map((c, i) => (i === 0 ? "Jamil Akter" : i === 1 ? "101" : `Sample ${c}`));
    const csv = [cols.join(","), sample.join(",")].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "id-studio-sample.csv";
    a.click();
  };

  const renderSidePng = async (
    fabric: typeof import("fabric"),
    designRaw: Record<string, unknown>,
    row: Record<string, string>,
    w: number,
    h: number
  ) => {
    let design = applyRowToDesign(designRaw, row, mapping) as {
      objects?: Array<{ type?: string; src?: string; data?: { fieldTitle?: string; isPhoto?: boolean }; fill?: unknown }>;
    };
    // Match Photo field → ZIP image
    const photoCol = mapping["Photo"] || mapping["photo"] || mapping["PHOTO"];
    if (photoCol && row[photoCol] && design.objects) {
      const rawName = String(row[photoCol]).trim();
      const key = rawName.toLowerCase().replace(/\s+/g, "");
      const keyNoExt = key.replace(/\.(jpe?g|png|webp|gif)$/i, "");
      const src = photoMap[key] || photoMap[keyNoExt];
      if (src) {
        for (const obj of design.objects) {
          const ft = (obj.data?.fieldTitle || "").toLowerCase();
          if (obj.data?.isPhoto || ft === "photo" || ft === "image") {
            if (obj.type === "image") obj.src = src;
          }
        }
      }
    }
    const el = document.createElement("canvas");
    const c = new fabric.fabric.Canvas(el, { width: w, height: h, backgroundColor: "#fff" });
    await new Promise<void>((resolve) => {
      c.loadFromJSON(design, () => {
        c.renderAll();
        resolve();
      });
    });
    const png = c.toDataURL({ format: "png", multiplier: 1 });
    c.dispose();
    return png;
  };

  const generate = async () => {
    if (!selected) return;
    setGenerating(true);
    const max = Math.min(rows.length, 200);
    setProgress({ done: 0, total: max });
    try {
      const fabricMod = await import("fabric");
      const cfg = (selected.canvasConfig || {}) as {
        widthPx?: number;
        heightPx?: number;
        widthMm?: number;
        heightMm?: number;
      };
      const w = cfg.widthPx || 638;
      const h = cfg.heightPx || 1011;
      const wMm = cfg.widthMm || 53.98;
      const hMm = cfg.heightMm || 85.6;
      const orient = w >= h ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation: orient, unit: "mm", format: [wMm, hMm] });

      let page = 0;
      for (let i = 0; i < max; i++) {
        const row = rows[i];
        if (mode === "both" || mode === "front") {
          if (page > 0) pdf.addPage([wMm, hMm], orient);
          const png = await renderSidePng(
            fabricMod,
            (selected.frontDesign || {}) as Record<string, unknown>,
            row,
            w,
            h
          );
          pdf.addImage(png, "PNG", 0, 0, wMm, hMm);
          page++;
        }
        if (mode === "both" || mode === "back") {
          if (page > 0) pdf.addPage([wMm, hMm], orient);
          const png = await renderSidePng(
            fabricMod,
            (selected.backDesign || {}) as Record<string, unknown>,
            row,
            w,
            h
          );
          pdf.addImage(png, "PNG", 0, 0, wMm, hMm);
          page++;
        }
        setProgress({ done: i + 1, total: max });
        await new Promise((r) => setTimeout(r, 0));
      }

      const suffix = mode === "both" ? "front-back" : mode === "front" ? "front-only" : "back-only";
      pdf.save(`${selected.templateName}-${suffix}.pdf`);
      toast.success(`Generated ${max} record(s) · mode: ${suffix}`);
      setStep(6);
    } catch (err) {
      console.error(err);
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <Header title="Bulk Generation" />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3, 4, 5, 6] as Step[]).map((s) => (
            <div
              key={s}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                step === s
                  ? "bg-primary text-primary-foreground"
                  : step > s
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {step > s ? <Check className="h-3 w-3" /> : s}.{" "}
              {s === 1
                ? "Template"
                : s === 2
                  ? "Upload"
                  : s === 3
                    ? "Mapping"
                    : s === 4
                      ? "Mode"
                      : s === 5
                        ? "Preview"
                        : "Done"}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Select template</CardTitle>
              <CardDescription>Field Titles on the design become CSV headers automatically</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map((t) => (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => setTemplateId(t._id)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        templateId === t._id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                      )}
                    >
                      <div className="aspect-[3/4] max-h-36 mb-2 rounded bg-muted flex items-center justify-center overflow-hidden">
                        {t.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.thumbnail} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-xs text-muted-foreground">No preview</span>
                        )}
                      </div>
                      <p className="font-medium text-sm truncate">{t.templateName}</p>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button disabled={!templateId} onClick={() => setStep(2)}>
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV / Excel</CardTitle>
              <CardDescription>
                FRONT: {frontTitles.join(", ") || "—"} · BACK: {backTitles.join(", ") || "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" onClick={downloadSample}>
                Download sample CSV (all fields)
              </Button>
              <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-12 cursor-pointer hover:bg-muted/50">
                <FileUp className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Drop file or click to browse</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                  }}
                />
              </label>
              {fileName && (
                <p className="text-sm">
                  {fileName} · {rows.length} rows
                </p>
              )}

              <div className="space-y-2 pt-4 border-t border-border">
                <p className="text-sm font-medium">Student Photos (ZIP)</p>
                <p className="text-xs text-muted-foreground">
                  Filenames must match the Photo column in CSV (e.g. jamil.jpg)
                </p>
                                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 cursor-pointer hover:bg-muted/50">
                  <FileUp className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Upload photos (multiple images or .zip)
                  </span>
                  <input
                    type="file"
                    accept=".zip,image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const map: Record<string, string> = { ...photoMap };
                      try {
                        for (const f of files) {
                          if (f.name.toLowerCase().endsWith(".zip") || f.type === "application/zip") {
                            try {
                              const JSZip = (await import("jszip")).default;
                              const zip = await JSZip.loadAsync(await f.arrayBuffer());
                              for (const path of Object.keys(zip.files)) {
                                const entry = zip.files[path];
                                if (entry.dir || path.includes("..")) continue;
                                const base = path.split("/").pop() || path;
                                if (!/\.(jpe?g|png|webp|gif)$/i.test(base)) continue;
                                const blob = await entry.async("blob");
                                if (blob.size > 5 * 1024 * 1024) continue;
                                const dataUrl = await new Promise<string>((res, rej) => {
                                  const r = new FileReader();
                                  r.onload = () => res(r.result as string);
                                  r.onerror = rej;
                                  r.readAsDataURL(blob);
                                });
                                const key = base.toLowerCase().replace(/\s+/g, "");
                                map[key] = dataUrl;
                                map[key.replace(/\.(jpe?g|png|webp|gif)$/i, "")] = dataUrl;
                              }
                              setZipName(f.name);
                            } catch {
                              toast.error("Install jszip: run npm install jszip — or upload images directly");
                            }
                          } else if (f.type.startsWith("image/")) {
                            const dataUrl = await new Promise<string>((res, rej) => {
                              const r = new FileReader();
                              r.onload = () => res(r.result as string);
                              r.onerror = rej;
                              r.readAsDataURL(f);
                            });
                            const key = f.name.toLowerCase().replace(/\s+/g, "");
                            map[key] = dataUrl;
                            map[key.replace(/\.(jpe?g|png|webp|gif)$/i, "")] = dataUrl;
                            setZipName((prev) => prev || `${files.length} image(s)`);
                          }
                        }
                        setPhotoMap(map);
                        toast.success(`${Object.keys(map).length} photo keys ready`);
                      } catch (err) {
                        console.error(err);
                        toast.error("Photo load failed");
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                {(zipName || Object.keys(photoMap).length > 0) && (
                  <p className="text-xs text-muted-foreground">
                    {zipName || "Photos"} · {Object.keys(photoMap).length} keys
                  </p>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button disabled={!rows.length} onClick={() => setStep(3)}>
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Field mapping</CardTitle>
              <CardDescription>Matched by Field Title (case-insensitive)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-left">
                      <th className="p-2">Template Field</th>
                      <th className="p-2">Side</th>
                      <th className="p-2">CSV Header</th>
                      <th className="p-2">Sample</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueTitles.map((ft) => {
                      const sides = designFields
                        .filter((f) => f.fieldTitle === ft)
                        .map((f) => f.side)
                        .join("+");
                      const col = mapping[ft];
                      const sample = col && rows[0] ? rows[0][col] : "";
                      return (
                        <tr key={ft} className="border-t border-border">
                          <td className="p-2 font-medium">{ft}</td>
                          <td className="p-2 text-xs text-muted-foreground">{sides}</td>
                          <td className="p-2">
                            <select
                              className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                              value={col || ""}
                              onChange={(e) =>
                                setMapping((m) => ({ ...m, [ft]: e.target.value || null }))
                              }
                            >
                              <option value="">— Skip —</option>
                              {headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 text-muted-foreground truncate max-w-[120px]">{sample}</td>
                          <td className="p-2">
                            {col ? (
                              <span className="text-xs text-emerald-500">Matched</span>
                            ) : (
                              <span className="text-xs text-amber-500">Unmapped</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={() => setStep(4)}>Next — Generation mode</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Generation mode</CardTitle>
              <CardDescription>
                Template designs are never modified — mode only controls what is exported
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    { id: "both" as GenMode, title: "Front + Back", desc: "Both sides per record (paired)" },
                    { id: "front" as GenMode, title: "Front Only", desc: "Only front pages" },
                    { id: "back" as GenMode, title: "Back Only", desc: "Only back pages" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      mode === opt.id ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "hover:bg-muted"
                    )}
                  >
                    <p className="font-semibold">{opt.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button onClick={() => setStep(5)}>Next — Preview</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>
                Record {previewIdx + 1} / {rows.length} · Mode: {mode}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "both" && (
                <div className="flex gap-2 justify-center">
                  <Button
                    size="sm"
                    variant={previewSide === "front" ? "default" : "outline"}
                    onClick={() => setPreviewSide("front")}
                  >
                    Front
                  </Button>
                  <Button
                    size="sm"
                    variant={previewSide === "back" ? "default" : "outline"}
                    onClick={() => setPreviewSide("back")}
                  >
                    Back
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={previewIdx <= 0}
                  onClick={() => setPreviewIdx((i) => i - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-h-[280px] flex items-center justify-center rounded-lg bg-muted/40 p-4">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="Preview" className="max-h-[320px] rounded shadow-lg" />
                  ) : (
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={previewIdx >= rows.length - 1}
                  onClick={() => setPreviewIdx((i) => i + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(4)}>
                  Back
                </Button>
                <Button onClick={generate} disabled={generating}>
                  {generating
                    ? `Generating ${progress.done}/${progress.total}…`
                    : "Generate PDF"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 6 && (
          <Card>
            <CardHeader>
              <CardTitle>Done</CardTitle>
              <CardDescription>PDF downloaded. Template designs were not modified.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={() => setStep(5)}>Generate again</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setTemplateId(null);
                  setRows([]);
                }}
              >
                Start over
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
