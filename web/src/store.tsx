import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, tokens } from './api';
import type { Cart, CartLine, Product, TokenPair, User } from './api';

interface AuthState {
  user: User | null;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

interface CartState {
  cart: Cart | null;
  count: number;
  refreshCart: () => Promise<void>;
  addItem: (product: Product, quantity: number) => Promise<void>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
}

const CartContext = createContext<CartState | null>(null);

const GUEST_CART = 'souq.cart';

type GuestLine = { product: CartLine['product']; quantity: number };

function readGuestCart(): GuestLine[] {
  try {
    const raw = localStorage.getItem(GUEST_CART);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GuestLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line) => line?.product?.id && line.quantity > 0);
  } catch {
    return [];
  }
}

function writeGuestCart(lines: GuestLine[]) {
  if (lines.length === 0) localStorage.removeItem(GUEST_CART);
  else localStorage.setItem(GUEST_CART, JSON.stringify(lines));
}

function toSnapshot(product: Product): CartLine['product'] {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    currency: product.currency,
    stock: product.stock,
    image: product.images?.[0]?.url ?? null,
  };
}

function guestCart(lines: GuestLine[]): Cart {
  const data: CartLine[] = lines.map((line) => ({
    id: line.product.id,
    quantity: line.quantity,
    lineTotal: line.product.price * line.quantity,
    product: line.product,
  }));
  return {
    data,
    summary: {
      itemCount: data.reduce((total, line) => total + line.quantity, 0),
      subtotal: data.reduce((total, line) => total + line.lineTotal, 0),
      currency: data[0]?.product.currency ?? 'SAR',
    },
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => tokens.user());
  const [guest, setGuest] = useState<GuestLine[]>(readGuestCart);
  const [serverCart, setServerCart] = useState<Cart | null>(null);

  const updateGuest = useCallback((next: GuestLine[]) => {
    writeGuestCart(next);
    setGuest(next);
  }, []);

  const refreshCart = useCallback(async () => {
    if (!tokens.access()) {
      setServerCart(null);
      return;
    }
    try {
      setServerCart(await api<Cart>('/cart/items'));
    } catch {
      setServerCart(null);
    }
  }, []);

  useEffect(() => {
    void refreshCart();
  }, [user, refreshCart]);

  const mergeGuestCart = useCallback(
    async (lines: GuestLine[]) => {
      for (const line of lines) {
        try {
          await api<Cart>('/cart/items', {
            method: 'POST',
            body: { productId: line.product.id, quantity: line.quantity },
          });
        } catch {
          // A product that vanished or sold out must not block the rest of the cart.
        }
      }
      updateGuest([]);
    },
    [updateGuest],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const pair = await api<TokenPair>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      tokens.set(pair);
      if (guest.length > 0) await mergeGuestCart(guest);
      const me = pair.user ?? null;
      setUser(me);
      return me as User;
    },
    [guest, mergeGuestCart],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const pair = await api<TokenPair>('/auth/register', {
        method: 'POST',
        body: { name, email, password },
        auth: false,
      });
      tokens.set(pair);
      if (guest.length > 0) await mergeGuestCart(guest);
      const me = pair.user ?? null;
      setUser(me);
      return me as User;
    },
    [guest, mergeGuestCart],
  );

  const signOut = useCallback(async () => {
    const refreshToken = tokens.refresh();
    if (refreshToken) {
      await api('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(
        () => undefined,
      );
    }
    tokens.clear();
    setUser(null);
    setServerCart(null);
    updateGuest([]);
  }, [updateGuest]);

  const addItem = useCallback(
    async (product: Product, quantity: number) => {
      if (tokens.access()) {
        setServerCart(
          await api<Cart>('/cart/items', {
            method: 'POST',
            body: { productId: product.id, quantity },
          }),
        );
        return;
      }
      const snapshot = toSnapshot(product);
      const existing = guest.find((line) => line.product.id === product.id);
      const next = existing
        ? guest.map((line) =>
            line.product.id === product.id
              ? {
                  product: { ...line.product, ...snapshot },
                  quantity: Math.min(line.quantity + quantity, snapshot.stock),
                }
              : line,
          )
        : [...guest, { product: snapshot, quantity: Math.min(quantity, snapshot.stock) }];
      updateGuest(next);
    },
    [guest, updateGuest],
  );

  const setQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (tokens.access()) {
        setServerCart(
          await api<Cart>(`/cart/items/${itemId}`, { method: 'PATCH', body: { quantity } }),
        );
        return;
      }
      updateGuest(
        guest.map((line) =>
          line.product.id === itemId
            ? { ...line, quantity: Math.min(quantity, line.product.stock) }
            : line,
        ),
      );
    },
    [guest, updateGuest],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (tokens.access()) {
        setServerCart(await api<Cart>(`/cart/items/${itemId}`, { method: 'DELETE' }));
        return;
      }
      updateGuest(guest.filter((line) => line.product.id !== itemId));
    },
    [guest, updateGuest],
  );

  const cart = user ? serverCart : guestCart(guest);

  const auth = useMemo(
    () => ({ user, signIn, signUp, signOut }),
    [user, signIn, signUp, signOut],
  );
  const cartState = useMemo(
    () => ({
      cart,
      count: cart?.summary.itemCount ?? 0,
      refreshCart,
      addItem,
      setQuantity,
      removeItem,
    }),
    [cart, refreshCart, addItem, setQuantity, removeItem],
  );

  return (
    <AuthContext.Provider value={auth}>
      <CartContext.Provider value={cartState}>{children}</CartContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside StoreProvider');
  return ctx;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart outside StoreProvider');
  return ctx;
}
