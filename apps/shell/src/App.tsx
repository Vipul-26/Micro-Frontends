import { lazy, Suspense } from "react";
import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useCartLines } from "@mfe/cart-client";
import { RemoteBoundary } from "./RemoteBoundary";

const CatalogApp = lazy(() => import("catalog/CatalogApp"));
const CartApp = lazy(() => import("cart/CartApp"));

export function App() {
  const count = useCartLines().reduce((total, line) => total + line.quantity, 0);

  return (
    <BrowserRouter>
      <div className="shell">
        <header className="shell-header">
          <NavLink className="shell-mark" to="/catalog">
            Storefront
          </NavLink>
          <span className="shell-origin">shell · localhost:3000</span>
          <nav className="shell-nav" aria-label="Primary">
            <NavLink to="/catalog">Catalog</NavLink>
            <NavLink to="/cart">
              Cart
              <span className="shell-count">{count}</span>
            </NavLink>
          </nav>
        </header>
        <main className="shell-main">
          <Routes>
            <Route path="/" element={<Navigate to="/catalog" replace />} />
            <Route
              path="/catalog/*"
              element={
                <RemoteBoundary label="Catalog is unavailable">
                  <Suspense fallback={<p className="remote-status">Loading catalog…</p>}>
                    <CatalogApp />
                  </Suspense>
                </RemoteBoundary>
              }
            />
            <Route
              path="/cart/*"
              element={
                <RemoteBoundary label="Cart is unavailable">
                  <Suspense fallback={<p className="remote-status">Loading cart…</p>}>
                    <CartApp />
                  </Suspense>
                </RemoteBoundary>
              }
            />
            <Route path="*" element={<p className="remote-status">No route for this path.</p>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
