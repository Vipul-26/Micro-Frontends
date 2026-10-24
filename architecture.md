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

## Contents

- [Repo](#repo)
- [Shared dependencies](#shared-dependencies)
- [What loads when](#what-loads-when)
- [Where `remoteEntry.js` is](#where-remoteentryjs-is)
- [How the shell finds a chunk](#how-the-shell-finds-a-chunk)
- [Production](#production)
- [Routes](#routes)
  - [`bootstrap.tsx`](#bootstraptsx)
- [Run one app](#run-one-app)
- [Data sharing](#data-sharing)
- [Styling isolation](#styling-isolation)
  - [CSS Modules / scoped CSS / CSS-in-JS](#css-modules--scoped-css--css-in-js)
  - [Shadow DOM (Web Components)](#shadow-dom-web-components)
  - [Namespacing / prefixing](#namespacing--prefixing)
  - [Shared design system](#shared-design-system)
- [Token-based styling](#token-based-styling)
  - [Define tokens once](#define-tokens-once)
  - [Shell publishes them on the page](#shell-publishes-them-on-the-page)
  - [Remotes consume in CSS Modules](#remotes-consume-in-css-modules)
  - [Wire the package](#wire-the-package)
  - [Package vs federated design-system remote](#package-vs-federated-design-system-remote)
  - [Themes and production](#themes-and-production)
- [Cross-MFE communication](#cross-mfe-communication)
  - [Custom events / event bus](#custom-events--event-bus)
  - [Shared state via the shell](#shared-state-via-the-shell)
  - [URL / query params](#url--query-params)
  - [Props / callbacks](#props--callbacks)
  - [What this storefront uses](#what-this-storefront-uses)

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

## Shared dependencies

Do not ship React three times. Hooks and context belong to the React copy that created them. Two copies on one page is an `Invalid hook call`, or a router context the remote cannot see. The shell's `BrowserRouter` is created by the shell's React. Catalog's `<Routes>` must render with that same React.

The decision is the `shared` object in each webpack config. `singleton: true` is set there, not in `package.json`. The same block is in `apps/shell/webpack.config.js`, `apps/catalog/webpack.config.js`, and `apps/cart/webpack.config.js`. The host and the remote both list a library, or the remote will not look for the host's copy.

```js
shared: {
  react: { singleton: true, requiredVersion: "18.3.1" },
  "react-dom": { singleton: true, requiredVersion: "18.3.1" },
  "react-router-dom": { singleton: true, requiredVersion: "6.28.1" },
}
```

`requiredVersion` is the compatibility check. These are exact versions. A remote built with another React does not attach to the host's copy. A range such as `^18.3.1` would allow small patch differences to share. This repo does not do that.

`package.json` still depends on `react`, `react-dom`, and `react-router-dom` in all three apps. `shared` does not remove that. Each app is its own build and must run alone: open http://localhost:3001 and there is no shell, so catalog's webpack must resolve React itself. `npm install` hoists one `react@18.3.1` in this workspace, so disk does not hold three versions.

At runtime inside the shell:

1. The shell puts its React `18.3.1` into the shared scope.
2. Catalog's build still contains a fallback copy from catalog's compile.
3. Catalog asks for `react` as a singleton. That request does not read `node_modules`. The browser has no `node_modules`. It goes to Module Federation's share scope, a registry in the page's memory. The shell already registered its React there, so catalog uses that object and does not run its fallback.

`node_modules` is only used when webpack compiles. Catalog's compile records a fallback copy of React from `node_modules`, plus the runtime request for the singleton. Open http://localhost:3001 alone and the share scope is empty, so catalog runs that fallback. Catalog is the only app on that page, so there is still one React.

Anything not named in `shared` is local to that build. `@mfe/cart-client`, the product list, and the cart UI are local. Each app bundles its own copy. The cart is still one store because the first bundle puts it on `window.__MFE_CART__`, not because Module Federation deduped that package.

Sharing more than the framework means every app upgrades together. Sharing less means three Reacts on one page. This repo shares the framework and the router, and leaves feature code local.

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

## Run one app

One `npm install`, run at the repo root, installs every app. It is not run inside `apps/shell`, `apps/catalog`, or `apps/cart`. The root `package.json` lists `"workspaces": ["apps/*", "packages/*"]`. npm reads each workspace `package.json`, installs the dependencies those files name, and puts the result in the root `node_modules`. That single install covers the shell, catalog, cart, and `@mfe/cart-client`.

There is one `node_modules`, at the repo root. The three apps do not have their own. `node_modules/catalog` points at `apps/catalog`. `node_modules/@mfe/cart-client` points at `packages/cart-client`.

Node resolves a package by walking up parent folders. Catalog imports `react`. There is no `apps/catalog/node_modules/react`, so Node checks `apps/node_modules`, then the root `node_modules/react`. `npm run dev` inside an app finds `webpack` the same way: npm puts the root `node_modules/.bin` on the path.

There is no production build script. Each app's only script is `dev`: `webpack serve --mode development`. That compiles in memory and serves the app. It does not write a `dist` folder.

A package used only by cart is declared only in `apps/cart/package.json`. Leave it out of the shell and catalog `package.json` files, and leave it out of every `shared` block. Then run `npm install` from the repo root. Cart's build bundles it. The shell and catalog do not import it. If no other workspace needs a different version, npm still hoists it to the root `node_modules`. An incompatible second version is placed in `apps/cart/node_modules` instead.

```bash
npm run dev -w catalog
npm run dev -w cart
npm run dev -w shell
```

| Command | What you get |
| --- | --- |
| `npm run dev -w catalog` | http://localhost:3001, its own `BrowserRouter`, list at `/`, detail at `/kb-01` |
| `npm run dev -w cart` | http://localhost:3002, the cart panel only. It has no router |
| `npm run dev -w shell` | http://localhost:3000. Catalog and cart must already be serving, or those slots show unavailable |

`npm run dev` with no workspace flag starts catalog and cart, waits until both `remoteEntry.js` URLs answer, then starts the shell. An app running alone uses its own `bootstrap.tsx`. Inside the shell, only the exposed `CatalogApp` or `CartApp` loads.

## Data sharing

This repo does not use Redux. `@mfe/cart-client` is a plain store: `addToCart`, `removeFromCart`, and `useCartLines`. Each app bundles that package. A module-level variable would be three stores. The first bundle creates the store and hangs it on `window.__MFE_CART__`. The others find that object.

`useCartLines` is `useSyncExternalStore` around that store, so the shell badge, the catalog quantity, and the cart lines re-render from one array. A React context inside `CartApp` cannot do this. Catalog must update the cart while `CartApp` is not mounted.

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

Redux would need the same shape: one store object, found by every build. Two ways to get that:

- Hang the Redux store on `window`, the way this cart store is. Each app still bundles the store module. They all read `window` instead of calling `createStore()` again.
- Put that store module in `shared` with `singleton: true`, the way React is shared. Module Federation then runs one copy of the module, and a module-level `createStore()` really is one store.

A provider that lives only inside `CartApp` still fails. It is not mounted on `/catalog`, so catalog cannot dispatch. The provider has to sit in the shell, above both remotes, or the store has to live outside React. This repo uses `window`.

## Styling isolation

CSS is one document. Catalog’s stylesheet and cart’s stylesheet both land in the shell’s `<head>`. Without isolation, both remotes’ `.title` rules fight.

### CSS Modules / scoped CSS / CSS-in-JS

Localize class names so “title” in source is not “title” in the DOM.

```css
/* CatalogApp.module.css */
.title {
  font-size: 28px;
}
```

```tsx
import styles from "./CatalogApp.module.css";

<h1 className={styles.title}>Catalog</h1>
/* DOM ≈ class="_title_fdKF_1" — cart's .title hashes differently */
```

Catalog and cart configure this with `test: /\.module\.css$/` in their webpack rules. CSS-in-JS (styled-components, Emotion) does the same at runtime: generate a unique class per component. Same goal, different tooling.

The shell is different. `shell.css` is a plain stylesheet. Classes such as `.shell-header` and `.remote-error` are global. The shell owns the page chrome. Remotes stay out of that namespace.

### Shadow DOM (Web Components)

Hard boundary: styles inside the shadow root cannot leak out, and page CSS cannot reach in.

```ts
class CatalogPanel extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>.title { font-size: 28px; }</style>
      <h1 class="title">Catalog</h1>
    `;
  }
}
customElements.define("mfe-catalog", CatalogPanel);
```

Outside `.title { color: red }` does not affect that `<h1>`. Shared design-system styles also cannot reach in unless you pierce the boundary (CSS variables on the host, or constructable stylesheets). Some libraries fight the shadow boundary. This repo does not use Shadow DOM.

### Namespacing / prefixing

Manual uniqueness, no Modules:

```css
/* catalog */
.catalog-title { font-size: 28px; }

/* cart */
.cart-title { font-size: 22px; }
```

```tsx
<h1 className="catalog-title">Catalog</h1>
```

Works if every team never drops the prefix. One bare `.button` and both remotes break. CSS Modules remove that discipline cost. The shell still uses global names (`.shell-header`) because it owns chrome and remotes agree not to reuse them.

### Shared design system

Isolation stops collisions. Consistency needs shared tokens and components.

```ts
// package @mfe/ui — or a federated remote exposing Button, tokens
export const tokens = {
  colorText: "#1c1917",
  spaceMd: "16px",
};

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={styles.btn} {...props} />;
}
```

Catalog and cart import `@mfe/ui` (or `import("ui/Button")` if federated) instead of copying button CSS. This repo has neither. Remotes only inherit `body` background and font from `shell.css`.

| Approach | Isolation strength | This repo |
| --- | --- | --- |
| CSS Modules / CSS-in-JS | Strong for class names | Catalog + cart `*.module.css` |
| Shadow DOM | Strongest (full tree) | Not used |
| Prefix convention | Weak (discipline) | Shell chrome only (`.shell-*`) |
| Shared design system | Consistency, not isolation | Not yet |

The rule for this storefront: remotes use CSS Modules (or CSS-in-JS), the shell keeps a small global chrome stylesheet, and anything visual that both remotes need becomes a package or a federated UI remote rather than copied CSS.

## Token-based styling

Token-based styling means named design values (color, space, type) instead of raw hex in every remote. Catalog and cart keep CSS Modules for isolation; they consume the same tokens, so the storefront looks like one product. This repo does not have a tokens package yet. Shell and remotes still hardcode values such as `#78716c` and `#1c1917`. The shape below is how to add it, same workspace pattern as `@mfe/cart-client`.

### Define tokens once

```css
/* packages/ui-tokens/tokens.css — source of truth for the cascade */
:root {
  --color-bg: #f4f5f7;
  --color-text: #1c1917;
  --color-muted: #78716c;
  --color-surface: #1c1917;
  --color-on-surface: #fafaf9;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --font-sans: "Segoe UI", system-ui, sans-serif;
  --text-title: 28px;
  --radius-md: 8px;
}
```

Optional JS/TS mirror for inline styles or charts:

```ts
// packages/ui-tokens/src/tokens.ts
export const tokens = {
  colorText: "var(--color-text)",
  spaceMd: "var(--space-md)",
} as const;
```

### Shell publishes them on the page

Only the shell (or a shared CSS entry each remote imports) should set `:root`. Inside the federated page, one place wins:

```ts
// apps/shell/src/bootstrap.tsx
import "@mfe/ui-tokens/tokens.css";
import "./shell.css";
```

```css
/* shell.css — use tokens, do not re-hardcode */
body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
}

.shell-header {
  background: var(--color-surface);
  color: var(--color-on-surface);
  padding: 14px var(--space-lg);
}
```

### Remotes consume in CSS Modules

Modules still hash class names (isolation). Values come from CSS variables (consistency):

```css
/* CatalogApp.module.css */
.title {
  font-size: var(--text-title);
  letter-spacing: -0.03em;
}

.origin {
  color: var(--color-muted);
  font-size: 12px;
}

.card {
  padding: var(--space-md);
  border-radius: var(--radius-md);
}
```

Cart does the same. Change `--color-muted` once and both remotes pick it up after rebuild or reload. No shared `.title` class, so no clobbering.

### Wire the package

```json
// packages/ui-tokens/package.json
{ "name": "@mfe/ui-tokens", "version": "0.0.1" }
```

Add `"@mfe/ui-tokens": "0.0.1"` to shell, catalog, and cart dependencies, then `npm install` from the repo root.

When a remote runs alone (http://localhost:3001), its `bootstrap.tsx` must also `import "@mfe/ui-tokens/tokens.css"`, or `:root` is empty and `var(--…)` falls back to nothing. Same idea as each app owning its own `BrowserRouter` when standalone.

### Package vs federated design-system remote

| Approach | When |
| --- | --- |
| `@mfe/ui-tokens` package | Tokens (and maybe Button) in the monorepo. Simple; every app rebuilds when tokens change. |
| Federated `ui` remote | Independent deploy of components; shell loads `ui/Button`. Heavier; needs version and contract discipline. |

For tokens only, a package plus CSS variables is the usual fit. Federate components later if teams ship UI on different cadences.

### Themes and production

- Theme switch: toggle a class or attribute on `<html>` (`[data-theme="dark"] { --color-bg: … }`). Remotes already use `var(--…)`, so they follow without knowing about dark mode.
- Do not put tokens in Module Federation `shared` unless you also share the CSS injection story. CSS variables on `:root` are enough.
- Pin one `@mfe/ui-tokens` version the way React is pinned. Two token packages means two design systems again.
- Deploy: changing a token means rebuild apps that import that CSS, or bust CDN cache if the tokens stylesheet is hosted separately.

Rule: Modules (or Shadow DOM) for which classes; tokens for what values.

## Cross-MFE communication

Catalog never imports cart, and cart never imports catalog. Remotes stay loosely coupled. They still need to cooperate. Four common options, plus what this repo actually uses.

### Custom events / event bus

One app fires; others listen. No shared store. Catalog does not know if the shell badge exists.

```ts
// catalog — after a successful add
window.dispatchEvent(
  new CustomEvent("mfe:cart-added", {
    detail: { id: product.id, name: product.name },
  }),
);

// shell — toast or analytics, not the cart lines themselves
window.addEventListener("mfe:cart-added", (event) => {
  const { id } = (event as CustomEvent<{ id: string }>).detail;
  console.info("added", id);
});
```

Use for one-shot signals: item added, user logged out, open a modal. Weak for “what is in the cart right now?” — that needs someone to hold state. A named bus (`bus.emit` / `bus.on`) is the same idea with less stringly typing. This repo does not use events for the cart.

### Shared state via the shell

The host owns a store or React context and passes it into remotes when it mounts them.

```tsx
// shell
const [lines, setLines] = useState<LineItem[]>([]);

<CatalogApp
  lines={lines}
  onAdd={(product) => setLines((prev) => upsert(prev, product))}
/>
<CartApp
  lines={lines}
  onRemove={(id) => setLines((prev) => prev.filter((l) => l.id !== id))}
/>
```

Catalog and cart become presentational. Alone on http://localhost:3001 you must stub the same API. Overused, every remote waits on the host’s shape and deploy. This shell does not pass a store down. It mounts `<CatalogApp />` and `<CartApp />` with no props.

Use sparingly for shell-owned chrome (theme, auth user). Avoid putting the whole domain model in the host.

### URL / query params

The route is the shared contract. No event, no store.

```tsx
// catalog — identity in the path (this repo)
<Link to={product.id} />
<Route path=":productId" element={<ProductDetail />} />

// filters via search (same idea, not in this repo)
<Link to="/catalog?tag=keyboard">Keyboards</Link>
const tag = new URLSearchParams(location.search).get("tag");
```

Use for shareable, refresh-safe state: product id, page, sort, selected tab. Do not put the live cart array in the query string — ugly URLs, size limits, and every change becomes history noise.

### Props / callbacks

When the host mounts a remote it can pass data and handlers. The remote never reaches for `window` or another remote.

```tsx
// shell
<CatalogApp
  currency="USD"
  onAddToCart={(product) => cartApi.add(product)}
/>

// catalog would accept props (current CatalogApp does not)
export function CatalogApp({
  onAddToCart,
}: {
  onAddToCart: (product: Product) => void;
}) {
  return (
    <button type="button" onClick={() => onAddToCart(product)}>
      Add to cart
    </button>
  );
}
```

Use when the shell is the only place that should perform the side effect (auth-gated checkout, analytics wrapper). Catalog alone on http://localhost:3001 needs a no-op or local `onAddToCart` in its own `bootstrap.tsx`. This shell mounts remotes bare.

### What this storefront uses

Not events, not shell context, not props — a window-scoped store in `@mfe/cart-client`:

```ts
window.__MFE_CART__ ??= createStore();

// catalog
addToCart(product);

// cart + shell header
const lines = useCartLines();
```

Catalog writes; cart and the shell badge read. `CartApp` can be unmounted and the data still exists. That is shared global state by contract, not a direct catalog→cart call, and not Module Federation deduping the package. Prefer URL for identity, events for one-shot messages, and a narrow shared store only when several remotes must read and write the same live data while some are unmounted — the cart case here. Heavy shared state across remotes recreates a monolith with worse deploy boundaries.

| Pattern | Good for | This repo |
| --- | --- | --- |
| Events / bus | Fire-and-forget signals | Not used |
| Shell store / context | Host-owned chrome | Not used |
| URL / query | Product id, filters | `/catalog/:productId` |
| Props / callbacks | Host wires side effects | Not used (`<CatalogApp />` bare) |
| Window / shared singleton store | Live cart across remotes | `window.__MFE_CART__` |
