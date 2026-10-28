# VRX RELAY — PROMPT DE RETOMADA (contexto completo)

> Data de referência: 18/10/2026. Idioma de trabalho: português do Brasil.
> Esta sessão pode estar SEM o histórico das anteriores. Tudo o que você precisa saber está neste documento. Leia inteiro antes de qualquer ação.

---

## 0. COMO RETOMAR (faça nesta ordem, antes de qualquer outra coisa)

1. Mostre o diretório atual e rode `git status` e `git branch --show-current`.
2. Se existirem, leia: `docs/PLANO-ORIGINAL.md`, `docs/NOTES.md`, `src/env.ts`, `scripts/keepawake.ps1`.
   - O projeto deve estar em: `C:\dev\vrx-relay` (a branch esperada é `fase-1-acesso-remoto`).
   - Se algum arquivo ou a branch não existir, DIGA o que falta e pergunte. Não invente nem recrie o que deveria existir.
3. NÃO me faça perguntas genéricas sobre "o que o relay deve fazer". As respostas estão neste documento (seções 1 a 4).
4. Atenção à pasta `C:\dev\relay-piloto`: ela é só o CAMPO DE TESTES do Remote Control (vazia, sem credenciais). Não construa o relay nela. O código do relay mora na pasta do projeto.
5. Faça um resumo de no máximo 10 linhas do que entendeu e do que fará a seguir, e então siga para a seção 9 (Passo 6).

---

## 1. QUEM SOU E O OBJETIVO

Sou o Pedro, fundador não-técnico (de origem designer UI/UX), com vários projetos em paralelo. Máquina: notebook com Windows. Celular: Android. Uso Claude Code com ASSINATURA (login oficial claude.ai).

Quero:
1. Trabalhar de qualquer lugar pelo celular: mandar texto ou áudio, acompanhar progresso e aprovar ações.
2. Ver o projeto rodando no celular: o agente me envia links clicáveis (preview local via Tailscale, túnel público temporário, GitHub Pages) com botões.
3. Maximizar meus tokens: o Claude pensa, decide e revisa; modelos gratuitos/baratos (DeepSeek, OpenRouter free e afins) fazem o trabalho braçal, guiados por skills.
4. Design bonito e funcional. ZERO gamificação. Nada de invenção desnecessária.

Codinome do projeto: **VRX Relay**. O orquestrador tem persona: **Bison** (agente nº1 do meu ciclo de agentes "VRX").

Como trabalhar comigo: sou não-técnico; explique decisões em linguagem de negócio, com analogias quando ajudar. Se algo da minha visão for tecnicamente ruim, caro ou arriscado, diga e proponha alternativa. Respostas diretas e organizadas.

---

## 2. PRINCÍPIOS INEGOCIÁVEIS

- Não reinventar o oficial: Remote Control, push, Channels (Telegram) e o app Claude já existem. Usar primeiro; construir só o que falta.
- A sessão principal do Claude roda SEMPRE no login oficial, direto. Nunca `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` ou `ANTHROPIC_API_KEY` de terceiros na sessão principal (a doc oficial diz que Remote Control NÃO funciona com `ANTHROPIC_BASE_URL` apontando para outro host). Modelos baratos entram como FERRAMENTA (MCP "braço"), nunca como substituto do Claude.
- Claude pensa, braço executa, Claude revisa. Nenhum output de modelo barato entra no código sem revisão do Claude e sem passar em lint/teste.
- Segurança por padrão: nada escuta em interface pública. Acesso remoto só via Tailscale (`tailscale serve`) ou túnel temporário que eu aprovo. Segredos só em `.env` fora do repositório. Nunca commitar chave. Nunca ler `.env` nem arquivos de credenciais; se encontrar um, avise e não abra.
- Pergunte antes de: instalar qualquer coisa global, abrir túnel público, fazer push/deploy, criar conta, inserir credencial ou gastar dinheiro de API.
- Incremental: cada fase funciona sozinha e é usável antes da próxima.
- Não toque em pastas da Radiauto nem de clientes da Vaca Roxa. A Fase 1 trabalha só na pasta do projeto e na do piloto.
- Não guarde dados de clientes em lugar nenhum desta stack. Não coloque `node_modules` nem `.git` grandes em pastas sincronizadas pelo OneDrive.

