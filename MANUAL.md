# Manual — Vynx OS

> Escrito para a Vetorial Tech. Não contém segredos: só diz ONDE ficam. Visão de todos os apps: Manual da Vetorial Tech (Drive).

Espaço seguro para desenvolvedores no Windows: laboratório Linux descartável (WSL2), emuladores de Android, Painel Dev com GitHub.

## Onde fica cada coisa
- `desktop/src-tauri/src/`: `main.rs`, `android.rs` (emulador oficial), `ldplayer.rs`, `terminal.rs`, `metricas.rs`, `atualizar.rs`. `app/src/telas/`: Laboratório, Android, Painel Dev, Arquivos, Ajustes.
- Só mexe em distribuições `vynx-lab-*`. O token do GitHub fica só no aparelho.
- Fluxo `app.yml`: verifica, testa o Rust, gera `VynxSetup.exe` e publica `1.N`.

## Padrão da suíte (vale para este app)
- `novidades.ts` / `Novidades.kt`: tela "O que há de novo"; `apresentacao.ts`: tour e termos (`VERSAO_DOS_TERMOS`).
- `teste/` (lógica) e `teste/seguranca.test.mjs` (segurança; se falha, a publicação para); `teste-visual/` (7 tamanhos).
- `FeedbackDoApp`: "Enviar feedback / Reportar erro" abre a página do servidor.
- Atualização por dentro: o app pergunta ao servidor `/atualizacao`, que olha as publicações (tags) deste repositório.
- A chave de assinatura dos APKs não está aqui: o fluxo pede ao servidor (`REPOS_PERMITIDOS`).


## Como voltar atrás se algo quebrar
- No GitHub: aba **Actions** mostra o fluxo vermelho; **Code › Commits** mostra o commit culpado; abra o commit e toque em **⋯ › Revert** (cria um commit novo que desfaz o anterior).
- O número da versão sempre sobe: a versão boa volta como número novo, nunca se republica um número antigo.
- Banco de dados e dados dos usuários não voltam com o código (migrações só andam para frente).

## Movimentações importantes
Uma linha por mudança que valha lembrar (a mais nova em cima). O Painel Dev também mostra os últimos commits automaticamente.

| Data | O que mudou | Onde |
| --- | --- | --- |
| 2026-11-28 | Emojis usados como ícone de tela viraram desenhos no padrão de ícones do app (apresentação, permissões e botões). Regra: ícone novo nunca é emoji; o teclado de emojis do chat continua. | `app/src/icones.tsx` e telas |
| 2026-11-27 | Manual criado | `MANUAL.md` |
