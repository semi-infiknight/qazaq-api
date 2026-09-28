/** Shared chrome for intent result views. */
export default function IntentViewToolbar({ label, meta }) {
  return (
    <div className="intent-view-toolbar">
      <span className="intent-view-toolbar-label">{label}</span>
      {meta ? <span className="intent-view-toolbar-meta">{meta}</span> : null}
    </div>
  );
}
