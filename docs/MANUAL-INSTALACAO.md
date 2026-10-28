# Manual de instalação do VRX Relay (para o Matheus)

> Este manual leva do zero até o relay funcionando no seu PC, com o seu próprio bot e a sua própria conta Claude.
> Se algo der errado fora do que está aqui, não tente adivinhar nem mexer em arquivos de credencial: mande ao Pedro o resultado de `.\bin\relay.cmd status` e a mensagem de erro exata.

## 0. Antes de começar

Confirme que você tem tudo isto. Se faltar algum item, resolva antes de seguir.

- [ ] **Windows 10 ou 11.** O relay só roda no Windows. Ele abre o Claude numa janela própria e usa comandos do PowerShell.
- [ ] **Um PC que fica ligado na tomada** durante o uso. Na bateria ele dorme em 3 minutos e o relay para de responder.
- [ ] **Git para Windows** (`git --version` num PowerShell devolve uma versão).
- [ ] **Node.js 24 ou mais recente** (`node --version`). O projeto declara `node >= 24`.
- [ ] **Python 3.14** instalado e no PATH (`python --version`). É a versão em que o relay foi testado. Serve para criar o `.venv` da transcrição de áudio (passo 2).
- [ ] **Claude Code** instalado (`claude --version`), logado com a **sua** conta Claude, pelo login oficial.
- [ ] **Uma conta de Telegram** e um **bot próprio** (passo 3). Não use o bot do Pedro.
- [ ] **App do Claude no celular**, com a mesma conta do PC.

Regra de ouro das credenciais: token de bot, chave de API e arquivos `.env` nunca vão para chat, print, commit ou e-mail.

## 1. Clonar o repositório

Use exatamente este caminho. Ele não é opcional, porque o arquivo `.mcp.json` aponta para `C:\dev\vrx-relay`.

```powershell
cd C:\dev
git clone https://github.com/massiveproducoes-ctrl/relay.git vrx-relay
cd C:\dev\vrx-relay
```

Você vai trabalhar na branch `main`. Se for criar uma branch sua para mexer no código, use um nome curto, como `matheus/tarefa-x`.

## 2. Instalar as dependências

**Node:** o projeto não tem dependências de pacote no `package.json`. Basta ter o Node 24 (passo 0).

**Python (transcrição de voz):**

