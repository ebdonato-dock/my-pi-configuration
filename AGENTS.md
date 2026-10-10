# Repository context

- This is the user's live global Pi configuration (`~/.pi/agent`), not an application or npm workspace. There is no root manifest, build pipeline, CI, or test suite.
- Use `git ls-files` to distinguish maintained configuration from installed packages and private runtime state. `npm/`, `.pi/`, `pi-*/*`, sessions, memory, credentials, caches, and generated model catalogs are ignored; avoid treating them as source or committing them.
- Both READMEs reference `extensions/agentic-bus.ts` and `extensions/rtk.ts`, but neither exists in this checkout. Trust the current files and `settings.json` rather than those architecture claims.

## Runtime and integration

- `settings.json` selects packages using unpinned `npm:` specifications. Reconcile installations with `pi update --extensions`, then inspect them with `pi list`; there is no root-level `npm install` step. Reload extensions and prompt templates with `/reload` inside Pi or restart it.
- Pi's Bash tool uses `C:\Program Files\Git\bin\bash.exe`. The model-sync extension deliberately uses `cmd.exe /d /s /c` on Windows instead; do not replace it with bare `bash`, which may resolve to WSL.
- `extensions/agb-models-sync-startup.js` runs and awaits `agentic-bus models sync` in its async factory, before Pi refreshes the catalog. It checks BOM-tolerant JSON at `PI_CODING_AGENT_DIR/models.json` (expanding a leading `~`), falling back to `~/.pi/agent/models.json`; execution uses the loader's working directory. Sync failures notify without stopping Pi.
- Agentic Bus setup requires the CLI on `PATH` and `agentic-bus login` before `agentic-bus models sync`. Treat `models.json` as generated local state.
- MCP definitions live in `mcp.json`; `settings.json` disables `builtin:mcp` in favor of `pi-mcp-adapter`. Fetch and Git servers require `uvx`; Node servers use `npx`. The filesystem server's allowed path is `.`, so access depends on its launch working directory.
- `extensions/pi-rtk-optimizer/config.json` configures the installed optimizer, not a local implementation. It enables command rewriting and truncates compacted output at 12,000 characters; inspect full output when diagnosing incomplete logs.

## Local extension verification

- The only local npm package is `extensions/copy-all`. Its declared check is `npm --prefix extensions/copy-all run check` (`tsc --noEmit -p .`), but its `tsconfig.json` extends an absent root `tsconfig.json`. Its Pi SDK import (`@earendil-works/pi-coding-agent`) is also absent from its manifest. Do not assume the check works after installing only this package's dependencies.
- `copy-all` is loaded through `extensions/copy-all/index.ts`, not built output. For runtime verification, reload Pi and invoke `/copy-all`: it waits for idle and copies only user/assistant messages from the active session branch, omitting tool messages and representing images as `[image]`.
- A focused syntax check for the startup extension is `node --check extensions/agb-models-sync-startup.js`; this does not execute model synchronization.

## Prompt and documentation edits

- Read `prompts/implement-development.md` or `prompts/implement-feedback.md` before changing their workflows. Preserve YAML frontmatter, argument interpolation (`${@:-...}` / `${1:-...}`), and missing-argument stop markers.
- These workflows require separately installed Agentic Bus skills: `agentic-bus setup --skills` in the target project, then `/reload`. Preserve their specification-approval and commit/push checkpoints; the feedback workflow requires pt-BR communication and the `agentic-bus-platform` MCP for ticket operations.
- Setup documentation exists in both `README.md` and `README.pt-BR.md`; keep corresponding instructions consistent when changing setup behavior.
