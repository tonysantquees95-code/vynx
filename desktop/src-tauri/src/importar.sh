set -e
set -o pipefail
export DEBIAN_FRONTEND=noninteractive GIT_TERMINAL_PROMPT=0
PASTA=/root/projetos
# Sinal de vida: uma linha que começa com "…" a cada 15 s. A tela usa isso só para saber que o laboratório está respondendo
# (não conta como andamento), assim dá para diferenciar "lento" de "travado".
( while sleep 15; do echo "… vivo (${SECONDS}s)"; done ) &
BATIDA=$!
trap 'kill $BATIDA 2>/dev/null || true' EXIT
passo() { echo "Etapa $1 de 4: $2"; }
# mostra só as linhas que interessam do apt (antes ele ficava mudo por minutos e parecia travado)
apt_quieto() { timeout 900 apt-get -o Acquire::ForceIPv4=true -o Acquire::http::Timeout=25 -o Acquire::Retries=2 "$@" 2>&1 | while IFS= read -r l; do case "$l" in Get:*|Hit:*|Err:*|Fetched*|Setting\ up*|Unpacking*|E:*|W:*) echo "apt: ${l:0:90}";; esac; done; }

passo 1 "Preparando as ferramentas do laboratório (git, curl, jq)"
FALTA=""
for f in git curl jq; do command -v "$f" >/dev/null 2>&1 || FALTA="$FALTA $f"; done
if [ -n "$FALTA" ]; then
  echo "Faltam:$FALTA. Instalando (na primeira vez pode levar alguns minutos)…"
  apt_quieto update || { echo "ERRO: não consegui atualizar a lista de programas do Linux. Confira a internet do computador e tente de novo." >&2; exit 1; }
  apt_quieto install -y git curl ca-certificates jq || { echo "ERRO: não consegui instalar as ferramentas. Confira a internet do computador e tente de novo." >&2; exit 1; }
else
  echo "Ferramentas já instaladas."
fi

passo 2 "Conferindo a internet e a sua conta do GitHub"
if ! curl -4 -sS --connect-timeout 15 --max-time 30 -o /dev/null https://api.github.com 2>/tmp/vynx-rede.txt; then
  echo "ERRO: o laboratório não consegue acessar a internet ($(tail -n 1 /tmp/vynx-rede.txt | cut -c1-120)). No Windows, tente: fechar o Vynx, abrir o Terminal e rodar wsl --shutdown; depois abra o Vynx de novo. Antivírus e VPN também podem bloquear." >&2
  exit 1
fi
mkdir -p "$PASTA" /root/.claude/commands
cd "$PASTA"
CODIGO=$(curl -4 -sS --connect-timeout 15 --max-time 120 -o lista.json -w '%{http_code}' -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" "https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner" || true)
if [ "$CODIGO" != "200" ]; then
  echo "ERRO: o GitHub respondeu $CODIGO. Se for 401, o token expirou: reconecte o GitHub no Painel Dev." >&2
  exit 1
fi
jq -r '.[] | select(.fork==false and .archived==false) | select(.name|test("^[A-Za-z0-9_.-]+$")) | .name' lista.json > nomes.txt
DONO=$(jq -r '.[0].owner.login' lista.json)
TOTAL=$(wc -l < nomes.txt)
AUTH="Authorization: Basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)"
echo "Achei $TOTAL projetos na conta $DONO."

passo 3 "Baixando os projetos, um por um"
N=0; FALHAS=0; I=0
{
  echo "# Meus projetos (importado pelo Vynx em $(date '+%d/%m/%Y %H:%M'))"
  echo
  echo "Cada pasta abaixo é um repositório clonado. Ao abrir o Claude dentro de uma pasta, ele lê o CLAUDE.md do projeto sozinho."
  echo
} > PROJETOS.md
while read -r R; do
  I=$((I+1))
  echo "[$I/$TOTAL] $R"
  INI=$SECONDS
  if [ -d "$R/.git" ]; then
    timeout 300 git -C "$R" -c http.extraheader="$AUTH" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 pull --ff-only -q < /dev/null || echo "aviso: não consegui atualizar $R (segue com a cópia que já existe)"
  else
    if ! timeout 600 git -c http.extraheader="$AUTH" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 clone -q "https://github.com/$DONO/$R.git" "$R" < /dev/null; then
      echo "aviso: não consegui baixar $R, pulei"; rm -rf "$R"; FALHAS=$((FALHAS+1)); continue
    fi
  fi
  git -C "$R" remote set-url origin "https://github.com/$DONO/$R.git"
  N=$((N+1))
  echo "   ok ($((SECONDS-INI)) s)"
  DESC=$(jq -r --arg n "$R" '.[] | select(.name==$n) | .description // ""' lista.json)
  {
    echo "## $R"
    [ -n "$DESC" ] && echo "$DESC"
    echo "- Pasta: $PASTA/$R"
    [ -f "$R/CLAUDE.md" ] && echo "- Regras e funcionamento: $R/CLAUDE.md (leia antes de mexer)" || echo "- Sem CLAUDE.md: leia o README e o código"
    echo "- Últimas mudanças:"
    git -C "$R" log --pretty='  - %ad %s' --date=short -5
    echo
  } >> PROJETOS.md
done < nomes.txt
rm -f lista.json
if [ "$N" -eq 0 ]; then echo "ERRO: nenhum projeto foi baixado. Veja os avisos acima." >&2; exit 1; fi

passo 4 "Montando o guia para o Claude"
cat > CLAUDE.md <<'F'
# Meus projetos
Esta pasta tem todos os repositórios do Toni (Vetorial Tech). Leia PROJETOS.md para saber o que cada um faz e onde parou.
Antes de mexer num projeto, leia o CLAUDE.md dele. Respostas curtas, em português simples.
F
cat > /root/.claude/commands/projetos.md <<'F'
Leia /root/projetos/PROJETOS.md e, em seguida, o CLAUDE.md dos projetos que forem relevantes para o que eu pedir. Resuma em poucas linhas onde cada projeto está (o que já funciona e o que falta) e pergunte em qual vamos trabalhar. Se eu já disse o projeto, vá direto nele.
F
if [ "$FALHAS" -gt 0 ]; then echo "Pronto: $N de $TOTAL projetos em $PASTA ($FALHAS não baixaram). Abra o Claude e digite /projetos."; else echo "Pronto: $N projetos em $PASTA. Abra o Claude e digite /projetos."; fi
