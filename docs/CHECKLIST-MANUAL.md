# Checklist manual (o que só você faz)

> Passos curtos. O que já está feito vem marcado. Se trocar de PC ou de celular, refaça os não marcados.

## 1. Telegram (bot do Bison)
- [x] Criar o bot no BotFather (`/newbot`) e guardar o token. O token fica só em `~/.claude/channels/telegram/.env`; nunca mande por chat.
- [x] Parear seu Telegram com o bot (no terminal: `/telegram:access`).
- [ ] Trocar a foto do bot: no BotFather, mande `/setuserpic`, escolha o bot e envie a imagem do Bison.
- Atenção: na pasta do token existe também um `.env.txt` com o mesmo tamanho. Parece cópia. Se não for usado, apague você mesmo (eu não abro nem apago).

## 2. Celular
- [x] App do Claude instalado e com o mesmo login do PC. A sessão aparece na aba Code com o nome `relay-vrx`.
- [x] App do Tailscale instalado e com a mesma conta do PC. Ele precisa estar **ligado** para abrir links `*.ts.net`.
- [ ] Notificações do app do Claude e do Telegram liberadas, sem "Não perturbe" para os dois.

## 3. PC
- PC sempre na tomada. Na bateria ele dorme em 3 min e o relay para de responder.
- Tela nunca apaga na tomada (já ajustado em 24/10). Para bloquear, use Win+L: bloquear não derruba nada.
- Não aperte o botão liga/desliga nem feche a tampa: isso põe o PC para dormir.

## 4. Ligar e desligar o relay
Num PowerShell comum, na pasta `C:\dev\vrx-relay`:
- Ligar: `.\bin\relay.cmd start`
- Ver se está de pé: `.\bin\relay.cmd status`
- Desligar: `.\bin\relay.cmd stop`
- Não feche a janela "VRX RELAY — NÃO FECHAR". Se fechar, o vigia religa e avisa no Telegram.

## 5. Regra de ouro
- Com o relay ligado, **não abra o Claude Code no terminal desta pasta**. Ele rouba as mensagens do bot.
- Para mexer no projeto pelo PC: `relay stop`, trabalhar, fechar a sessão, `relay start`.

## 6. Comandos que só funcionam no terminal do PC
- `/mcp`, `/plugin`, `/config`, confirmações de confiança de pasta e de servidores MCP. Eles não chegam ao celular.

## 7. Não precisa mais
- Chave da Groq: a voz é transcrita no próprio PC (Whisper local), sem serviço pago.
