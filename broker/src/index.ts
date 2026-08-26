import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { askRouter } from "./routes/ask.js";
import { journeyRouter } from "./routes/journey.js";
import { agentsRouter } from "./routes/agents.js";
import { accessControlRouter } from "./routes/accessControl.js";
import { policyRouter } from "./routes/policy.js";
import { auditRecordRouter } from "./routes/auditRecord.js";
import { controlsRouter } from "./routes/controls.js";
import { environmentRouter } from "./routes/environment.js";
import { maintenanceRouter } from "./routes/maintenance.js";
import { observabilityRouter } from "./routes/observability.js";
import { runsRouter } from "./routes/runs.js";

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.use("/api", askRouter);
app.use("/api", journeyRouter);
app.use("/api", agentsRouter);
app.use("/api", accessControlRouter);
app.use("/api", policyRouter);
app.use("/api", auditRecordRouter);
app.use("/api", controlsRouter);
app.use("/api", environmentRouter);
app.use("/api", maintenanceRouter);
app.use("/api", observabilityRouter);
app.use("/api", runsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------- FRONTEND
//
// Optional single-origin mode: when a built demo-app is present, this process
// serves it too. Registered *after* every /api router, so an API path can
// never be shadowed by a file, and the fallback below explicitly excludes
// /api so a mistyped endpoint still returns JSON 404 handling rather than
// index.html.
//
// The console has no client-side router today (no react-router; App.tsx
// switches on state), so the fallback is only insurance for a deep link or a
// refresh — it costs nothing and prevents a blank page if that changes.
const resolvedPublicDir = config.publicDir
  ? path.resolve(config.publicDir)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

if (fs.existsSync(path.join(resolvedPublicDir, "index.html"))) {
  const indexHtml = path.join(resolvedPublicDir, "index.html");
  app.use(express.static(resolvedPublicDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(indexHtml);
  });
  // eslint-disable-next-line no-console
  console.log(`Serving the console from ${resolvedPublicDir}`);
}

// Centralised error handling so a failed Azure call returns a clean 5xx
// instead of crashing the process — every route above is async and lets
// exceptions propagate here rather than catching individually.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(502).json({ error: err instanceof Error ? err.message : "Unknown error calling Azure" });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Broker listening on http://localhost:${config.port}`);
});
