type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  const json = await res.json();

  if (!res.ok) {
    const err = new Error(json.message || "Request failed") as Error & {
      status: number;
      isSuspended?: boolean;
      response?: { data: typeof json };
    };
    err.status = res.status;
    err.response = { data: json };
    if (json.message === "ACCOUNT_SUSPENDED") err.isSuspended = true;
    throw err;
  }

  return json;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
