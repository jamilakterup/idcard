import { normalizeHeader } from "@/stores/editor-store";

export interface DesignField {
  fieldTitle: string;
  isDynamic: boolean;
  defaultText?: string;
  side: "front" | "back";
  type: "text" | "qr" | "photo" | "other";
}

/** Extract dynamic field titles from Fabric JSON */
export function extractFieldsFromDesign(
  design: Record<string, unknown> | null | undefined,
  side: "front" | "back"
): DesignField[] {
  if (!design || typeof design !== "object") return [];
  const objects = (design as { objects?: unknown[] }).objects || [];
  const fields: DesignField[] = [];
  for (const raw of objects) {
    const o = raw as {
      type?: string;
      text?: string;
      data?: { fieldTitle?: string; isDynamic?: boolean; defaultText?: string; isQr?: boolean; isPhoto?: boolean };
    };
    const ft = o.data?.fieldTitle?.trim();
    if (!ft) continue;
    const isDynamic = o.data?.isDynamic !== false;
    let type: DesignField["type"] = "other";
    if (o.data?.isQr) type = "qr";
    else if (o.data?.isPhoto) type = "photo";
    else if (o.type === "i-text" || o.type === "text") type = "text";
    fields.push({
      fieldTitle: ft,
      isDynamic,
      defaultText: o.data?.defaultText || o.text,
      side,
      type,
    });
  }
  return fields;
}

export function autoMapHeaders(
  fieldTitles: string[],
  csvHeaders: string[]
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  const used = new Set<string>();
  const normHeaders = csvHeaders.map((h) => ({ raw: h, norm: normalizeHeader(h) }));

  for (const ft of fieldTitles) {
    const n = normalizeHeader(ft);
    const exact = normHeaders.find((h) => h.norm === n && !used.has(h.raw));
    if (exact) {
      map[ft] = exact.raw;
      used.add(exact.raw);
      continue;
    }
    map[ft] = null;
  }
  return map;
}

/** Apply row values onto Fabric JSON (text objects with matching fieldTitle) */
export function applyRowToDesign(
  design: Record<string, unknown>,
  row: Record<string, string>,
  mapping: Record<string, string | null>
): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(design)) as {
    objects?: Array<{
      type?: string;
      text?: string;
      data?: { fieldTitle?: string; isDynamic?: boolean };
      visible?: boolean;
    }>;
  };
  if (!clone.objects) return clone;

  for (const obj of clone.objects) {
    const ft = obj.data?.fieldTitle?.trim();
    if (!ft) continue;
    if (obj.data?.isDynamic === false) continue;
    const csvCol = mapping[ft];
    if (!csvCol) {
      // hide unmatched dynamic text
      if (obj.type === "i-text" || obj.type === "text") {
        obj.visible = false;
      }
      continue;
    }
    const value = row[csvCol];
    if (value === undefined || value === null || String(value).trim() === "") {
      if (obj.type === "i-text" || obj.type === "text") obj.visible = false;
      continue;
    }
    if (obj.type === "i-text" || obj.type === "text") {
      obj.text = String(value);
      obj.visible = true;
    }
  }
  return clone;
}
