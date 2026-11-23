// Provider Dock Agentic Bus — o pi chama o Agentic Bus (agents/teams como
// modelos OpenAI), nunca os providers de modelo diretamente.
// Scaffolded por `agentic-bus setup --pi` (spec 2026-09-08-oauth-login).
//
// Credencial: o pi executa `agentic-bus auth token` a cada request
// (apiKey "!comando") — nenhum segredo em arquivo do repo. Sem login,
// o comando falha com stderr orientando `agentic-bus login`.
//
// Atribuição FinOps: `X-Run-Origin: pi` é estático; `X-Client-Context-*`
// acompanha o cwd e a branch da sessão a cada request, sem entrar no prompt.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE_URL = "https://agentbus.dev.dock.tech/backend";

// --- Log de erro do tráfego provider → server (troubleshooting) ---
// Best-effort: grava METADADOS (sem Authorization/corpo) em JSONL no mesmo
// store que a CLI lê (`agentic-bus logs`); nunca quebra o request.
function logDir(): string {
  const override = process.env?.AGENTIC_BUS_LOG_DIR;
  return override !== undefined && override.length > 0
    ? override
    : join(tmpdir(), "agentic-bus", "logs");
}
function logProviderError(entry: Record<string, unknown>): void {
  try {
    const dir = logDir();
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = join(dir, `error-${new Date().toISOString().slice(0, 10)}.jsonl`);
    appendFileSync(file, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
  } catch {
    /* troubleshooting nunca quebra a sessão */
  }
}

// Nível de log efetivo: `AGENTIC_BUS_LOG_LEVEL=info` liga info+erro; default erro.
function logLevel(): "info" | "error" {
  return (process.env?.AGENTIC_BUS_LOG_LEVEL ?? "").toLowerCase() === "info"
    ? "info"
    : "error";
}
// Id de transporte 32-hex (formato uuid4().hex) — aceito pelo runtime (ADR-141).
// Sem dep de crypto: a extensão roda no sandbox do pi e o id é só correlação
// (spoofável por desenho; é correlação, não autenticação).
function newRequestId(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 32; i++) out += hex[Math.floor(Math.random() * 16)];
  return out;
}

// Windows: spawn/execFile sem shell nao resolve o shim .cmd do npm
// (CreateProcess so executa .exe) — passa por cmd /c. Linux/mac: shell de
// LOGIN (sh -lc) — sem isso, apps GUI (VS Code/pi) que nao herdam o PATH
// de shell (ex.: Homebrew em /opt/homebrew/bin) falham com "command not
// found" mesmo com login valido; path_helper roda via /etc/profile so em
// shells de login.
const IS_WIN = process.platform === "win32";
const AUTH_CMD = IS_WIN ? "cmd" : "/bin/sh";
const AUTH_ARGS = IS_WIN
  ? ["/c", "agentic-bus", "auth", "token"]
  : ["-lc", "agentic-bus auth token"];
// O hook apiKey e resolvido pelo NUCLEO do pi, que executa hooks via bash em
// toda plataforma (Git Bash no Windows) — la o shim sem extensao do npm roda
// direto, entao no Windows o comando vai SEM wrapper. Diferente do currentToken
// acima (execFileSync direto), o hook NAO deve usar cmd /c. No POSIX o hook
// precisa de shell de LOGIN (`/bin/sh -lc`): o PATH de apps GUI (Homebrew) so
// existe via /etc/profile. A escolha e em RUNTIME (IS_WIN) — o arquivo e
// versionado e compartilhado entre os tres SOs, entao nao se congela uma forma
// na geracao.
const AUTH_HOOK = IS_WIN ? "!agentic-bus auth token" : "!/bin/sh -lc 'agentic-bus auth token'";

// Header -> campo do `agentic-bus client-context` (fonte única no CLI).
const CLIENT_CONTEXT_FIELDS: Record<string, string> =
  { "X-Client-Context-Repo": "repo", "X-Client-Context-Branch": "branch", "X-Client-Context-Machine": "machine", "X-Client-Context-Username": "username" };
const RUN_ORIGIN_HEADERS: Record<string, string> = { "X-Run-Origin": "pi" };

// Cost fallback (zeros) — shape vem da fonte unica do CLI (pi-models.ts via
// placeholder); modelos com rate no metadata de /v1/models sobrepoem.
const COST_FALLBACK = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

