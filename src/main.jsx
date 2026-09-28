import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

try {
  localStorage.removeItem("khazak-intent-view");
} catch {
  // ignore
}

const rootEl = document.getElementById("root");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

requestAnimationFrame(() => {
  requestAnimationFrame(() => rootEl?.classList.add("is-mounted"));
});
