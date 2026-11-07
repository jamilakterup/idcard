"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Type, Image as ImageIcon, QrCode, Square, Circle, Minus, Upload,
  ZoomIn, ZoomOut, Save, Eye, Undo, Redo, Trash2, MousePointer2,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  FileUp, Download, Table, Layers, CircleDot, SquareIcon,
} from "lucide-react";
import { toast } from "sonner";
import { IdCanvas } from "@/components/editor/id-canvas";
import { SizeSetup } from "@/components/editor/size-setup";
import { useEditorStore, EditorTool } from "@/stores/editor-store";
import { templateService } from "@/services/template.service";
import { uploadImageFile, persistFabricImageSources } from "@/lib/upload";
import { extractFieldsFromDesign } from "@/lib/bulk/mapping";
import { FONT_FAMILIES } from "@/lib/editor/constants";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

const tools: { id: EditorTool; icon: React.ElementType; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "text", icon: Type, label: "Text" },
  { id: "image", icon: ImageIcon, label: "Image" },
  { id: "qr", icon: QrCode, label: "QR" },
  { id: "rect", icon: Square, label: "Rect" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "line", icon: Minus, label: "Line" },
];

function getCanvasJson(): Promise<string> {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent("editor:force-json", { detail: { resolve } })
    );
    setTimeout(() => resolve(""), 1500);
  });
}