// ---- Cache local (opt-in via `agentic-bus cache enable`) -------------------
// Espelha o formato que a CLI dona (src/lib/cache-store.ts / cache-config.ts):
// arquivo 0600, escrita atômica, leitura tolerante. Desabilitado por padrão.
const CACHE_VERSION = 1;
const CACHE_FILE = "cache.json";
const CACHE_CONFIG_FILE = "config.json";
const CACHE_AUTH_TTL_MS = 43200000;
const CACHE_CLIENT_CONTEXT_TTL_MS = 300000;

interface CacheAuthEntry {
  token: string;
  fingerprint: string;
  expiresAt: number;
}
interface CacheContextEntry {
  value: Record<string, string>;
  fingerprint: string;
  expiresAt: number;
}
interface CacheShape {
  version: number;
  auth?: CacheAuthEntry;
  clientContext?: Record<string, CacheContextEntry>;
}

function cacheRoot(): string {
  const base =
    process.env.AGENTIC_BUS_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(base, "agentic-bus");
}
function cachePath(): string {
  return path.join(cacheRoot(), CACHE_FILE);
}
function cacheConfigPath(): string {
  return path.join(cacheRoot(), CACHE_CONFIG_FILE);
}

function readCache(): CacheShape {
  try {
    const data: unknown = JSON.parse(fs.readFileSync(cachePath(), "utf8"));
    if (typeof data !== "object" || data === null) return { version: CACHE_VERSION };
    const obj = data as Record<string, unknown>;
    if (obj.version !== CACHE_VERSION) return { version: CACHE_VERSION };
    return {
      version: CACHE_VERSION,
      auth: obj.auth as CacheAuthEntry | undefined,
      clientContext: obj.clientContext as Record<string, CacheContextEntry> | undefined,
    };
  } catch {
    return { version: CACHE_VERSION };
  }
}

