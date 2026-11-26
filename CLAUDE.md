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

## Emulador de Android (aba Android)
- Nativo em `desktop/src-tauri/src/android.rs`; interface em `app/src/telas/Android.tsx`; lógica pura em `app/src/android.ts` (testada em `app/teste/android.test.mjs`; o Rust tem os próprios testes e roda na publicação).
- Tudo fica em `%LOCALAPPDATA%\VynxOS\android` (JDK da Microsoft, ferramentas e emulador do Android, AVDs em `avd/`). Só usa `curl.exe` e `tar.exe` do Windows, sempre com argumentos separados. A licença do Android SDK só é aceita pela pessoa (caixa na tela) antes do download. Termos e permissões falam disso (`VERSAO_DOS_TERMOS` = 2).
- Tarefas longas (preparar, instalar APK) rodam numa thread e a tela acompanha por `android_progresso`. Só uma tarefa por vez.
- APK: só de release da conta (`url_apk_valida`), pacote só `tech.vetorial.*`. App novo na suíte: acrescente em `APPS_ANDROID` (`android.ts`) com repositório, nome do APK e `appId`. Imagem do sistema: `IMAGEM` (Android 35, x86_64). Celulares: `vynx-celular|pequeno|tablet`.
- Demonstração (navegador e teste visual): `localStorage "vynx.demo.android"` = `{preparado, celulares, ligado, pronto}`. Mudou a interface do plugin? Ajuste `ponte.ts`.
- Só dá para testar de verdade no Windows com virtualização ligada (WHPX/Hyper-V).

## LDPlayer e "Testar no Android"
- `desktop/src-tauri/src/ldplayer.rs`: acha o `ldconsole.exe` (C:\LDPlayer\LDPlayer9 etc.), cria a instância "Vynx" (2 núcleos, 2 GB, 540x960; nunca mexe nas outras), liga e espera o Android (`list2`), `installapp` e `runapp`. O Vynx NÃO instala o LDPlayer (terceiro, licença própria): a tela leva ao site. Andamento pelo mesmo `android_progresso`. Lógica pura testada (`ler_lista`, `candidatos`).
- `app/src/testar.ts` (`testarNoAndroid`) é o caminho único de "Testar": escolhe o motor (`escolherMotor` em `android.ts`; preferência `vynx.android.motor`, padrão LDPlayer) e liga sozinho se estiver fechado. Aba Android: `AndroidLd` e `AndroidOficial`. Demo: `localStorage "vynx.demo.ld"`. Só dá para testar de verdade no Windows com o LDPlayer instalado.
- Painel Dev (`telas/PainelDev.tsx`, lógica em `painel.ts`): resumo de todos os apps (releases + `actions/runs`), indicadores, builds quebrados e atividade. O teste visual simula o GitHub por padrão de endereço (`respostasPorPadrao`).

## Casca do sistema (barra, dock e janelas)
- `app/src/telas/Casca.tsx` monta a barra do topo, o dock (`nav` "Seções", um botão por app, o da frente fica preenchido e o aberto leva um ponto) e as janelas. Lógica pura em `app/src/janelas.ts` (abrir/focar/mover/minimizar/maximizar, sempre dentro da área; testada em `teste/janelas.test.mjs`). Abaixo de 900 px de largura cada app ocupa a tela toda e o dock vai para baixo. As janelas continuam montadas ao minimizar (não perdem o estado).
- Mesa de trabalho: camada atrás das janelas (`region` "Mesa de trabalho") com um atalho por app (`APPS`); nenhuma janela abre sozinha. Tocar no app da frente no dock minimiza (volta à mesa), em qualquer tamanho.
- App novo: acrescente o id em `IdApp` e `TAMANHO` (`janelas.ts`), o ícone em `icones.tsx` (traço fino 1.8), a linha em `APPS` (`Casca.tsx`) e o `renderizar` em `App.tsx`. Cenários `casca-*` no teste visual. O ícone do app (`desktop/app-icon.png`) é o `logo.tsx` desenhado em 1024 px.

## Terminal embutido
- `desktop/src-tauri/src/terminal.rs` (`terminal_abrir/escrever/fechar`): `wsl.exe -d vynx-lab-<nome> -u root -- script -qf /dev/null` (pty dentro do laboratório, argumentos sem espaço, nunca shell do Windows); a saída chega por eventos `terminal-saida`/`terminal-fim` e a tela é o xterm.js em `telas/Terminal.tsx`. Uma sessão por vez; o tamanho (colunas x linhas) vale da abertura: redimensionar a janela depois NÃO muda o `stty`. Demo em `ponte.ts` (`terminalOuvir`). Só dá para testar de verdade no Windows.

## Entrada (Vetorial ID)
- O app abre na tela `telas/Entrar.tsx` (e-mail e senha do Vetorial ID, `app: "vynx"`); sessão em `localStorage "vynx.sessao"` (`conta.ts`). Administrador: `GET /id/github` (servidor) entrega o token de LEITURA do GitHub e o Painel Dev já abre conectado. Sair (Ajustes › Conta) apaga sessão e token. Teste visual: cenário `entrar` (modo `sem-conta`).

