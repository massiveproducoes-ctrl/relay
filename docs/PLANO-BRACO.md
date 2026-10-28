# Plano técnico — O Braço (Fase 2, etapa 4)

> Status: PROPOSTA, aguardando OK do Pedro. Nenhum código escrito.
> Base: `docs/CONTEXTO.md` (Fase 2), `docs/PLANO-ORIGINAL.md` §5 e a leitura de referências em `docs/NOTES.md` (24/10).

## Ideia em uma frase
Um servidor MCP pequeno, em TypeScript e sem dependências, que recebe uma tarefa do Claude, lê só os arquivos permitidos, faz **uma** pergunta a um modelo barato e devolve a resposta (diff, texto ou JSON) para o Claude revisar. O Braço nunca grava arquivo nem roda comando.

## Decisões já tomadas
- Sessão principal do Claude intocada; o Braço é só uma ferramenta.
- Uma chamada por tarefa: sem laço de agente, sem ferramentas para o modelo barato.
- Lista de **permitidas** no lugar da lista proibida (decisão de 24/10): só a pasta do projeto da tarefa.
- Sem chave por enquanto (gasto adiado): tudo é testado contra um servidor falso.

## Peças
| Arquivo | O que faz |
|---|---|
| `src/braco/files.ts` | Lê os `context_files`. Só aceita arquivos dentro da `workdir` (resolve o caminho real: bloqueia `../`, caminho absoluto fora e atalho/symlink que escapa). Sempre bloqueia `.env`, `.env.*`, `*.pem`, `*.key` e `~/.claude/channels/`. Limites: até 3 arquivos e 64 KB no total (ajustáveis). |
| `src/braco/llm.ts` | Chama um endpoint compatível com OpenAI (`/chat/completions`). Endereço e modelo vêm do `braco.config.json`; a chave vem de `~/.vrx-relay/braco.env` (fora do repositório; o Claude nunca lê). Só fala com hosts da lista `allowedHosts`. Tempo limite. Classifica o erro: sem chave, limite de uso (429), rede, erro do provedor (5xx), resposta inválida. |
| `src/braco/diff.ts` | Confere a resposta quando `output = diff`: precisa ser um diff unificado que só mexe nos arquivos enviados. Senão, devolve erro em vez do diff. |
| `src/braco/usage.ts` | Registra cada chamada (data, modelo, tokens de entrada e saída, custo estimado, sucesso/erro) em `~/.vrx-relay/braco-usage.jsonl`. Sem conteúdo da tarefa. |
| `src/braco/server.ts` | Servidor MCP por stdio, escrito à mão (JSON-RPC: `initialize`, `tools/list`, `tools/call`). Ferramentas abaixo. |
| `braco.config.json` | Endpoint, modelo, preços por milhão de tokens, `allowedHosts`, limites. Sem segredo. |
| `test/braco-*.test.ts` | Testes com servidor falso local que imita o DeepSeek. |
| `.claude/skills/delegar-braco/SKILL.md` | Quando delegar e como (etapa 5). |

## Ferramentas do MCP
- `delegate({ task, workdir, context_files, output })` — `output`: `diff` | `text` | `json`. Devolve a resposta, o modelo usado, tokens e custo estimado.
- `braco_usage({ days? })` — total de chamadas, tokens e custo por dia e por modelo.
- `braco_models()` — modelos configurados e se o endpoint responde (sem gastar tokens quando o provedor permitir).

## Mudanças em relação ao plano original
1. **Sem laço de agente** (decidido na etapa 1): menor, mais seguro, mais fácil de testar.
2. **Registro de uso em JSONL** em vez de SQLite: um arquivo de texto com uma linha por chamada. Dá as mesmas somas, sem dependência e sem recurso experimental do Node.
3. **MCP escrito à mão** em vez do SDK oficial (`@modelcontextprotocol/sdk`): mantém o projeto sem dependências e sem instalar nada. Risco: errar algum detalhe do protocolo; mitigação: testes de ponta a ponta com o próprio Claude Code. Se der problema, a alternativa é instalar o SDK (pede seu OK).
4. **Cadeia de fallback** fica para quando houver mais de um provedor: hoje só o DeepSeek está no plano.
5. **Governor-lite** (delegar mais quando o uso do Claude estiver alto) fica para depois do mini-teste das 10 tarefas.

## Etapas, com parada para OK
- **4a** `files.ts` + `braco.config.json` + testes (só código e testes; nada liga).
- **4b** `llm.ts` + `diff.ts` + `usage.ts` + testes com servidor falso.
- **4c** `server.ts` + teste de protocolo. Registrar no Claude Code com um `.mcp.json` no projeto: **muda configuração, pede seu OK**, e a confirmação de confiança aparece só no terminal do PC (com o relay parado).
- **5** Skill `delegar-braco`.
- Depois, com o gasto liberado: chave no `braco.env`, teste real e mini-teste com 10 tarefas.

## Riscos
- Código sai do PC para o provedor do modelo: só o que estiver na pasta permitida e fora dos bloqueios de senha.
- O modelo barato erra: tudo volta como proposta; o Claude revisa e roda os testes antes de aplicar.
- Adicionar um MCP ao projeto afeta também a sessão do relay (ela carrega o Braço). Sem chave, ele só responde "sem chave".
