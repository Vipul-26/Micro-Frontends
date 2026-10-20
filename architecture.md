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

## Where `remoteEntry.js` is

It is not a file in the repo. You do not write it. `ModuleFederationPlugin` adds it to the catalog and cart compilations.

| App | Config | Served at |
| --- | --- | --- |
| catalog | `filename: "remoteEntry.js"`, exposes `./CatalogApp` | http://localhost:3001/remoteEntry.js |
| cart | `filename: "remoteEntry.js"`, exposes `./CartApp` | http://localhost:3002/remoteEntry.js |

`npm run dev` runs three compilers. Catalog webpack compiles `apps/catalog`. Cart webpack compiles `apps/cart`. Shell webpack compiles only `apps/shell`. The shell config lists remote URLs. It does not compile catalog or cart source.

Dev has no `dist` folder. Webpack-dev-server keeps each compilation in memory. Stop the servers and `remoteEntry.js` is gone.

`remoteEntry.js` is a manifest, not the whole app. The browser downloads it, reads which chunks `CatalogApp` or `CartApp` need, then downloads those chunks from the same host, for example `http://localhost:3001/src_CatalogApp_tsx.js`. Those chunks are the compiled catalog code. The shell bundle is not rebuilt when catalog changes. Saving a catalog file recompiles catalog in memory, and the next page load fetches the new manifest and chunks.

The shell does not contain `remoteEntry.js`. `apps/shell/webpack.config.js` only lists the two URLs:

```text
catalog@http://localhost:3001/remoteEntry.js
cart@http://localhost:3002/remoteEntry.js
```

## How the shell finds a chunk

Same steps in dev and production. The shell knows the remote URL and the expose name. It does not know chunk filenames. Catalog's compile writes those names into `remoteEntry.js`.

Shell source:

```ts
const CatalogApp = lazy(() => import("catalog/CatalogApp"));
```

Shell webpack rewrites that import into: load the catalog `remoteEntry.js` URL from the shell config, then call `catalog.get("./CatalogApp")`.

| | Dev, this repo | Production, after the remote URL is set |
| --- | --- | --- |
| Shell config | `catalog@http://localhost:3001/remoteEntry.js` | `catalog@https://catalog.example.com/remoteEntry.js` |
| Manifest request | `http://localhost:3001/remoteEntry.js` | `https://catalog.example.com/remoteEntry.js` |
| Where the file lives | webpack-dev-server memory | catalog's deployed output |

The manifest contains a map like this. The chunk id string differs between a dev build and a production build. The shape is the same:

```js
"./CatalogApp": () =>
  Promise.all([
    __webpack_require__.e("src_CatalogApp_tsx"),
    // plus the shared React and CSS chunks
  ]).then(() => __webpack_require__("./src/CatalogApp.tsx"))
```

`__webpack_require__.e` loads a script. The filename function in dev is `chunkId + ".js"`, so `src_CatalogApp_tsx` becomes `src_CatalogApp_tsx.js`. A production build usually hashes that filename. The new hash is inside the new `remoteEntry.js`, which is why the shell does not need the chunk name at compile time.

`publicPath: "auto"` takes the directory of the script that just ran and uses it for every following chunk. Dev and production use that same rule:

| Script that just ran | Chunk request |
| --- | --- |
| `http://localhost:3001/remoteEntry.js` | `http://localhost:3001/src_CatalogApp_tsx.js` |
| `https://catalog.example.com/remoteEntry.js` | `https://catalog.example.com/<hashed-chunk>.js` |

That second file is the compiled component. `get("./CatalogApp")` resolves, and `React.lazy` renders it. Cart works the same way through `cart.get("./CartApp")`.

```mermaid
sequenceDiagram
  participant Shell as shell bundle
  participant Entry as remoteEntry.js
  participant Chunk as component chunk

  Shell->>Entry: load the configured remoteEntry.js URL
  Shell->>Entry: catalog.get("./CatalogApp")
  Note over Entry: module map lists the chunk id
  Entry->>Chunk: GET that id from the remoteEntry.js directory
  Chunk-->>Shell: CatalogApp module
```

