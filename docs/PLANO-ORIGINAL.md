# MISSÃO: VRX Relay — Claude Code remoto + orquestração multi-modelo

> Cole este arquivo inteiro numa sessão nova do Claude Code, numa pasta vazia chamada `vrx-relay`, em **plan mode**.
> Primeiro entregável: `_refs/NOTES.md` + plano da Fase 1. Depois disso, PARE e espere minha aprovação.

---

## 1. Quem sou e o que eu quero

Sou o Pedro, fundador não-técnico (designer de UI/UX de origem), tocando vários projetos em paralelo. Uso Claude Code com assinatura.
Quero:

1. **Trabalhar de qualquer lugar pelo celular**: mandar texto ou áudio, acompanhar o progresso, aprovar ações.
2. **Ver o projeto rodando no celular**: o agente me manda links clicáveis (preview local, túnel público, GitHub Pages) com botões.
3. **Maximizar meus tokens**: o Claude pensa, decide e revisa; modelos gratuitos/baratos (DeepSeek, Qwen, GLM, Llama via OpenRouter/Groq) fazem o trabalho braçal, guiados por skills.
4. **Design bonito e funcional**. Zero gamificação. Nada de invenção desnecessária.

O orquestrador desse sistema tem persona: **Bison** (agente nº1 do meu ciclo de agentes "VRX"). O codinome do projeto é **VRX Relay**.

---

## 2. Princípios inegociáveis

- **Não reinventar o que é oficial.** Remote Control, push notifications, Channels (Telegram/Discord) e o app Claude já existem. Usar primeiro, construir só o que falta.
- **O Claude continua no login oficial da assinatura.** Nunca rotear o login da assinatura por proxy de terceiros. Modelos baratos entram como **ferramenta** (MCP) chamada pelo Claude, não como substituto do Claude.
- **Claude pensa, braço executa, Claude revisa.** Nenhum output de modelo barato vai pro código sem revisão do Claude ou sem passar num check (lint/test).
- **Segurança por padrão.** Nada escuta em interface pública. Acesso remoto só via Tailscale (rede privada) ou túnel temporário que eu aprovo. Segredos só em `.env` (no `.gitignore`). Nunca commitar chave.
- **Pergunte antes de** instalar algo global, abrir túnel público, fazer push/deploy, ou gastar dinheiro de API.
- **Incremental.** Cada fase funciona sozinha e é usável antes da próxima começar.

---

## 3. Passo 0 — Estudar as referências (antes de qualquer código)

Clone em `./_refs/` (só leitura, `--depth 1`, adicione `_refs/` ao `.gitignore`):

| Repo | Por que estudar | Arquivos-chave |
|---|---|---|
| `https://github.com/gitbot-hq/GitBot` (MIT) | Hub local: bots → threads → sessões reais de Claude Code/Codex/OpenCode; cards de aprovação; SSE; histórico lido do transcript do próprio agente; backend OpenCode (porta pra outros modelos) | `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `src/`, `ui/` |
| `https://github.com/Fei2411/DeepSeek-Bot` (Apache-2.0) | UX de orquestração: bot "Chief" que gerencia os outros, group chat com admin pra economizar tokens, handoff por @, biblioteca de capabilities (MCP/skills), uso por bot/modelo, memória em Markdown | `README.md`, `AGENTS.md`, `ds-bot/README.md`, a seção *Acknowledgments* (lista de projetos que inspiraram) |
| `https://github.com/matank001/clodfarm` (MIT) | Motor: governor que lê o uso real (janela 5h e semanal) via `rate_limit_event`, worktree por subtarefa, verify gate antes de merge, planner via `MISSION.md`, notificações ntfy/Discord, keeper do Remote Control | `clodfarm/governor.py`, `docs/architecture.md`, `docs/budget.md`, `docs/agents.md`, `docs/security.md` |
| `https://github.com/musistudio/claude-code-router` | Como traduzir formato Anthropic ↔ outros provedores, e regras de roteamento por tipo de tarefa | `README.md`, config de exemplo |
| Fonte do plugin oficial do Telegram (`telegram@claude-plugins-official`) | Entender o protocolo de Channels, pairing, se suporta áudio e botões inline | o que achar no marketplace oficial |

**Entregável do Passo 0:** `_refs/NOTES.md` com, para cada repo:
- O que vamos **roubar** (padrão, não código copiado) e onde entra no VRX Relay
- O que vamos **ignorar** e por quê
- Riscos/limitações encontrados
- Se for copiar qualquer trecho de código: respeitar a licença (MIT/Apache-2.0, manter aviso/NOTICE)

Também verifique e registre no NOTES.md (as coisas mudam rápido, não confie na memória):
- Versão atual do Claude Code e os flags atuais de `claude remote-control`, `--channels` e push notifications
- Se o plugin de Telegram recebe **mensagens de voz** e se suporta **inline keyboard**
- Lista atual de modelos `:free` no OpenRouter (endpoint `/api/v1/models`) e limites do free tier
- Endpoint atual compatível com Anthropic da DeepSeek e nomes dos modelos vigentes
- Comando headless atual do OpenCode (`opencode run` ou equivalente)

---

