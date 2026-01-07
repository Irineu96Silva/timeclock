// apps/web/src/services/api.ts

// Em DEV (local) você usa localhost.
// Em PROD (Vercel) você define VITE_API_URL nas Environment Variables.
const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:3000";

const ACCESS_TOKEN_KEY = "access_token";
const USER_ROLE_KEY = "user_role";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
}

export function getUserRole() {
  return localStorage.getItem(USER_ROLE_KEY);
}

export function setUserRole(role: string) {
  localStorage.setItem(USER_ROLE_KEY, role);
}

export function clearUserRole() {
  localStorage.removeItem(USER_ROLE_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
    mode: "cors",
  });

  if (!response.ok) {
    let message = response.statusText;
    let code: string | undefined;
    let details: unknown;

    try {
      const data = (await response.json()) as {
        message?: string | string[];
        error?: string;
        code?: string;
        details?: unknown;
      };

      if (data?.message) {
        message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      }

      code = data?.code || data?.error;
      details = data?.details;
    } catch {
      // ignora erro de parse
    }

    if (response.status === 401) {
      clearAccessToken();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    throw new ApiError(message, response.status, code, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
    mode: "cors",
  });

  if (!response.ok) {
    let message = response.statusText;
    let code: string | undefined;
    let details: unknown;

    try {
      const data = (await response.json()) as {
        message?: string | string[];
        error?: string;
        code?: string;
        details?: unknown;
      };

      if (data?.message) {
        message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      }

      code = data?.code || data?.error;
      details = data?.details;
    } catch {
      // ignora erro de parse
    }

    if (response.status === 401) {
      clearAccessToken();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    throw new ApiError(message, response.status, code, details);
  }

  return response.blob();
}

async function requestBlobPost(path: string, body?: unknown): Promise<Blob> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    mode: "cors",
  });

  if (!response.ok) {
    throw new ApiError(response.statusText, response.status);
  }

  return response.blob();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, body ? { method: "POST", body: JSON.stringify(body) } : { method: "POST" }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, body ? { method: "PATCH", body: JSON.stringify(body) } : { method: "PATCH" }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  getBlob: (path: string) => requestBlob(path),
  postBlob: (path: string, body?: unknown) => requestBlobPost(path, body),
};