## Production

This repo has no production script. Every app script is `webpack serve --mode development`.

A production build is `webpack --mode production` once per app. That writes files to disk: `remoteEntry.js` plus hashed chunks. Deploy the three output folders separately. The user still opens only the shell. Catalog and cart are other hosts, for example `https://catalog.example.com/remoteEntry.js`.

The shell remotes in this repo are localhost. A production shell build would keep requesting `localhost:3001` and `localhost:3002` until those URLs are changed to the deployed hosts. After that, a catalog change is: rebuild catalog, upload its output, leave the shell deployed as it is. The next page load fetches the same `remoteEntry.js` URL and gets the new chunks. Rebuild the shell only when a remote URL or the exposed module name changes.

Dev-server CORS headers are not part of the static files. The host that serves catalog and cart must allow the shell origin to load those scripts. The deployed builds must stay on the same React, ReactDOM, and React Router versions, because they are singletons. The cart store is the same in production: `window.__MFE_CART__` for that page load, cleared on a full reload.

## Routes

The shell owns the site URLs. Catalog owns only the remainder under `/catalog`. One `BrowserRouter` in the shell is the history for the whole page. React Router is a shared singleton, so catalog's `<Routes>` and `<Link>` use that same history.

```tsx
<Route path="/" element={<Navigate to="/catalog" replace />} />
<Route path="/catalog/*" element={<CatalogApp />} />
<Route path="/cart/*" element={<CartApp />} />
<Route path="*" element={<p>No route for this path.</p>} />
```

The `/*` keeps the shell route matched when the URL goes deeper, and it leaves the remainder for the remote. Catalog matches that remainder:

```tsx
<Route index element={<ProductList />} />
<Route path=":productId" element={<ProductDetail />} />
```

| URL on the shell | Who matches it | What renders |
| --- | --- | --- |
| `/` | shell | redirect to `/catalog` |
| `/catalog` | shell, then catalog index | product list |
| `/catalog/kb-01` | shell, then catalog `:productId` | that product |
| `/cart` | shell | `CartApp` |
| anything else | shell `*` | "No route for this path." |

Cart has no inner routes. `/cart` and `/cart/anything` both render the same panel.

A product link is `to={product.id}`, relative to the current route. On the shell, `/catalog` plus `kb-01` becomes `/catalog/kb-01`. "Back to catalog" is `to=".."`, which returns to `/catalog`. Header links are absolute: `/catalog` and `/cart`.

### `bootstrap.tsx`

Each app's `src/index.ts` is only `import("./bootstrap")`. That file is the dev-server entry. The shell does not load a remote's `bootstrap.tsx`. It loads the exposed component: `CatalogApp` or `CartApp`.

When you open the shell, the only `BrowserRouter` is in `apps/shell/src/App.tsx`. `apps/shell/src/bootstrap.tsx` mounts that `App`. Catalog and cart render inside it, and their `<Routes>` and `<Link>` use that history because React Router is one shared singleton.

The other `BrowserRouter` is in `apps/catalog/src/bootstrap.tsx`. That file runs only when you open http://localhost:3001 by itself. With no `/catalog` parent, the index route is `/` and the detail route is `/kb-01`. Cart's `bootstrap.tsx` renders `CartApp` with no router, because the cart UI does not read the path.

```mermaid
flowchart TD
  rootPath["/ "] --> catalogPath["/catalog"]
  catalogPath --> list["CatalogApp index\nproduct list"]
  catalogPath --> detail["/catalog/:productId\nproduct detail"]
  cartPath["/cart/*"] --> cartView["CartApp\nlines + Remove"]
  missing["anything else"] --> note["No route for this path"]
```

A refresh of `/catalog/kb-01` still works. The dev server falls back to `index.html`, and `<base href="/">` loads `/main.js` instead of `/catalog/main.js`. The router then reads the real URL. Production uses these same paths on the shell host. The remote hosts serve scripts, not these URLs.

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

`npm run dev` starts catalog and cart, waits until both `remoteEntry.js` URLs answer, then starts the shell. Catalog and cart must be compiled and serving before the shell asks for them.
