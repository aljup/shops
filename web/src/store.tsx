import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, tokens } from './api';
import type { Cart, TokenPair, User } from './api';

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
  addItem: (productId: string, quantity: number) => Promise<void>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
}

const CartContext = createContext<CartState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => tokens.user());
  const [cart, setCart] = useState<Cart | null>(null);

  const refreshCart = useCallback(async () => {
    if (!tokens.access()) {
      setCart(null);
      return;
    }
    try {
      setCart(await api<Cart>('/cart/items'));
    } catch {
      setCart(null);
    }
  }, []);

  useEffect(() => {
    void refreshCart();
  }, [user, refreshCart]);

  const signIn = useCallback(async (email: string, password: string) => {
    const pair = await api<TokenPair>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    tokens.set(pair);
    const me = pair.user ?? null;
    setUser(me);
    return me as User;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const pair = await api<TokenPair>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
      auth: false,
    });
    tokens.set(pair);
    const me = pair.user ?? null;
    setUser(me);
    return me as User;
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = tokens.refresh();
    if (refreshToken) {
      await api('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(
        () => undefined,
      );
    }
    tokens.clear();
    setUser(null);
    setCart(null);
  }, []);

  const addItem = useCallback(
    async (productId: string, quantity: number) => {
      setCart(await api<Cart>('/cart/items', { method: 'POST', body: { productId, quantity } }));
    },
    [],
  );

  const setQuantity = useCallback(async (itemId: string, quantity: number) => {
    setCart(
      await api<Cart>(`/cart/items/${itemId}`, { method: 'PATCH', body: { quantity } }),
    );
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    setCart(await api<Cart>(`/cart/items/${itemId}`, { method: 'DELETE' }));
  }, []);

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
