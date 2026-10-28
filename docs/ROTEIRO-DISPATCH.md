# Roteiro: teste do Dispatch (30 min)

> Objetivo: ver se o Dispatch oficial resolve o que o relay + vigia resolvem hoje, antes de investir mais no passo 6 (decisão 5 de `docs/DECISAO-FECHAMENTO.md`).
> Você faz no celular; eu não consigo rodar este teste. Anote o resultado de cada passo na tabela do fim.

## O que é o Dispatch (doc oficial, out/2026)
- Recurso da Anthropic para mandar tarefas do celular para o Claude Desktop no PC. Fica no painel lateral do Cowork.
- Tarefa de código vai para o Claude Code; o resto vai para o Cowork.
- Avisa no celular (notificação push) quando termina ou quando precisa de aprovação.
- Pedido de aprovação sem resposta em **10 min é negado sozinho**, e a tarefa segue sem aquela ação.
- O PC precisa estar ligado, acordado e com o Claude Desktop aberto.
- Disponibilidade: beta limitado em alguns planos Pro e Max. Pode não aparecer na sua conta.
- Fontes: [Ajuda do Cowork](https://support.claude.com/en/articles/13947068-assign-tasks-from-anywhere-in-claude-cowork), [Guia do Dispatch](https://claude.com/docs/cowork/guide/dispatch), [Claude Code no desktop](https://code.claude.com/docs/en/desktop).

## Antes de começar (decisões suas)
- Se o Claude Desktop precisar ser instalado ou atualizado, isso é instalação: confira a origem (claude.com/download) e a versão antes.
- A configuração do Dispatch pergunta se ele pode **acessar arquivos** e **manter o PC acordado**. Recomendo: acesso só à pasta de testes `C:\dev\relay-piloto`, nunca à `C:\dev\vrx-relay` nem a pastas da Radiauto ou de clientes.
- O relay pode continuar ligado. Só não peça a mesma tarefa nos dois ao mesmo tempo.

## Passos

| # | Tempo | O que fazer | O que observar |
|---|---|---|---|
| 1 | 5 min | Abrir o Dispatch no Claude Desktop, "Get started", ligar no celular. | Aparece na sua conta? Quantos passos até funcionar? |
| 2 | 3 min | Do celular: "liste os arquivos de C:\dev\relay-piloto". | Quanto tempo até a resposta? Chegou notificação? |
| 3 | 5 min | Do celular: "crie C:\dev\relay-piloto\teste-dispatch.txt com a palavra ok". | Pediu aprovação antes de gravar? Dá para ver o que está aprovando? **Em que modo de permissão a sessão abriu (manual ou auto)?** |
| 4 | 12 min | Repetir o passo 3 com outro nome e **não responder** a aprovação por 10 min. | Negou sozinho aos 10 min? Avisou? |
| 5 | 3 min | Fechar o Claude Desktop e mandar uma tarefa do celular. | Avisou que o PC está fora? A tarefa ficou guardada para depois? |
| 6 | 2 min | Reabrir o Claude Desktop. | A tarefa pendente rodou sozinha ou se perdeu? |

O passo 3 é o mais importante: o relay foi fixado no modo Manual justamente para nada ser aprovado sem você. Se o Dispatch abrir em auto, ele aprova ações sozinho.

## Comparação (preencher)

| Critério | Relay + vigia (hoje) | Dispatch |
|---|---|---|
| Configuração | já pronto | |
| Pedir por texto | sim (Telegram) | |
| Pedir por voz | sim (Whisper local) | |
| Aprovação mostra o comando real | sim (See more) | |
| Modo Manual garantido | sim (config do projeto) | |
| Aviso de fim de tarefa | sim (Stop hook, bloco de fechamento) | |
| Opções numeradas para continuar | sim | |
| Religa sozinho se cair | sim (até 5 vezes em 30 min) | |
| Aprovação esquecida | fica esperando | nega em 10 min |
| Persona Bison e Fase 2 | sim | |

## Depois do teste
Mande o resultado (pode ser por voz). Eu registro no `docs/NOTES.md` e proponho a decisão do passo 6: seguir com o vigia, trocar pelo Dispatch ou usar os dois.