---

## 3. REGRAS DE EXECUÇÃO E PERMISSÕES

- Esta sessão deve estar em modo **Manual** (pergunta antes de agir). Instalações e mudanças de sistema NUNCA em Auto.
- Instalação global: mostre o comando exato, a origem oficial e a versão, e espere meu OK individual para cada uma.
- Comandos destrutivos (rm/rmdir/del, git push, git reset --hard, npm publish, deploy, instalar pacotes globais) nunca são auto-aprovados, nem pelo Telegram.
- Mantenha as regras de `deny` no settings do projeto. Se ainda não existirem, proponha-as (rm/rmdir/del, git push, git reset --hard, npm publish, deploy, instalação de pacotes globais). CONFIRME NA DOCUMENTAÇÃO atual que `deny` vale também no modo Auto e registre a fonte. Não presuma.
- Git desde o commit 1; branch por fase; commits claros.
- Pare em cada checkpoint em que EU preciso agir, com instruções curtas e exatas do que fazer.
- Ao fim de cada passo: relatório curto (o que passou, o que não passou, o que mudou no plano) e atualização de `docs/NOTES.md`.

---

## 4. DECISÕES JÁ TOMADAS (não reabrir)

**O que é o relay.** NÃO é um servidor que repassa mensagens. É um script de linha de comando (`bin/relay`) com três subcomandos:
- `relay start <pasta>`: abre o `claude` em janela própria, nomeado, com Remote Control e Channels; liga o keep-awake; limpa `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_API_KEY` só no processo filho (avisando apenas o NOME da variável, nunca o valor); guarda PID e nome em `~/.vrx-relay/state.json`; tenta `--continue` se houve sessão nas últimas 4h.
- `relay status`: sessões, links, último erro.
- `relay stop`: encerra tudo e libera a energia.
O roteamento celular → sessão é feito pelo Remote Control e pelo Telegram Channels (oficiais). O relay não faz proxy nem recebe webhook, e não escuta porta nenhuma.

**Linguagem:** Node + TypeScript (Node 24 roda TS direto), sem dependências externas, sem build. NÃO usar Bun, salvo justificativa concreta e meu OK.

**Acesso:** só eu, pela tailnet. Previews de teste via `tailscale serve` (HTTPS só dentro da tailnet), com o servidor em `127.0.0.1`. Evite bind em `0.0.0.0`; se for inevitável, justifique.

**Autenticação extra:** nenhuma agora (o relay não escuta porta). Se algum dia virar servidor, token é obrigatório.

**Energia:** notebook na tomada, tampa aberta, tela pode apagar. Use `SetThreadExecutionState` só com o pedido de "sistema ocupado" (sem flag de tela), num processo auxiliar que sai sozinho se o pai morrer. O relay NÃO altera o plano de energia nem a ação da tampa do Windows. (Em 18/10 o notebook suspendia sozinho em 5 min na tomada e 3 min na bateria.) Em 19/10 o Pedro decidiu ajustar o Windows ele mesmo: nunca suspender na tomada, tampa fechada na tomada = não fazer nada, Wi-Fi sem economia de energia. Conferir com `powercfg /query` no Passo 0 do passo 6.

**Voz (atualizado em 19/10/2026):** transcrição LOCAL com faster-whisper, modelo `small`, em CPU (venv em `.venv/`, `av==16.1.0` fixado). Substituiu o Groq: o áudio não sai do PC, não há chave de API e não há custo por uso. O plugin do Telegram só baixa o arquivo (`download_attachment`); a transcrição é nossa (`scripts/transcribe.py`, `src/transcribe.ts`), com `initial_prompt` para nomes próprios. Voz é só para comandos meus (não vou ditar dados sensíveis de clientes). OGG/Opus do Telegram: testado e aceito.

