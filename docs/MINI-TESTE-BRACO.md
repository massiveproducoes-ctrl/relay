# Mini-teste do Braço (10 tarefas)

> Proposta, para o Pedro trocar o que quiser. Roda quando houver chave (gasto adiado em 24/10).
> Todas são tarefas reais deste projeto, de tipos que a skill `delegar-braco` manda ao Braço. Nada sensível.

## Tarefas
| # | Tipo | Tarefa | Arquivos | Saída |
|---|---|---|---|---|
| 1 | refactor mecânico | Juntar o laço repetido de `lastUserOrigin` e `lastUserKind` numa função só, sem mudar o comportamento | `src/stop-hook.ts` | diff |
| 2 | testes a partir de spec | Testes para `readUsage`: arquivo ausente devolve `[]`; linhas antigas fora do período são ignoradas | `src/braco/usage.ts`, `test/braco-llm.test.ts` | diff |
| 3 | testes a partir de spec | Mais casos para `isSecretName`: `.ENV`, `.env.production`, `chave.Key`, `envelope.ts` (não é segredo) | `src/braco/files.ts`, `test/braco-files.test.ts` | diff |
| 4 | boilerplate | Script `braco` no `package.json` que roda o servidor do Braço | `package.json` | diff |
| 5 | docs | `README.md` curto do projeto (o que é, como ligar, onde estão os docs), a partir do CLAUDE.md e do checklist | `CLAUDE.md`, `docs/CHECKLIST-MANUAL.md` | text |
| 6 | docs | Comentário de cabeçalho para `src/braco/server.ts` listando as 3 ferramentas e o que cada uma devolve | `src/braco/server.ts` | diff |
| 7 | transformação de dados | Tabela do Glossário de ferramentas do CLAUDE.md em JSON (`nome`, `codinome`, `faz`, `risco`) | `CLAUDE.md` | json |
| 8 | mensagem de commit | Mensagem de commit para o diff da tarefa 1 | (diff colado no pedido) | text |
| 9 | resumo de log | Resumo em 5 linhas do `watcher.log` (quedas, religamentos, avisos) | `~/.vrx-relay/watcher.log` copiado para o scratchpad | text |
| 10 | resumo | Resumo do `docs/NOTES.md` em 10 linhas para quem chega agora | `docs/NOTES.md` | text |

Obs.: na 9 o arquivo está fora da pasta do projeto; o Braço só lê arquivos da `workdir`, então a tarefa usa uma cópia no scratchpad como `workdir`. Na 10, o `NOTES.md` tem 33 KB em 24/10, dentro do limite de 64 KB.

## Como medir (por tarefa)
- **Resultado:** ✅ aceito sem ajuste · 🟡 aceito com ajuste pequeno (até ~5 linhas) · ❌ refeito pelo Claude.
- **Custo** (`costUsd`) e **tokens** de entrada e saída.
- **Testes** passaram depois de aplicar (só tarefas de código).
- **Observação** de 1 linha: o que errou ou acertou.

## Aceite (do plano original)
Numa tarefa real, pelo menos 40% das gerações de código saem do Braço, com qualidade aprovada pelo Claude, e o Pedro vê o relatório de uso/economia (`braco_usage`).
Aqui: contar ✅ + 🟡 entre as tarefas 1–4 e 6 (as de código). Meta: pelo menos 2 de 5.
