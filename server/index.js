import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CATALOGUE_META, KZ_APIS } from "./data/apis.js";
import { sortCatalogueByImpact } from "./lib/catalogueSort.js";
import {
  freshnessReport,
  listCategories,
  publicDetailEntry,
  publicListEntry,
  searchApis,
} from "./lib/search.js";
import { suggestApis, suggestExamples } from "./lib/suggest.js";
import { answerApiQuestion } from "./lib/apiAsk.js";
import { warmLocalLlm } from "./lib/localLlm.js";
import { warmQueryEmbedder } from "./lib/queryEmbedder.js";
import { warmFeatureVectors } from "./lib/featureExtract.js";
import { checkHealth } from "./lib/health.js";
import { openApiToPostman } from "./lib/postman.js";
import { validateDataEgovKey, DATA_EGOV_LINKS } from "./lib/egov.js";
import { proxyRequest, resolveTryRequest } from "./lib/proxy.js";
import {
  buildCatalogIndex,
  buildCategoryCompanies,
  buildCompanyHub,
  buildServiceIndex,
  buildServiceTree,
  categorySlug,
  resolveCompany,
} from "./lib/services.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8787;
const isProd = process.env.NODE_ENV === "production";

const openApiSpec = JSON.parse(fs.readFileSync(path.join(__dirname, "openapi.json"), "utf8"));

function publicBaseUrl(req) {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  const host = req.get("host");
  return host ? `${req.protocol}://${host}` : `http://localhost:${PORT}`;
}

app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.get("/api/catalogue", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 200);
  const offset = Number(req.query.offset) || 0;
  const apis = sortCatalogueByImpact(KZ_APIS).slice(offset, offset + limit).map(publicListEntry);
  res.json({
    ...CATALOGUE_META,
    count: apis.length,
    apis,
  });
});

app.get("/api/search", (req, res) => {
  res.json(searchApis(KZ_APIS, req.query));
});

app.get("/api/suggest", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 24, 48);
    res.json(await suggestApis(KZ_APIS, req.query.q || "", { limit }));
  } catch (err) {
    console.error("[suggest]", err);
    res.status(500).json({ error: "Suggest failed", message: err.message });
  }
});

app.post("/api/suggest", async (req, res) => {
  try {
    const q = req.body?.q || req.body?.query || "";
    const limit = Math.min(Number(req.body?.limit) || 24, 48);
    res.json(await suggestApis(KZ_APIS, q, { limit }));
  } catch (err) {
    console.error("[suggest]", err);
    res.status(500).json({ error: "Suggest failed", message: err.message });
  }
});

app.get("/api/suggest/examples", (_req, res) => {
  res.json({ examples: suggestExamples() });
});

app.get("/api/categories", (_req, res) => {
  res.json({ count: listCategories(KZ_APIS).length, categories: listCategories(KZ_APIS) });
});

app.get("/api/catalog", (_req, res) => {
  res.json({ count: buildCatalogIndex(KZ_APIS).length, categories: buildCatalogIndex(KZ_APIS) });
});

app.get("/api/catalog/:categorySlug", (req, res) => {
  const category = buildCategoryCompanies(KZ_APIS, req.params.categorySlug);
  if (!category) return res.status(404).json({ error: `no category '${req.params.categorySlug}'` });
  res.json(category);
});

app.get("/api/catalog/:categorySlug/:companySlug", (req, res) => {
  const hub = buildCompanyHub(KZ_APIS, req.params.categorySlug, req.params.companySlug);
  if (!hub) {
    return res.status(404).json({ error: `no company '${req.params.companySlug}' in '${req.params.categorySlug}'` });
  }
  res.json(hub);
});

