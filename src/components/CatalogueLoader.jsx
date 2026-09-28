/**
 * Vector catalogue loader — thin SVG arc + stacked request layers (no raster dots).
 */
export default function CatalogueLoader({ size = 96, label }) {
  return (
    <div
      className="qz-loader"
      role="status"
      aria-live="polite"
      aria-label={label || "Loading"}
      style={{ "--qz-size": `${size}px` }}
    >
      <div className="qz-loader-visual" aria-hidden="true">
        <svg className="qz-loader-svg" viewBox="0 0 100 100" focusable="false">
          <circle className="qz-loader-track" cx="50" cy="50" r="42" />
          <circle className="qz-loader-arc" cx="50" cy="50" r="42" />
        </svg>
        <div className="qz-loader-core">
          <span className="qz-loader-layer" style={{ "--qz-i": 0 }} />
          <span className="qz-loader-layer" style={{ "--qz-i": 1 }} />
          <span className="qz-loader-layer" style={{ "--qz-i": 2 }} />
        </div>
      </div>
      {label ? <p className="qz-loader-label">{label}</p> : null}
    </div>
  );
}
