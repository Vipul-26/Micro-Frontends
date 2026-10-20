# Storefront micro frontends

Three builds. The shell is the only page the user opens. It downloads each remote at runtime and renders the component that remote exposes. It never compiles catalog or cart source.

```mermaid
flowchart LR
  user((Browser)) --> shell

  subgraph shellApp ["shell · :3000"]
    shell["header + BrowserRouter"]
  end

  subgraph catalogApp ["catalog · :3001"]
    catalog["CatalogApp"]
  end

  subgraph cartApp ["cart · :3002"]
    cart["CartApp"]
  end

  shell -->|"GET /remoteEntry.js"| catalog
  shell -->|"GET /remoteEntry.js"| cart
  catalog -->|"addToCart"| windowSlot["window.__MFE_CART__"]
  cart -->|"useCartLines / removeFromCart"| windowSlot
  shell -->|"useCartLines"| windowSlot
```

## Repo

```mermaid
flowchart TB
  root["micro-frontends"]
  root --> apps
  root --> packages
  apps --> shellPkg["apps/shell"]
  apps --> catalogPkg["apps/catalog"]
  apps --> cartPkg["apps/cart"]
  packages --> client["packages/cart-client\n@mfe/cart-client"]
```

| Package | Dev server | Public module |
| --- | --- | --- |
| `shell` | http://localhost:3000 | host, no expose |
| `catalog` | http://localhost:3001 | `catalog/CatalogApp` |
| `cart` | http://localhost:3002 | `cart/CartApp` |
| `@mfe/cart-client` | none | bundled into each app |

React `18.3.1`, ReactDOM `18.3.1`, and React Router `6.28.1` are singletons. One copy of each is on the page.

## What loads when

```mermaid
sequenceDiagram
  participant Browser
  participant Shell as shell :3000
  participant Catalog as catalog :3001
  participant Cart as cart :3002

  Browser->>Shell: GET /
  Shell->>Browser: redirect /catalog
  Browser->>Catalog: GET /remoteEntry.js
  Catalog-->>Browser: CatalogApp
  Note over Browser,Cart: CartApp is not loaded yet
  Browser->>Browser: addToCart writes window.__MFE_CART__
  Browser->>Cart: GET /remoteEntry.js when /cart opens
  Cart-->>Browser: CartApp reads the same store
```

`output.publicPath` is `"auto"`, so catalog's extra chunks stay on port 3001 even though the document is on port 3000. Each app's `src/index.ts` is only `import("./bootstrap")`, so shared React is installed before app code imports it.

## Routes

`BrowserRouter` lives in the shell. Catalog and cart do not bring their own history when they are remotes. Catalog's standalone bootstrap wraps `CatalogApp` in a router so http://localhost:3001 works alone.

```mermaid
flowchart TD
  rootPath["/ "] --> catalogPath["/catalog"]
  catalogPath --> list["CatalogApp index\nproduct list"]
  catalogPath --> detail["/catalog/:productId\nproduct detail"]
  cartPath["/cart/*"] --> cartView["CartApp\nlines + Remove"]
  missing["anything else"] --> note["No route for this path"]
```

If a remote fails to load, that slot shows "Catalog is unavailable" or "Cart is unavailable". The other route still renders.

## Cart

Each app bundles `@mfe/cart-client`. A module-level variable would be three stores. The first bundle creates the store and hangs it on `window.__MFE_CART__`. The others find that object.

```mermaid
flowchart LR
  add["addToCart"] --> slot["window.__MFE_CART__"]
  remove["removeFromCart"] --> slot
  slot --> hook["useCartLines"]
  hook --> badge["shell header count"]
  hook --> list["catalog quantity"]
  hook --> lines["cart line items"]
```

A full reload clears the cart. The store belongs to that document, so http://localhost:3001 does not share a cart with http://localhost:3000.

## Start

`npm run dev` starts catalog and cart, waits until both `remoteEntry.js` URLs answer, then starts the shell.
