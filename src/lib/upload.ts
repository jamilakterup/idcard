/** Upload image File or dataURL to /api/uploads, returns permanent public URL */

export async function uploadImageFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/uploads", {
    method: "POST",
    body: form,
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Upload failed");
  }
  return json.data.url as string;
}

export async function uploadDataUrl(dataUrl: string, filename = "image.png"): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  return uploadImageFile(file);
}

/** Convert data: or blob: sources in Fabric JSON to permanent URLs (best-effort) */
export async function persistFabricImageSources(
  design: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const clone = JSON.parse(JSON.stringify(design)) as {
    backgroundImage?: { src?: string };
    objects?: Array<{ type?: string; src?: string; fill?: unknown }>;
  };

  const persistSrc = async (src?: string): Promise<string | undefined> => {
    if (!src) return src;
    if (src.startsWith("/uploads/") || src.startsWith("http://") || src.startsWith("https://")) {
      return src;
    }
    if (src.startsWith("data:")) {
      try {
        return await uploadDataUrl(src);
      } catch {
        return src; // keep data url as fallback
      }
    }
    return src;
  };

  if (clone.backgroundImage?.src) {
    clone.backgroundImage.src = await persistSrc(clone.backgroundImage.src);
  }

  if (Array.isArray(clone.objects)) {
    for (const obj of clone.objects) {
      if (obj.type === "image" && obj.src) {
        obj.src = await persistSrc(obj.src);
      }
    }
  }

  return clone as Record<string, unknown>;
}
