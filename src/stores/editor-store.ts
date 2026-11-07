import { create } from "zustand";
import { Orientation, Unit, mmToPx, DEFAULT_DPI } from "@/lib/editor/constants";

export type EditorSide = "front" | "back";
export type EditorTool =
  | "select"
  | "text"
  | "image"
  | "qr"
  | "rect"
  | "circle"
  | "line"
  | "photo";

export interface CanvasConfig {
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  unit: Unit;
  dpi: number;
  orientation: Orientation;
  preset: string;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  fill: string;
  textAlign: string;
  underline: boolean;
  opacity: number;
}

export interface SelectedMeta {
  fieldTitle: string;
  isDynamic: boolean;
  defaultText: string;
}

interface SideHistory {
  stack: string[];
  index: number;
}

interface EditorState {
  side: EditorSide;
  tool: EditorTool;
  zoom: number;
  selectedId: string | null;
  selectedType: string | null;
  selectedText: string;
  selectedMeta: SelectedMeta;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  setupDone: boolean;
  isHydrating: boolean;
  hydrateError: string | null;
  templateId: string | null;
  templateName: string;
  canvas: CanvasConfig;
  frontJson: string | null;
  backJson: string | null;
  frontHistory: SideHistory;
  backHistory: SideHistory;
  textStyle: TextStyle;
  dynamicFields: string[];
  setSide: (side: EditorSide) => void;
  setTool: (tool: EditorTool) => void;
  setZoom: (zoom: number) => void;
  setSelected: (id: string | null, type: string | null, text?: string, meta?: Partial<SelectedMeta>) => void;
  setSelectedText: (text: string) => void;
  setSelectedMeta: (m: Partial<SelectedMeta>) => void;
  setHistoryFlags: (canUndo: boolean, canRedo: boolean) => void;
  setDirty: (dirty: boolean) => void;
  setSetupDone: (done: boolean) => void;
  setHydrating: (v: boolean) => void;
  setHydrateError: (e: string | null) => void;
  setTemplateId: (id: string | null) => void;
  setTemplateName: (name: string) => void;
  setCanvas: (c: Partial<CanvasConfig>) => void;
  setSideJson: (side: EditorSide, json: string) => void;
  pushSideHistory: (side: EditorSide, json: string) => void;
  undoSide: (side: EditorSide) => string | null;
  redoSide: (side: EditorSide) => string | null;
  initSideHistory: (side: EditorSide, json: string) => void;
  setTextStyle: (s: Partial<TextStyle>) => void;
  addDynamicField: (field: string) => void;
  removeDynamicField: (field: string) => void;
  syncDynamicFieldsFromDesigns: (frontJson: string | null, backJson: string | null) => void;
  resetEditor: () => void;
  applyPreset: (presetKey: string, unit?: Unit, dpi?: number) => void;
}

const defaultMmW = 85.6;
const defaultMmH = 53.98;

const defaultCanvas = (): CanvasConfig => ({
  widthPx: mmToPx(defaultMmW),
  heightPx: mmToPx(defaultMmH),
  widthMm: defaultMmW,
  heightMm: defaultMmH,
  unit: "mm",
  dpi: DEFAULT_DPI,
  orientation: "landscape",
  preset: "cr80_landscape",
});

const emptyHist = (): SideHistory => ({ stack: [], index: -1 });

