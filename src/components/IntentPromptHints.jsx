// Unused: example prompt cards removed from homepage; prompts cycle as ghost text in IntentInputBar (Tab to accept).
/*
export default function IntentPromptHints({ hints, onSelect }) {
  return (
    <div className="intent-hints">
      <p className="intent-hints-label">Example prompts</p>
      <div className="intent-hints-grid">
        {hints.map((hint) => (
          <button
            key={hint.title}
            type="button"
            className="intent-hint-card"
            onClick={() => onSelect(hint)}
          >
            <span className="intent-hint-title">{hint.title}</span>
            <span className="intent-hint-desc">{hint.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
*/
export default function IntentPromptHints() {
  return null;
}
