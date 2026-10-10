# Minha configuração de Pi

[English](README.md) | Português

Este repositório contém minha configuração pessoal para o [Pi](https://pi.dev), o harness de agente de codificação extensível. Ele reside em `~/.pi/agent` e reúne as extensões, modelos de prompt, tema e configurações que uso no meu fluxo de trabalho de desenvolvimento diário.

Minha configuração é **fortemente influenciada pela configuração do Agentic Bus**, especialmente pela integração com scaffold criada pelo `agentic-bus setup --pi`. O Agentic Bus é o provedor padrão, e os prompts de desenvolvimento seguem sua abordagem orientada por habilidades para investigação, mudanças precisas, testes, revisão e aprovação explícita antes das operações do Git.

Esta é uma configuração pessoal opinativa—não é uma distribuição oficial do Pi ou Agentic Bus, e não é um instalador portátil de um comando. Sinta-se livre para usá-la como ponto de partida e mantenha apenas as peças que se adequem ao seu fluxo de trabalho.

## O que está incluído

| Caminho | Propósito |
| --- | --- |
| `settings.json` | Provedor padrão, lista de pacotes, shell, tema e configurações de recursos. |
| `extensions/agentic-bus.ts` | Registra o provedor Agentic Bus e busca seus modelos disponíveis. A autenticação é resolvida através do CLI do Agentic Bus. |
| `extensions/agb-models-sync-startup.js` | Executa `agentic-bus models sync` na inicialização e verifica o `models.json` local gerado. |
| `extensions/copy-all/` | Extensão de área de transferência local. |
| `extensions/rtk.ts` e `extensions/pi-rtk-optimizer/` | Personalização e configuração local relacionadas ao RTK. |
| `prompts/` | Modelos de workflow de desenvolvimento e feedback/ticket. |
| `themes/alien-candy.json` | Meu tema de Pi preferido. |
| `mcp.json` | Definições de servidores MCP do Agentic Bus, filesystem, sequential-thinking, Playwright, fetch e Git. |
| `pi-mcb-config.json` | Configurações de compactação de contexto e memória. |
| `caveman.json` | Configuração para o pacote Caveman. |

A lista de pacotes inclui inteligência de código (`pi-lens`), integração MCP, subagentes, tarefas em background, gerenciamento de contexto, otimização RTK, verificações de segurança, carregamento de extensão lazy, acesso web, memória, gráficos de conhecimento e handoff de visão. Veja `settings.json` para a lista atual.

A extensão MCP integrada do Pi está desabilitada aqui em favor do `pi-mcp-adapter`.

## Como usar esta configuração

### 1. Instale os pré-requisitos

- Instale o [Pi](https://pi.dev) usando suas instruções de instalação oficiais. Pi atualmente requer Node.js **22.19 ou mais novo**.
- Instale o Git.
- Para a integração do Agentic Bus, instale o CLI do Agentic Bus através das instruções fornecidas pela sua organização e certifique-se de que `agentic-bus` está no seu `PATH`. Você precisa de sua própria conta autorizada; este repositório não concede acesso ao serviço.
- No Windows, instale **Git Bash**. O `shellPath` confirmado aponta para `C:\Program Files\Git\bin\bash.exe`.
- Os servidores MCP baseados em Node usam `npx`; Playwright também precisa de suas dependências de navegador.

> **Configuração de shell do Windows:** Uso esta configuração no Windows, então `shellPath` em [`settings.json`](settings.json) (linha 5) aponta explicitamente para Git Bash: `C:\Program Files\Git\bin\bash.exe`. Isso força as chamadas da ferramenta `bash` do Pi a usar Git Bash em vez de confiar na detecção automática de shell. Atualize o caminho se o Git for instalado em outro lugar, ou remova esta configuração no Linux/macOS. Extensões que iniciam seu próprio shell (como tarefas em background) podem usar uma política de shell separada.

> **Requisito MCP Python:** Alguns servidores MCP configurados (fetch e Git) são baseados em Python e lançados através de `uvx`. Instale [uv](https://docs.astral.sh/uv/) (que inclui `uvx`) e certifique-se de que ambos `uv` e `uvx` estão disponíveis no seu `PATH`. Eles são necessários se você manter esses servidores habilitados; uv pode gerenciar o tempo de execução Python que eles precisam.

### 2. Faça backup de sua configuração existente do Pi

Se você já usa Pi, faça backup de `~/.pi/agent` antes de copiar qualquer coisa. No Windows, este diretório é `%USERPROFILE%\.pi\agent`.

Clone este repositório em um diretório separado primeiro, substituindo o placeholder pela URL deste repositório:

```bash
git clone <repository-url> pi-config
```

Revise os arquivos e copie os arquivos de configuração e os diretórios `extensions/`, `prompts/` e `themes/` para seu próprio `~/.pi/agent`. Mescle as configurações existentes em vez de sobrescrevê-las às cegas. Este repositório é um diretório de configuração, não uma aplicação npm; não há nenhuma etapa `npm install` no nível raiz.

**Antes de iniciar o Pi:**

- Altere ou remova `shellPath` em `settings.json` se você usar um local diferente de Git Bash, Linux ou macOS.
- Revise `mcp.json`. Remova os servidores que você não precisa e substitua os pontos finais específicos da organização se apropriado. O acesso ao sistema de arquivos é escopo para `.` no comando do servidor configurado; verifique em qual diretório de trabalho o servidor é recebido antes de usá-lo.
- Revise as extensões e pacotes antes de carregá-los: extensões executam código em sua máquina.
- Ajuste a lista de pacotes e as configurações de contexto/memória de acordo com suas preferências. As especificações de pacote não são fixadas por versão, portanto as instalações podem diferir ao longo do tempo.

### 3. Autentique e sincronize o Agentic Bus

```bash
agentic-bus login
agentic-bus models sync
```

A extensão do provedor obtém credenciais através de `agentic-bus auth token` em vez de armazenar um token neste repositório. A extensão de inicialização também sincroniza modelos sempre que Pi a carrega.

Se você quiser usar Pi **sem Agentic Bus**, remova `extensions/agentic-bus.ts` e `extensions/agb-models-sync-startup.js` de sua configuração copiada, altere `defaultProvider` em `settings.json` e remova a entrada MCP do Agentic Bus. Faça login em seu provedor suportado escolhido usando `/login` dentro do Pi. O fluxo de trabalho de feedback também depende da plataforma Agentic Bus e precisará ser adaptado.

### 4. Instale os pacotes configurados

Com as configurações copiadas em vigor, reconcilie as instalações de pacotes:

```bash
pi update --extensions
pi list
```

Para instalar um pacote individual explicitamente, use:

```bash
pi install npm:pi-vision-handoff
```

Algumas extensões e pacotes podem exigir ferramentas adicionais ou seu próprio onboarding. Siga sua documentação se Pi relatar dependências ausentes; copiar este repositório não copia dependências instaladas ou estado de tempo de execução local.

### 5. Inicie o Pi em seu projeto

```bash
cd /path/to/your/project
pi
```

Selecione um modelo disponível usando `/model`. Após alterar extensões ou modelos de prompt, use `/reload` ou reinicie o Pi.

Os modelos de prompt incluídos podem ser invocados dentro do Pi:

```text
/implement-development Add input validation to the checkout endpoint
/implement-feedback <ticket-id>
```

Estes modelos requerem habilidades do Agentic Bus como `ask-matt`, `tdd` e `code-review`, juntamente com outras habilidades referenciadas nos modelos. A integração do Pi sozinha não as instala. Se você usar esses fluxos de trabalho, execute o seguinte na raiz do seu projeto, revise os recursos instalados e recarregue o Pi:

```bash
agentic-bus setup --skills
```

Leia os modelos antes de usá-los: eles incluem pontos de verificação de aprovação, requisitos de teste e regras de segurança do Git. Algumas instruções e interações estão em português brasileiro.

## Estado privado e segurança

Credenciais, catálogos de modelos gerados, sessões, memória, caches e conteúdo de pacote instalado são intencionalmente excluídos por `.gitignore`. Cada usuário deve gerar seu próprio estado local e autenticar independentemente.

Não confirme tokens, chaves de API, arquivos `.env` ou dados de sessão/memória. Revise as alterações de configuração antes de publicar: `.gitignore` é uma proteção, não uma garantia de que um arquivo é seguro para compartilhar.

## Créditos

- [Pi](https://pi.dev) para o harness de agente extensível.
- Agentic Bus para as convenções de configuração, integração do provedor e inspiração de fluxo de trabalho que formaram fortemente esta configuração.
