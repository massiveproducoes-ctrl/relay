# Decisão: Fechamento de tarefa do Bison (VRX Relay)

> Documento de contexto. Leia inteiro antes de agir. Ele explica o problema, o que pesquisamos, o que já está decidido e o que fazer em cada etapa.

---

## 1. O problema

Quando você (Claude Code) termina uma tarefa, eu (Pedro) não sei qual é o próximo passo.

- No terminal, o Claude Code mostra uma sugestão cinza do próximo prompt. Isso me ajuda a continuar.
- Pelo Telegram e pelo app (Remote Control), essa sugestão não aparece. A tarefa acaba e eu fico sem direção.
- Também acontece de a tarefa terminar e nada chegar no Telegram. O resultado fica só no terminal ou no app.

**O que eu quero:** toda tarefa termina com uma mensagem curta, sempre igual, que diz o que foi feito, prova que funcionou e me dá opções numeradas para continuar. Eu respondo só com o número.

---

## 2. Por que acontece (diagnóstico)

1. **A sugestão cinza é um recurso fechado da interface do terminal.** Não é o modelo que gera para mim. Não existe hook, configuração ou diretiva de CLAUDE.md que leve essa sugestão para fora do terminal. Fora do terminal, o próximo passo só existe se estiver escrito na própria mensagem.
2. **A regra atual tem escopo errado.** O protocolo do CLAUDE.md só vale para tarefas que vieram do Telegram. Tarefas iniciadas no app ou no terminal fecham sem o bloco.
3. **A regra está enterrada.** O CLAUDE.md tem ~96 linhas. Em sessão longa, a regra se dilui.
4. **A entrega depende da boa vontade do modelo.** Hoje a mensagem só chega no Telegram se o modelo decidir chamar o `reply`. Nada garante isso. Uma instrução no CLAUDE.md é um pedido, não uma trava.

---

## 3. O que o mercado faz (pesquisa de out/2026)

- **Formato de número é o padrão.** Guias de supervisão de agentes pelo celular recomendam que o agente faça uma pergunta só, com opções numeradas, para responder com um dígito, e que cada etapa feche com um status curto: o que mudou, o comando rodado, o resultado e o próximo passo.
- **Aprova-se a evidência, não o resumo.** O status precisa trazer o comando executado e o resultado (ex.: exit code), não só "deu certo".
- **A entrega é garantida por Stop hook.** Quem construiu pontes Claude Code ↔ Telegram migrou do envio feito pelo modelo (MCP) para um Stop hook, que roda sempre que o turno termina. O Notification hook repassa os pedidos de atenção.
- **Fluxo mesa → celular → mesa.** Planejar e revisar diff ficam no PC. O celular serve para responder, aprovar ação delimitada e corrigir rota.
- **Risco de modo de permissão.** A partir da v2.1.283, o Claude Code passou a iniciar em modo auto, em que um classificador aprova ações sem perguntar. O start precisa fixar o modo Manual. **(Já fiz isso. Confirme que o comando de start aplica.)**
- **Worktree por tarefa** é o padrão para isolar trabalho remoto. Fica para o passo 6.

---

## 4. Decisões travadas (não reabrir)

1. O transporte continua o oficial: Remote Control + Channels do Telegram, login da assinatura. Nada de proxy de terceiros na sessão principal.
2. Todo fechamento de tarefa usa o bloco abaixo, **em qualquer canal**.
3. A entrega do fechamento ao Telegram vai passar a ser feita por **Stop hook**, não pelo modelo. O `reply` do plugin fica só para perguntas no meio da tarefa.
4. O modo Manual fica fixado no start.
5. O diferencial do projeto é o Bison (protocolo, persona e Fase 2), não o encanamento. Antes de investir pesado no vigia do passo 6, vamos testar o Dispatch oficial como referência.

### O bloco de fechamento

```
✅ Feito: <1 frase>
🧪 Prova: <comando rodado + resultado, ou "não se aplica">
⚠️ Preciso de você: <decisão ou "nada">
➡️ Próximo: 1) <recomendado> 2) ... 3) <fechar: commitar/parar>
```

Regras do bloco:
- A opção 1 é sempre a que você recomenda.
- Cada opção tem verbo + resultado, em até 8 palavras.
- Uma das opções sempre fecha: commitar ou parar.
- Eu respondo só com o número. Se eu mandar um número, execute a opção correspondente do último bloco.
- Decisão no meio da tarefa: uma pergunta só, com opções numeradas.
- Se travar ou falhar: o bloco continua obrigatório, com o motivo em "Feito" e a correção sugerida como opção 1.
- Diff completo e logs longos não vão no Telegram. Diga onde ver.
- Nunca inclua tokens, chaves, IDs ou conteúdo de .env.

---

## 5. Plano em etapas

### Etapa 1 — AGORA (~15 min): regra no CLAUDE.md
1. Mostre o trecho atual do CLAUDE.md sobre formato de resposta e fechamento. Diga se a linha "➡️ Próximo" existe e qual é o escopo.
2. Proponha uma seção **"Fechamento de tarefa"** no TOPO do CLAUDE.md com o bloco e as regras da seção 4. Ela vale para qualquer canal. Se a tarefa veio do Telegram, o bloco vai no reply do Telegram (até a Etapa 2 existir).
3. Remova ou ajuste regras antigas que conflitem, para não existirem duas versões.
4. Confirme que o comando de start fixa o modo Manual.
5. **Mostre o texto final e espere meu OK** antes de gravar. Depois commite.
6. Salve este documento em `docs/DECISAO-FECHAMENTO.md` (se ainda não estiver lá) e adicione uma linha no CLAUDE.md apontando para ele.

### Etapa 2 — PRÓXIMA SESSÃO (~1h30): Stop hook
Não comece agora. Só para você saber o destino:
- Confirme na **doc oficial** o formato de entrada e saída do Stop hook: `stop_hook_active`, o campo com a última mensagem do assistente e o formato de `decision: "block"`. Não confie em README de terceiros.
- O hook confere se a última mensagem tem "➡️ Próximo:". Se não tiver e `stop_hook_active` for false, ele bloqueia uma vez com a razão "Feche com o bloco de Fechamento de tarefa".
- Se tiver, o hook envia o bloco ao Telegram direto pela Bot API, só para o meu chat da allowlist, com o token lido do .env.
- Ajuste o CLAUDE.md: o fechamento deixa de ir pelo `reply`, para não duplicar.
- Script em Node/TS, com teste e log em arquivo. Plano primeiro, código só com meu OK.

### Etapa 3 — DEPOIS: testes e decisão do passo 6
- Testar três cenários: tarefa pelo Telegram, tarefa pelo app e tarefa que falha de propósito.
- Testar o Dispatch por 30 min e comparar com o vigia planejado no passo 6.

---

## 6. Regras de trabalho (valem sempre)

- Mostre antes de gravar. Espere meu OK em qualquer mudança de arquivo de configuração, hook ou CLAUDE.md.
- Se algo for ambíguo, pergunte em vez de adivinhar, com opções numeradas.
- Explique decisões técnicas em linguagem simples. Não sou técnico.
- Ao terminar a Etapa 1, feche com o bloco novo, já como primeiro teste dele.