app.get("/api/catalog/:categorySlug/:companySlug/endpoints/:id", (req, res) => {
  const hub = buildCompanyHub(KZ_APIS, req.params.categorySlug, req.params.companySlug);
  if (!hub) {
    return res.status(404).json({ error: `no company '${req.params.companySlug}' in '${req.params.categorySlug}'` });
  }
  const entry = KZ_APIS.find((a) => a.id === req.params.id || a.slug === req.params.id);
  if (!entry || resolveCompany(entry).slug !== req.params.companySlug || categorySlug(entry.category) !== req.params.categorySlug) {
    return res.status(404).json({ error: `endpoint not in hub '${req.params.categorySlug}/${req.params.companySlug}'` });
  }
  res.json({ hub, endpoint: publicListEntry(entry) });
});

app.get("/api/services", (_req, res) => {
  res.json({ count: buildServiceIndex(KZ_APIS).length, services: buildServiceIndex(KZ_APIS) });
});

app.get("/api/services/:slug", (req, res) => {
  const tree = buildServiceTree(KZ_APIS, req.params.slug);
  if (!tree) return res.status(404).json({ error: `no service '${req.params.slug}'` });
  res.json(tree);
});

app.get("/api/services/:slug/endpoints/:id", (req, res) => {
  const tree = buildServiceTree(KZ_APIS, req.params.slug);
  if (!tree) return res.status(404).json({ error: `no service '${req.params.slug}'` });
  const entry = KZ_APIS.find((a) => a.id === req.params.id || a.slug === req.params.id);
  if (!entry || resolveCompany(entry).slug !== req.params.slug) {
    return res.status(404).json({ error: `endpoint not in service '${req.params.slug}'` });
  }
  res.json({ service: tree, endpoint: publicListEntry(entry) });
});

app.get("/api/freshness", (req, res) => {
  const days = Number(req.query.days) || 90;
  res.json(freshnessReport(KZ_APIS, days));
});

app.get("/api/apis/:id", async (req, res) => {
  const entry = KZ_APIS.find((a) => a.id === req.params.id || a.slug === req.params.id);
  if (!entry) return res.status(404).json({ error: `no API with id '${req.params.id}'` });

  const detail = publicDetailEntry(entry);
  detail.health = await checkHealth(entry);
  res.json(detail);
});

app.post("/api/apis/:id/ask", async (req, res) => {
  try {
    const entry = KZ_APIS.find((a) => a.id === req.params.id || a.slug === req.params.id);
    if (!entry) return res.status(404).json({ error: `no API with id '${req.params.id}'` });

    const question = String(req.body?.q || req.body?.question || "").trim();
    if (!question) return res.status(400).json({ error: "question required" });

    const detail = publicDetailEntry(entry);
    const result = await answerApiQuestion(detail, question);
    res.json({ apiId: entry.id, question, ...result });
  } catch (err) {
    console.error("[api/ask]", err);
    res.status(500).json({ error: "Ask failed", message: err.message });
  }
});

app.post("/api/apis/:id/try", async (req, res) => {
  const entry = KZ_APIS.find((a) => a.id === req.params.id || a.slug === req.params.id);
  if (!entry) return res.status(404).json({ error: `no API with id '${req.params.id}'` });

  const resolved = resolveTryRequest(entry, req.body || {});
  if (resolved.error) return res.status(400).json({ error: resolved.error });

  const response = await proxyRequest(resolved.method, resolved.url, resolved.headers, resolved.settings);
  res.json({
    request: {
      method: resolved.method,
      url: resolved.url,
      headers: resolved.headers,
      curl: resolved.curl,
      settings: resolved.settings,
    },
    response,
  });
});

app.options("/api/apis/:id/try", (_req, res) => {
  res.sendStatus(204);
});

app.post("/api/providers/data-egov/validate-key", async (req, res) => {
  const apiKey = req.body?.apiKey;
  const result = await validateDataEgovKey(apiKey);
  if (result.valid) {
    return res.json({ ...result, links: DATA_EGOV_LINKS });
  }
  res.status(400).json({ ...result, links: DATA_EGOV_LINKS });
});

