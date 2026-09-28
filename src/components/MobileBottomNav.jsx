import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import IntentInputBar from "./IntentInputBar.jsx";
import { INTENT_PROMPT_LINES } from "../data/intentPromptHints.js";
import { useCatalogueNav } from "../context/CatalogueNavContext.jsx";

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const { catalogue } = useCatalogueNav();
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!onHome) return undefined;
    document.body.classList.add("catalogue-mobile-nav-active");
    return () => {
      document.body.classList.remove("catalogue-mobile-nav-active");
    };
  }, [onHome]);

  useEffect(() => {
    if (!onHome) return undefined;
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const syncBrowserChrome = () => {
      if (!viewport.height) {
        document.documentElement.style.setProperty("--browser-ui-offset", "0px");
        document.documentElement.style.setProperty("--viewport-offset-top", "0px");
        return;
      }

      const chrome = Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height);
      const capped = Math.min(chrome, 120);
      document.documentElement.style.setProperty("--browser-ui-offset", `${capped}px`);
      document.documentElement.style.setProperty("--viewport-offset-top", `${viewport.offsetTop}px`);
    };

    syncBrowserChrome();
    viewport.addEventListener("resize", syncBrowserChrome);
    viewport.addEventListener("scroll", syncBrowserChrome);
    window.addEventListener("orientationchange", syncBrowserChrome);

    return () => {
      viewport.removeEventListener("resize", syncBrowserChrome);
      viewport.removeEventListener("scroll", syncBrowserChrome);
      window.removeEventListener("orientationchange", syncBrowserChrome);
      document.documentElement.style.removeProperty("--browser-ui-offset");
      document.documentElement.style.removeProperty("--viewport-offset-top");
    };
  }, [onHome]);

  if (!onHome) return null;

  const nav = (
    <div className="catalogue-mobile-nav" aria-hidden={false}>
      <nav className="catalogue-mobile-bar catalogue-mobile-bar--search-open" aria-label="Mobile prompt">
        <div className="catalogue-mobile-search-slot catalogue-mobile-search-slot--open">
          <div className="catalogue-mobile-search-field">
            <IntentInputBar
              variant="inline"
              inputRef={searchInputRef}
              value={catalogue?.query || ""}
              onChange={(next) => catalogue?.onQueryChange?.(next)}
              onSubmit={() => catalogue?.onIntentSubmit?.()}
              submitting={catalogue?.intentSubmitting}
              hintLines={INTENT_PROMPT_LINES}
              placeholder="Describe the Kazakhstan app you want to build…"
            />
          </div>
        </div>
      </nav>
    </div>
  );

  return createPortal(nav, document.body);
}
