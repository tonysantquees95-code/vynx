# Vynx OS (Windows) — notas para quem mexe no código

- Espaço seguro para desenvolvedores: **Laboratório** (Linux isolado e descartável em cima do WSL2), **Painel Dev** (GitHub pela API, com o token da própria pessoa) e Ajustes. Fase 1 = só o app de Windows; depois CLI `vynx`, integrações com Vindex/Velox e, bem depois, uma ISO.
- Stack: Tauri 2 + Vite + React 19 + Tailwind 4 (a mesma do Voxix/Vindex). Interface em `app/src/`, parte nativa em `desktop/src-tauri/src/main.rs`.

## Regra de ouro: toda mudança de função vai para a tela "O que há de novo"
- Qualquer melhoria que mude o que o app faz ou como se usa ganha uma linha em `app/src/novidades.ts`.
- `id` = o maior id existente + 1; `tipo` = `novo`, `melhoria` ou `correcao`; `titulo` curto; `texto` em português simples, dizendo o que mudou para a pessoa.
- A tela aparece sozinha depois da atualização e mostra só o que a pessoa ainda não viu. Na primeira instalação ela não aparece: quem explica é a apresentação.
- O teste `app/teste/novidades.test.mjs` confere ids, tipos e textos.

## Apresentação da primeira abertura
- Tour → permissões explicadas → termos, em `app/src/telas/Apresentacao.tsx`; conteúdo em `app/src/apresentacao.ts`.
- Função nova: acrescente um passo em `TOUR`. Permissão nova: explique o porquê ANTES de pedir. Mudou o texto dos termos: suba `VERSAO_DOS_TERMOS`. Também ficam em Ajustes › Sobre.

## Laboratório (WSL2)
- Cada laboratório é uma distribuição `vynx-lab-<nome>` criada por `wsl --export` da base + `wsl --import`, com `/etc/wsl.conf` isolado (sem `automount`, sem `interop`, sem PATH do Windows). Descartar = `wsl --unregister`. O app só mexe nas distribuições com esse prefixo.
- Comandos nativos (`estado_wsl`, `criar_laboratorio`, `descartar_laboratorio`, `abrir_terminal`, `abrir_link`): sempre `wsl.exe` com argumentos separados (nunca shell) e nomes validados (`nome_valido`/`base_valida`, espelhados em `laboratorio.ts`). Mudou a interface? Ajuste `app/src/ponte.ts` (incluindo o modo de demonstração).
- No navegador e no teste visual vale a demonstração (WSL simulado em `localStorage "vynx.demo.wsl"`).

## Painel Dev
- Token do GitHub só em `localStorage` (`vynx.github.token`), nunca no servidor. Lógica pura e testada em `github.ts`.

## Teste visual das telas
- `app/teste-visual/telas.mjs` + `config.mjs`: `npm run build && npm run test:visual` abre o app em 7 tamanhos e confere se cada tela e janela cabe, não estoura para o lado e todo botão dá para alcançar. Tela ou janela nova: acrescente um cenário em `config.mjs`.

## Feedback, publicação e atualização
- Ajustes › Sobre tem "Enviar feedback" e "Reportar um erro" (`telas/FeedbackDoApp.tsx`, página `/feedback?app=vynx`). O CSP do `tauri.conf.json` precisa de `frame-src` do servidor.
- `.github/workflows/app.yml`: verifica, testa o Rust, gera o instalador NSIS e publica a release `1.N` com `VynxSetup.exe`. Atualização por dentro (verificar → barra de download → Instalar) via `/atualizacao?app=vynx-windows`.
- Servidor (`vetorial-servidor`): o app precisa estar em `feedback/dados.js` (`APPS`), no mapa de atualização e no Painel Dev; o Vindex enxerga todos os apps.
- Repositório público: nunca coloque chave, token ou senha no código.
