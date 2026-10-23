---
description: "Workflow cirúrgico para resolver feedback/ticket da plataforma Dock Agentic Bus (ID via argumento)"
argument-hint: "<ticket-id>"
---

🛑 **PRÉ-CONDIÇÃO OBRIGATÓRIA (antes de qualquer ação):** Se o marcador `[[AUSENTE_TICKET_ID]]` aparecer abaixo, o comando foi chamado SEM o `<ticket-id>` obrigatório. PARE imediatamente — não execute nenhum passo do workflow, não adivinhe o ticket nem continue com o contexto. Responda em pt-br pedindo o `<ticket-id>` e aguarde.

**Prerequisite (skills):** this workflow invokes `/skill:ask-matt`, `/skill:tdd` and `/skill:code-review`. The pi group alone does not install skills — if `/skill:ask-matt` is unavailable, run `agentic-bus setup --skills` in the repo root and `/reload` before proceeding.

**Feedback/ticket platform (Dock Agentic Bus):** to interact with the platform — fetch/update the ticket, comment, and link the PR — use the `agentic-bus-platform` MCP. Do not use endpoints, tokens, or repository credentials to access the platform.

/skill:ask-matt Execute the surgical analysis and resolution workflow for PR/Ticket: ${1:-[[AUSENTE_TICKET_ID]]}

**Core Objective:**
Identify the root cause, specify a surgical fix, break down tasks (if necessary), apply test-driven minimal changes (TDD + Surgical Patch), review the code, log an Architectural Decision Record (ADR) if applicable, and prepare for commit/push linking the PR to the ticket on the platform upon explicit approval.
*Scope Note:* Focus 100% on internal technical resolution and code/API contracts (e.g., HTTP status codes, error payloads). Ignore any customer support messaging, emails, or end-user communications.
*Language Directive:* All user-facing communications, status reports, intermediate outputs, and human-in-the-loop interactions MUST be conducted in Brazilian Portuguese (pt-br).

---

### Execution Rules & Guardrails (Harness)
1. **Surgical Changes & Token Efficiency:** Make only strictly necessary changes. Refactoring out-of-scope code or modifying formatting on unrelated files is strictly prohibited. Skip reading and analyzing media files, assets, or compiled artifacts (e.g., `.png`, `.svg`, `.map`, `dist/`, `build/`, `node_modules/`, `.venv/`).
2. **Git Protection (`/skill:git-guardrails-claude-code`):** Invoke and strictly adhere to Git safety guardrails. Destructive operations (e.g., `git push --force`, `git reset --hard` on remote branches, or accidental branch/history deletion) are strictly forbidden.
3. **Concise Communication (PT-BR):** Intermediate reports must be 5 lines max written in Brazilian Portuguese (pt-br), focusing strictly on facts, diffs, and affected files.
4. **Mandatory Validation:** No change is considered complete without local test suite execution and approval (PASS).
5. **DevSecOps & Security Sanitization:** Never include tokens, secrets, hashes, or API key prefixes/snippets in reports, comments, or commits (even if masked). Replace them with generic labels like `[API Key OpenRouter]` or `[Token do Sistema]`.
6. **Error Handling & Circuit Breaker:** If tests fail, output only the relevant error lines (10 lines max in the report). Limit autonomous fix attempts to a maximum of 3. If the test suite continues to fail on the 3rd attempt, 🛑 STOP immediately and request human guidance in Brazilian Portuguese (pt-br).

---

### Sequential Execution Workflow

