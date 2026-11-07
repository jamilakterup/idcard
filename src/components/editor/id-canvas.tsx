"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";

type FabricCanvas = import("fabric").fabric.Canvas;
type FabricObject = import("fabric").fabric.Object;

interface IdCanvasProps {
  /** If provided, load this JSON instead of default demo objects */
  initialJson?: string | null;
  /** Skip adding default demo text when empty */
  blank?: boolean;
}

export function IdCanvas({ initialJson, blank }: IdCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const isRestoringRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [fitScale, setFitScale] = useState(0.4);
  const sideRef = useRef(useEditorStore.getState().side);

  const {
    side, tool, zoom, canvas: cfg,
    setSelected, setDirty, setTool, setTextStyle, setZoom, setSelectedMeta,
    pushSideHistory, initSideHistory, undoSide, redoSide, setHistoryFlags,
  } = useEditorStore();

  const serialize = (c: FabricCanvas) =>
    JSON.stringify(c.toJSON(["name", "data", "clipPath", "rx", "ry"]));

  const pushHistory = useCallback(
    (c: FabricCanvas) => {
      if (isRestoringRef.current) return;
      const json = serialize(c);
      pushSideHistory(useEditorStore.getState().side, json);
      setDirty(true);
    },
    [pushSideHistory, setDirty]
  );

  const computeFit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 0.4;
    const pad = 32;
    const availW = el.clientWidth - pad;
    const availH = el.clientHeight - pad;
    if (availW <= 0 || availH <= 0) return 0.4;
    return Math.max(0.12, Math.min(availW / cfg.widthPx, availH / cfg.heightPx, 1));
  }, [cfg.widthPx, cfg.heightPx]);

  // Init once per dimension change
  useEffect(() => {
    let disposed = false;
    let fc: FabricCanvas | null = null;

    (async () => {
      const { fabric } = await import("fabric");
      if (disposed || !canvasElRef.current) return;
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }

      fc = new fabric.Canvas(canvasElRef.current, {
        width: cfg.widthPx,
        height: cfg.heightPx,
        backgroundColor: "#ffffff",
        selection: true,
        preserveObjectStacking: true,
        stopContextMenu: true,
      });
      fabricRef.current = fc;

      const fit = computeFit();
      setFitScale(fit);
      setZoom(100);

      const finishInit = (json: string) => {
        initSideHistory(useEditorStore.getState().side, json);
        // also seed the other side if empty
        const st = useEditorStore.getState();
        if (st.side === "front" && !st.backJson) {
          const empty = JSON.stringify({ version: "5.3.0", objects: [], background: "#ffffff" });
          st.initSideHistory("back", empty);
        }
        setReady(true);
      };

      if (initialJson) {
        isRestoringRef.current = true;
        fc.loadFromJSON(initialJson, () => {
          fc!.renderAll();
          isRestoringRef.current = false;
          finishInit(serialize(fc!));
        });
      } else if (!blank) {
        const W = cfg.widthPx;
        const H = cfg.heightPx;
        const nameT = new fabric.IText("Your Name", {
          left: Math.round(W * 0.08),
          top: Math.round(H * 0.55),
          fontSize: Math.max(14, Math.round(H * 0.04)),
          fill: "#111111",
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          name: "field-name",
          data: { fieldTitle: "Name", isDynamic: true, defaultText: "Your Name" },
        });
        const idT = new fabric.IText("ID-001", {
          left: Math.round(W * 0.08),
          top: Math.round(H * 0.65),
          fontSize: Math.max(12, Math.round(H * 0.028)),
          fill: "#334155",
          fontFamily: "Inter, system-ui, sans-serif",
          name: "field-id",
          data: { fieldTitle: "ID", isDynamic: true, defaultText: "ID-001" },
        });
        fc.add(nameT, idT);
        fc.renderAll();
        finishInit(serialize(fc));
      } else {
        fc.renderAll();
        finishInit(serialize(fc));
      }

      const syncSelection = (obj: FabricObject | undefined) => {
        if (!obj) {
          setSelected(null, null, "");
          return;
        }
        const o = obj as FabricObject & {
          name?: string; type?: string; text?: string;
          fontFamily?: string; fontSize?: number;
          fontWeight?: string | number; fontStyle?: string;
          fill?: string; textAlign?: string; underline?: boolean; opacity?: number;
          data?: { fieldTitle?: string; isDynamic?: boolean; defaultText?: string };
        };
        const textVal = typeof o.text === "string" ? o.text : "";
        setSelected(o.name || "obj", o.type || null, textVal, {
          fieldTitle: o.data?.fieldTitle || "",
          isDynamic: o.data?.isDynamic !== false,
          defaultText: o.data?.defaultText || textVal,
        });
        if (o.type === "i-text" || o.type === "text") {
          setTextStyle({
            fontFamily: o.fontFamily || "Inter, system-ui, sans-serif",
            fontSize: o.fontSize || 24,
            fontWeight: String(o.fontWeight || "normal"),
            fontStyle: o.fontStyle || "normal",
            fill: typeof o.fill === "string" ? o.fill : "#111111",
            textAlign: o.textAlign || "left",
            underline: !!o.underline,
            opacity: o.opacity ?? 1,
          });
        }
      };

      fc.on("selection:created", (e) => syncSelection(e.selected?.[0]));
      fc.on("selection:updated", (e) => syncSelection(e.selected?.[0]));
      fc.on("selection:cleared", () => setSelected(null, null, ""));
      fc.on("object:modified", () => pushHistory(fc!));
      fc.on("object:added", () => { if (!isRestoringRef.current) pushHistory(fc!); });
      fc.on("object:removed", () => { if (!isRestoringRef.current) pushHistory(fc!); });
      fc.on("text:changed", (e) => {
        const t = e.target as { text?: string } | undefined;
        if (t?.text !== undefined) useEditorStore.getState().setSelectedText(t.text);
      });
    })();

    return () => {
      disposed = true;
      fc?.dispose();
      fabricRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.widthPx, cfg.heightPx]);

  useEffect(() => {
    const onResize = () => setFitScale(computeFit());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [computeFit]);

  // Side switch — restore from store, never wipe the other side
  useEffect(() => {
    const c = fabricRef.current;
    if (!c || !ready) return;
    if (sideRef.current === side) return;
    sideRef.current = side;

    // Save current canvas to previous side before switch is already done by store
    const st = useEditorStore.getState();
    const json = side === "front" ? st.frontJson : st.backJson;
    isRestoringRef.current = true;
    if (json) {
      c.loadFromJSON(json, () => {
        c.renderAll();
        isRestoringRef.current = false;
        const hist = side === "front" ? st.frontHistory : st.backHistory;
        setHistoryFlags(hist.index > 0, hist.index < hist.stack.length - 1);
      });
    } else {
      c.clear();
      c.backgroundColor = "#ffffff";
      c.renderAll();
      isRestoringRef.current = false;
      const empty = serialize(c);
      initSideHistory(side, empty);
    }
  }, [side, ready, setHistoryFlags, initSideHistory]);

  // Event handlers
  useEffect(() => {
    const c = fabricRef.current;
    if (!c || !ready) return;

    const addText = async (e?: Event) => {
      const { fabric } = await import("fabric");
      const ts = useEditorStore.getState().textStyle;
      const detail = (e as CustomEvent | undefined)?.detail as
        | { fieldTitle?: string; defaultText?: string; isDynamic?: boolean }
        | undefined;
      const fieldTitle = detail?.fieldTitle || "Name";
      const defaultText = detail?.defaultText || "Your Name";
      const isDynamic = detail?.isDynamic !== false;
      const t = new fabric.IText(defaultText, {
        left: cfg.widthPx / 2 - 80,
        top: cfg.heightPx / 2 - 16,
        fontSize: ts.fontSize,
        fill: ts.fill,
        fontFamily: ts.fontFamily,
        fontWeight: ts.fontWeight,
        fontStyle: ts.fontStyle,
        name: `text-${Date.now()}`,
        data: { fieldTitle, isDynamic, defaultText },
      });
      c.add(t);
      c.setActiveObject(t);
      c.renderAll();
      setTool("select");
    };

    const addRect = async () => {
      const { fabric } = await import("fabric");
      const r = new fabric.Rect({
        left: 50, top: 50, width: 100, height: 70,
        fill: "#3b82f6", rx: 4, ry: 4, name: `rect-${Date.now()}`,
      });
      c.add(r); c.setActiveObject(r); c.renderAll(); setTool("select");
    };

    const addCircle = async () => {
      const { fabric } = await import("fabric");
      const o = new fabric.Circle({
        left: 60, top: 60, radius: 36, fill: "#06b6d4", name: `circle-${Date.now()}`,
        data: { fieldTitle: "Photo", isDynamic: true, isPhoto: true },
      });
      c.add(o); c.setActiveObject(o); c.renderAll(); setTool("select");
    };

    const addLine = async () => {
      const { fabric } = await import("fabric");
      const l = new fabric.Line([30, 30, 180, 30], {
        stroke: "#111", strokeWidth: 2, name: `line-${Date.now()}`,
      });
      c.add(l); c.setActiveObject(l); c.renderAll(); setTool("select");
    };

    const addImage = async (e: Event) => {
      const { dataUrl } = (e as CustomEvent).detail as { dataUrl: string };
      const { fabric } = await import("fabric");
      fabric.Image.fromURL(dataUrl, (img) => {
        const max = Math.min(cfg.widthPx * 0.32, cfg.heightPx * 0.38);
        const s = Math.min(max / (img.width || 1), max / (img.height || 1), 1);
        img.set({ left: 36, top: 50, scaleX: s, scaleY: s, name: `img-${Date.now()}` });
        c.add(img); c.setActiveObject(img); c.renderAll();
      }, { crossOrigin: "anonymous" });
      setTool("select");
    };

    const addQr = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { dataUrl: string; content?: string; fieldTitle?: string };
      const { fabric } = await import("fabric");
      fabric.Image.fromURL(detail.dataUrl, (img) => {
        const size = Math.min(cfg.widthPx, cfg.heightPx) * 0.15;
        img.set({
          left: cfg.widthPx - size - 12,
          top: cfg.heightPx - size - 12,
          scaleX: size / (img.width || 1),
          scaleY: size / (img.height || 1),
          name: `qr-${Date.now()}`,
          data: {
            isQr: true,
            fieldTitle: detail.fieldTitle || "QR",
            isDynamic: true,
            qrContent: detail.content || "",
          },
        });
        c.add(img); c.setActiveObject(img); c.renderAll();
      });
      setTool("select");
    };

    const setBg = async (e: Event) => {
      const { dataUrl } = (e as CustomEvent).detail as { dataUrl: string };
      const { fabric } = await import("fabric");
      fabric.Image.fromURL(dataUrl, (img) => {
        img.set({
          scaleX: cfg.widthPx / (img.width || 1),
          scaleY: cfg.heightPx / (img.height || 1),
          originX: "left", originY: "top",
          selectable: false, evented: false,
        });
        c.setBackgroundImage(img, () => {
          c.renderAll();
          pushHistory(c);
        });
      }, { crossOrigin: "anonymous" });
    };

    const undo = () => {
      const json = undoSide(useEditorStore.getState().side);
      if (!json) return;
      isRestoringRef.current = true;
      c.loadFromJSON(json, () => {
        c.renderAll();
        isRestoringRef.current = false;
      });
    };

    const redo = () => {
      const json = redoSide(useEditorStore.getState().side);
      if (!json) return;
      isRestoringRef.current = true;
      c.loadFromJSON(json, () => {
        c.renderAll();
        isRestoringRef.current = false;
      });
    };

    const del = () => {
      c.getActiveObjects().forEach((o) => c.remove(o));
      c.discardActiveObject();
      c.renderAll();
    };

    const applyStyle = (e: Event) => {
      const style = (e as CustomEvent).detail as Record<string, unknown>;
      const obj = c.getActiveObject() as (FabricObject & Record<string, unknown> & { data?: Record<string, unknown> }) | undefined;
      if (!obj) return;
      if (obj.type === "i-text" || obj.type === "text") {
        Object.entries(style).forEach(([k, v]) => {
          if (k === "text") obj.set("text", v as string);
          else if (k === "fieldTitle" || k === "isDynamic" || k === "defaultText") {
            obj.data = { ...(obj.data || {}), [k]: v };
          } else obj.set(k as keyof FabricObject, v as never);
        });
        c.renderAll();
        pushHistory(c);
        if (typeof style.text === "string") useEditorStore.getState().setSelectedText(style.text);
        if (style.fieldTitle !== undefined || style.isDynamic !== undefined) {
          setSelectedMeta({
            fieldTitle: (style.fieldTitle as string) ?? useEditorStore.getState().selectedMeta.fieldTitle,
            isDynamic: (style.isDynamic as boolean) ?? useEditorStore.getState().selectedMeta.isDynamic,
            defaultText: (style.defaultText as string) ?? useEditorStore.getState().selectedMeta.defaultText,
          });
        }
      }
    };

    const setCornerRadius = async (e: Event) => {
      const { fabric } = await import("fabric");
      const ratio = Math.min(1, Math.max(0, (e as CustomEvent).detail as number));
      const obj = c.getActiveObject();
      if (!obj) return;
      if (obj.type === "rect") {
        const rect = obj as import("fabric").fabric.Rect;
        const maxR = Math.min(rect.width || 1, rect.height || 1) / 2;
        rect.set({ rx: maxR * ratio, ry: maxR * ratio });
        c.renderAll();
        pushHistory(c);
        return;
      }
      if (obj.type !== "image") return;
      const img = obj as import("fabric").fabric.Image;
      const iw = img.width || 1;
      const ih = img.height || 1;
      const r = (Math.min(iw, ih) / 2) * ratio;
      if (ratio < 0.01) {
        img.clipPath = undefined;
      } else {
        img.clipPath = new fabric.Rect({
          width: iw, height: ih, rx: r, ry: r,
          originX: "center", originY: "center", left: 0, top: 0,
        });
      }
      img.set("dirty", true);
      c.requestRenderAll();
      pushHistory(c);
    };

    const fillShapeWithImage = async (e: Event) => {
      const { dataUrl } = (e as CustomEvent).detail as { dataUrl: string };
      const { fabric } = await import("fabric");
      const obj = c.getActiveObject();
      if (!obj || (obj.type !== "rect" && obj.type !== "circle")) return;
      const imgEl = new Image();
      imgEl.crossOrigin = "anonymous";
      imgEl.onload = () => {
        const shapeW =
          obj.type === "circle"
            ? ((obj as import("fabric").fabric.Circle).radius || 1) * 2
            : (obj as import("fabric").fabric.Rect).width || 1;
        const shapeH =
          obj.type === "circle"
            ? ((obj as import("fabric").fabric.Circle).radius || 1) * 2
            : (obj as import("fabric").fabric.Rect).height || 1;
        const scale = Math.max(shapeW / imgEl.width, shapeH / imgEl.height);
        const scaledW = imgEl.width * scale;
        const scaledH = imgEl.height * scale;
        const pattern = new fabric.Pattern({
          source: imgEl,
          repeat: "no-repeat",
          offsetX: (shapeW - scaledW) / 2,
          offsetY: (shapeH - scaledH) / 2,
          patternTransform: [scale, 0, 0, scale, 0, 0],
        });
        obj.set("fill", pattern);
        c.renderAll();
        pushHistory(c);
      };
      imgEl.src = dataUrl;
    };

    const panShapeImage = (e: Event) => {
      const { dx, dy } = (e as CustomEvent).detail as { dx: number; dy: number };
      const obj = c.getActiveObject();
      if (!obj || (obj.type !== "rect" && obj.type !== "circle")) return;
      const fill = obj.fill as { offsetX?: number; offsetY?: number; source?: HTMLImageElement } | string;
      if (!fill || typeof fill === "string" || !fill.source) return;
      fill.offsetX = (fill.offsetX || 0) + dx;
      fill.offsetY = (fill.offsetY || 0) + dy;
      obj.set("dirty", true);
      c.requestRenderAll();
      pushHistory(c);
    };

    const applyShapeStyle = (e: Event) => {
      const style = (e as CustomEvent).detail as {
        fill?: string; stroke?: string; strokeWidth?: number; rx?: number; ry?: number;
      };
      const obj = c.getActiveObject();
      if (!obj) return;
      if (obj.type === "rect" || obj.type === "circle" || obj.type === "line") {
        if (style.fill !== undefined && obj.type !== "line") obj.set("fill", style.fill);
        if (style.stroke !== undefined) obj.set("stroke", style.stroke);
        if (style.strokeWidth !== undefined) obj.set("strokeWidth", style.strokeWidth);
        if (obj.type === "rect" && style.rx !== undefined) {
          (obj as import("fabric").fabric.Rect).set({ rx: style.rx, ry: style.ry ?? style.rx });
        }
        c.renderAll();
        pushHistory(c);
      }
    };

    const bringFront = () => { const o = c.getActiveObject(); if (o) { c.bringToFront(o); c.renderAll(); pushHistory(c); } };
    const sendBack = () => { const o = c.getActiveObject(); if (o) { c.sendToBack(o); c.renderAll(); pushHistory(c); } };
    const bringForward = () => { const o = c.getActiveObject(); if (o) { c.bringForward(o); c.renderAll(); pushHistory(c); } };
    const sendBackward = () => { const o = c.getActiveObject(); if (o) { c.sendBackwards(o); c.renderAll(); pushHistory(c); } };

    const exportPng = (e: Event) => {
      const detail = (e as CustomEvent).detail as { resolve: (url: string) => void; rounded?: boolean };
      const dataUrl = c.toDataURL({ format: "png", multiplier: 1, enableRetinaScaling: false });
      if (!detail.rounded) { detail.resolve(dataUrl); return; }
      const img = new Image();
      img.onload = () => {
        const off = document.createElement("canvas");
        off.width = cfg.widthPx;
        off.height = cfg.heightPx;
        const ctx = off.getContext("2d")!;
        const radius = Math.min(24, Math.min(cfg.widthPx, cfg.heightPx) * 0.04);
        const w = cfg.widthPx, h = cfg.heightPx;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(w - radius, 0);
        ctx.quadraticCurveTo(w, 0, w, radius);
        ctx.lineTo(w, h - radius);
        ctx.quadraticCurveTo(w, h, w - radius, h);
        ctx.lineTo(radius, h);
        ctx.quadraticCurveTo(0, h, 0, h - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0, w, h);
        detail.resolve(off.toDataURL("image/png"));
      };
      img.onerror = () => detail.resolve(dataUrl);
      img.src = dataUrl;
    };

    const preview = () => {
      window.dispatchEvent(new CustomEvent("editor:export-png", {
        detail: {
          rounded: true,
          resolve: (url: string) => {
            if (!url) return;
            const w = window.open("", "_blank");
            if (!w) return;
            w.document.write(`<!DOCTYPE html><html><head><title>Preview</title>
<style>*{margin:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;padding:24px}
img{max-width:min(96vw,900px);max-height:92vh;border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.5)}</style>
</head><body><img src="${url}" alt="Preview"/></body></html>`);
            w.document.close();
          },
        },
      }));
    };

    const forceSaveJson = (e: Event) => {
      const detail = (e as CustomEvent).detail as { resolve: (json: string) => void };
      const json = serialize(c);
      pushSideHistory(useEditorStore.getState().side, json);
      detail.resolve(json);
    };

    const loadJson = (e: Event) => {
      const detail = (e as CustomEvent).detail as { json: string; resolve?: () => void };
      if (!detail?.json) return;
      isRestoringRef.current = true;
      c.loadFromJSON(detail.json, () => {
        c.renderAll();
        isRestoringRef.current = false;
        initSideHistory(useEditorStore.getState().side, serialize(c));
        detail.resolve?.();
      });
    };

    const nudge = (e: Event) => {
      const { dx, dy } = (e as CustomEvent).detail as { dx: number; dy: number };
      const objs = c.getActiveObjects();
      if (!objs.length) return;
      objs.forEach((o) => {
        o.set({ left: (o.left || 0) + dx, top: (o.top || 0) + dy });
        o.setCoords();
      });
      c.renderAll();
      pushHistory(c);
    };

    const list: [string, EventListener][] = [
      ["editor:add-text", addText as EventListener],
      ["editor:add-rect", addRect],
      ["editor:add-circle", addCircle],
      ["editor:add-line", addLine],
      ["editor:add-image", addImage as EventListener],
      ["editor:add-qr", addQr as EventListener],
      ["editor:set-bg", setBg as EventListener],
      ["editor:undo", undo],
      ["editor:redo", redo],
      ["editor:delete", del],
      ["editor:preview", preview],
      ["editor:apply-style", applyStyle as EventListener],
      ["editor:export-png", exportPng as EventListener],
      ["editor:corner-radius", setCornerRadius as EventListener],
      ["editor:fill-shape", fillShapeWithImage as EventListener],
      ["editor:pan-shape-image", panShapeImage as EventListener],
      ["editor:shape-style", applyShapeStyle as EventListener],
      ["editor:bring-front", bringFront],
      ["editor:send-back", sendBack],
      ["editor:bring-forward", bringForward],
      ["editor:send-backward", sendBackward],
      ["editor:force-json", forceSaveJson as EventListener],
      ["editor:load-json", loadJson as EventListener],
      ["editor:nudge", nudge as EventListener],
    ];
    list.forEach(([n, h]) => window.addEventListener(n, h));

    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement || ev.target instanceof HTMLSelectElement) return;
      const step = ev.shiftKey ? 10 : 1;
      if (ev.key === "ArrowLeft") { ev.preventDefault(); window.dispatchEvent(new CustomEvent("editor:nudge", { detail: { dx: -step, dy: 0 } })); }
      if (ev.key === "ArrowRight") { ev.preventDefault(); window.dispatchEvent(new CustomEvent("editor:nudge", { detail: { dx: step, dy: 0 } })); }
      if (ev.key === "ArrowUp") { ev.preventDefault(); window.dispatchEvent(new CustomEvent("editor:nudge", { detail: { dx: 0, dy: -step } })); }
      if (ev.key === "ArrowDown") { ev.preventDefault(); window.dispatchEvent(new CustomEvent("editor:nudge", { detail: { dx: 0, dy: step } })); }
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "z") { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
      if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); del(); }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      list.forEach(([n, h]) => window.removeEventListener(n, h));
      window.removeEventListener("keydown", onKey);
    };
  }, [ready, cfg.widthPx, cfg.heightPx, pushHistory, setTool, undoSide, redoSide, initSideHistory, setSelectedMeta]);

  useEffect(() => {
    if (!ready) return;
    if (tool === "text") {
      window.dispatchEvent(new CustomEvent("editor:add-text", {
        detail: { fieldTitle: "Name", defaultText: "Your Name", isDynamic: true },
      }));
    }
    if (tool === "rect") window.dispatchEvent(new Event("editor:add-rect"));
    if (tool === "circle") window.dispatchEvent(new Event("editor:add-circle"));
    if (tool === "line") window.dispatchEvent(new Event("editor:add-line"));
  }, [tool, ready]);

  const scale = fitScale * (zoom / 100);
  const dw = cfg.widthPx * scale;
  const dh = cfg.heightPx * scale;

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden bg-muted/20 p-3"
    >
      <div
        className="relative shrink-0 bg-white shadow-2xl"
        style={{ width: dw, height: dh, borderRadius: Math.max(4, 12 * scale), overflow: "hidden" }}
      >
        <div style={{ width: cfg.widthPx, height: cfg.heightPx, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <canvas ref={canvasElRef} />
        </div>
      </div>
    </div>
  );
}
