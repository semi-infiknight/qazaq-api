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
        return;
      }

      // Measure how far a bottom-fixed edge sits past the visible viewport.
      // innerHeight math double-counts offsetTop on browsers that already
      // attach position:fixed to the visual viewport, which shoved the ghost
      // prompt into the browser chrome.
      const probe = document.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;pointer-events:none;visibility:hidden;";
      document.body.appendChild(probe);
      const overlap = Math.max(0, probe.getBoundingClientRect().bottom - viewport.height);
      probe.remove();

      const capped = Math.min(Math.round(overlap), 180);
      document.documentElement.style.setProperty("--browser-ui-offset", `${capped}px`);
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
    };
  }, [onHome]);

  useEffect(() => {
    if (!onHome) return undefined;
    const bar = document.querySelector(".catalogue-mobile-bar");
    if (!bar) return undefined;

    const publishDockHeight = () => {
      const height = Math.ceil(bar.getBoundingClientRect().height);
      if (height > 0) {
        document.documentElement.style.setProperty("--catalogue-dock-height", `${height}px`);
      }
    };

    publishDockHeight();
    const observer = new ResizeObserver(publishDockHeight);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--catalogue-dock-height");
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