**Telegram:** eu crio o bot no BotFather. Eu mesmo rodo `/telegram:configure` no terminal: o token NUNCA passa pelo chat. Token em `~/.claude/channels/telegram/.env` (fora do repo). Pareamento só com meu usuário e `policy allowlist` ATIVA antes de qualquer teste que execute ações.

**Pasta bloqueada (blocklist de delegação):** fica para a Fase 2. Até lá a sessão só trabalha na pasta do projeto e na do piloto.

---

## 5. ESTADO ATUAL

### Atualização de 19/10/2026 (vale sobre o que estiver mais abaixo)
- **Passos 1, 2 e 4 concluídos.** **Passo 3 (Tailscale) feito**, com uma pendência cosmética: o aviso "failed to set the DNS configuration ... Access is denied" no `tailscale status`. O Tailscale tenta mudar o DNS do Windows (MagicDNS) e o Windows nega. Não impede o celular de abrir `<NOME>.ts.net`; só impede o PC de resolver nomes da tailnet (os IPs funcionam). Decisão: não mexer.
- **Passo 4 (Telegram):** `--remote-control` e `--channels` funcionam no MESMO processo e a sessão aparece no app (aba Code). O pedido de permissão vai ao Telegram com botões See more / Allow / Deny (permission relay); Allow e Deny pelo Telegram testados. Política do bot: `allowlist`, só o Pedro. Verificação em duas etapas do Telegram: ativa. Quem responde pelo canal consegue aprovar ações (doc oficial).
- **Passo 5 (voz):** transcrição LOCAL (faster-whisper `small`), no lugar do Groq. Ver seção 4.
- **Passo 6:** plano (relay + vigia, opção "um processo interativo com --remote-control + --channels") aprovado; em andamento pelo Passo 0 (só leitura). Detalhes e decisões em `docs/NOTES.md`.
- Regras de allow no settings de usuário: `reply` e `download_attachment` do plugin do Telegram; Write/Edit/Bash seguem em ask. As regras de `deny` do projeto (rm, rmdir, del, git push etc.) estão ativas e já bloquearam exclusões do Claude.
- Itens da lista "Não testado / pendente" abaixo já resolvidos: `--remote-control` + `--channels` no mesmo processo (sim); voz no plugin (só baixa o arquivo; a transcrição é nossa); inline keyboard (sim, nas permissões). Continuam pendentes: suspensão/retorno da sessão e o comportamento real do Auto.

### Concluído
**Passo 1 (ambiente limpo e energia):** commitado na branch `fase-1-acesso-remoto`, 3 testes passando. `src/env.ts` limpa as 3 variáveis só na cópia do ambiente do processo filho. `scripts/keepawake.ps1` faz o keep-awake. Não foi possível confirmar o pedido de energia com `powercfg /requests` (exige administrador); confirmar na prática no teste de ficar parado com a tela apagada.

**Passo 2 (Remote Control + push), testado no celular:**
- Sessão `relay-piloto` (em `C:\dev\relay-piloto`) iniciada com `claude --remote-control "relay-piloto"` aparece no app Claude (aba Code) e responde.
- Push configurado por `/config chave=true` (funciona também enviado pelo app):
  - `agentPushNotifEnabled` = "Push when Claude decides" → ligado
  - `inputNeededNotifEnabled` = "Push when actions required" → ligado
  - REGISTRE as duas chaves no `NOTES.md`.
- Em modo Manual, o pedido de permissão chega ao app com 3 botões: "Permitir uma vez", "Permitir sempre nesta sessão", "Negar". Aprovar pelo app executou a ação no PC. Negar funcionou e o Claude aceitou a recusa.
- Push no celular: chegou na repetição do teste; a primeira tentativa não chegou (suspeitos: modo silencioso/Não perturbe e app aberto na sessão). Também chega notificação no PC.
- Regra de uso a registrar: pela documentação, o push é suprimido enquanto o terminal conectado está em foco; com o app aberto na sessão o Android pode não mostrar o aviso.
- **Modos de permissão no app (+ > Permission): 4 modos: Manual, Aceitar edições, Planejar e AUTO. O Bypass NÃO aparece.**

