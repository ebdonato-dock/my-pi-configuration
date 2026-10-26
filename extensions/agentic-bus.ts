// Provider Dock Agentic Bus — o pi chama o Agentic Bus (agents/teams como
// modelos OpenAI), nunca os providers de modelo diretamente.
// Scaffolded por `agentic-bus setup --pi` (spec 2026-09-08-oauth-login).
//
// Credencial: o pi executa `agentic-bus auth token` a cada request
// (apiKey "!comando") — nenhum segredo em arquivo do repo. Sem login,
// o comando falha com stderr orientando `agentic-bus login`.
//
// Atribuição FinOps: headers `X-Run-Origin: pi` + `X-Client-Context-*`
// (repo/branch/machine/username). São atribuição, NUNCA entram no prompt;
// resolvidos UMA vez no load da extensão (4 subprocessos por sessão) para
// não pagar spawn em cada request.
import { execFileSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const BASE_URL = "https://agentbus.dev.dock.tech/backend";

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
// O hook apiKey e resolvido pelo NUCLEO do pi, que no Windows executa via
// git-bash (bash -c) — la o shim sem extensao do npm funciona. Diferente do
// currentToken acima (execFileSync direto), o hook NAO deve usar cmd /c.
const AUTH_HOOK = "!/bin/sh -lc 'agentic-bus auth token'";

// Header -> campo do `agentic-bus client-context` (fonte única no CLI).
const CLIENT_CONTEXT_FIELDS: Record<string, string> =
  { "X-Client-Context-Repo": "repo", "X-Client-Context-Branch": "branch", "X-Client-Context-Machine": "machine", "X-Client-Context-Username": "username" };
const RUN_ORIGIN_HEADERS: Record<string, string> = { "X-Run-Origin": "pi" };

// Cost fallback (zeros) — shape vem da fonte unica do CLI (pi-models.ts via
// placeholder); modelos com rate no metadata de /v1/models sobrepoem.
const COST_FALLBACK = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

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
 * Contexto de cliente do checkout atual — best-effort. Fora de repo git,
 * origin local ou CLI antigo: campo vira "" e o header é omitido; a run
 * segue sem atribuição (nunca derruba o modelo).
 */
function clientContextHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [header, field] of Object.entries(CLIENT_CONTEXT_FIELDS)) {
    try {
      const value = execFileSync(
        AUTH_CMD,
        IS_WIN
          ? ["/c", `agentic-bus client-context ${field}`]
          : ["-lc", `agentic-bus client-context ${field}`],
        { encoding: "utf8" },
      ).trim();
      if (value) headers[header] = value;
    } catch {
      // sem CLI no PATH ou fora de repo: atribuição fica ausente
    }
  }
  return headers;
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

  pi.registerProvider("agentic-bus", {
    name: "Dock Agentic Bus",
    baseUrl: `${BASE_URL}/v1`,
    api: "openai-completions",
    apiKey: AUTH_HOOK,
    authHeader: true,
    headers: { ...RUN_ORIGIN_HEADERS, ...clientContextHeaders() },
    models,
  });
}
