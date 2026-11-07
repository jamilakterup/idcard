export type Orientation = "landscape" | "portrait" | "custom";
export type Unit = "px" | "mm" | "cm" | "in";

export const PRESETS = {
  cr80_landscape: { label: "CR80 Landscape (Standard ID)", widthMm: 85.6, heightMm: 53.98, orientation: "landscape" as Orientation },
  cr80_portrait: { label: "CR80 Portrait", widthMm: 53.98, heightMm: 85.6, orientation: "portrait" as Orientation },
  a6_portrait: { label: "A6 Portrait", widthMm: 105, heightMm: 148, orientation: "portrait" as Orientation },
  custom: { label: "Custom Size", widthMm: 85.6, heightMm: 53.98, orientation: "custom" as Orientation },
};

export const DEFAULT_DPI = 300;

export function mmToPx(mm: number, dpi = DEFAULT_DPI): number {
  return Math.round((mm / 25.4) * dpi);
}

export function pxToMm(px: number, dpi = DEFAULT_DPI): number {
  return Math.round(((px * 25.4) / dpi) * 100) / 100;
}

export function toPx(value: number, unit: Unit, dpi = DEFAULT_DPI): number {
  switch (unit) {
    case "mm": return mmToPx(value, dpi);
    case "cm": return mmToPx(value * 10, dpi);
    case "in": return Math.round(value * dpi);
    default: return Math.round(value);
  }
}

export function fromPx(px: number, unit: Unit, dpi = DEFAULT_DPI): number {
  switch (unit) {
    case "mm": return pxToMm(px, dpi);
    case "cm": return pxToMm(px, dpi) / 10;
    case "in": return Math.round((px / dpi) * 1000) / 1000;
    default: return px;
  }
}

export const FONT_FAMILIES = [
  "Inter, system-ui, sans-serif",
  "Arial, Helvetica, sans-serif",
  "Georgia, serif",
  "Times New Roman, Times, serif",
  "Courier New, monospace",
  "Verdana, Geneva, sans-serif",
  "Trebuchet MS, sans-serif",
  "Noto Sans Bengali, Arial, sans-serif",
  "Hind Siliguri, Arial, sans-serif",
];

export const DEMO_FIELDS: Record<string, string> = {
  name: "Alex Rivera",
  id: "EMP-2024-0847",
  roll: "1025",
  designation: "Senior Designer",
  department: "Creative",
  mobile: "01712345678",
  email: "alex@company.com",
  blood_group: "O+",
  address: "Dhaka, Bangladesh",
  valid: "2024–2026",
};
