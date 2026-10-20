export type Product = {
  id: string;
  name: string;
  priceCents: number;
};

export type LineItem = Product & {
  quantity: number;
};

type Listener = () => void;

type CartStore = {
  getSnapshot: () => readonly LineItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (id: string) => void;
  subscribe: (listener: Listener) => () => void;
};

/**
 * Each app bundles this module, so a `let` at module scope would be three
 * stores. The first bundle to run creates the object and hangs it on window.
 * Later bundles find that same object. The shared thing is the window, not a
 * second React tree — catalog can add a line while CartApp is unmounted.
 */
function createCart(): CartStore {
  let lines: readonly LineItem[] = [];
  const listeners = new Set<Listener>();

  const publish = (next: readonly LineItem[]) => {
    if (next === lines) return;
    lines = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => lines,
    addToCart(product) {
      if (!product.id) return;
      const item: Product = {
        id: product.id,
        name: product.name,
        priceCents: product.priceCents,
      };
      const index = lines.findIndex((line) => line.id === item.id);
      if (index === -1) {
        publish([...lines, { ...item, quantity: 1 }]);
        return;
      }
      const current = lines[index];
      if (!current) return;
      const next = lines.slice();
      next[index] = { ...current, quantity: current.quantity + 1 };
      publish(next);
    },
    removeFromCart(id) {
      if (!lines.some((line) => line.id === id)) return;
      publish(lines.filter((line) => line.id !== id));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function cartStore(): CartStore {
  const host = window as Window & { __MFE_CART__?: CartStore };
  const existing = host.__MFE_CART__;
  if (existing) return existing;
  const created = createCart();
  host.__MFE_CART__ = created;
  return created;
}

export function addToCart(product: Product): void {
  cartStore().addToCart(product);
}

export function removeFromCart(id: string): void {
  cartStore().removeFromCart(id);
}

export function subscribeCart(listener: Listener): () => void {
  return cartStore().subscribe(listener);
}

export function getCartSnapshot(): readonly LineItem[] {
  return cartStore().getSnapshot();
}

const SERVER_SNAPSHOT: readonly LineItem[] = [];

export function getCartServerSnapshot(): readonly LineItem[] {
  return SERVER_SNAPSHOT;
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
