import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import CatalogApp from "./CatalogApp";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Catalog root element #root is missing");
}

// Standalone only. The shell already owns the history when this app is a remote.
createRoot(root).render(
  <BrowserRouter>
    <CatalogApp />
  </BrowserRouter>,
);
