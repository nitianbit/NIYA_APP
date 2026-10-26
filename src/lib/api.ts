import { getApiBaseUrl } from './config';

export type Member = {
  id?: string;
  memberId?: string;
  fullName: string;
  relation: string;
  gender?: string;
  dateOfBirth?: number | null;
};

export type Overview = {
  profile: {
    id: string;
    fullName: string;
    employeeCode: string;
    email: string;
    phone: string;
    gender: string;
    dateOfBirth: number | null;
    department: string;
    dateOfJoining: number | null;
    corporateName: string;
  };
  family: Member[];
  covers: {
    id: string;
    name: string;
    type: string;
    periodStart: number;
    periodEnd: number;
    sumInsured: number;
    parentCoverLimit: number | null;
    members: Member[];
  }[];
};

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function api<T>(path: string, options: {
  method?: 'GET' | 'POST'; body?: object; token?: string;
} = {}): Promise<T> {
  const base = getApiBaseUrl();
  if (!path.startsWith('/api/') || path.includes('?') || path.includes('#')) {
    throw new Error('Invalid NIYA API path.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof data === 'object' && data !== null
        ? ('error' in data && typeof data.error === 'string' ? data.error
          : 'message' in data && typeof data.message === 'string' ? data.message
            : 'Something went wrong. Try again.') : 'Something went wrong. Try again.';
      throw new ApiError(message, response.status);
    }
    if (data === null) throw new ApiError('NIYA returned an invalid response. Please try again.', response.status);
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(controller.signal.aborted
      ? 'NIYA took too long to respond. Please try again.'
      : 'Cannot reach NIYA. Check your connection and try again.', { cause: error });
  } finally { clearTimeout(timeout); }
}

export function dateLabel(value?: number | null): string {
  if (!Number.isInteger(value)) return 'Not on file';
  const raw = String(value);
  if (!/^\d{8}$/.test(raw)) return 'Not on file';
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day) return 'Not on file';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export function rupees(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}
