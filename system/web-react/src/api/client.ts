import type { ApiError } from '../types';

const BASE_URL = window.location.origin;

class ApiClient {
  private getToken(): string | null {
    try {
      const raw = localStorage.getItem('auth_token');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      window.location.replace('/login');
      throw new Error('登录已过期，请重新登录');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = (body as ApiError).detail || `请求失败 (${res.status})`;
      throw new Error(detail);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      window.location.replace('/login');
      throw new Error('登录已过期，请重新登录');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = (body as ApiError).detail || '上传失败';
      throw new Error(detail);
    }

    return res.json();
  }
}

export const api = new ApiClient();