function extractFieldTitles(json: string | null): string[] {
  if (!json) return [];
  try {
    const data = JSON.parse(json);
    const objs = data.objects || [];
    const titles: string[] = [];
    for (const o of objs) {
      const ft = o?.data?.fieldTitle;
      if (typeof ft === "string" && ft.trim() && o?.data?.isDynamic !== false) {
        titles.push(ft.trim());
      }
    }
    return titles;
  } catch {
    return [];
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  side: "front",
  tool: "select",
  zoom: 100,
  selectedId: null,
  selectedType: null,
  selectedText: "",
  selectedMeta: { fieldTitle: "", isDynamic: true, defaultText: "" },
  canUndo: false,
  canRedo: false,
  isDirty: false,
  setupDone: false,
  isHydrating: false,
  hydrateError: null,
  templateId: null,
  templateName: "Untitled Template",
  canvas: defaultCanvas(),
  frontJson: null,
  backJson: null,
  frontHistory: emptyHist(),
  backHistory: emptyHist(),
  textStyle: {
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 28,
    fontWeight: "normal",
    fontStyle: "normal",
    fill: "#111111",
    textAlign: "left",
    underline: false,
    opacity: 1,
  },
  dynamicFields: [],
  setSide: (side) => {
    const hist = side === "front" ? get().frontHistory : get().backHistory;
    set({
      side,
      selectedId: null,
      selectedType: null,
      selectedText: "",
      canUndo: hist.index > 0,
      canRedo: hist.index >= 0 && hist.index < hist.stack.length - 1,
    });
  },
  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom }),
  setSelected: (selectedId, selectedType, selectedText = "", meta) =>
    set({
      selectedId,
      selectedType,
      selectedText,
      selectedMeta: meta
        ? { ...get().selectedMeta, ...meta }
        : { fieldTitle: "", isDynamic: true, defaultText: selectedText },
    }),
  setSelectedText: (selectedText) => set({ selectedText }),
  setSelectedMeta: (m) => set((s) => ({ selectedMeta: { ...s.selectedMeta, ...m } })),
  setHistoryFlags: (canUndo, canRedo) => set({ canUndo, canRedo }),
  setDirty: (isDirty) => set({ isDirty }),
  setSetupDone: (setupDone) => set({ setupDone }),
  setHydrating: (isHydrating) => set({ isHydrating }),
  setHydrateError: (hydrateError) => set({ hydrateError }),
  setTemplateId: (templateId) => set({ templateId }),
  setTemplateName: (templateName) => set({ templateName }),
  setCanvas: (c) => set((s) => ({ canvas: { ...s.canvas, ...c } })),
  setSideJson: (side, json) =>
    set(side === "front" ? { frontJson: json } : { backJson: json }),
  pushSideHistory: (side, json) => {
    const key = side === "front" ? "frontHistory" : "backHistory";
    const hist = get()[key];
    const stack = hist.stack.slice(0, hist.index + 1);
    stack.push(json);
    if (stack.length > 60) stack.shift();
    const index = stack.length - 1;
    set({
      [key]: { stack, index },
      canUndo: index > 0,
      canRedo: false,
      isDirty: true,
      ...(side === "front" ? { frontJson: json } : { backJson: json }),
    } as Partial<EditorState>);
  },
  undoSide: (side) => {
    const key = side === "front" ? "frontHistory" : "backHistory";
    const hist = get()[key];
    if (hist.index <= 0) return null;
    const index = hist.index - 1;
    const json = hist.stack[index];
    set({
      [key]: { ...hist, index },
      canUndo: index > 0,
      canRedo: true,
      ...(side === "front" ? { frontJson: json } : { backJson: json }),
    } as Partial<EditorState>);
    return json;
  },
  redoSide: (side) => {
    const key = side === "front" ? "frontHistory" : "backHistory";
    const hist = get()[key];
    if (hist.index >= hist.stack.length - 1) return null;
    const index = hist.index + 1;
    const json = hist.stack[index];
    set({
      [key]: { ...hist, index },
      canUndo: true,
      canRedo: index < hist.stack.length - 1,
      ...(side === "front" ? { frontJson: json } : { backJson: json }),
    } as Partial<EditorState>);
    return json;
  },
  initSideHistory: (side, json) => {
    const key = side === "front" ? "frontHistory" : "backHistory";
    set({
      [key]: { stack: [json], index: 0 },
      ...(side === "front" ? { frontJson: json } : { backJson: json }),
      canUndo: false,
      canRedo: false,
    } as Partial<EditorState>);
  },
  setTextStyle: (ts) => set((s) => ({ textStyle: { ...s.textStyle, ...ts } })),
  addDynamicField: (field) =>
    set((s) => {
      const f = field.trim();
      if (!f || s.dynamicFields.includes(f)) return s;
      return { dynamicFields: [...s.dynamicFields, f] };
    }),
  removeDynamicField: (field) =>
    set((s) => ({ dynamicFields: s.dynamicFields.filter((x) => x !== field) })),
  syncDynamicFieldsFromDesigns: (frontJson, backJson) => {
    const all = [
      ...extractFieldTitles(frontJson),
      ...extractFieldTitles(backJson),
    ];
    const unique = Array.from(new Set(all));
    set({ dynamicFields: unique });
  },
  resetEditor: () =>
    set({
      side: "front",
      tool: "select",
      zoom: 100,
      selectedId: null,
      selectedType: null,
      selectedText: "",
      selectedMeta: { fieldTitle: "", isDynamic: true, defaultText: "" },
      canUndo: false,
      canRedo: false,
      isDirty: false,
      setupDone: false,
      isHydrating: false,
      hydrateError: null,
      templateId: null,
      templateName: "Untitled Template",
      canvas: defaultCanvas(),
      frontJson: null,
      backJson: null,
      frontHistory: emptyHist(),
      backHistory: emptyHist(),
      dynamicFields: [],
    }),
  applyPreset: (presetKey, unit = "mm", dpi = DEFAULT_DPI) => {
    const { PRESETS } = require("@/lib/editor/constants") as typeof import("@/lib/editor/constants");
    const p = PRESETS[presetKey as keyof typeof PRESETS] || PRESETS.cr80_landscape;
    set({
      canvas: {
        widthPx: mmToPx(p.widthMm, dpi),
        heightPx: mmToPx(p.heightMm, dpi),
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        unit,
        dpi,
        orientation: p.orientation,
        preset: presetKey,
      },
    });
  },
}));

/** Normalize header for matching */
export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}
