# Colaboração

Proposta do Pedro, a ser aprovada pelo Matheus.

## Fluxo
- Cada tarefa vira uma branch (ou worktree), um commit claro e um pull request para a `main`.
- Hoje, com só o Pedro ativo, a regra de pull request na `main` está desligada e o Pedro pode dar push direto.
- Quando o Matheus entrar, ninguém dá push direto na `main`.

## Revisão
- Quando o Matheus entrar, religar a regra de pull request na `main`, com 1 aprovação.

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
