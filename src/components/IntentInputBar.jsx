import { useEffect, useRef } from "react";
import { useTypewriterCycle } from "../hooks/useTypewriterCycle.js";

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 13.5V2.5M8 2.5 4 6.5M8 2.5l4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function resizeField(node) {
  if (!node) return;
  node.style.height = "0";
  node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
}

export default function IntentInputBar({
  value,
  onChange,
  onSubmit,
  submitting = false,
  placeholder = "Send a message…",
  hintLines = null,
  variant = "default",
  inputRef,
}) {
  const fieldRef = useRef(null);
  const inline = variant === "inline";
  const hero = variant === "hero";
  const hasValue = Boolean(value.trim());
  const showGhost = Boolean(hintLines?.length) && !hasValue && !submitting;
  const { text: ghostText, currentLine: ghostPrompt } = useTypewriterCycle(hintLines, { active: showGhost });

  useEffect(() => {
    resizeField(fieldRef.current);
  }, [value]);

  const setFieldRef = (node) => {
    fieldRef.current = node;
    if (!inputRef) return;
    if (typeof inputRef === "function") inputRef(node);
    else inputRef.current = node;
  };

  const submit = (event) => {
    event.preventDefault();
    if (!value.trim() || submitting) return;
    onSubmit();
  };

  const acceptGhost = () => {
    if (!showGhost || !ghostPrompt) return;
    onChange(ghostPrompt);
  };

  return (
    <form
      className={[
        "ai-input",
        inline && "ai-input-inline",
        hero && "ai-input-hero",
        hasValue && "ai-input-has-value",
        submitting && "ai-input-submitting",
        showGhost && "ai-input-ghosting",
      ]
        .filter(Boolean)
        .join(" ")}
      onSubmit={submit}
    >
      <div className="ai-input-shell">
        {showGhost ? (
          <span className="ai-input-ghost" aria-hidden="true">
            <span className="ai-input-ghost-text">
              {ghostText}
              <span className="ai-input-ghost-caret" />
            </span>
          </span>
        ) : null}
        <textarea
          ref={setFieldRef}
          className="ai-input-field"
          rows={1}
          value={value}
          placeholder={showGhost ? "" : placeholder}
          aria-label="Describe your app or features"
          disabled={submitting}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Tab" && showGhost && ghostPrompt && !event.shiftKey) {
              event.preventDefault();
              acceptGhost();
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (value.trim() && !submitting) onSubmit();
            }
          }}
        />
        <div className="ai-input-actions">
          {showGhost && ghostPrompt ? (
            <button
              type="button"
              className="ai-input-tab-hint"
              onClick={acceptGhost}
              aria-label="Use example prompt (Tab)"
              title="Use example prompt (Tab)"
            >
              <kbd className="ai-input-tab-key" aria-hidden="true">
                <span className="ai-input-tab-key-wing" />
                <span className="ai-input-tab-key-label">Tab</span>
              </kbd>
            </button>
          ) : null}
          <button
            type="submit"
            className="ai-input-send"
            disabled={!hasValue || submitting}
            aria-label={submitting ? "Finding APIs" : "Send"}
          >
            <span className="ai-input-send-mark" aria-hidden="true">
              <span className="ai-input-send-icon">
                <SendIcon />
              </span>
              <span className="ai-input-send-busy" />
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
