---
description: "Workflow cirúrgico de desenvolvimento (descrição da tarefa via argumentos)"
argument-hint: "<task-description>"
---

🛑 **PRÉ-CONDIÇÃO OBRIGATÓRIA (antes de qualquer ação):** Se o marcador `[[AUSENTE_DESCRICAO_TAREFA]]` aparecer abaixo, o comando foi chamado SEM a `<task-description>` obrigatória. PARE imediatamente — não execute nenhum passo do workflow, não invente tarefa nem continue com o contexto. Responda em pt-br pedindo a `<task-description>` e aguarde.

**Prerequisite (skills):** this workflow invokes `/skill:ask-matt`, `/skill:tdd` and `/skill:code-review`. The pi group alone does not install skills — if `/skill:ask-matt` is unavailable, run `agentic-bus setup --skills` in the repo root and `/reload` before proceeding.

/skill:ask-matt Execute the surgical development workflow for: ${@:-[[AUSENTE_DESCRICAO_TAREFA]]}

**Core Objective:**
Analyze the codebase, identify the root cause/target area, specify a surgical fix/implementation, break down tasks (if necessary), apply test-driven minimal changes (TDD + Surgical Patch), review the code, log an Architectural Decision Record (ADR) if applicable, and prepare for commit/push linking the PR/ticket upon explicit approval.
*Scope Note:* Focus 100% on internal technical resolution and code/API contracts (e.g., HTTP status codes, error payloads). Ignore any customer support messaging, emails, or end-user communications.

---

### Execution Rules & Guardrails (Harness)
1. **Surgical Changes & Token Efficiency:** Make only strictly necessary changes. Refactoring out-of-scope code or modifying formatting on unrelated files is strictly prohibited. Skip reading and analyzing media files, assets, or compiled artifacts (e.g., `.png`, `.svg`, `.map`, `dist/`, `build/`, `node_modules/`).
2. **Git Protection (`/skill:git-guardrails-claude-code`):** Invoke and strictly adhere to Git safety guardrails. Destructive operations (e.g., `git push --force`, `git reset --hard` on remote branches, or accidental branch/history deletion) are strictly forbidden.
3. **Concise Communication:** Intermediate reports must be 5 lines max, focusing strictly on facts, diffs, and affected files.
4. **Mandatory Validation:** No change is considered complete without local test suite execution and approval (PASS).
5. **DevSecOps & Security Sanitization:** Never include tokens, secrets, hashes, or API key prefixes/snippets in reports, comments, or commits (even if masked). Replace them with generic labels like `[OpenRouter API Key]` or `[System Token]`.
6. **Error Handling & Circuit Breaker:** If tests fail, output only the relevant error lines (10 lines max in the report). Limit autonomous fix attempts to a maximum of 3. If the test suite continues to fail on the 3rd attempt, 🛑 STOP immediately and request human guidance.

---

### Sequential Execution Workflow

1. **Investigation & Context (`/skill:ask-matt`)**
   - Map the codebase/logs and locate the files/modules afetados pela descrição da tarefa (argumentos do comando), ignoring compiled artifacts and assets.
   - Report in 3 concise bullet points: [Sintom/Technical Objective], [Identified Root Cause/Strategy], [Affected Files/Lines].

2. **Surgical Specification (`/skill:to-spec`)**
   - Detail the minimal change required to address the root cause/feature along with the technical rationale.
   - 🛑 **MANDATORY PAUSE (Human-in-the-Loop):** Present the summarized specification and await explicit approval before proceeding.

3. **Task Decomposition (`/skill:to-tickets`)** *(Post-approval)*
   - If the task spans multiple repositories or subsystems, break it down into smaller sub-tasks. For single/simple changes, skip this step by stating: "Isolated change, skipping task decomposition."
4. **Test-Driven Surgical Implementation**
   - **4.1 (`/skill:tdd`):** FIRST create or update the unit/integration tests that validate the new rule or reproduce the failure (Red phase).
   - **4.2 (Surgical Patch):** Generate the specification for the smallest possible code patch required to satisfy the newly created tests — narrowest responsible layer, no out-of-scope refactoring, cleanup, renaming, or abstraction.
   - **4.3 (`/skill:implement-spec`):** Apply code changes strictly following the specification approved in Step 2 until all tests pass (Green phase).
   - Confirm and report the test suite PASS status.

5. **Code Review (`/skill:code-review`)**
   - Invoke the skill to inspect code compliance, potential side effects, test coverage, and security before closing.

6. **Architectural Decision Record (`ADR`)**
   - If the solution involves an architectural shift, new API contract, pattern change, or significant behavior modification:
     * List the `docs/adr/` directory to identify the highest existing sequential ID.
     * Create a new file incrementing the number (e.g., `docs/adr/000N-[decision-title].md`) using the MADR format, containing: Status (Accepted), Context, Decision, and Consequences.
   - *For trivial fixes/features with no architectural impact, skip by reporting:* "No architectural impact, ADR waived."

7. **Finalization, Ticket Linking & Commit/Push**
   - **Signal the Conventional Commits model in the commit message**: `<type>(<scope>): <summary>` (e.g. `fix(setup): ...`, `feat(scope): ...`, `chore(dogfood): ...`, `docs: ...`, `test: ...`, `refactor(scope): ...`) — short summary (pt-br, repo convention) and a body explaining what/why.
   - **Signal the Gitflow Naming Convention when creating branches**: `<type>/<short-description>` (e.g. `feature/mcp-fetch-server`, `fix/...`, `chore/...`, `docs/...`, `test/...`, `hotfix/...`) — determine the base branch from the target repository (`develop` when it exists, else `main`); ask when unclear; never commit directly to the base branch.
   - If applicable, populate the dedicated platform field linking the PR to its corresponding ticket/issue (or include cross-references in the commit).
   - After final validation, 🛑 **STOP and ask**: *"The changes, ticket linkage, and documentation are complete. Would you like me to execute the commit (using Conventional Commits) and push to the repository?"*
   - Proceed with Git operations only after receiving explicit confirmation (while adhering to `git-guardrails`).
