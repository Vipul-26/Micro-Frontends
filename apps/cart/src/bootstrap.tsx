import { createRoot } from "react-dom/client";
import CartApp from "./CartApp";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Cart root element #root is missing");
}

createRoot(root).render(<CartApp />);
