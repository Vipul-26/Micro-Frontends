# Micro frontends

A storefront split into three apps. The shell is the site you open. Catalog and cart are separate builds. The shell does not import their source. At runtime it downloads each remote's `remoteEntry.js` and renders the component that file exposes.

Diagrams of the load order, routes, and cart store are in [architecture.md](architecture.md).

## Apps

| App | URL | Role |
| --- | --- | --- |
| shell | http://localhost:3000 | Header, routes, loads the other two |
| catalog | http://localhost:3001 | Product list, product detail, Add to cart |
| cart | http://localhost:3002 | Line items, Remove |

Open the shell for the composed site. Open catalog or cart directly to run that app with no shell chrome.

`/` redirects to `/catalog`. `/catalog/:productId` is the detail page. `/cart` is the cart. React, ReactDOM, and React Router are singletons (`18.3.1` and `6.28.1`), so catalog's routes use the shell's history.

## Cart

`@mfe/cart-client` creates one store and hangs it on `window.__MFE_CART__`. Catalog can call `addToCart` while Cart is not mounted. `useCartLines` subscribes with `useSyncExternalStore`, so the header count updates on the catalog page. A reload clears the cart. Port 3001 does not share a cart with port 3000, because those are different documents.

## Run

Node 20 or newer.

```bash
npm install
npm run dev
```

`npm run dev` starts catalog and cart, waits until both `remoteEntry.js` URLs respond, then starts the shell. `npm run typecheck` checks the four TypeScript projects.

Each app can also be started on its own with `npm run dev -w shell`, `npm run dev -w catalog`, or `npm run dev -w cart`. Start catalog and cart before the shell, or the shell shows "Catalog is unavailable" / "Cart is unavailable" for the remote that is down. The other route still works.
