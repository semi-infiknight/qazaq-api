const NODE_META = {
  start: { label: "Start", icon: "▶", tone: "start" },
  feature: { label: "Feature", icon: "◆", tone: "feature" },
  logic: { label: "Logic", icon: "⎇", tone: "logic" },
};

function FlowField({ label, value, badge, badgeTone = "neutral" }) {
  return (
    <div className="intent-flows-field">
      <span className="intent-flows-field-label">{label}</span>
      <div className="intent-flows-field-value">
        {badge ? (
          <span className={`intent-flows-field-badge intent-flows-field-badge--${badgeTone}`}>{badge}</span>
        ) : null}
        <span className="intent-flows-field-text">{value}</span>
      </div>
    </div>
  );
}

export default function PostmanFlowNode({
  type = "feature",
  title,
  subtitle,
  fields = [],
  nodeRef,
  stepIndex,
}) {
  const meta = NODE_META[type] || NODE_META.feature;
  const kindLabel = stepIndex != null ? `${meta.label} ${stepIndex}` : meta.label;

  return (
    <article
      ref={nodeRef}
      className={`intent-flows-node intent-flows-node--${meta.tone}${fields.length ? "" : " intent-flows-node--compact"}`}
      aria-label={title}
    >
      <header className="intent-flows-node-head">
        <span className="intent-flows-node-icon" aria-hidden="true">
          {meta.icon}
        </span>
        <div className="intent-flows-node-head-copy">
          <span className="intent-flows-node-kind">{kindLabel}</span>
          <strong className="intent-flows-node-title">{title}</strong>
          {subtitle ? <span className="intent-flows-node-subtitle">{subtitle}</span> : null}
        </div>
      </header>

      {fields.length > 0 ? (
        <div className="intent-flows-node-body">
          {fields.map((field) => (
            <FlowField key={field.label} {...field} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
