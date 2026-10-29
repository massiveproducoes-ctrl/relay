# Colaboração

Proposta do Pedro, a ser aprovada pelo Matheus.

## Fluxo
- Cada tarefa vira uma branch (ou worktree), um commit claro e um pull request para a `main`.
- Ninguém dá push direto na `main`.

## Revisão
- Hoje a `main` exige pull request com 0 aprovações, porque só o Pedro está ativo.
- Quando o Matheus entrar, subir para 1 aprovação.

## Mensagem de commit
- Verbo no presente (ele atualiza, ele cria), uma linha, em português.
- Exemplo: `docs: atualiza estado do projeto`.

## Regras de segurança
- Nunca commitar `.env`, tokens, IPs da tailnet nem caminhos pessoais.
- Nunca `git push --force`.

## Sessões do Claude
- Uma sessão do Claude por worktree, sem `--channels` (ver `docs/WORKTREES.md`).

## Registro
- Decisões vão em `docs/NOTES.md`.
- Quem executou cada entrega entra no registro de contribuição do Memorando de Parceria.
