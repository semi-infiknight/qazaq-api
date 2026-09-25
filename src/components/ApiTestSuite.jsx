import { useEffect, useMemo, useState } from "react";
import { tryApi } from "../lib/api.js";
import { getProviderIdForApi, getProviderKey } from "../lib/providerKeys.js";
import ResponseViewer from "./ResponseViewer.jsx";

const LANGUAGES = [
  { id: "curl", label: "cURL" },
  { id: "js", label: "JavaScript" },
  { id: "python", label: "Python" },
];

function buildPreviewUrl(spec, params, apiKey) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    let v = String(value);
    if (v.includes("YOUR_KEY") && apiKey) v = v.replace(/YOUR_KEY/g, apiKey);
    qs.set(key, v);
  }
  const base = spec?.baseUrl || "";
  const path = spec?.path || "";
  let url = `${base}${path}${qs.toString() ? `?${qs.toString()}` : ""}`;
  if (apiKey) url = url.replace(/YOUR_KEY/g, apiKey);
  return url;
}

function ParamRow({ param, value, onChange }) {
  return (
    <tr>
      <td className="http-col-check">
        <input type="checkbox" checked readOnly aria-label={`Use ${param.name}`} />
      </td>
      <td className="http-param-key">
        {param.name}
        {param.required && <span className="http-required">*</span>}
      </td>
      <td>
        <input
          type={param.sensitive ? "password" : "text"}
          autoComplete="off"
          placeholder={param.example || ""}
          className="http-input"
          value={value ?? ""}
          onChange={(e) => onChange(param.name, e.target.value)}
        />
      </td>
      <td className="http-param-desc">{param.description}</td>
    </tr>
  );
}

