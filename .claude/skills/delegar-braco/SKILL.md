---
name: delegar-braco
description: Decide when and how to hand a small, well-bounded coding subtask to the Braço (the cheap-model MCP tool mcp__braco__delegate) and how to review what comes back. Use when about to write boilerplate, repetitive components from an existing pattern, tests from a clear spec, docstrings/README text, mechanical refactors (rename, move), i18n strings, data transformation, commit messages or long-log summaries — and whenever the user asks to "delegar", "usar o braço" or save Claude usage. Do not use for architecture, non-trivial debugging, security or UX decisions.
---

# Delegar ao Braço

O Braço é um modelo barato atrás do MCP `braco`. Ele faz UMA chamada, não vê o disco além dos arquivos que você passar, nunca grava e nunca roda comando. Você continua responsável pelo resultado.

## Antes de delegar
1. Rode `mcp__braco__braco_models`. Se `key` for `ausente`, não delegue: faça você mesmo e diga em uma linha que o Braço está sem chave.
2. A tarefa cabe no Braço? Vai: boilerplate, componente repetitivo a partir de um padrão que já existe, testes a partir de spec, docstrings/README, refactor mecânico, i18n, transformação de dados, mensagem de commit, resumo de log. Fica com você: arquitetura, debugging não trivial, segurança, decisões de UX, qualquer coisa ambígua.
3. Nada sensível: sem senhas, tokens, dados de clientes. Pastas da Radiauto e de clientes da Vaca Roxa nunca entram.
4. Divida antes: até 3 arquivos e ~300 linhas por chamada, um tipo de trabalho por chamada (não misture "código + testes + docs").

## Como chamar `mcp__braco__delegate`
- `workdir`: caminho absoluto do projeto. `context_files`: relativos à workdir, todos os que a tarefa precisa (modelo sem o arquivo inventa).
- `task`: o quê, onde e o critério de pronto, em frases curtas. Termine com: "Seu escopo: só estes arquivos. Não invente conteúdo de outros arquivos."
- `output`: `diff` para mudar código; `text` para texto (commit, resumo, README); `json` para dados.
- Sem persona nem tom do Bison no `task`: o pedido ao Braço é técnico e neutro.

## Na volta (obrigatório)
1. Leia a resposta inteira. O Braço já recusou diff que mexe em arquivo não enviado; o resto é com você.
2. Para `diff`: salve num arquivo temporário do scratchpad e rode `git apply --check <arquivo>`; se passar, aplique com `git apply <arquivo>` (pede aprovação no modo Manual). Se não passar ou estiver ruim, corrija você mesmo com Edit; não insista no Braço mais de uma vez.
3. Rode os testes do projeto (`npm test` aqui) antes de dizer que terminou.
4. No fechamento, diga o que veio do Braço, o modelo e o custo (`costUsd`), e o que você mudou na revisão.

## Erros comuns
- `sem-chave`: pare de delegar nesta sessão.
- `limite`: espere ou faça você mesmo; não repita em laço.
- `rede` / `provedor`: tente uma vez; depois faça você mesmo.
- `conferencia` (resposta fora do formato): reformule o `task` uma vez, com o formato mais explícito; se falhar de novo, faça você mesmo.

Custo acumulado: `mcp__braco__braco_usage`.
