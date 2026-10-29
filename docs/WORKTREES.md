# Worktrees: sessões paralelas

## O que é
Uma worktree é uma segunda pasta do mesmo repositório, com a própria branch, para trabalhar em duas tarefas ao mesmo tempo sem uma atrapalhar a outra.

## Criar
```
git worktree add ..\vrx-relay-<tarefa> -b <branch> main
```

## Remover depois do merge
```
git worktree remove ..\vrx-relay-<tarefa>
```

## Regras
- Uma sessão do Claude por worktree.
- Sessão de worktree nunca sobe com `--channels`. O bot do Telegram aceita só um processo, então uma segunda sessão com o canal derruba o relay.
- Cada worktree vira uma branch e um pull request.
- Nunca `git push --force`.
