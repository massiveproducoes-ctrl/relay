# Cockpit: o que aproveitar e o que descartar (lado técnico)

Registro da tarefa D2-07. Repositório avaliado: `autoplus-git/vaca-roxa-cockpit`, `main` no commit `0203d0a`. Next.js 16.4.3, React 19, NextAuth 4.24.15, Tailwind 4. São 19 arquivos de código e cerca de 1.400 linhas.

**Resumo:** o Cockpit é uma casca de painel bonita e pequena. O login e a proteção das telas servem para o Relay. Os números e os gráficos são todos de mentira (escritos direto no código), e as 3 telas de conteúdo são de marketing de tráfego, sem relação com o Relay. Não há banco de dados, nem chamada a servidor, nem dado em tempo real.

| Parte | Arquivos | Veredito | Por quê |
|---|---|---|---|
| Login por e-mail e senha | `lib/auth.ts`, `lib/password.ts`, `app/page.tsx`, `app/api/auth/[...nextauth]/route.ts`, `app/providers.tsx` | **Aproveitar e evoluir** | Já funciona e a senha saiu do código. Hoje aceita só 1 usuário, vindo do ambiente. O Relay precisa de 2 pessoas e de registro de quem entrou. |
| Proteção das telas | `app/dashboard/layout.tsx` | **Aproveitar** | Confere a sessão no servidor e manda quem não logou para a tela de entrada. É o jeito certo e já está pronto. |
| Casca do painel (topo, menu lateral, tema escuro roxo) | `layout.tsx`, `Sidebar.tsx`, `SignOutButton.tsx`, `globals.css` | **Aproveitar e trocar a marca** | A estrutura serve para o painel do Relay (Home, Tarefas, Aprovações, Custos). O texto "VACA ROXA · IA", "Cliente" e o nome "Radiauto" precisam sair. |
| Cartões de números | `app/dashboard/page.tsx` | **Aproveitar o formato, descartar os números** | Os valores (investimento, leads, ROAS) são fixos no código. O formato serve para a tela de Custos e consumo. |
| Gráficos | `WeeklyChart.tsx`, `CampaignBarChart.tsx`, `FunnelChart.tsx` | **Aproveitar o jeito, trocar os dados** | São feitos à mão em SVG, sem biblioteca, o que é leve e fácil de manter. O funil não tem uso no Relay. |
| Tela "Performance de Tráfego" | `app/dashboard/performance/` | **Descartar** | Campanhas, cliques e CTR da Radiauto. Nada a ver com o Relay. |
| Tela "Atribuição" | `app/dashboard/atribuicao/` | **Descartar** | Funil de atribuição de marketing. |
| Tela "Relatórios" | `app/dashboard/relatorios/` | **Descartar o conteúdo, guardar a ideia** | Lista fixa de relatórios. A ideia de uma lista com histórico pode virar a tela de Tarefas. |
| Ícones | `app/dashboard/icons.tsx` | **Aproveitar em parte** | Reaproveitar os que servirem, sem arrastar os de marketing. |
| Gerador de hash | `scripts/gerar-hash.mjs` | **Aproveitar** | Gera o hash da senha sem deixá-la no histórico do terminal. |

## O que não existe e precisa ser construído
- Um servidor que entregue ao painel os dados do Relay (tarefas, aprovações, custos). Hoje o Relay só fala com o Telegram.
- Usuários de verdade (2 pessoas) e registro de acessos.
- Atualização em tempo real do status das tarefas.
- Decidir onde ele roda (PC ligado ou servidor), o que muda a segurança.

## O que eu não verifiquei
- Se o painel funciona no navegador: só rodei o build, não abri a tela nem testei o login.
- Como o menu lateral se comporta no celular. O layout usa a largura `sm:` para abrir espaço ao menu, mas não testei em tela pequena.
- Se existe limite de tentativas de senha. Não vi nenhum no código.
- Os arquivos de ambiente: não abri nenhum `.env`.
