import { useEffect, useMemo, useState } from "react";
import { buildPostmanCollection, downloadJson, postmanImportUrl } from "../lib/externalApiTools.js";

const LANGUAGES = [
  { id: "curl", label: "cURL" },
  { id: "js", label: "JavaScript" },
  { id: "python", label: "Python" },
];

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" className="http-btn-ghost" onClick={copy}>
      {copied ? "Copied" : label}
    </button>
  );
}

export function OverviewPanel({ api, spec, previewUrl, headers, apiKey }) {
  const description =
    api.note ||
    api.description ||
    api.setup?.summary ||
    api.trust?.label ||
    "";
  const catalogueLine = [
    api.provider,
    api.category,
    api.companyName && api.companyName !== api.provider ? api.companyName : null,
    api.source,
  ]
    .filter(Boolean)
    .join(" · ");
  const snippets = useMemo(() => {
    const map = {};
    if (api.curl) map.curl = api.curl;
    if (api.js) map.js = api.js;
    if (api.python) map.python = api.python;
    return map;
  }, [api]);

  const langOptions = LANGUAGES.filter((l) => snippets[l.id]);
  const [lang, setLang] = useState(langOptions[0]?.id || "curl");
  const activeLang = langOptions.find((o) => o.id === lang) || langOptions[0];
  const code = activeLang ? snippets[activeLang.id] : "";

  useEffect(() => {
    const first = LANGUAGES.find((l) => snippets[l.id]);
    setLang(first?.id || "curl");
  }, [api.id, snippets]);

  const exportPostman = () => {
    const collection = buildPostmanCollection(api, spec, previewUrl, headers);
    downloadJson(`${api.slug || api.id}.postman_collection.json`, collection);
  };

  const importFullCollection = postmanImportUrl(
    `${window.location.origin}/postman.json`
  );

  return (
    <div className="http-overview-panel">
      {/* Title + docs link — Postman style */}
      <div className="http-overview-hero">
        <div className="http-overview-hero-text">
          <h3 className="http-overview-title">{api.title}</h3>
          {api.docs && (
            <a href={api.docs} target="_blank" rel="noopener noreferrer" className="http-overview-docs-link">
              View complete documentation ↗
            </a>
          )}
        </div>
        <div className="http-overview-tools">
          <button type="button" className="http-btn-ghost" onClick={exportPostman}>
            Export to Postman
          </button>
          <a
            href={importFullCollection}
            target="_blank"
            rel="noopener noreferrer"
            className="http-btn-ghost http-btn-link"
          >
            Import full catalogue
          </a>
        </div>
      </div>

      {/* URL */}
      <div className="http-overview-section">
        <code className="http-overview-url">
          {spec.method} {previewUrl || `${spec.baseUrl || ""}${spec.path || ""}`}
        </code>
      </div>

      {catalogueLine && (
        <p className="http-overview-catalogue-line">{catalogueLine}</p>
      )}

      {/* Description */}
      {description && (
        <div className="http-overview-section">
          <p className="http-overview-desc">{description}</p>
        </div>
      )}

      {/* Metadata chips */}
      <div className="http-overview-meta-row">
        {api.tier && <span className="http-overview-chip">{api.tier}</span>}
        {api.pricing && <span className="http-overview-chip">{api.pricing}</span>}
        {api.auth && <span className="http-overview-chip">{api.auth}</span>}
        {api.coverage && <span className="http-overview-chip">{api.coverage}</span>}
        {api.freshness?.label && <span className="http-overview-chip">{api.freshness.label}</span>}
        {(api.country || []).map((c) => (
          <span key={c} className="http-overview-chip">{c}</span>
        ))}
        {api.frequency && <span className="http-overview-chip">{api.frequency}</span>}
        {api.kind && <span className="http-overview-chip">{api.kind}</span>}
      </div>

      {spec.notes?.length > 0 && (
        <div className="http-overview-section">
          <h4 className="http-overview-subtitle">Catalogue notes</h4>
          <ul className="http-overview-list">
            {spec.notes.map((note) => (
              <li key={note} className="http-overview-trust-meta">{note}</li>
            ))}
          </ul>
        </div>
      )}

      {api.setup?.sections?.length > 0 && (
        <div className="http-overview-section">
          <div className="http-overview-section-head">
            <h4 className="http-overview-subtitle">
              {api.setup.label ? api.setup.label.replace(/_/g, " ") : "Getting started"}
            </h4>
            {(api.setup.portalUrl || api.setup.registerUrl) && (
              <div className="http-overview-tools http-overview-tools-inline">
                {api.setup.registerUrl && (
                  <a
                    href={api.setup.registerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="http-btn-ghost http-btn-link"
                  >
                    Register ↗
                  </a>
                )}
                {api.setup.portalUrl && api.setup.portalUrl !== api.setup.registerUrl && (
                  <a
                    href={api.setup.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="http-btn-ghost http-btn-link"
                  >
                    Developer portal ↗
                  </a>
                )}
              </div>
            )}
          </div>
          {api.setup.sections.map((section) => (
            <div key={section.title} className="http-overview-setup-block">
              <p className="http-overview-setup-title">{section.title}</p>
              <ul className="http-overview-list">
                {(section.items || []).map((item) => (
                  <li key={item} className="http-overview-desc">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Authorization — Postman style */}
      {spec.auth && (
        <div className="http-overview-section">
          <h4 className="http-overview-subtitle">Authorization</h4>
          <div className="http-overview-auth-grid">
            <div>
              <p className="http-overview-auth-type">{spec.auth.scheme || spec.auth.type || api.auth}</p>
              <p className="http-overview-trust-meta">{spec.auth.label}</p>
              {spec.auth.placement && (
                <p className="http-overview-trust-meta">Placement: {spec.auth.placement}</p>
              )}
            </div>
            <div>
              {api.authDetails?.credential && (
                <p className="http-overview-desc">{api.authDetails.credential}</p>
              )}
              {apiKey ? (
                <p className="http-overview-trust-meta">Key configured for live testing</p>
              ) : spec.auth.required ? (
                <p className="http-overview-caveat">API key required — add in Keys or Authorization tab</p>
              ) : null}
              {spec.auth.docs && (
                <a href={spec.auth.docs} target="_blank" rel="noopener noreferrer" className="http-link">
                  Auth docs ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Code snippet — Postman shows this in Overview */}
      {langOptions.length > 0 && (
        <div className="http-overview-section">
          <div className="http-overview-section-head">
            <h4 className="http-overview-subtitle">Code snippet</h4>
            <div className="http-code-toolbar">
              <select
                className="snippet-select"
                value={activeLang?.id || lang}
                onChange={(e) => setLang(e.target.value)}
              >
                {langOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <CopyButton text={code} />
            </div>
          </div>
          <pre className="snippet-code http-overview-code"><code>{code}</code></pre>
        </div>
      )}

      {/* Headers summary */}
      {spec.headers?.length > 0 && (
        <div className="http-overview-section">
          <h4 className="http-overview-subtitle">Default headers</h4>
          <div className="http-table-wrap">
            <table className="http-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {spec.headers.map((h) => (
                  <tr key={h.name}>
                    <td>{h.name}</td>
                    <td>{h.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Parameters summary */}
      {spec.parameters?.length > 0 && (
        <div className="http-overview-section">
          <h4 className="http-overview-subtitle">Query parameters</h4>
          <div className="http-table-wrap">
            <table className="http-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Description</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                {spec.parameters.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}{p.sensitive && " 🔒"}</td>
                    <td>{p.description}</td>
                    <td>{p.required ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trust + health */}
      {api.trust && (
        <div className="http-overview-section">
          <h4 className="http-overview-subtitle">Trust</h4>
          <p className="http-overview-trust">{api.trust.label}</p>
          <p className="http-overview-trust-meta">Source: {api.trust.source}</p>
          {api.trust.sourceUrl && (
            <a href={api.trust.sourceUrl} target="_blank" rel="noopener noreferrer" className="http-link">
              Official source ↗
            </a>
          )}
          {api.trust.caveat && <p className="http-overview-caveat">{api.trust.caveat}</p>}
        </div>
      )}

      {api.health && !api.health.skipped && (
        <div className="http-overview-section">
          <h4 className="http-overview-subtitle">Health</h4>
          <p className="http-overview-trust">
            <span
              className={
                api.health.tone === "live"
                  ? "text-[var(--green)]"
                  : api.health.tone === "reachable"
                    ? "text-[var(--amber)]"
                    : "text-[var(--red)]"
              }
            >
              {api.health.label || (api.health.ok ? "OK" : "FAIL")}
            </span>
            <span className="http-overview-trust-meta"> · HTTP {api.health.status} · {api.health.ms}ms</span>
          </p>
          {api.health.reason && <p className="http-overview-trust-meta">{api.health.reason}</p>}
        </div>
      )}

      {/* External tools note */}
      <div className="http-overview-section http-overview-external">
        <h4 className="http-overview-subtitle">Use in external clients</h4>
        <p className="http-overview-trust-meta">
          Postman and Insomnia cannot be embedded here — they block iframe embedding.
          Export this request as a Postman collection (works in Insomnia and Bruno too),
          or import the full Qazaq Stack catalogue from <a href="/postman.json" className="http-link">/postman.json</a>.
        </p>
        <div className="http-overview-tools http-overview-tools-inline">
          <button type="button" className="http-btn-ghost" onClick={exportPostman}>
            Download .postman_collection.json
          </button>
          <CopyButton text={code || api.curl || previewUrl} label="Copy cURL" />
        </div>
      </div>
    </div>
  );
}

export function ScriptsPanel({ preRequest, postResponse, onChange }) {
  const [active, setActive] = useState("pre");

  return (
    <div className="http-scripts-panel">
      <div className="http-segment" role="tablist" aria-label="Script type">
        <button
          type="button"
          className={`http-segment-btn ${active === "pre" ? "http-segment-btn-active" : ""}`}
          onClick={() => setActive("pre")}
        >
          Pre-request
        </button>
        <button
          type="button"
          className={`http-segment-btn ${active === "post" ? "http-segment-btn-active" : ""}`}
          onClick={() => setActive("post")}
        >
          Post-response
        </button>
      </div>

      {active === "pre" && (
        <label className="http-field http-field-full">
          <span className="http-field-label">Pre-request script</span>
          <textarea
            className="http-body-textarea http-script-textarea"
            placeholder="// pm.request.headers.add({ key: 'X-Custom', value: 'value' });"
            value={preRequest}
            onChange={(e) => onChange("preRequest", e.target.value)}
            rows={10}
            spellCheck={false}
          />
        </label>
      )}

      {active === "post" && (
        <label className="http-field http-field-full">
          <span className="http-field-label">Post-response script / Tests</span>
          <textarea
            className="http-body-textarea http-script-textarea"
            placeholder="// pm.test('status is 200', () => pm.response.to.have.status(200));"
            value={postResponse}
            onChange={(e) => onChange("postResponse", e.target.value)}
            rows={10}
            spellCheck={false}
          />
        </label>
      )}

      <p className="http-script-note">
        Scripts are stored with the request but not executed in the browser sandbox yet.
      </p>
    </div>
  );
}

export function SettingsPanel({ settings, onChange }) {
  const toggle = (key) => onChange({ ...settings, [key]: !settings[key] });
  const setNum = (key, value) => {
    const n = parseInt(value, 10);
    onChange({ ...settings, [key]: Number.isNaN(n) ? "" : n });
  };

  return (
    <div className="http-settings-panel">
      <div className="http-setting-row">
        <div className="http-setting-info">
          <span className="http-setting-label">Follow redirects</span>
          <span className="http-setting-desc">Follow HTTP 3xx responses as redirects.</span>
        </div>
        <button
          type="button"
          className={`http-toggle ${settings.followRedirects ? "http-toggle-on" : ""}`}
          onClick={() => toggle("followRedirects")}
          aria-pressed={settings.followRedirects}
        >
          <span className="http-toggle-knob" />
        </button>
      </div>

      <div className="http-setting-row">
        <div className="http-setting-info">
          <span className="http-setting-label">SSL certificate verification</span>
          <span className="http-setting-desc">Verify SSL certificates when sending a request.</span>
        </div>
        <button
          type="button"
          className={`http-toggle ${settings.sslVerification ? "http-toggle-on" : ""}`}
          onClick={() => toggle("sslVerification")}
          aria-pressed={settings.sslVerification}
        >
          <span className="http-toggle-knob" />
        </button>
      </div>

      <div className="http-setting-row">
        <div className="http-setting-info">
          <span className="http-setting-label">Encode URL automatically</span>
          <span className="http-setting-desc">Encode the URL path, query parameters, and auth fields.</span>
        </div>
        <button
          type="button"
          className={`http-toggle ${settings.encodeUrl ? "http-toggle-on" : ""}`}
          onClick={() => toggle("encodeUrl")}
          aria-pressed={settings.encodeUrl}
        >
          <span className="http-toggle-knob" />
        </button>
      </div>

      <div className="http-setting-row">
        <div className="http-setting-info">
          <span className="http-setting-label">Disable cookie jar</span>
          <span className="http-setting-desc">Prevent cookies from being stored or sent with this request.</span>
        </div>
        <button
          type="button"
          className={`http-toggle ${settings.disableCookieJar ? "http-toggle-on" : ""}`}
          onClick={() => toggle("disableCookieJar")}
          aria-pressed={settings.disableCookieJar}
        >
          <span className="http-toggle-knob" />
        </button>
      </div>

      <div className="http-setting-row http-setting-row-inline">
        <label className="http-setting-info">
          <span className="http-setting-label">Request timeout</span>
          <span className="http-setting-desc">Milliseconds to wait before aborting the request.</span>
        </label>
        <input
          type="number"
          className="http-input http-input-timeout"
          value={settings.timeout}
          onChange={(e) => setNum("timeout", e.target.value)}
          min={1000}
          max={60000}
          step={1000}
        />
      </div>
    </div>
  );
}

export function CookiesPanel({ requestUrl }) {
  return (
    <div className="http-cookies-panel">
      <p className="http-empty-note">Cookie jar management is not enabled for this request.</p>
      {requestUrl && (
        <p className="http-cookies-domain">
          Domain: <code>{new URL(requestUrl).host}</code>
        </p>
      )}
    </div>
  );
}