### Discrepância com a documentação (registrar no NOTES.md como "observado, divergente da doc, 18/10/2026")
A doc oficial (code.claude.com, páginas Remote Control e mobile) diz que não dá para selecionar Auto numa sessão de Remote Control. No meu app o Auto aparece, e o primeiro teste pelo celular (`teste.txt`) rodou sem pedir aprovação com a sessão em automático. Verifique na doc atual os requisitos do auto mode (plano, modelo, versão) e registre a fonte.

### Não testado / pendente
- Suspensão do notebook e retorno automático da sessão no celular.
- Comportamento real do Auto: antes da Fase 2, testar SÓ na pasta do piloto com arquivos descartáveis (um pedido simples e um pedido de apagar arquivo) e registrar o que passa, o que pergunta e o que é bloqueado.
- Versão do `claude` em uso (registrar com `claude --version`; push mobile exige 2.1.110+, Remote Control 2.1.51+).
- Se o plugin oficial do Telegram recebe mensagem de VOZ, se suporta inline keyboard e se aceita mais de um bot por sessão.
- Se `--remote-control` e `--channels` funcionam no mesmo processo (a doc não diz). Se não funcionarem: dois processos (modo servidor para o Remote Control, interativo para o Telegram), ou Telegram só para áudio e links.

---

## 6. FATOS VERIFICADOS (reconfirme os sensíveis a tempo antes de depender deles)

- DeepSeek: modelos vigentes na página de preços: `deepseek-flash` e `deepseek-v4-pro`. `deepseek-chat` e `deepseek-reasoner` tratados como aposentados. `deepseek-flash` custa US$0,15/M de entrada e US$0,60/M de saída fora do pico (dobro no pico). Confirmar listando `/models` quando houver chave.
- OpenRouter free (doc oficial): 20 req/min e 50 req/dia; 1.000/dia com US$10 de crédito. (Um guia de terceiros dizia 200/dia: está errado.) O crédito de US$10 é decisão de gasto MINHA: na Fase 2, proponha com números e espere meu OK.
- Remote Control: exige login de assinatura claude.ai; indisponível com `ANTHROPIC_BASE_URL` de outro host; a transcrição da sessão fica armazenada nos servidores da Anthropic enquanto ativo; reconecta sozinho após suspensão/queda de rede; o processo `claude` precisa continuar rodando e a máquina ligada.
- Channels (Telegram/Discord/iMessage): research preview, exige Claude Code v2.1.80+ e uma sessão rodando (não é serviço persistente). O plugin oficial do Telegram tem botões Allow/Deny para permissões.
- Happy (slopus/happy): criptografia ponta a ponta, mas o servidor deles vê metadados e o app envia analytics ao PostHog. Decisão: só estudar a UX; não usar o servidor deles com minhas sessões.
- OmniRoute: o servidor escuta em 0.0.0.0 por padrão; 13 provedores marcados `tos: avoid` continuam no roteamento a menos que sejam removidos à mão. Clone falhou; docs lidas pelo GitHub raw (licença MIT); só 2 dos 16 arquivos de `docs/security/` foram lidos.

---

## 7. REFERÊNCIAS (em `_refs/`, somente leitura, `--depth 1`, `_refs/` no `.gitignore`)

| Repo | Para quê |
|---|---|
| gitbot-hq/GitBot (MIT) | modelo bots → threads → sessões, cards de aprovação, backend OpenCode. Não usar como dependência (sem autenticação, sem layout de celular). |
| Fei2411/DeepSeek-Bot (Apache-2.0) | UX de orquestração: "Chief", group chat com admin para economizar tokens, handoff por @, painel de uso. Só padrões. |
| matank001/clodfarm (MIT) | governor de uso (5h/semanal), worktree por subtarefa, verify gate, planner via MISSION.md, notificações. Ignorar a metáfora de fazenda. |
| musistudio/claude-code-router | tradução de formato e roteamento por tipo de tarefa. Só estudo (a sessão principal não passa por proxy). |
| slopus/happy | só UX móvel para a Fase 4. |
| diegosouzapw/OmniRoute (MIT) | Fase 2.5 OPCIONAL, ver seção 8. |
| Candidatos a braço: SShadowS/pi-mcp, epistates/praxio, arjunkr303/multi-llm-mcp, fernando-freitas-alves/multi-model-mcp, fegone/claude-code-delegate-local | triagem de ideias: contrato de evidência, teste de coleira, output_file, juiz. Nenhum entrega diff, fallback com classificação de erro, SQLite de custo, blocklist de pastas nem governor. |

