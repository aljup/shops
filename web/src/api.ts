const ACCESS = 'souq.access';
const REFRESH = 'souq.refresh';
const USER = 'souq.user';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'CUSTOMER';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user?: User;
}

export const tokens = {
  access: () => localStorage.getItem(ACCESS),
  refresh: () => localStorage.getItem(REFRESH),
  user: (): User | null => {
    const raw = localStorage.getItem(USER);
    return raw ? (JSON.parse(raw) as User) : null;
  },
  set(pair: TokenPair) {
    localStorage.setItem(ACCESS, pair.accessToken);
    localStorage.setItem(REFRESH, pair.refreshToken);
    if (pair.user) localStorage.setItem(USER, JSON.stringify(pair.user));
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(USER);
  },
};

export class HttpError extends Error {
  status: number;
  code: string;
  requestId?: string;

  constructor(status: number, body: { code?: string; message?: string; requestId?: string }) {
    super(body.message ?? 'تعذّر إكمال الطلب');
    this.status = status;
    this.code = body.code ?? 'ERROR';
    this.requestId = body.requestId;
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = tokens.refresh();
      if (!refreshToken) return false;
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        tokens.clear();
        return false;
      }
      tokens.set((await res.json()) as TokenPair);
      return true;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
}

const HTTP_UNAUTHORIZED = 401;

/** The server rejected the bearer token: the session must be refreshed. */
function isAuthChallenge(res: Response): boolean {
  return res.status === HTTP_UNAUTHORIZED;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const send = (token: string | null) =>
    fetch(`/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(opts.headers ?? {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

  let res = await send(tokens.access());
  if (isAuthChallenge(res) && opts.auth !== false && tokens.refresh()) {
    if (await refreshOnce()) res = await send(tokens.access());
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (isAuthChallenge(res)) tokens.clear();
    throw new HttpError(res.status, data?.error ?? {});
  }
  return data as T;
}

export interface PageInfo {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface Page<T> {
  data: T[];
  pageInfo: PageInfo;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  position: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  isActive: boolean;
  category: Category | null;
  images: ProductImage[];
}

export interface CartLine {
  id: string;
  quantity: number;
  lineTotal: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    currency: string;
    stock: number;
    image: string | null;
  };
}

export interface Cart {
  data: CartLine[];
  summary: { itemCount: number; subtotal: number; currency: string | null };
}

export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderLine {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  paymentMethod: 'cod' | 'manual';
  paymentStatus: string;
  subtotal: number;
  total: number;
  currency: string;
  cancelReason: string | null;
  items: OrderLine[];
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function money(minor: number, currency = 'SAR'): string {
  const value = (minor / 100).toLocaleString('ar-SA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${value} ${currency === 'SAR' ? 'ر.س' : currency}`;
}

export function newIdempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'قيد المراجعة',
  PAID: 'مدفوع',
  SHIPPED: 'تم الشحن',
  DELIVERED: 'تم التوصيل',
  CANCELLED: 'ملغى',
};

export const PAYMENT_LABEL: Record<string, string> = {
  pending: 'بانتظار الدفع',
  paid: 'مدفوع',
  refunded: 'مسترجع',
  failed: 'فشل',
};
