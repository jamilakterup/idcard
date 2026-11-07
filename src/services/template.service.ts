import { api } from "@/lib/http/client";
import { Template } from "@/types";

type TemplatePayload = {
  templateName: string;
  frontDesign?: Record<string, unknown>;
  backDesign?: Record<string, unknown>;
  elements?: unknown[];
  canvasConfig?: Record<string, unknown>;
  thumbnail?: string | null;
};

export const templateService = {
  getAll: () => api.get<{ templates: Template[] }>("/api/templates"),
  getById: (id: string) => api.get<{ template: Template }>(`/api/templates/${id}`),
  create: (data: TemplatePayload) =>
    api.post<{ template: Template }>("/api/templates", data),
  update: (id: string, data: Partial<TemplatePayload>) =>
    api.put<{ template: Template }>(`/api/templates/${id}`, data),
  delete: (id: string) => api.delete(`/api/templates/${id}`),
};