export default function CreatePage() {
  const imageRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const shapeImageRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [qrText, setQrText] = useState("https://idstudio.app");
  const [excelRows, setExcelRows] = useState<Record<string, string>[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [newField, setNewField] = useState("");
  const [propsOpen, setPropsOpen] = useState(true);

  const {
    side, tool, zoom, selectedId, selectedType, selectedText,
    selectedMeta,
    canUndo, canRedo, templateName, templateId, frontJson, backJson,
    setupDone, canvas, textStyle, dynamicFields,
    setSide, setTool, setZoom, setTemplateName, setTemplateId, setDirty,
    setTextStyle, setSetupDone, setSelectedText,
    setSelectedMeta, addDynamicField, removeDynamicField,
    syncDynamicFieldsFromDesigns, setHydrating, setHydrateError, isHydrating, hydrateError,
    setSideJson,
  } = useEditorStore();

  const searchParams = useSearchParams();
  const router = useRouter();
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Single reliable load path for Edit/Use — set JSON before mounting canvas
  useEffect(() => {
    const tid = searchParams.get("template") || searchParams.get("use");
    const isUse = !!searchParams.get("use");
    if (!tid) return;
    if (setupDone && templateId === tid && !isUse) return;
    if (setupDone && isUse && templateName.includes("(copy)")) return;

    let cancelled = false;
    (async () => {
      setLoadingTemplate(true);
      setHydrating(true);
      setHydrateError(null);
      try {
        const res = await templateService.getById(tid);
        const tpl = res.data?.template;
        if (!tpl || cancelled) return;

        const cc = (tpl.canvasConfig || {}) as {
          widthPx?: number; heightPx?: number; widthMm?: number; heightMm?: number;
          dpi?: number; orientation?: string; unit?: string; preset?: string;
        };

        if (cc.widthPx && cc.heightPx) {
          useEditorStore.getState().setCanvas({
            widthPx: cc.widthPx,
            heightPx: cc.heightPx,
            widthMm: cc.widthMm || 85.6,
            heightMm: cc.heightMm || 53.98,
            dpi: cc.dpi || 300,
            orientation: (cc.orientation as "landscape" | "portrait" | "custom") || "portrait",
            unit: (cc.unit as "mm" | "px" | "cm" | "in") || "mm",
            preset: cc.preset || "custom",
          });
        }

        const front = tpl.frontDesign && Object.keys(tpl.frontDesign).length
          ? JSON.stringify(tpl.frontDesign)
          : null;
        const back = tpl.backDesign && Object.keys(tpl.backDesign).length
          ? JSON.stringify(tpl.backDesign)
          : null;

        // Critical: write JSON into store BEFORE setupDone so IdCanvas mounts with data
        if (front) {
          useEditorStore.getState().initSideHistory("front", front);
        }
        if (back) {
          useEditorStore.getState().initSideHistory("back", back);
        } else {
          useEditorStore.getState().initSideHistory(
            "back",
            JSON.stringify({ version: "5.3.0", objects: [], background: "#ffffff" })
          );
        }

        setTemplateId(isUse ? null : tpl._id);
        setTemplateName(isUse ? `${tpl.templateName} (copy)` : tpl.templateName);
        useEditorStore.getState().setSide("front");
        useEditorStore.getState().syncDynamicFieldsFromDesigns(front, back);
        useEditorStore.getState().setSetupDone(true);
        toast.success(isUse ? "Template loaded as copy" : "Template loaded for editing");
        router.replace("/create");
      } catch (err) {
        console.error(err);
        setHydrateError("Failed to load template. It may have been deleted.");
        toast.error("Failed to load template");
      } finally {
        if (!cancelled) {
          setLoadingTemplate(false);
          setHydrating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);


  const applyTextStyle = (partial: Partial<typeof textStyle> & { text?: string; defaultText?: string; fieldTitle?: string; isDynamic?: boolean }) => {
    if (partial.text !== undefined) setSelectedText(partial.text);
    setTextStyle(partial);
    window.dispatchEvent(new CustomEvent("editor:apply-style", { detail: partial }));
  };

  const handleTool = useCallback(async (t: EditorTool) => {
    if (t === "image") { imageRef.current?.click(); return; }
    if (t === "qr") {
      try {
        const dataUrl = await QRCode.toDataURL(qrText || "ID Studio", {
          width: 256, margin: 1, color: { dark: "#000000", light: "#ffffff" },
        });
        window.dispatchEvent(new CustomEvent("editor:add-qr", {
          detail: { dataUrl, content: qrText, fieldTitle: "QR" },
        }));
      } catch { toast.error("QR failed"); }
      return;
    }
    setTool(t);
  }, [qrText, setTool]);

  const readDataUrl = (file: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f?.type.startsWith("image/")) return;
    try {
      toast.info("Uploading image…");
      const url = await uploadImageFile(f);
      const abs = url.startsWith("http") ? url : `${window.location.origin}${url}`;
      window.dispatchEvent(new CustomEvent("editor:add-image", { detail: { dataUrl: abs } }));
      toast.success("Image added");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
    e.target.value = "";
  };

  const handleBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f?.type.startsWith("image/")) { toast.error("Image only — use PDF button for PDF"); return; }
    try {
      toast.info("Uploading background…");
      const url = await uploadImageFile(f);
      const abs = url.startsWith("http") ? url : `${window.location.origin}${url}`;
      window.dispatchEvent(new CustomEvent("editor:set-bg", { detail: { dataUrl: abs } }));
      toast.success("Background applied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
    e.target.value = "";
  };

  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || f.type !== "application/pdf") { toast.error("Select a PDF"); return; }
    try {
      toast.info("Rendering PDF…");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 2.5 });
      const el = document.createElement("canvas");
      el.width = viewport.width;
      el.height = viewport.height;
      await page.render({ canvasContext: el.getContext("2d")!, viewport, canvas: el }).promise;
      // Upload rendered PNG so it persists
      const dataUrl = el.toDataURL("image/png");
      try {
        const permanent = await uploadImageFile(
          new File([await (await fetch(dataUrl)).blob()], "bg-pdf.png", { type: "image/png" })
        );
        const abs = permanent.startsWith("http") ? permanent : `${window.location.origin}${permanent}`;
        window.dispatchEvent(new CustomEvent("editor:set-bg", { detail: { dataUrl: abs } }));
      } catch {
        window.dispatchEvent(new CustomEvent("editor:set-bg", { detail: { dataUrl } }));
      }
      toast.success("PDF background applied");
    } catch (err) {
      console.error(err);
      toast.error("PDF render failed");
    }
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!templateName.trim()) { toast.error("Enter template name"); return; }
    setSaving(true);
    try {
      const currentJson = await getCanvasJson();
      let front = frontJson;
      let back = backJson;
      if (currentJson) {
        if (side === "front") {
          front = currentJson;
          setSideJson("front", currentJson);
        } else {
          back = currentJson;
          setSideJson("back", currentJson);
        }
      }

      const parseSafe = (s: string | null) => {
        if (!s) return {};
        try { return JSON.parse(s); } catch { return {}; }
      };

      toast.info("Saving images & template…");
      let frontDesign = parseSafe(front);
      let backDesign = parseSafe(back);
      try {
        frontDesign = await persistFabricImageSources(frontDesign);
        backDesign = await persistFabricImageSources(backDesign);
      } catch (e) {
        console.warn("Image persist partial", e);
      }

      const thumbnail: string = await new Promise((resolve) => {
        window.dispatchEvent(
          new CustomEvent("editor:export-png", {
            detail: { rounded: true, resolve },
          })
        );
        setTimeout(() => resolve(""), 2000);
      });

      const autoFields = [
        ...extractFieldsFromDesign(frontDesign, "front"),
        ...extractFieldsFromDesign(backDesign, "back"),
      ]
        .filter((f) => f.isDynamic)
        .map((f) => f.fieldTitle);

      const payload = {
        templateName: templateName.trim(),
        frontDesign,
        backDesign,
        elements: Array.from(new Set(autoFields)),
        canvasConfig: {
          widthPx: canvas.widthPx,
          heightPx: canvas.heightPx,
          widthMm: canvas.widthMm,
          heightMm: canvas.heightMm,
          dpi: canvas.dpi,
          orientation: canvas.orientation,
          unit: canvas.unit,
        },
        thumbnail: thumbnail || null,
      };

      if (templateId) {
        await templateService.update(templateId, payload);
        toast.success("Template saved ✓");
      } else {
        const res = await templateService.create(payload);
        const id = res.data?.template?._id;
        if (id) setTemplateId(id);
        toast.success("Template saved ✓");
      }
      syncDynamicFieldsFromDesigns(front, back);
      setDirty(false);
    } catch (err: unknown) {
      console.error(err);
      const e = err as { message?: string; response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const downloadPng = () => {
    window.dispatchEvent(
      new CustomEvent("editor:export-png", {
        detail: {
          rounded: true,
          resolve: (url: string) => {
            if (!url) return;
            const a = document.createElement("a");
            a.href = url;
            a.download = `${templateName || "id-card"}-${side}.png`;
            a.click();
          },
        },
      })
    );
  };

  const downloadDemoCsv = () => {
    const frontFields = extractFieldsFromDesign(
      frontJson ? JSON.parse(frontJson) : {},
      "front"
    ).filter((f) => f.isDynamic);
    const backFields = extractFieldsFromDesign(
      backJson ? JSON.parse(backJson) : {},
      "back"
    ).filter((f) => f.isDynamic);
    const headers = Array.from(
      new Set([...frontFields, ...backFields].map((f) => f.fieldTitle))
    );
    const cols = headers.length ? headers : ["Name", "ID", "Email"];
    const sample = cols.map((h, i) => (i === 0 ? "John Doe" : i === 1 ? "STU-001" : `sample_${h}`));
    const csv = [cols.join(","), sample.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "id-studio-demo.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Demo CSV downloaded");
  };

  const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const wb = XLSX.read(await f.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      if (!rows.length) { toast.error("Empty file"); return; }
      setExcelHeaders(Object.keys(rows[0]));
      setExcelRows(rows.slice(0, 500));
      setShowBulk(true);
      toast.success(`${rows.length} rows loaded`);
    } catch { toast.error("Parse failed"); }
    e.target.value = "";
  };

  const generateBulkPdf = async () => {
    if (!excelRows.length) { toast.error("Upload Excel/CSV first"); return; }
    setGenerating(true);
    try {
      const png: string = await new Promise((resolve) => {
        window.dispatchEvent(
          new CustomEvent("editor:export-png", {
            detail: { rounded: true, resolve },
          })
        );
        setTimeout(() => resolve(""), 2500);
      });
      if (!png) { toast.error("Export failed"); setGenerating(false); return; }

      const pdf = new jsPDF({
        orientation: canvas.widthPx >= canvas.heightPx ? "landscape" : "portrait",
        unit: "mm",
        format: [canvas.widthMm, canvas.heightMm],
      });

      const max = Math.min(excelRows.length, 100);
      for (let i = 0; i < max; i++) {
        if (i > 0) {
          pdf.addPage(
            [canvas.widthMm, canvas.heightMm],
            canvas.widthPx >= canvas.heightPx ? "landscape" : "portrait"
          );
        }
        pdf.addImage(png, "PNG", 0, 0, canvas.widthMm, canvas.heightMm);
        const row = excelRows[i];
        pdf.setFontSize(7);
        pdf.setTextColor(80);
        pdf.text(
          `#${i + 1} ${Object.values(row).slice(0, 4).join(" · ")}`.slice(0, 80),
          2,
          canvas.heightMm - 1.5
        );
      }
      pdf.save(`${templateName || "id-cards"}-bulk.pdf`);
      toast.success(`PDF ready · ${max} cards`);
    } catch (err) {
      console.error(err);
      toast.error("Bulk PDF failed");
    } finally {
      setGenerating(false);
    }
  };


    const loadTid = searchParams.get("template") || searchParams.get("use");
  const isText = selectedType === "i-text" || selectedType === "text";
  const isImage = selectedType === "image";
  const isShape = selectedType === "rect" || selectedType === "circle" || selectedType === "line";

  // Edit/Use: show skeleton until JSON is in the store and setupDone
  if (loadTid && (loadingTemplate || isHydrating || !setupDone)) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <Header title="ID Card Editor" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-background">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading saved design…</p>
          <div className="mt-4 w-56 space-y-2">
            <div className="h-3 rounded bg-muted animate-pulse" />
            <div className="h-28 rounded bg-muted animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (hydrateError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <p className="text-destructive">{hydrateError}</p>
        <Button onClick={() => { setHydrateError(null); router.push("/templates"); }}>Back to templates</Button>
      </div>
    );
  }

  if (!setupDone) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <Header title="ID Card Editor" />
        <div className="flex-1 overflow-y-auto">
          <SizeSetup onDone={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header title="ID Card Editor" />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Tools */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-border bg-card py-2 overflow-y-auto">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <Button key={t.id} variant="ghost" size="icon" title={t.label}
                className={cn("h-9 w-9", tool === t.id && "bg-primary/15 text-primary")}
                onClick={() => handleTool(t.id)}>
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
          <div className="my-1 h-px w-6 bg-border" />
          <Button variant="ghost" size="icon" title="BG image" className="h-9 w-9" onClick={() => bgRef.current?.click()}>
            <Upload className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="BG PDF" className="h-9 w-9" onClick={() => pdfRef.current?.click()}>
            <FileUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Delete" className="h-9 w-9 text-destructive"
            onClick={() => window.dispatchEvent(new Event("editor:delete"))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Center */}
        <div className="flex flex-1 flex-col min-w-0 min-h-0">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-1 border-b border-border px-2 py-1.5">
            <Tabs value={side} onValueChange={(v) => setSide(v as "front" | "back")}>
              <TabsList className="h-8">
                <TabsTrigger value="front" className="text-xs px-2 h-7">Front</TabsTrigger>
                <TabsTrigger value="back" className="text-xs px-2 h-7">Back</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.max(25, zoom - 10))}><ZoomOut className="h-3.5 w-3.5" /></Button>
              <span className="w-9 text-center text-[11px] text-muted-foreground">{zoom}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.min(200, zoom + 10))}><ZoomIn className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canUndo} onClick={() => window.dispatchEvent(new Event("editor:undo"))}><Undo className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canRedo} onClick={() => window.dispatchEvent(new Event("editor:redo"))}><Redo className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.dispatchEvent(new Event("editor:preview"))}>
                <Eye className="mr-1 h-3 w-3" />Preview
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={downloadPng}>
                <Download className="mr-1 h-3 w-3" />PNG
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <a href="/bulk"><Table className="mr-1 h-3 w-3 inline" />Bulk</a>
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
                <Save className="mr-1 h-3 w-3" />{saving ? "…" : "Save"}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs lg:hidden" onClick={() => setPropsOpen((o) => !o)}>
                Props
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <IdCanvas />
          </div>
        </div>

        {/* Properties */}
        <div className={cn(
          "w-full sm:w-72 shrink-0 flex-col border-l border-border bg-card overflow-y-auto",
          propsOpen ? "flex absolute right-0 top-16 bottom-0 z-20 sm:static sm:top-auto" : "hidden lg:flex"
        )}>
          <div className="border-b border-border px-3 py-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Properties</h3>
            <Button variant="ghost" size="sm" className="lg:hidden h-7" onClick={() => setPropsOpen(false)}>Close</Button>
          </div>
          <div className="space-y-3 p-3 pb-8">
            <div className="space-y-1">
              <Label className="text-xs">Template Name</Label>
              <Input className="h-8 text-sm" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Canvas</p>
              <p className="text-xs">{canvas.widthMm} × {canvas.heightMm} mm · {canvas.orientation}</p>
              <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setSetupDone(false)}>Change size</button>
            </div>

            {/* Text content + style */}
            {isText && (
              <div className="space-y-2 border-t border-border pt-2">
                <p className="text-xs font-medium text-muted-foreground">Text content</p>
                <div className="space-y-1">
                  <Label className="text-xs">Field Title (CSV Header)</Label>
                  <Input
                    className="h-8 text-sm"
                    value={selectedMeta.fieldTitle}
                    placeholder="e.g. Name, Roll, Department"
                    onChange={(e) => {
                      const fieldTitle = e.target.value;
                      setSelectedMeta({ fieldTitle });
                      window.dispatchEvent(
                        new CustomEvent("editor:apply-style", {
                          detail: { fieldTitle, isDynamic: selectedMeta.isDynamic },
                        })
                      );
                      if (fieldTitle.trim()) addDynamicField(fieldTitle.trim());
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    CSV column with this header fills this text during bulk generation
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDynamic"
                    checked={selectedMeta.isDynamic}
                    onChange={(e) => {
                      const isDynamic = e.target.checked;
                      setSelectedMeta({ isDynamic });
                      window.dispatchEvent(
                        new CustomEvent("editor:apply-style", {
                          detail: { isDynamic, fieldTitle: selectedMeta.fieldTitle },
                        })
                      );
                    }}
                  />
                  <Label htmlFor="isDynamic" className="text-xs font-normal">
                    Dynamic (from CSV)
                  </Label>
                </div>
                <Label className="text-xs">Default / placeholder text</Label>
                <textarea
                  className="w-full min-h-[64px] rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={selectedText}
                  onChange={(e) => applyTextStyle({ text: e.target.value, defaultText: e.target.value })}
                  placeholder="Visible on template until bulk fill"
                />
                <div className="space-y-1">
                  <Label className="text-xs">Font</Label>
                  <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    value={textStyle.fontFamily}
                    onChange={(e) => applyTextStyle({ fontFamily: e.target.value })}>
                    {FONT_FAMILIES.map((f) => (
                      <option key={f} value={f}>{f.split(",")[0]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Size</Label>
                  <Input className="h-8" type="number" min={8} max={200} value={textStyle.fontSize}
                    onChange={(e) => applyTextStyle({ fontSize: parseInt(e.target.value) || 16 })} />
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="icon" className="h-8 w-8" variant={textStyle.fontWeight === "bold" ? "default" : "outline"}
                    onClick={() => applyTextStyle({ fontWeight: textStyle.fontWeight === "bold" ? "normal" : "bold" })}>
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="icon" className="h-8 w-8" variant={textStyle.fontStyle === "italic" ? "default" : "outline"}
                    onClick={() => applyTextStyle({ fontStyle: textStyle.fontStyle === "italic" ? "normal" : "italic" })}>
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="icon" className="h-8 w-8" variant={textStyle.underline ? "default" : "outline"}
                    onClick={() => applyTextStyle({ underline: !textStyle.underline })}>
                    <Underline className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="icon" className="h-8 w-8" variant={textStyle.textAlign === "left" ? "default" : "outline"}
                    onClick={() => applyTextStyle({ textAlign: "left" })}><AlignLeft className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="icon" className="h-8 w-8" variant={textStyle.textAlign === "center" ? "default" : "outline"}
                    onClick={() => applyTextStyle({ textAlign: "center" })}><AlignCenter className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="icon" className="h-8 w-8" variant={textStyle.textAlign === "right" ? "default" : "outline"}
                    onClick={() => applyTextStyle({ textAlign: "right" })}><AlignRight className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex gap-2 items-center">
                  <input type="color" className="h-8 w-10 cursor-pointer rounded border border-input"
                    value={textStyle.fill.startsWith("#") ? textStyle.fill : "#111111"}
                    onChange={(e) => applyTextStyle({ fill: e.target.value })} />
                  <Input className="h-8 text-xs" value={textStyle.fill} onChange={(e) => applyTextStyle({ fill: e.target.value })} />
                </div>
              </div>
            )}

            {/* Image options */}
            {isImage && (
              <div className="space-y-2 border-t border-border pt-2">
                <p className="text-xs font-medium text-muted-foreground">Corner radius</p>
                <p className="text-[10px] text-muted-foreground">0 = square · 100 = full circle</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  defaultValue={0}
                  className="w-full accent-primary"
                  onChange={(e) => {
                    const ratio = parseInt(e.target.value, 10) / 100;
                    window.dispatchEvent(
                      new CustomEvent("editor:corner-radius", { detail: ratio })
                    );
                  }}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Square</span>
                  <span>Rounded</span>
                  <span>Circle</span>
                </div>
              </div>
            )}

            {/* Shape style */}
            {isShape && (
              <div className="space-y-2 border-t border-border pt-2">
                <p className="text-xs font-medium text-muted-foreground">Shape</p>
                {(selectedType === "rect" || selectedType === "circle") && (
                  <>
                    <div className="flex gap-2 items-center">
                      <Label className="text-xs w-12">Fill</Label>
                      <input
                        type="color"
                        className="h-8 w-10 cursor-pointer rounded border border-input"
                        defaultValue="#3b82f6"
                        onChange={(e) =>
                          window.dispatchEvent(
                            new CustomEvent("editor:shape-style", {
                              detail: { fill: e.target.value },
                            })
                          )
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs"
                      onClick={() => shapeImageRef.current?.click()}
                    >
                      Fill with image
                    </Button>
                    <p className="text-[10px] text-muted-foreground">
                      Image fills the shape and stays clipped inside
                    </p>
                    <p className="text-xs font-medium text-muted-foreground pt-1">Image position</p>
                    <div className="grid grid-cols-3 gap-1 place-items-center">
                      <span />
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8"
                        onClick={() => window.dispatchEvent(new CustomEvent("editor:pan-shape-image", { detail: { dx: 0, dy: -8 } }))}>↑</Button>
                      <span />
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8"
                        onClick={() => window.dispatchEvent(new CustomEvent("editor:pan-shape-image", { detail: { dx: -8, dy: 0 } }))}>←</Button>
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8"
                        onClick={() => window.dispatchEvent(new CustomEvent("editor:pan-shape-image", { detail: { dx: 0, dy: 0 } }))}
                        title="Reset">·</Button>
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8"
                        onClick={() => window.dispatchEvent(new CustomEvent("editor:pan-shape-image", { detail: { dx: 8, dy: 0 } }))}>→</Button>
                      <span />
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8"
                        onClick={() => window.dispatchEvent(new CustomEvent("editor:pan-shape-image", { detail: { dx: 0, dy: 8 } }))}>↓</Button>
                      <span />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Arrow keys also nudge the selected shape</p>
                  </>
                )}
                {selectedType === "rect" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Corner radius</Label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      defaultValue={0}
                      className="w-full accent-primary"
                      onChange={(e) => {
                        const ratio = parseInt(e.target.value, 10) / 100;
                        window.dispatchEvent(
                          new CustomEvent("editor:corner-radius", { detail: ratio })
                        );
                      }}
                    />
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <Label className="text-xs w-12">Stroke</Label>
                  <input
                    type="color"
                    className="h-8 w-10 cursor-pointer rounded border border-input"
                    defaultValue="#111111"
                    onChange={(e) =>
                      window.dispatchEvent(
                        new CustomEvent("editor:shape-style", {
                          detail: { stroke: e.target.value, strokeWidth: 2 },
                        })
                      )
                    }
                  />
                </div>
              </div>
            )}


            {/* Position X Y W H — canvas coordinates */}
            {selectedId && (
              <div className="space-y-2 border-t border-border pt-2">
                <p className="text-xs font-medium text-muted-foreground">Position & size</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["left", "top", "width", "height"] as const).map((key) => (
                    <div key={key} className="space-y-0.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        {key === "left" ? "X" : key === "top" ? "Y" : key === "width" ? "W" : "H"}
                      </Label>
                      <Input
                        className="h-8 text-xs"
                        type="number"
                        placeholder={key}
                        onFocus={(e) => {
                          // seed from active object via export is hard; user types values
                          e.target.select();
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          const v = parseFloat((e.target as HTMLInputElement).value);
                          if (Number.isNaN(v)) return;
                          window.dispatchEvent(
                            new CustomEvent("editor:set-position", {
                              detail: { [key]: v },
                            })
                          );
                        }}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isNaN(v)) return;
                          window.dispatchEvent(
                            new CustomEvent("editor:set-position", {
                              detail: { [key]: v },
                            })
                          );
                        }}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Enter + blur applies. Arrow keys nudge 1px (Shift=10).</p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    ["left", "Left"],
                    ["hcenter", "H Center"],
                    ["right", "Right"],
                    ["top", "Top"],
                    ["vcenter", "V Center"],
                    ["bottom", "Bottom"],
                    ["center", "Center"],
                  ].map(([id, label]) => (
                    <Button
                      key={id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-1"
                      onClick={() =>
                        window.dispatchEvent(new CustomEvent("editor:align", { detail: id }))
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Layers */}
            {selectedId && (
              <div className="space-y-1 border-t border-border pt-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Layers
                </p>
                <div className="grid grid-cols-2 gap-1">
                  <Button type="button" size="sm" variant="outline" className="text-xs h-8"
                    onClick={() => window.dispatchEvent(new Event("editor:bring-front"))}>Bring front</Button>
                  <Button type="button" size="sm" variant="outline" className="text-xs h-8"
                    onClick={() => window.dispatchEvent(new Event("editor:send-back"))}>Send back</Button>
                  <Button type="button" size="sm" variant="outline" className="text-xs h-8"
                    onClick={() => window.dispatchEvent(new Event("editor:bring-forward"))}>Forward</Button>
                  <Button type="button" size="sm" variant="outline" className="text-xs h-8"
                    onClick={() => window.dispatchEvent(new Event("editor:send-backward"))}>Backward</Button>
                </div>
              </div>
            )}

            <div className="space-y-1 border-t border-border pt-2">
              <Label className="text-xs">QR Content</Label>
              <Input className="h-8 text-xs" value={qrText} onChange={(e) => setQrText(e.target.value)} />
            </div>

            {/* Auto-detected bulk fields from Field Titles */}
            <div className="space-y-2 border-t border-border pt-2">
              <p className="text-xs font-medium text-muted-foreground">Bulk Fields (Auto Detected)</p>
              <p className="text-[10px] text-muted-foreground">
                Set Field Title on text/QR/photo elements. Titles register automatically for CSV mapping.
              </p>
              {(() => {
                const frontFields = extractFieldsFromDesign(
                  frontJson ? JSON.parse(frontJson) : {},
                  "front"
                ).filter((f) => f.isDynamic);
                const backFields = extractFieldsFromDesign(
                  backJson ? JSON.parse(backJson) : {},
                  "back"
                ).filter((f) => f.isDynamic);
                const all = Array.from(
                  new Set([...frontFields, ...backFields].map((f) => f.fieldTitle))
                );
                return (
                  <div className="space-y-2 text-[11px]">
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">FRONT</p>
                      <div className="flex flex-wrap gap-1">
                        {frontFields.length ? frontFields.map((f, i) => (
                          <span key={`f-${f.fieldTitle}-${i}`} className="rounded bg-primary/15 text-primary px-1.5 py-0.5">{f.fieldTitle}</span>
                        )) : <span className="text-muted-foreground">None</span>}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">BACK</p>
                      <div className="flex flex-wrap gap-1">
                        {backFields.length ? backFields.map((f, i) => (
                          <span key={`b-${f.fieldTitle}-${i}`} className="rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5">{f.fieldTitle}</span>
                        )) : <span className="text-muted-foreground">None</span>}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">ALL (CSV headers)</p>
                      <div className="flex flex-wrap gap-1">
                        {all.length ? all.map((f) => (
                          <span key={f} className="rounded bg-muted px-1.5 py-0.5">{f}</span>
                        )) : <span className="text-muted-foreground">Add dynamic Field Titles on elements</span>}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {showBulk && (
              <div className="space-y-2 border-t border-border pt-2">
                <p className="text-xs font-medium">Bulk generate</p>
                <Button variant="outline" className="w-full h-8 text-xs" size="sm" onClick={downloadDemoCsv}>
                  Download demo CSV
                </Button>
                <Button variant="outline" className="w-full h-8 text-xs" size="sm" onClick={() => excelRef.current?.click()}>
                  <FileUp className="mr-1 h-3.5 w-3.5" />Upload Excel / CSV
                </Button>
                {excelRows.length > 0 && (
                  <>
                    <p className="text-[11px] text-muted-foreground">{excelRows.length} rows</p>
                    <div className="max-h-28 overflow-auto rounded border border-border text-[10px]">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-muted sticky top-0">
                            {excelHeaders.slice(0, 4).map((h) => (
                              <th key={h} className="p-1 text-left font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {excelRows.slice(0, 6).map((r, i) => (
                            <tr key={i} className="border-t border-border">
                              {excelHeaders.slice(0, 4).map((h) => (
                                <td key={h} className="p-1 truncate max-w-[70px]">{r[h]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button className="w-full h-8 text-xs" size="sm" disabled={generating} onClick={generateBulkPdf}>
                      {generating ? "Generating…" : "Download bulk PDF"}
                    </Button>
                  </>
                )}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">Selected: {selectedId || "None"}</p>
          </div>
        </div>
      </div>

      <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
      <input ref={bgRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleBg} />
      <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdf} />
      <input
        ref={shapeImageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            toast.info("Uploading…");
            const url = await uploadImageFile(f);
            const abs = url.startsWith("http") ? url : `${window.location.origin}${url}`;
            window.dispatchEvent(
              new CustomEvent("editor:fill-shape", { detail: { dataUrl: abs } })
            );
            toast.success("Image applied inside shape");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
          }
          e.target.value = "";
        }}
      />
      <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcel} />
    </div>
  );
}