app.options("/api/providers/data-egov/validate-key", (_req, res) => {
  res.sendStatus(204);
});

app.get("/openapi.json", (req, res) => {
  res.json({
    ...openApiSpec,
    info: { ...openApiSpec.info, version: CATALOGUE_META.version },
    servers: [{ url: publicBaseUrl(req), description: isProd ? "Production" : "Current host" }],
  });
});

app.get("/postman.json", (req, res) => {
  const spec = {
    ...openApiSpec,
    info: { ...openApiSpec.info, version: CATALOGUE_META.version },
  };
  const collection = openApiToPostman(spec, publicBaseUrl(req));
  res.setHeader("Content-Disposition", 'attachment; filename="qazaq-stack.postman_collection.json"');
  res.json(collection);
});

app.get("/api-docs", (_req, res) => {
  res.redirect(301, "/api-docs.html");
});

function mcpManifest(req) {
  const base = publicBaseUrl(req).replace(/\/$/, "");
  return {
    name: "qazaq-stack",
    version: "1.0.0",
    description: "Remote MCP server for Qazaq Stack — Kazakhstan integration catalogue (Streamable HTTP).",
    tools: [
      { name: "search_kz_apis", description: "Search Qazaq Stack catalogue" },
      { name: "get_kz_api", description: "Get one API by id" },
      { name: "list_api_categories", description: "List categories with counts" },
    ],
    url: `${base}/mcp`,
  };
}

app.get("/api/mcp", (req, res) => {
  res.json(mcpManifest(req));
});

function sendSpa(res) {
  const distHtml = path.join(__dirname, "..", "dist", "index.html");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return res.sendFile(distHtml);
}

// GET /mcp is always the setup page. JSON lives at GET /api/mcp.
app.get("/mcp", (req, res) => {
  if (req.query.json === "1" || req.query.format === "json") {
    return res.json(mcpManifest(req));
  }
  if (isProd) return sendSpa(res);
  res.redirect(302, "http://localhost:5173/mcp");
});

app.post("/mcp", (_req, res) => {
  res.status(501).json({
    error: "MCP streamable HTTP is not fully implemented yet",
    hint: "Use GET /api/mcp for the tool manifest, or the REST catalogue at /api/search",
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, apis: KZ_APIS.length, updated: CATALOGUE_META.updated });
});

function resolveOgGifPath() {
  const distGif = path.join(__dirname, "..", "dist", "og.gif");
  const publicGif = path.join(__dirname, "..", "public", "og.gif");
  if (isProd && fs.existsSync(distGif)) return distGif;
  if (fs.existsSync(publicGif)) return publicGif;
  return null;
}

/** Open Graph / social preview — animated catalogue loader (not SPA HTML). */
app.get("/og", (req, res) => {
  const gif = resolveOgGifPath();
  if (!gif) {
    res.status(503).type("text/plain").send("OG preview not built yet — run npm run build");
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.type("image/gif");
  res.sendFile(gif);
});

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

if (isProd) {
  const dist = path.join(__dirname, "..", "dist");
  app.use(
    express.static(dist, {
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    }),
  );
  app.get("*", (req, res) => {
    const ext = path.extname(req.path).toLowerCase();
    // Never serve SPA HTML for missing JS/CSS/assets — that breaks module loading
    // when a stale cached index.html still points at /src/main.jsx.
    if (ext && ![".html", ""].includes(ext)) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.use((_req, res) => {
  res.status(404).json({
    error: "not found",
    endpoints: ["/api/catalogue", "/api/search", "/api/suggest", "/api/categories", "/api/apis/:id", "/api/freshness"],
  });
});

app.listen(PORT, () => {
  console.log(`Qazaq Stack server on http://localhost:${PORT} (${KZ_APIS.length} KZ APIs)`);
  warmQueryEmbedder();
  warmFeatureVectors();
  warmLocalLlm();
});