Se for copiar qualquer trecho de código: respeitar a licença (MIT/Apache-2.0), manter aviso/NOTICE. Preferir copiar PADRÃO, não código.

---

## 8. PLANO GERAL (somente a Fase 1 está liberada agora)

**Fase 1 — Acesso remoto** (configuração, quase zero código)
Ordem de execução, parando em cada checkpoint em que eu preciso agir:
1. ✅ Ambiente limpo + energia
2. ✅ Remote Control + push
3. ✅ Tailscale + `tailscale serve` (pendência cosmética: aviso de DNS)
4. ✅ Telegram (concluído em 19/10/2026)
5. ✅ Voz: transcrição LOCAL (faster-whisper small), em vez de Groq
6. ⏭️ (em desenho) Script `relay` consolidado (`start`/`status`/`stop`, reconexão, `-c`/`--continue`)
7. `CHECKLIST-MANUAL.md` (passos curtos e sem jargão para mim: BotFather, app Claude, Tailscale no celular, chave Groq, `/config`) + teste de aceite

**Aceite da Fase 1:** do celular, por áudio no Telegram, peço "roda o projeto e me manda o link" e recebo um link Tailscale que abre no celular; uma aprovação de ação chega e é respondida pelo celular.

**Fase 2 — O Braço (MCP local de delegação)** — NÃO começar sem minha aprovação
- Escrever o nosso, pequeno, em TypeScript. ANTES de codar, ler o CÓDIGO (não só o README) de `fegone/claude-code-delegate-local` e `arjunkr303/multi-llm-mcp`, com limite de tempo, e registrar se algo reduz o escopo.
- O braço fala com um endpoint genérico compatível com OpenAI, definido por variável de ambiente (OpenRouter, DeepSeek direto, OmniRoute no futuro).
- Primário: DeepSeek pago (`deepseek-flash` como padrão); OpenRouter free é só bônus.
- Ferramentas: `delegate({ task, context_files, tier, output })` com `output` = `diff` (nunca escreve direto) | `text` | `json`; fallback com classificação de erro; `braco_usage()` (SQLite de custo); `braco_models()`.
- `braco.config.json` com blocklist de pastas que NUNCA vão para delegação (Radiauto e clientes da Vaca Roxa; eu informo os caminhos).
- Skill `delegar-braco`: vai para o braço boilerplate, componentes repetitivos a partir de padrão existente, testes a partir de spec, docstrings/README, refactor mecânico, i18n, transformação de dados, mensagens de commit, resumo de logs. Fica com o Claude: arquitetura, debugging não trivial, segurança, decisões de UX, revisão final de tudo que o braço produziu.
- Hipótese a validar (fonte única, um post no Reddit com 198 execuções, tarefas em português): tarefa bem delimitada é acertada por modelos baratos; modelo sem o arquivo no contexto alucina de forma consistente; o delegado herda as permissões que o MCP lhe der. Incorporar na skill (contexto completo obrigatório, permissão mínima, validar na volta) e fazer um mini-benchmark com 10 tarefas reais minhas.
- Governor-lite (inspirado no clodfarm): ler o uso real do Claude (5h/semanal); acima de limiares configuráveis, a skill delega mais; registrar a decisão.
- Tiers gratuitos: só código NÃO sensível.
- **Fase 2.5 (OPCIONAL, só se os limites do free tier travarem):** OmniRoute com hardening: bind em 127.0.0.1 ou só Tailscale, versão fixada por digest, 3–5 provedores, `tos: avoid` fora, MITM/TPROXY, TLS stealth, plugins e memória desligados, ponte de Telegram desligada. Nunca roteia a sessão principal do Claude.

