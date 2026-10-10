# My Pi configuration

This repository contains my personal configuration for [Pi](https://pi.dev), the extensible coding agent harness. It lives in `~/.pi/agent` and brings together the extensions, prompt templates, theme, and settings I use in my day-to-day development workflow.

My configuration is **heavily influenced by the Agentic Bus setup**, especially the integration scaffolded by `agentic-bus setup --pi`. Agentic Bus is the default provider, and the development prompts follow its skill-driven approach to investigation, surgical changes, testing, review, and explicit approval before Git operations.

This is an opinionated personal setup—not an official Pi or Agentic Bus distribution, and not a portable, one-command installer. Feel free to use it as a starting point and keep only the pieces that suit your workflow.

## What's included

| Path | Purpose |
| --- | --- |
| `settings.json` | Default provider, package list, shell, theme, and resource settings. |
| `extensions/agentic-bus.ts` | Registers the Agentic Bus provider and fetches its available models. Authentication is resolved through the Agentic Bus CLI. |
| `extensions/agb-models-sync-startup.js` | Runs `agentic-bus models sync` at startup and checks the generated local `models.json`. |
| `extensions/copy-all/` | Local clipboard extension. |
| `extensions/rtk.ts` and `extensions/pi-rtk-optimizer/` | Local RTK-related customization and configuration. |
| `prompts/` | Development and feedback/ticket workflow templates. |
| `themes/alien-candy.json` | My preferred Pi theme. |
| `mcp.json` | Agentic Bus platform, filesystem, sequential-thinking, Playwright, fetch, and Git MCP server definitions. |
| `pi-mcb-config.json` | Context compaction and memory settings. |
| `caveman.json` | Configuration for the Caveman package. |

The package list includes code intelligence (`pi-lens`), MCP integration, subagents, background tasks, context management, RTK optimization, safety checks, lazy extension loading, web access, memory, knowledge graphs, and vision handoff. See `settings.json` for the current list.

Pi's built-in MCP extension is disabled here in favor of `pi-mcp-adapter`.

## How to use this configuration

### 1. Install the prerequisites

- Install [Pi](https://pi.dev) using its official installation instructions. Pi currently requires Node.js **22.19 or newer**.
- Install Git.
- For the Agentic Bus integration, install the Agentic Bus CLI through the instructions provided by your organization and make sure `agentic-bus` is on your `PATH`. You need your own authorized account; this repository does not grant access to the service.
- On Windows, install **Git Bash**. The committed `shellPath` points to `C:\Program Files\Git\bin\bash.exe`.
- If you keep the Python-based fetch and Git MCP servers, install Python and [uv](https://docs.astral.sh/uv/) so `uvx` is available. The Node-based MCP servers use `npx`; Playwright also needs its browser dependencies.

### 2. Back up your existing Pi configuration

If you already use Pi, back up `~/.pi/agent` before copying anything. On Windows, this directory is `%USERPROFILE%\.pi\agent`.

Clone this repository into a separate directory first, replacing the placeholder with this repository's URL:

```bash
git clone <repository-url> pi-config
```

Review the files, then copy the configuration files and the `extensions/`, `prompts/`, and `themes/` directories into your own `~/.pi/agent`. Merge existing settings rather than overwriting them blindly. This repository is a configuration directory, not an npm application; there is no root-level `npm install` step.

**Before starting Pi:**

- Change or remove `shellPath` in `settings.json` if you use a different Git Bash location, Linux, or macOS.
- Review `mcp.json`. Remove servers you do not need and replace organization-specific endpoints if appropriate. Filesystem access is scoped to `.` in the configured server command; verify which working directory the server receives before using it.
- Review the extensions and packages before loading them: extensions execute code on your machine.
- Adjust the package list and context/memory settings to your preferences. Package specifications are not version-pinned, so installations may differ over time.

### 3. Authenticate and synchronize Agentic Bus

```bash
agentic-bus login
agentic-bus models sync
```

The provider extension obtains credentials through `agentic-bus auth token` rather than storing a token in this repository. The startup extension also synchronizes models whenever Pi loads it.

If you want to use Pi **without Agentic Bus**, remove `extensions/agentic-bus.ts` and `extensions/agb-models-sync-startup.js` from your copied configuration, change `defaultProvider` in `settings.json`, and remove the Agentic Bus MCP entry. Sign in to your chosen supported provider using `/login` inside Pi. The feedback workflow also depends on the Agentic Bus platform and will need adapting.

### 4. Install the configured packages

With the copied settings in place, reconcile package installations:

```bash
pi update --extensions
pi list
```

To install an individual package explicitly, use:

```bash
pi install npm:pi-vision-handoff
```

Some extensions and packages may require additional tools or their own onboarding. Follow their documentation if Pi reports missing dependencies; copying this repository does not copy installed dependencies or local runtime state.

### 5. Start Pi in your project

```bash
cd /path/to/your/project
pi
```

Select an available model using `/model`. After changing extensions or prompt templates, use `/reload` or restart Pi.

The included prompt templates can be invoked inside Pi:

```text
/implement-development Add input validation to the checkout endpoint
/implement-feedback <ticket-id>
```

These templates require Agentic Bus skills such as `ask-matt`, `tdd`, and `code-review`, along with other skills referenced in the templates. The Pi integration alone does not install them. If you use these workflows, run the following in your project root, review the installed resources, then reload Pi:

```bash
agentic-bus setup --skills
```

Read the templates before using them: they include approval checkpoints, testing requirements, and Git safety rules. Some instructions and interactions are in Brazilian Portuguese.

## Private state and security

Credentials, generated model catalogs, sessions, memory, caches, and installed package contents are intentionally excluded by `.gitignore`. Each user must generate their own local state and authenticate independently.

Do not commit tokens, API keys, `.env` files, or session/memory data. Review configuration changes before publishing: `.gitignore` is a safeguard, not a guarantee that a file is safe to share.

## Credits

- [Pi](https://pi.dev) for the extensible agent harness.
- Agentic Bus for the setup conventions, provider integration, and workflow inspiration that strongly shaped this configuration.