1. **Investigation & Context (`/skill:ask-matt`)**
   - **Kanban — Em andamento (`in_progress`):** ao iniciar o desenvolvimento, mova o Feedback para `in_progress` com `platform_admin_triage_feedback` e registre em `status_note` que o trabalho começou (agente/contexto). Faça isso **antes** de qualquer alteração de código. Uma transição por round.
   - Analyze logs, diffs, commits, or description do ticket informado, ignoring compiled artifacts and assets.
   - If you cannot map a subsystem/flow after reasonable exploration (e.g. repeated failed searches on unfamiliar code), consult the repository knowledge graph: run `graphify_update` first (incremental refresh), then `graphify_query`/`graphify_path`/`graphify_explain` — never read raw `graphify-out/graph.json` wholesale.
   - Report in 3 concise bullet points in pt-br: [Sintoma/Problema], [Causa Raiz Identificada], [Arquivos/Linhas Afetados].

2. **Surgical Specification (`/skill:to-spec`)**
   - Detail the minimal change required to address the root cause along with the technical rationale.
   - 🛑 **MANDATORY PAUSE (Human-in-the-Loop):** Present the summarized specification in pt-br and await explicit approval before proceeding.

3. **Task Decomposition (`/skill:to-tickets`)** *(Post-approval)*
   - If the task spans multiple repositories or subsystems, break it down into smaller sub-tasks. For single/simple changes, skip this step by stating in pt-br: "Mudança pontual, ignorando decomposição."

4. **Test-Driven Surgical Implementation**
   - **4.1 (`/skill:tdd`):** FIRST create or update the unit/integration tests that reproduce the failure or validate the new rule (Red phase).
   - **4.2 (Surgical Patch):** Generate the specification for the smallest possible code patch required to satisfy the newly created tests — narrowest responsible layer, no out-of-scope refactoring, cleanup, renaming, or abstraction.
   - **4.3 (`/skill:implement-spec`):** Apply code changes strictly following the specification approved in Step 2 until all tests pass (Green phase).
   - Confirm and report the test suite PASS status in pt-br.

5. **Code Review (`/skill:code-review`)**
   - Invoke the skill to inspect code compliance, potential side effects, test coverage, and security before closing.

6. **Architectural Decision Record (`ADR`)**
   - If the solution involves an architectural shift, new API contract, pattern change, or significant behavior modification:
     * List the `docs/adr/` directory to identify the highest existing sequential ID.
     * Create a new file incrementing the number (e.g., `docs/adr/000N-[decision-title].md`) using the MADR format, containing: Status (Accepted), Context, Decision, and Consequences.
   - *For trivial fixes/features with no architectural impact, skip by reporting in pt-br:* "Sem impacto arquitetural, ADR dispensada."

7. **Finalization, Ticket Linking & Commit/Push**
   - **Signal the Conventional Commits model in the commit message**: `<type>(<scope>): <summary>` (e.g. `fix(setup): ...`, `feat(scope): ...`, `chore(dogfood): ...`, `docs: ...`, `test: ...`, `refactor(scope): ...`) — short summary (pt-br, repo convention) and a body explaining what/why.
   - **Signal the Gitflow Naming Convention when creating branches**: `<type>/<short-description>` (e.g. `feature/mcp-fetch-server`, `fix/...`, `chore/...`, `docs/...`, `test/...`, `hotfix/...`) — determine the base branch from the target repository (`develop` when it exists, else `main`); ask when unclear; never commit directly to the base branch.
   - If a corresponding ticket exists, populate the **dedicated feedback platform field** linking the PR to the respective ticket.
   - After final validation, 🛑 **STOP and ask in pt-br**: *"As alterações, a vinculação da PR no campo do ticket e a documentação estão prontas. Deseja que eu faça o commit (com Conventional Commits) e o push para o repositório?"*
   - Proceed with Git operations only after receiving explicit confirmation (while adhering to `git-guardrails`).
   - **Kanban — Code Review (`in_code_review`):** após o push e a abertura da PR, mova o Feedback para `in_code_review` com `platform_admin_triage_feedback`, preenchendo `pull_requests` (`{repo, number, url, head_sha, state}`) para vincular a PR e registrando em `status_note` o resumo da entrega. O `done` fica para depois da revisão/merge.