function writeCache(cache: CacheShape): void {
  try {
    fs.mkdirSync(cacheRoot(), { recursive: true, mode: 0o700 });
    const tmp = path.join(cacheRoot(), `.cache-${process.pid}-${Date.now()}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2) + "\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    try {
      fs.chmodSync(tmp, 0o600);
    } catch {
      // best-effort
    }
    fs.renameSync(tmp, cachePath());
  } catch {
    // best-effort: o cache nunca quebra o request
  }
}

let configMemo: { mtimeMs: number; enabled: boolean } | undefined;
function cacheEnabled(): boolean {
  try {
    const stat = fs.statSync(cacheConfigPath());
    if (configMemo && configMemo.mtimeMs === stat.mtimeMs) return configMemo.enabled;
    const data: unknown = JSON.parse(fs.readFileSync(cacheConfigPath(), "utf8"));
    const obj = data as { cache?: { enabled?: unknown } };
    const enabled =
      typeof obj.cache === "object" &&
      obj.cache !== null &&
      obj.cache.enabled === true;
    configMemo = { mtimeMs: stat.mtimeMs, enabled };
    return enabled;
  } catch {
    configMemo = undefined;
    return false;
  }
}

function authFingerprint(): string {
  try {
    const stat = fs.statSync(path.join(cacheRoot(), "auth.json"));
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return "";
  }
}

function gitDirOf(root: string): string {
  const dotGit = path.join(root, ".git");
  try {
    if (fs.statSync(dotGit).isDirectory()) return dotGit;
  } catch {
    return dotGit;
  }
  try {
    const content = fs.readFileSync(dotGit, "utf8");
    const match = /^gitdir:\s*(.+)$/m.exec(content);
    if (match && match[1]) return path.resolve(root, match[1].trim());
  } catch {
    // ignora
  }
  return dotGit;
}

function findGitRoot(cwd: string): string | undefined {
  let dir = cwd;
  for (;;) {
    try {
      if (fs.existsSync(path.join(dir, ".git"))) return dir;
    } catch {
      // ignora
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function clientFingerprint(cwd: string): string {
  const root = findGitRoot(cwd);
  if (!root) return `cwd:${cwd}`;
  try {
    const dir = gitDirOf(root);
    const head = fs.readFileSync(path.join(dir, "HEAD"), "utf8").trim();
    const stat = fs.statSync(path.join(dir, "config"));
    return createHash("sha256").update(`${head}|${stat.mtimeMs}`).digest("hex");
  } catch {
    return `cwd:${cwd}`;
  }
}

let authMemory: CacheAuthEntry | undefined;
function resolveAuthToken(): string {
  if (!cacheEnabled()) return currentToken();
  const fingerprint = authFingerprint();
  const now = Date.now();
  if (authMemory && authMemory.fingerprint === fingerprint && authMemory.expiresAt > now) {
    return authMemory.token;
  }
  const cache = readCache();
  if (cache.auth && cache.auth.fingerprint === fingerprint && cache.auth.expiresAt > now) {
    authMemory = cache.auth;
    return cache.auth.token;
  }
  const token = currentToken();
  const entry: CacheAuthEntry = { token, fingerprint, expiresAt: now + CACHE_AUTH_TTL_MS };
  authMemory = entry;
  cache.auth = entry;
  writeCache(cache);
  return token;
}

// Persistimos no formato "campo" do cache-store da CLI ({repo,branch,machine,username}),
// NÃO no formato de header — a CLI e a extensão leem o MESMO arquivo cache.json.
function headersFromFields(fields: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(CLIENT_CONTEXT_FIELDS).map(([header, field]) => [
      header,
      fields[field] ?? "unknown",
    ]),
  );
}
function fieldsFromHeaders(headers: Record<string, string>): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [header, field] of Object.entries(CLIENT_CONTEXT_FIELDS)) {
    fields[field] = headers[header] ?? "unknown";
  }
  return fields;
}

const contextMemory = new Map<string, CacheContextEntry>();
async function resolveClientContext(
  pi: ExtensionAPI,
  cwd: string,
): Promise<Record<string, string>> {
  if (!cacheEnabled()) return clientContextHeaders(pi, cwd);
  const fingerprint = clientFingerprint(cwd);
  const now = Date.now();
  const inMemory = contextMemory.get(cwd);
  if (inMemory && inMemory.fingerprint === fingerprint && inMemory.expiresAt > now) {
    return headersFromFields(inMemory.value);
  }
  const cache = readCache();
  const stored = cache.clientContext?.[cwd];
  if (stored && stored.fingerprint === fingerprint && stored.expiresAt > now) {
    contextMemory.set(cwd, stored);
    return headersFromFields(stored.value);
  }
  const headers = await clientContextHeaders(pi, cwd);
  const entry: CacheContextEntry = {
    value: fieldsFromHeaders(headers),
    fingerprint,
    expiresAt: now + CACHE_CLIENT_CONTEXT_TTL_MS,
  };
  contextMemory.set(cwd, entry);
  cache.clientContext = { ...(cache.clientContext ?? {}), [cwd]: entry };
  writeCache(cache);
  return headers;
}

function providerApiKey(): string {
  if (!cacheEnabled()) return AUTH_HOOK;
  try {
    return resolveAuthToken();
  } catch {
    return AUTH_HOOK;
  }
}

function currentToken(): string {
  try {
    return execFileSync(AUTH_CMD, AUTH_ARGS, {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw new Error(
      `Agentic Bus: sem credencial local (${detail}). Rode 'agentic-bus login' e reabra o pi.`,
    );
  }
}

/**
 * Uma coleta por request com cwd da sessão, não do processo do host.
 * Campos vazios viram "unknown"; falhas são tratadas pelo hook.
 */
async function clientContextHeaders(pi: ExtensionAPI, cwd: string): Promise<Record<string, string>> {
  const result = await pi.exec(
    AUTH_CMD,
    IS_WIN
      ? ["/c", "agentic-bus client-context --json"]
      : ["-lc", "agentic-bus client-context --json"],
    { cwd, timeout: 10000 },
  );
  if (result.code !== 0) throw new Error("client-context falhou");
  const context: unknown = JSON.parse(result.stdout);
  if (typeof context !== "object" || context === null) {
    throw new Error("client-context inválido");
  }
  const values = context as Record<string, unknown>;
  return Object.fromEntries(Object.entries(CLIENT_CONTEXT_FIELDS).map(([header, field]) => {
    const value = values[field];
    if (typeof value !== "string") throw new Error("client-context incompleto");
    return [header, value.trim() || "unknown"];
  }));
}
function headerValue(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (headers === undefined) return undefined;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() !== name) continue;
    const value = headers[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

export default async function (pi: ExtensionAPI) {
  let models: Array<Record<string, unknown>> = [];
  try {
    const res = await fetch(`${BASE_URL}/v1/models`, {
      headers: { authorization: `Bearer ${currentToken()}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = (await res.json()) as {
      data?: Array<{
        id: string;
        metadata?: {
          kind?: string;
          description?: string;
          input_per_1m?: number;
          output_per_1m?: number;
          cached_input_per_1m?: number;
          context_window?: number;
          max_tokens?: number;
          supports_store?: boolean;
        };
      }>;
    };
    models = (payload.data ?? []).map((m) => ({
      id: m.id,
      name: m.metadata?.description?.trim() || m.id,
      reasoning: false,
      input: ["text"],
      cost: {
        input: m.metadata?.input_per_1m ?? COST_FALLBACK.input,
        output: m.metadata?.output_per_1m ?? COST_FALLBACK.output,
        cacheRead: m.metadata?.cached_input_per_1m ?? COST_FALLBACK.cacheRead,
        cacheWrite: COST_FALLBACK.cacheWrite,
      },
      // limites reais do catálogo (spec #158) via /v1/models metadata;
      // fallback: constantes do scaffold (entries sem limites, ex. agents/teams).
      contextWindow: m.metadata?.context_window ?? 128000,
      maxTokens: m.metadata?.max_tokens ?? 4096,
      // capacidade por modelo (GET /v1/models metadata.supports_store);
      // só emite compat quando o catálogo declara false explicitamente.
      ...(m.metadata?.supports_store === false
        ? { compat: { supportsStore: false } }
        : {}),
    }));
  } catch (error) {
    console.warn(
      `[agentic-bus] /v1/models falhou (${error instanceof Error ? error.message : String(error)}) ` +
        "— rode `agentic-bus login` e reabra o pi.",
    );
  }

  let lastRequestAt = 0;
  let lastModel: string | undefined;
  // Id de transporte da chamada corrente (gerado no before_provider_headers).
  let pendingRequestId: string | undefined;
  pi.on("before_provider_request", (event) => {
    lastRequestAt = Date.now();
    const payload = event.payload;
    if (payload !== null && typeof payload === "object" && "model" in payload) {
      const model = (payload as { model?: unknown }).model;
      if (typeof model === "string") lastModel = model;
    }
  });
  pi.on("after_provider_response", (event) => {
    const isError = event.status < 200 || event.status >= 300;
    // Default: só erro. `AGENTIC_BUS_LOG_LEVEL=info` grava sucesso também.
    if (!isError && logLevel() !== "info") return;
    logProviderError({
      ts: new Date().toISOString(),
      level: isError ? "error" : "info",
      source: "pi",
      operation: "provider response",
      status: event.status,
      reason: `HTTP ${event.status}`,
      model: lastModel,
      durationMs: lastRequestAt > 0 ? Date.now() - lastRequestAt : undefined,
      server: BASE_URL,
      requestId: pendingRequestId,
      runId: headerValue(event.headers, "x-run-id"),
      serverDate: headerValue(event.headers, "date"),
    });
  });

  pi.registerProvider("agentic-bus", {
    name: "Dock Agentic Bus",
    baseUrl: `${BASE_URL}/v1`,
    api: "openai-completions",
    apiKey: providerApiKey(),
    authHeader: true,
    headers: RUN_ORIGIN_HEADERS,
    models,
  });

  let contextWarningShown = false;
  pi.on("before_provider_headers", async (event, ctx) => {
    const isAgenticBus = Object.entries(RUN_ORIGIN_HEADERS).every(
      ([header, value]) => Object.entries(event.headers).some(
        ([name, current]) => name.toLowerCase() === header.toLowerCase() && current === value,
      ),
    );
    if (!isAgenticBus) return;
    // Correlação de transporte por request: gera o id e o envia em
    // `X-Request-Id`; o runtime adota/ecoa o mesmo valor (ADR-141). Guardado
    // para o log do `after_provider_response` casar requestId↔runId.
    pendingRequestId = newRequestId();
    event.headers["X-Request-Id"] = pendingRequestId;
    let headers: Record<string, string>;
    if (cacheEnabled()) {
      try {
        const token = resolveAuthToken();
        for (const name of Object.keys(event.headers)) {
          if (name.toLowerCase() === "authorization") delete event.headers[name];
        }
        event.headers.Authorization = `Bearer ${token}`;
      } catch {
        // sem credencial em cache: mantém o Authorization resolvido pelo pi
      }
    }
    try {
      headers = await resolveClientContext(pi, ctx.cwd);
    } catch {
      if (!contextWarningShown) {
        console.warn(
          "[agentic-bus] client-context --json indisponível ou inválido; " +
          "mantendo headers de fallback. Atualize a CLI e verifique o cwd da sessão.",
        );
        contextWarningShown = true;
      }
      headers = Object.fromEntries(Object.keys(CLIENT_CONTEXT_FIELDS).map((header) => {
        const existing = Object.entries(event.headers).find(
          ([name]) => name.toLowerCase() === header.toLowerCase(),
        )?.[1];
        return [header, typeof existing === "string" && existing.trim() ? existing : "unknown"];
      }));
    }
    for (const [header, value] of Object.entries(headers)) {
      for (const name of Object.keys(event.headers)) {
        if (name !== header && name.toLowerCase() === header.toLowerCase()) delete event.headers[name];
      }
      event.headers[header] = value;
    }
  });
}