function HeaderEditor({ headers, onChange }) {
  const [pairs, setPairs] = useState(
    Object.entries(headers).map(([key, value]) => ({ key, value }))
  );

  const sync = (next) => {
    setPairs(next);
    const obj = {};
    next.forEach((p) => { if (p.key.trim()) obj[p.key] = p.value; });
    onChange(obj);
  };

  return (
    <div className="http-headers-editor">
      {pairs.map((pair, i) => (
        <div key={i} className="http-header-row">
          <input
            type="text"
            placeholder="header name"
            className="http-input http-input-key"
            value={pair.key}
            onChange={(e) => sync(pairs.map((p, j) => j === i ? { ...p, key: e.target.value } : p))}
          />
          <input
            type="text"
            placeholder="value"
            className="http-input http-input-val"
            value={pair.value}
            onChange={(e) => sync(pairs.map((p, j) => j === i ? { ...p, value: e.target.value } : p))}
          />
          <button
            type="button"
            className="http-header-remove"
            onClick={() => sync(pairs.filter((_, j) => j !== i))}
            aria-label="Remove header"
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="http-header-add" onClick={() => sync([...pairs, { key: "", value: "" }])}>
        + Add header
      </button>
    </div>
  );
}

function BodyEditor({ body, onChange }) {
  return (
    <div className="http-body-editor">
      <textarea
        className="http-body-textarea"
        placeholder='{ "key": "value" }'
        value={body}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        spellCheck={false}
      />
    </div>
  );
}

function CodeSnippet({ api, url, method, params, headers, apiKey }) {
  const snippets = useMemo(() => {
    const map = {};
    if (api.curl) map.curl = api.curl;
    if (api.js) map.js = api.js;
    if (api.python) map.python = api.python;
    return map;
  }, [api]);

  const options = useMemo(() => LANGUAGES.filter((l) => snippets[l.id]), [snippets]);
  const [lang, setLang] = useState(options[0]?.id || "curl");
  const [copied, setCopied] = useState(false);

  useEffect(() => { setLang(options[0]?.id || "curl"); }, [api.id, options]);

  const active = options.find((o) => o.id === lang) || options[0];
  const code = active ? snippets[active.id] : "";

  if (!options.length) return <p className="http-empty-note">No code snippets available.</p>;

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="http-code-panel">
      <div className="http-code-toolbar">
        <select className="snippet-select" value={active?.id || lang} onChange={(e) => setLang(e.target.value)}>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button type="button" className="http-btn-ghost" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre className="snippet-code"><code>{code}</code></pre>
    </div>
  );
}

export default function ApiTestSuite({ api }) {
  const spec = api.trySpec;
  const defaults = spec?.defaults?.params || {};
  const defaultHeaders = spec?.defaults?.headers || { Accept: "application/json, text/plain, */*" };
  const isPostBody = ["POST", "PUT", "PATCH"].includes(spec?.method?.toUpperCase());

  const [params, setParams] = useState(defaults);
  const [headers, setHeaders] = useState(defaultHeaders);
  const [body, setBody] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [reqTab, setReqTab] = useState("params");

  const providerId = useMemo(() => getProviderIdForApi(api), [api]);

  useEffect(() => {
    setParams(spec?.defaults?.params || {});
    setHeaders(spec?.defaults?.headers || { Accept: "application/json, text/plain, */*" });
    setBody("");
    setApiKey(providerId ? getProviderKey(providerId) : "");
    setResult(null);
    setError(null);
    setReqTab("params");
  }, [api.id, spec, api, providerId]);

  useEffect(() => {
    if (!providerId) return;
    const syncKey = () => setApiKey(getProviderKey(providerId));
    window.addEventListener("khazak:provider-key", syncKey);
    return () => window.removeEventListener("khazak:provider-key", syncKey);
  }, [providerId]);

  const showKeyField = useMemo(() => {
    if (!api.endpoint) return false;
    return spec?.auth?.required || api.endpoint.includes("YOUR_KEY");
  }, [api, spec]);

  const previewUrl = useMemo(() => buildPreviewUrl(spec, params, apiKey), [spec, params, apiKey]);

  if (!spec?.available) {
    return (
      <div className="api-suite panel">
        <div className="api-suite-unavailable">
          <span className="api-suite-unavailable-method">{spec?.method || "GET"}</span>
          <span className="api-suite-unavailable-text">{spec?.reason || "Testing is not available for this entry."}</span>
        </div>
      </div>
    );
  }

  const send = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const outboundHeaders = { ...headers };
      if (apiKey && spec.auth?.placement?.includes("Authorization")) {
        outboundHeaders.Authorization = `Bearer ${apiKey}`;
      } else if (apiKey && (spec.auth?.type === "bearer" || api.auth === "token" || api.auth === "oauth")) {
        outboundHeaders.Authorization = `Bearer ${apiKey}`;
      }
      const data = await tryApi(api.id, {
        params,
        headers: outboundHeaders,
        apiKey: apiKey || undefined,
        body: isPostBody ? body : undefined,
      });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setParams(defaults);
    setHeaders(defaultHeaders);
    setBody("");
    setApiKey(providerId ? getProviderKey(providerId) : "");
    setResult(null);
    setError(null);
  };

  const requestTabs = [
    { id: "params", label: "Params", count: spec.parameters?.length || 0 },
    ...(showKeyField ? [{ id: "auth", label: "Auth" }] : []),
    { id: "headers", label: "Headers" },
    ...(isPostBody ? [{ id: "body", label: "Body" }] : []),
    { id: "code", label: "Code" },
  ];

  return (
    <div className="api-suite panel">
      {/* Suite header */}
      <div className="api-suite-header">
        <div className="api-suite-header-meta">
          <span className="api-suite-section-label">Endpoint</span>
          <span className="api-suite-header-path">{spec.path || api.endpoint || "—"}</span>
        </div>
        {api.docs && (
          <a href={api.docs} target="_blank" rel="noopener noreferrer" className="http-btn-ghost">
            Provider docs ↗
          </a>
        )}
      </div>

      <p className="api-suite-honesty-note">
        Live try sends <strong>GET</strong> through Qazaq Stack (query params + API key).{" "}
        <code>Authorization</code> and <code>X-API-Key</code> headers forward when you set them.
        POST, OAuth, and full provider flows use the docs or Code tab.
      </p>

      {/* Request bar */}
      <div className="api-suite-request-bar">
        <span className={`http-method http-method-${spec.method.toLowerCase()}`}>{spec.method}</span>
        <input type="text" readOnly value={previewUrl} className="http-url-input" aria-label="Request URL" />
        <button type="button" className="http-send-btn" onClick={send} disabled={loading}>
          {loading ? "Sending…" : "Send"}
        </button>
        <button type="button" className="http-btn-ghost" onClick={reset} disabled={loading}>Reset</button>
      </div>

      {/* Notes + error */}
      {spec.notes?.length > 0 && (
        <ul className="http-notes">
          {spec.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
      {error && <p className="http-error">{error}</p>}

      {/* Side-by-side request / response panes */}
      <div className="api-suite-panes">
        <div className="api-suite-pane api-suite-pane--request">
          <div className="http-tabs">
            {requestTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`http-tab ${reqTab === tab.id ? "http-tab-active" : ""}`}
                onClick={() => setReqTab(tab.id)}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 && <span className="http-tab-count">{tab.count}</span>}
              </button>
            ))}
          </div>
          <div className="api-suite-request-panel">
            {reqTab === "params" && (
              spec.parameters?.length ? (
                <div className="http-table-wrap">
                  <table className="http-table">
                    <thead>
                      <tr>
                        <th className="http-col-check">✓</th>
                        <th>Key</th>
                        <th>Value</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spec.parameters.map((param) => (
                        <ParamRow
                          key={param.name}
                          param={param}
                          value={params[param.name]}
                          onChange={(name, value) => setParams((prev) => ({ ...prev, [name]: value }))}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="http-empty-note">No query parameters for this endpoint.</p>
            )}

            {reqTab === "auth" && (
              <div className="http-auth-panel">
                <div className="http-auth-type-row">
                  <span className="http-auth-badge">{spec.auth.scheme || api.auth}</span>
                  <span className="http-auth-label">{spec.auth.label}</span>
                  {spec.auth.placement && <span className="http-auth-placement">{spec.auth.placement}</span>}
                </div>
                {providerId && !apiKey && (
                  <p className="http-auth-hint">
                    No saved key —{" "}
                    <a href={`/keys?provider=${encodeURIComponent(providerId)}`} className="text-[var(--accent)] underline">add it in Keys</a>{" "}
                    to auto-fill live testing.
                  </p>
                )}
                <label className="http-field">
                  <span className="http-field-label">{spec.auth.type === "bearer" ? "Bearer token" : "API key"}</span>
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={api.endpoint?.includes("YOUR_KEY") ? "Replaces YOUR_KEY in query params" : "Required to call this API"}
                    className="http-input http-input-wide"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </label>
                {spec.auth.docs && (
                  <a href={spec.auth.docs} target="_blank" rel="noopener noreferrer" className="http-link">Provider auth docs ↗</a>
                )}
              </div>
            )}

            {reqTab === "headers" && (
              <HeaderEditor headers={headers} onChange={setHeaders} />
            )}

            {reqTab === "body" && (
              <BodyEditor body={body} onChange={setBody} />
            )}

            {reqTab === "code" && (
              <CodeSnippet api={api} url={previewUrl} method={spec.method} params={params} headers={headers} apiKey={apiKey} />
            )}
          </div>
        </div>

        <div className="api-suite-pane api-suite-pane--response">
          <ResponseViewer response={result?.response} request={result?.request} loading={loading && !result} />
        </div>
      </div>
    </div>
  );
}