**Fase 3 — Preview e ações com botão:** skill/hook `preview` (link Tailscale, túnel público via `cloudflared` só com meu OK, URL do GitHub Pages via `gh`); mensagens no Telegram com botões (Abrir preview, Ver diff, Aprovar commit, Deploy Pages, Parar servidor); notificações de conclusão/falha/limite/aprovação. Aprovações em Manual por padrão; Auto só em pastas liberadas.

**Fase 4 — Cockpit PWA** (só depois de 1 semana usando as Fases 1–3): mobile-first, dark, roxo da marca, tipografia forte, alta densidade; telas de Sessões, Thread (chat + cards de aprovação), Previews e Uso; apresente 2 direções visuais antes de implementar; autenticação obrigatória mesmo atrás do Tailscale.

---

## 9. PRÓXIMA AÇÃO: PASSO 6 — `relay` (start/status/stop) + vigia

Objetivo nº 1: a sessão NÃO PODE CAIR enquanto o Pedro está na rua. Plano aprovado em 19/10/2026 (um processo interativo com `--remote-control` e `--channels`, janela "VRX RELAY — NÃO FECHAR", mais um vigia separado que relança com `--continue` e avisa pelo Telegram só com `sendMessage`).
Ordem, com parada antes de cada fase: (0) Passo 0, só leitura: sinal de "Remote Control desconectado", lentidão da transcrição, `powercfg`; (1) `relay start/status/stop`; (2) vigia e notificador; (3) voz automática; (4) testes de aceite.
Decisões e resultados: `docs/NOTES.md`. Não escreva código do passo 6 antes do OK do Pedro depois do Passo 0.

Histórico: o Passo 3 (Tailscale + `tailscale serve`) foi concluído; ver `docs/NOTES.md`.

---

## 10. CAMADA DE IDENTIDADE (cosmética; NÃO bloqueia nenhuma fase)

Objetivo: dar rosto e voz aos agentes sem alterar arquitetura, fases ou aceites. Se este adendo conflitar com qualquer aceite, o aceite vence.

- Persona como configuração: pasta `personas/` com 1 arquivo curto por agente (≤120 tokens: nome, papel, tom, 3 exemplos de fala). `persona.level` na config: 0 = neutro, 1 = leve (padrão), 2 = expressivo, 3 = festa.
- Regras invioláveis:
  - Persona só no texto enviado a MIM (Telegram/cockpit). NUNCA em código, commits, diffs, PRs, READMEs, nem nos prompts de delegação aos modelos baratos.
  - Mensagens críticas (aprovação, limite de uso/custo, falha, deploy, segurança) usam template neutro; no máximo uma linha de sabor ao final.
  - Persona nunca altera permissões: tom de entusiasmo não implica auto-aprovação.
- Elenco inicial (nomes provisórios): Bison (orquestrador, o único que fala comigo), Fiscal (governor de uso/custo), Braço (executor; variação de COR por tier: free, barato, local), Vigia (preview/deploy/notificações).
- Visual: estilo "vinyl toy" (cabeça grande, corpo pequeno, olhos de ponto, sem boca), molde único com variação de cor e acessório, paleta roxa da marca. Não usar a palavra "Funko" nem logo, nem marcas de terceiros; só personagens originais. Sem XP, nível ou ranking.
- **Escopo na Fase 1:** apenas uma linha de assinatura nas mensagens e um passo no CHECKLIST-MANUAL para eu trocar a foto do bot (Bison) no BotFather. Nenhum outro avatar agora. Entregue `personas/STYLE.md` com o guia visual.
- Fase 3: assinatura por tipo de notificação. Fase 4: avatares por estado (idle, working, waiting-approval, error).

---

## 11. FORMATO DAS SUAS RESPOSTAS

- Comece pelo resumo da seção 0.5 e pelo plano do próximo passo; não repita este documento de volta.
- Seja objetivo; use listas só quando eu for comparar ou conferir itens.
- Ao terminar um passo: o que passou, o que não passou, o que mudou no plano, e exatamente o que eu devo fazer (se houver checkpoint).
- Se algo aqui contradisser a realidade que você observar (versão, flag, comportamento), diga o que viu e proponha o ajuste; não siga cegamente este documento.
