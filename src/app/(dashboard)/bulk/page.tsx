"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { templateService } from "@/services/template.service";
import { extractFieldsFromDesign, autoMapHeaders, applyRowToDesign } from "@/lib/bulk/mapping";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { Check, ChevronLeft, ChevronRight, FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4 | 5;

export default function BulkPage() {
  const [step, setStep] = useState<Step>(1);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

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

  useEffect(() => {
    if (uniqueTitles.length && headers.length) {
      setMapping(autoMapHeaders(uniqueTitles, headers));
    }
  }, [uniqueTitles, headers]);

  // Live preview of one row by rendering fabric offscreen
  useEffect(() => {
    if (step !== 4 || !selected || !rows[previewIdx]) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { fabric } = await import("fabric");
        const design = applyRowToDesign(
          selected.frontDesign || {},
          rows[previewIdx],
          mapping
        );
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
  }, [step, selected, rows, previewIdx, mapping]);

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

  const generate = async () => {
    if (!selected) return;
    setGenerating(true);
    setProgress({ done: 0, total: rows.length });
    try {
      const { fabric } = await import("fabric");
      const cfg = (selected.canvasConfig || {}) as {
        widthPx?: number; heightPx?: number; widthMm?: number; heightMm?: number;
      };
      const w = cfg.widthPx || 638;
      const h = cfg.heightPx || 1011;
      const wMm = cfg.widthMm || 53.98;
      const hMm = cfg.heightMm || 85.6;
      const orient = w >= h ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation: orient, unit: "mm", format: [wMm, hMm] });

      const max = Math.min(rows.length, 200);
      for (let i = 0; i < max; i++) {
        const design = applyRowToDesign(selected.frontDesign || {}, rows[i], mapping);
        const el = document.createElement("canvas");
        const c = new fabric.Canvas(el, { width: w, height: h, backgroundColor: "#fff" });
        await new Promise<void>((resolve) => {
          c.loadFromJSON(design, () => {
            c.renderAll();
            resolve();
          });
        });
        const png = c.toDataURL({ format: "png", multiplier: 1 });
        c.dispose();
        if (i > 0) pdf.addPage([wMm, hMm], orient);
        pdf.addImage(png, "PNG", 0, 0, wMm, hMm);
        setProgress({ done: i + 1, total: max });
        // yield to UI
        await new Promise((r) => setTimeout(r, 0));
      }
      pdf.save(`${selected.templateName}-bulk.pdf`);
      toast.success(`Generated ${max} cards`);
      setStep(5);
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
        {/* Steps */}
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3, 4, 5] as Step[]).map((s) => (
            <div
              key={s}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                step === s ? "bg-primary text-primary-foreground" : step > s ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {step > s ? <Check className="h-3 w-3" /> : s}.{" "}
              {s === 1 ? "Template" : s === 2 ? "Upload" : s === 3 ? "Mapping" : s === 4 ? "Preview" : "Generate"}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Select template</CardTitle>
              <CardDescription>Choose a saved design with Field Titles for CSV mapping</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : templates.length === 0 ? (
                <p className="text-muted-foreground">No templates. Create one first.</p>
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
                Headers should match Field Titles in the template ({uniqueTitles.join(", ") || "none yet"})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" onClick={downloadSample}>
                Download sample CSV
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
              <CardDescription>CSV Header = Template Field Title (case-insensitive)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-left">
                      <th className="p-2">Template Field</th>
                      <th className="p-2">CSV Header</th>
                      <th className="p-2">Sample</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueTitles.map((ft) => {
                      const col = mapping[ft];
                      const sample = col && rows[0] ? rows[0][col] : "";
                      return (
                        <tr key={ft} className="border-t border-border">
                          <td className="p-2 font-medium">{ft}</td>
                          <td className="p-2">
                            <select
                              className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                              value={col || ""}
                              onChange={(e) =>
                                setMapping((m) => ({
                                  ...m,
                                  [ft]: e.target.value || null,
                                }))
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
                    {!uniqueTitles.length && (
                      <tr>
                        <td colSpan={4} className="p-4 text-muted-foreground text-center">
                          No dynamic Field Titles on this template. Edit the template and set Field Title on text elements.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={() => setStep(4)}>Next — Preview</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>
                Record {previewIdx + 1} of {rows.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button onClick={generate} disabled={generating}>
                  {generating ? `Generating ${progress.done}/${progress.total}…` : "Generate PDF"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Done</CardTitle>
              <CardDescription>Your bulk PDF should have downloaded.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={() => setStep(4)}>Generate again</Button>
              <Button variant="outline" onClick={() => { setStep(1); setTemplateId(null); setRows([]); }}>
                Start over
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