## Claude dentro do laboratório
- Laboratório › "Instalar Claude" (`instalar_claude`, texto fixo `INSTALAR_CLAUDE` em `main.rs`, sem caracteres especiais do cmd) abre um terminal que instala o Claude Code como root no laboratório pelo instalador oficial (`claude.ai/install.sh`, sem Node/npm: `apt install npm` puxava 200+ pacotes e levava minutos) e liga `/usr/local/bin/claude`. "Importar projetos" (`importar_projetos`, script `importar.sh`) clona os repositórios da conta em `/root/projetos` usando o token do Painel Dev (vai pela entrada padrão, não fica no `.git`) e gera `PROJETOS.md`, `CLAUDE.md` e o comando `/projetos`. O andamento da importação aparece na janela Laboratório (o script imprime `[n/total] projeto`; o Rust manda cada linha pelo evento `importar-linha`; `andamentoDaLinha` em `laboratorio.ts` lê o número). Aba Documentos = página `/pdf/` do servidor numa janela (`telas/Documentos.tsx`). Só dá para testar de verdade no Windows.

## Faixa de uso, tela cheia, Arquivos e apps da suíte
- Faixa no topo (`telas/Faixa.tsx`, lógica pura em `metricas.ts`): CPU/RAM vêm de kernel32 e a GPU de um `typeperf` ligado (`desktop/src-tauri/src/metricas.rs`); `liberar_ram` encolhe o próprio Vynx e, só se a pessoa marcar, encerra labs `vynx-lab-*` ligados. Nunca mexe em programas de fora.
- Tela cheia (`tela_cheia` no `main.rs`, F11 e botão no topo): abre assim na primeira vez, a escolha fica em `vynx.telacheia`.
- Arquivos (`telas/Arquivos.tsx`): `projetos_listar` (`ls /root/projetos` no lab) e `pasta_abrir` (Explorador em `\\wsl.localhost\...`). Vindex e Velox Pro (`telas/Externo.tsx`): `externo_instalado/abrir` só aceitam esses dois, em `%LOCALAPPDATA%\Programs\`. Abrem como janelas do Windows, não embutidos.
- Andamento (`andamento.ts` + `telas/Andamento.tsx`): tempo, etapa, aviso "sem novidade há X" e Cancelar; as linhas "… vivo" do `importar.sh` são sinal de vida, não progresso. Só dá para testar de verdade no Windows.

## Painel Dev
- Token do GitHub só em `localStorage` (`vynx.github.token`); nunca é ENVIADO ao servidor (o administrador só o RECEBE dele). Lógica pura e testada em `github.ts`.

## Teste visual das telas
- `app/teste-visual/telas.mjs` + `config.mjs`: `npm run build && npm run test:visual` abre o app em 7 tamanhos e confere se cada tela e janela cabe, não estoura para o lado e todo botão dá para alcançar. Tela ou janela nova: acrescente um cenário em `config.mjs`.

## Feedback, publicação e atualização
- Ajustes › Sobre tem "Enviar feedback" e "Reportar um erro" (`telas/FeedbackDoApp.tsx`, página `/feedback?app=vynx`). O CSP do `tauri.conf.json` precisa de `frame-src` do servidor.
- `.github/workflows/app.yml`: verifica, testa o Rust, gera o instalador NSIS e publica a release `1.N` com `VynxSetup.exe`. Atualização por dentro (verificar → barra de download → Instalar) via `/atualizacao?app=vynx-windows`.
- Servidor (`vetorial-servidor`): o app precisa estar em `feedback/dados.js` (`APPS`), no mapa de atualização e no Painel Dev; o Vindex enxerga todos os apps.
- Atualização por dentro (Windows): `atualizar.rs` baixa `VynxSetup.exe` com `curl.exe` (progresso por `atualizar_progresso`), confere tamanho e SHA-256 do servidor e `atualizar_instalar` abre o instalador e fecha o app. A URL só vale se for `github.com/tonysantquees95-code/vynx/releases/download/.../VynxSetup.exe`. NÃO use `abrir_link` para baixar: ele recusa `&` na URL. Interface em `telas/Ajustes.tsx` (Baixar atualização → barra → Instalar); demo em `ponte.ts`.
- Repositório público: nunca coloque chave, token ou senha no código.

## Teste de segurança (igual em todos os apps da suíte)
- `app/teste/seguranca.test.mjs` roda junto com os outros testes e na publicação: se falhar, a publicação para. Confere o repositório inteiro: segredo escrito no código (chaves, tokens, senhas), arquivo que nunca pode ser versionado (.env, chaves de assinatura), CSP do Tauri sem `unsafe-eval`/curinga, manifesto do Android (debug, tráfego http, componente exposto sem permissão, `QUERY_ALL_PACKAGES`), `eval`, HTML montado com texto (`innerHTML`), endereço `http://` fora da máquina local, segredo no log, HTTPS desligado e WebView com acesso perigoso.
- Exceção justificada = uma linha em `seguranca.permitidos.json` (regra, arquivo, trecho e MOTIVO de verdade); sem motivo, não vale. Texto digitado pela pessoa ou vindo de site/servidor nunca entra em HTML sem escapar (`textContent` ou `esc()`).
- O arquivo é o mesmo em todos os apps: mudou uma regra? Mude em todos. Achou uma brecha nova? Escreva primeiro um teste que a reproduz.
