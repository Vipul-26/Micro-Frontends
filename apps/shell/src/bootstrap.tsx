import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./shell.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Shell root element #root is missing");
}

createRoot(root).render(<App />);
