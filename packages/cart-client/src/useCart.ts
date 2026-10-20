import { useSyncExternalStore } from "react";
import {
  getCartServerSnapshot,
  getCartSnapshot,
  subscribeCart,
  type LineItem,
} from "./cart";

export function useCartLines(): readonly LineItem[] {
  return useSyncExternalStore(subscribeCart, getCartSnapshot, getCartServerSnapshot);
}
