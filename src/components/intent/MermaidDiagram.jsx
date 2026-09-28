import { useEffect, useId, useRef, useState } from "react";

export default function MermaidDiagram({ chart }) {
  const hostRef = useRef(null);
  const reactId = useId().replace(/:/g, "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    async function renderChart() {
      if (!chart || !hostRef.current) return;
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "dark",
          flowchart: {
            curve: "basis",
            padding: 12,
            nodeSpacing: 28,
            rankSpacing: 40,
            htmlLabels: false,
          },
          themeVariables: {
            darkMode: true,
            background: "transparent",
            primaryColor: "#1a1025",
            primaryTextColor: "#f0ebe3",
            primaryBorderColor: "#c76a3a",
            lineColor: "#8a5c40",
            secondaryColor: "#141018",
            tertiaryColor: "#0d0a10",
            fontFamily: "JetBrains Mono, ui-monospace, monospace",
            fontSize: "13px",
          },
        });

        const id = `stack-${reactId}-${Date.now()}`;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && hostRef.current) {
          hostRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setFailed(true);
      }
    }

    renderChart();
    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (!chart) return null;

  if (failed) {
    return (
      <pre className="intent-prompt-mermaid-fallback">
        <code>{chart}</code>
      </pre>
    );
  }

  return <div ref={hostRef} className="intent-prompt-mermaid" aria-label="Suggested API stack diagram" />;
}
