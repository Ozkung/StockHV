'use client';
import { useCallback } from 'react';
import { signOut, useSession } from 'next-auth/react';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Returns a fetcher bound to the current session token. Paths are relative to the backend, e.g. `/inventory`. */
export function useApi() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const request = useCallback(async <T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
    const res = await fetch(`/backend${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (res.status === 401) {
      void signOut({ callbackUrl: '/login' });
      throw new ApiError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
      throw new ApiError(res.status, msg ?? 'เกิดข้อผิดพลาด');
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }, [token]);

  return { request, ready: !!token };
}
