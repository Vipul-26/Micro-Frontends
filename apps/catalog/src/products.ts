import type { Product } from "@mfe/cart-client";

export type CatalogProduct = Product & {
  summary: string;
};

export const products: readonly CatalogProduct[] = [
  {
    id: "kb-01",
    name: "Low-profile keyboard",
    priceCents: 14900,
    summary: "Quiet switches and a metal top case, sized for a small desk.",
  },
  {
    id: "ms-02",
    name: "Wireless mouse",
    priceCents: 7900,
    summary: "One receiver, two devices, and a wheel that does not rattle.",
  },
  {
    id: "hd-03",
    name: "USB-C headset",
    priceCents: 11900,
    summary: "Boom mic and a single cable. No dongle to lose.",
  },
  {
    id: "mt-04",
    name: "Desk mat",
    priceCents: 3400,
    summary: "Large enough for a keyboard and a mouse, thin enough to roll.",
  },
];

export function findProduct(id: string): CatalogProduct | undefined {
  return products.find((product) => product.id === id);
}
