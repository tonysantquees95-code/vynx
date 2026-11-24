set -e
echo "Preparando o laboratório…"
export DEBIAN_FRONTEND=noninteractive
command -v git >/dev/null 2>&1 || { apt-get update -y >/dev/null; apt-get install -y git curl ca-certificates jq >/dev/null; }
command -v jq >/dev/null 2>&1 || { apt-get update -y >/dev/null; apt-get install -y jq curl ca-certificates >/dev/null; }
PASTA=/root/projetos
mkdir -p "$PASTA" /root/.claude/commands
cd "$PASTA"
AUTH="Authorization: Basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)"
curl -fsS -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" "https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner" > lista.json
jq -r '.[] | select(.fork==false and .archived==false) | select(.name|test("^[A-Za-z0-9_.-]+$")) | .name' lista.json > nomes.txt
TOTAL=$(wc -l < nomes.txt)
echo "Achei $TOTAL projetos. Baixando um por um…"
N=0
{
  echo "# Meus projetos (importado pelo Vynx em $(date '+%d/%m/%Y %H:%M'))"
  echo
  echo "Cada pasta abaixo é um repositório clonado. Ao abrir o Claude dentro de uma pasta, ele lê o CLAUDE.md do projeto sozinho."
  echo
} > PROJETOS.md
while read -r R; do
  echo "[$((N+1))/$TOTAL] $R"
  if [ -d "$R/.git" ]; then git -C "$R" -c http.extraheader="$AUTH" pull --ff-only -q || echo "aviso: não consegui atualizar $R"; else git -c http.extraheader="$AUTH" clone -q "https://github.com/$(jq -r '.[0].owner.login' lista.json)/$R.git" "$R" || { echo "aviso: não consegui clonar $R"; continue; }; fi
  git -C "$R" remote set-url origin "https://github.com/$(jq -r '.[0].owner.login' lista.json)/$R.git"
  N=$((N+1))
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
cat > CLAUDE.md <<'F'
# Meus projetos
Esta pasta tem todos os repositórios do Toni (Vetorial Tech). Leia PROJETOS.md para saber o que cada um faz e onde parou.
Antes de mexer num projeto, leia o CLAUDE.md dele. Respostas curtas, em português simples.
F
cat > /root/.claude/commands/projetos.md <<'F'
Leia /root/projetos/PROJETOS.md e, em seguida, o CLAUDE.md dos projetos que forem relevantes para o que eu pedir. Resuma em poucas linhas onde cada projeto está (o que já funciona e o que falta) e pergunte em qual vamos trabalhar. Se eu já disse o projeto, vá direto nele.
F
echo "Pronto: $N projetos em $PASTA. Abra o Claude e digite /projetos."
