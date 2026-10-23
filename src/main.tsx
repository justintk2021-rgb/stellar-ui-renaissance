import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const syncTabHidden = () => {
  document.documentElement.classList.toggle("tab-hidden", document.hidden);
};
syncTabHidden();
document.addEventListener("visibilitychange", syncTabHidden);

createRoot(document.getElementById("root")!).render(<App />);