```powershell
cd C:\dev\vrx-relay
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Na primeira transcrição o modelo `small` do Whisper é baixado pela internet. Depois disso, a transcrição roda no seu PC, sem serviço pago.

> O `transcribe-cli` usa sempre o Python do `.venv` do projeto (`.venv\Scripts\python.exe`), nunca o Python do PATH. Por isso o `faster_whisper` precisa estar instalado no `.venv`, como acima. Instalar no Python do sistema não adianta.

## 3. Criar o seu bot no Telegram

Cada pessoa tem o próprio bot. Um bot aceita só um processo, então dois relays com o mesmo bot se atrapalham.

1. No Telegram, abra o **@BotFather** e envie `/newbot`.
2. Escolha um nome e um nome de usuário que termine em `bot`.
3. Guarde o token que o BotFather devolve. **Não envie o token para ninguém.**
4. Coloque o token no arquivo `%USERPROFILE%\.claude\channels\telegram\.env`, no formato que o plugin do Telegram pedir.
5. Ainda no BotFather, use `/setuserpic` se quiser trocar a foto do bot.
6. Faça o pareamento do seu Telegram com o bot: numa sessão normal do Claude (fora do relay), rode `/telegram:access` e siga as instruções.

> **Plugin do Telegram:** o relay usa o plugin `telegram@claude-plugins-official` (o Pedro usa a versão 0.0.7). Instale antes do item 4 acima, numa sessão normal do Claude no terminal (fora do relay), com o comando `/plugin install telegram@claude-plugins-official`. Depois feche e abra o Claude de novo para o plugin carregar.

## 4. Aceitar a pasta no Claude

O relay não abre uma pasta que o Claude ainda não conhece como confiável. Esse aviso só aparece no terminal, e o relay não consegue responder a ele.

```powershell
cd C:\dev\vrx-relay
claude
```

Quando o Claude perguntar se você confia na pasta, aceite. Depois saia com `/exit`.

## 5. Ligar, conferir e desligar o relay

Tudo sai de um PowerShell comum, dentro de `C:\dev\vrx-relay`:

```powershell
.\bin\relay.cmd start     # liga o relay
.\bin\relay.cmd status    # confere se está de pé
.\bin\relay.cmd stop      # desliga
```

Ao ligar, você deve ver:
- uma janela chamada **"VRX RELAY — NÃO FECHAR"**. Não feche;
- o keep-awake ligado (o PC não dorme enquanto o relay roda);
- o vigia ligado (religa o Claude se a janela cair, e avisa no Telegram).

Em cerca de um minuto, a sessão **relay-vrx** deve aparecer na aba **Code** do app do Claude.

## 6. Como saber que funcionou (teste de aceite)

Só considere a instalação pronta quando os quatro itens abaixo passarem:

- [ ] `relay status` mostra o Claude, o keep-awake e o vigia vivos.
- [ ] Você manda "oi" para o seu bot no Telegram e recebe resposta.
- [ ] A sessão **relay-vrx** aparece no app do Claude, na aba Code, no seu celular.
- [ ] `npm test` roda sem falha de ambiente (falhas de lógica devem ser avisadas ao Pedro).

Para o último item, rode `npm test` no PowerShell dentro de `C:\dev\vrx-relay`, com o relay desligado.

## 7. Regras do dia a dia

- **Regra de ouro:** com o relay ligado, **não abra o Claude Code no terminal desta pasta**. Ele rouba as mensagens do bot e confunde o Stop hook.
- Para mexer no projeto pelo PC: `relay stop`, trabalhar, fechar a sessão, `relay start`.
- Comandos com barra (`/mcp`, `/plugin`, `/config`) e confirmações de pasta ou de servidor MCP só funcionam no terminal do PC, não chegam ao celular.
- A permissão padrão do projeto é **manual**: toda ação que precisa de aprovação aparece no Telegram ou no app.
- Ações proibidas pelo projeto, mesmo aprovadas: apagar arquivos (`rm`, `del`, `Remove-Item`), `git push`, `git reset --hard`, `npm publish`, instalação global e deploy. Se uma tarefa exigir alguma delas, pare e fale com o Pedro.
- Isso inclui o **seu** `git push`: ele também é bloqueado no seu clone, de propósito. A regra de envio do seu trabalho:
  1. Trabalhe sempre numa branch sua (`matheus/tarefa-x`), nunca no `main`. Faça commit nela.
  2. Para enviar, digite você mesmo no prompt do Claude, com o `!` na frente: `! git push origin matheus/tarefa-x`. O Claude não envia por você.
  3. Avise o Pedro. Só ele junta o seu trabalho ao `main`, pelo GitHub, depois de revisar.
  4. Nunca envie para o `main` e nunca use `--force`.
  Para isso o Pedro precisa te dar permissão de escrita no repositório.

## 8. O que não fazer

- Não use o bot do Pedro, nem a conta Claude dele.
- Não copie `.env`, tokens, IDs do Telegram ou a pasta `~\.vrx-relay` para fora da sua máquina.
- Não faça commit de `.env`, de `.venv` ou de alterações pessoais no `.mcp.json`.
- Não ligue o **Braço** (DeepSeek) com chave própria sem combinar com o Pedro. O gasto é dele para autorizar.
- Não use `git push --force`. Se precisar mexer no histórico, fale antes.

## 9. Problemas comuns

| O que aparece | O que fazer |
|---|---|
| "Já está rodando" | Rode `relay stop` e depois `relay start`. |
| "A pasta ainda não foi marcada como confiável" | Passo 4: rode `claude` na pasta, aceite e saia com `/exit`. |
| "Não achei o comando claude" | O Claude Code não está no PATH. Reinstale ou ajuste o PATH com cuidado. |
| "Não consegui conferir a confiança da pasta" | Confirme que a pasta é `C:\dev\vrx-relay` e rode `claude` nela. |
| Keep-awake ou vigia aparecem como "NÃO ligou" | Rode `relay stop`, depois `relay start`. Se repetir, mande o `relay status` ao Pedro. |
| O bot não responde | Confira se o token está no arquivo certo e se o plugin do Telegram está instalado. Confirme que nenhum outro processo está usando o mesmo bot. |
| A sessão não aparece no celular em 1 minuto | Confira a conta do app e se o celular tem internet. Mande o `relay status` ao Pedro. |
| A janela do Claude fechou | O vigia religa e avisa no Telegram. Se não religar, rode `relay status`. |
| Transcrição de áudio falha | Confirme que o `.venv` existe e que o `pip install -r requirements.txt` rodou com ele ativado (passo 2). O Python do PATH não é usado. |

## 10. Limites conhecidos (28/10)

Isto está escrito para você não se surpreender. São pendências da Sprint 1, não erros seus.

- **Só Windows.** O relay não roda em outro sistema.
- **Braço sem chave:** o projeto já registra o servidor `braco` (modelo barato para tarefas braçais), mas sem chave. Ele aparece na lista e recusa qualquer chamada com o aviso "sem chave". Isso é esperado, não é erro de instalação.
- **Caminho fixo:** o `.mcp.json` aponta para `C:\dev\vrx-relay`. Mudar a pasta exige editar esse arquivo localmente e não commitar a mudança.
- **Um bot, um processo.** Por isso cada pessoa usa o próprio bot.
- **Nome de sessão fixo:** a sessão se chama sempre `relay-vrx` (definido em `src/launcher.ts`). No mesmo PC, um segundo relay nem abre: o `relay start` recusa com "Já está rodando". Em dois PCs na mesma conta Claude, aparecem duas sessões com o mesmo nome no app, e fica difícil saber qual é qual.
- **Mesma conversa:** o relay retoma a conversa anterior se ela tiver menos de 4 horas. Ele não separa o trabalho de duas pessoas. Isso está na lista da Sprint 1.
- **Comandos de terminal:** `/mcp`, `/plugin` e `/config` não chegam ao celular.

## 11. Quem chamar

- Dúvida de instalação ou de uma pendência que não está aqui: **Pedro**.
- Mande sempre junto: o que você tentou, a mensagem de erro exata e o resultado de `.\bin\relay.cmd status`. Sem token, sem `.env`, sem IDs.