## 4. Fase 1 — Acesso remoto (configuração, quase zero código)

Objetivo: em 1 sessão eu consigo sair de casa e continuar trabalhando.

1. Remote Control com push notifications ativas no projeto-piloto.
2. Channel do Telegram pareado só com o meu usuário (allowlist).
3. Se o Telegram não transcrever voz: adicionar transcrição (Whisper via Groq free tier, ou `whisper.cpp` local — escolha e justifique).
4. Tailscale na máquina e no celular, pra abrir `localhost` do PC pelo celular.
5. Script `relay` com subcomandos simples:
   - `relay start <pasta-do-projeto>` → abre sessão nomeada com Remote Control + Channels
   - `relay status` → sessões ativas, links, uso
   - `relay stop`
6. Um `CHECKLIST-MANUAL.md` com o que **eu** preciso fazer à mão (criar bot no BotFather, instalar Tailscale no celular, etc.), em passos curtos, sem jargão.

**Aceite:** do celular, por áudio no Telegram, peço "roda o projeto e me manda o link" e recebo um link que abre no meu celular.

---

## 5. Fase 2 — O Braço (MCP server local de delegação)

Objetivo: o Claude delega trabalho braçal para modelos baratos/gratuitos e só revisa.

**MCP server `braco`** (TypeScript ou Python, justifique), com ferramentas:
- `delegate({ task, context_files, tier, output })`
  - `tier`: `free` (OpenRouter `:free` / Groq) → `cheap` (DeepSeek pago) → `local` (Ollama, opcional)
  - `output`: `diff` (unified diff, nunca escreve direto) | `text` | `json`
  - Fallback automático na cadeia quando bater rate limit ou falhar
- `braco_usage()` → requisições, tokens e custo por modelo/dia (SQLite)
- `braco_models()` → modelos disponíveis agora, testados

Configuração em `braco.config.json` (modelos por tipo de tarefa), chaves em `.env`.

**Skill `delegar-braco/SKILL.md`** — matriz de decisão:
- **Vai pro braço:** boilerplate, componentes repetitivos a partir de um padrão existente, testes a partir de spec, docstrings/README, refactor mecânico (renomear, mover), i18n, extração/transformação de dados, mensagens de commit, resumo de logs longos.
- **Fica com o Claude:** arquitetura, debugging não-trivial, segurança, decisões de UX, revisão final de tudo que o braço produziu.
- Regra: todo diff do braço passa por revisão do Claude + lint/test antes de aplicar.

**Governor-lite** (inspirado em `clodfarm/governor.py`): ler uso real do Claude (5h/semanal); acima de limiares configuráveis (ex.: 60% / 80%), a skill fica mais agressiva em delegar; registrar a decisão.

**Aceite:** numa tarefa real do projeto-piloto, ≥40% das gerações de código saem do braço, com qualidade aprovada pelo Claude, e eu vejo o relatório de uso/economia.

---

## 6. Fase 3 — Camada de preview e ações com botão

1. Skill/hook `preview`: quando um dev server sobe, detectar a porta e gerar:
   - Link Tailscale (MagicDNS) pro celular
   - Link público temporário via `cloudflared tunnel --url` (só com minha aprovação; derrubar ao final)
   - URL do GitHub Pages após deploy (via `gh`)
2. Mensagem no Telegram com botões: **Abrir preview** · **Ver diff** · **Aprovar commit** · **Deploy Pages** · **Parar servidor**.
   - Se o plugin oficial não suportar inline keyboard: bot companheiro mínimo só para os botões, ou fork enxuto do plugin. Justifique.
3. Notificações estilo clodfarm (ntfy ou Telegram) para: tarefa concluída, falha, limite de uso, "preciso de aprovação".

**Aceite:** recebo no celular uma mensagem com screenshot/link e botões, e um toque meu dispara o deploy.

---

## 7. Fase 4 — Cockpit PWA (só depois das Fases 1–3 rodarem 1 semana)

- Mobile-first, PWA instalável. Modelo de dados inspirado no GitBot (agentes → threads → sessões).
- Telas: Sessões ativas · Thread (chat + cards de aprovação) · Previews · Uso (Claude 5h/semanal + custo do braço por modelo).
- Persona Bison como orquestrador (estilo "Chief" do DeepSeek-Bot), sem gamificação.
- Design: dark, roxo como cor de marca, tipografia forte, densidade de informação alta, microinterações discretas. Mostre 2 direções visuais antes de implementar.
- Autenticação obrigatória mesmo atrás do Tailscale.

---

## 8. Regras de execução

- Comece em plan mode. Uma fase por vez. Ao fim de cada fase: o que foi feito, como testar do celular, o que ficou pendente.
- Git desde o commit 1. Branch por fase. Mensagens de commit claras.
- Explique decisões técnicas em linguagem de negócio (sou não-técnico; analogias ajudam).
- Se algo da minha visão for tecnicamente ruim, caro ou arriscado, diga e proponha alternativa.
- Não crie conta, não insira credencial, não gaste dinheiro sem eu confirmar.

**Agora:** execute o Passo 0, escreva `_refs/NOTES.md`, proponha o plano detalhado da Fase 1 e PARE.
