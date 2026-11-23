import test from "node:test";
import assert from "node:assert/strict";
import { APPS_DO_PAINEL, avisosDeBuild, estadoDaRodada, lerRepos, lerRodadas, lerVersoes, tamanhoLegivel, tempoRelativo, tokenValido } from "../src/github.ts";

test("token: aceita formatos do GitHub e recusa espaço, aspas e curto demais", () => {
  assert.ok(tokenValido("ghp_abcdefghijklmnopqrstuvwxyz0123456789"));
  assert.ok(tokenValido("github_pat_11ABCDEFG0abcdefghijklmn_xyz"));
  assert.ok(!tokenValido("curto"));
  assert.ok(!tokenValido("ghp_abc def ghijklmnopqrstuvwxyz0123"));
  assert.ok(!tokenValido('ghp_"abcdefghijklmnopqrstuvwxyz0123'));
});

test("repositórios: ignora lixo e lê os campos úteis", () => {
  const r = lerRepos([{ name: "vynx", full_name: "a/vynx", private: true, pushed_at: "2026-11-23T01:00:00Z", open_issues_count: 2, description: "x" }, null, { name: 1 }, "x"]);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].nome, r[0].privado, r[0].abertas], ["vynx", true, 2]);
  assert.deepEqual(lerRepos({}), []);
});

test("rodadas: estado e links só do github.com", () => {
  assert.equal(estadoDaRodada("completed", "success"), "ok");
  assert.equal(estadoDaRodada("completed", "failure"), "falhou");
  assert.equal(estadoDaRodada("in_progress", null), "rodando");
  assert.equal(estadoDaRodada("completed", "cancelled"), "cancelado");
  const r = lerRodadas({ workflow_runs: [{ id: 1, name: "App", head_branch: "main", status: "completed", conclusion: "failure", created_at: "2026-11-23T01:00:00Z", html_url: "https://github.com/a/b/actions/runs/1" }, { id: 2, name: "X", html_url: "javascript:alert(1)" }, { name: "sem id" }] });
  assert.equal(r.length, 2);
  assert.equal(r[0].link, "https://github.com/a/b/actions/runs/1");
  assert.equal(r[1].link, "");
});

test("aviso de build: só a última rodada de cada fluxo, e só se ela quebrou", () => {
  const mk = (id, nome, estado) => ({ id, nome, ramo: "main", estado, quando: "", link: "" });
  const avisos = avisosDeBuild([mk(5, "App", "ok"), mk(4, "App", "falhou"), mk(3, "Servidor", "falhou"), mk(2, "Servidor", "ok")]);
  assert.deepEqual(avisos.map((a) => a.id), [3]);
});

test("tempo relativo", () => {
  const agora = Date.parse("2026-11-23T12:00:00Z");
  assert.equal(tempoRelativo("2026-11-23T11:59:50Z", agora), "agora");
  assert.equal(tempoRelativo("2026-11-23T11:30:00Z", agora), "há 30 min");
  assert.equal(tempoRelativo("2026-11-23T09:00:00Z", agora), "há 3 h");
  assert.equal(tempoRelativo("2026-11-20T12:00:00Z", agora), "há 3 d");
  assert.equal(tempoRelativo("lixo", agora), "");
});

test("versões: pega a última e a anterior, ignora rascunho, release sem arquivo e link de fora", () => {
  const ok = (n) => ({ tag_name: "1." + n, name: "App 1." + n, published_at: "2026-11-23T01:00:00Z", assets: [{ name: "App.apk", size: 3145728, browser_download_url: "https://github.com/tonysantquees95-code/x/releases/download/1." + n + "/App.apk" }] });
  const v = lerVersoes([{ ...ok(9), draft: true }, ok(8), { tag_name: "1.7", assets: [] }, { ...ok(6), assets: [{ name: "x.apk", browser_download_url: "https://evil.com/x.apk" }] }, ok(5), ok(4)]);
  assert.deepEqual(v.map((r) => r.tag), ["1.8", "1.5"]);
  assert.equal(v[0].arquivos[0].nome, "App.apk");
  assert.deepEqual(lerVersoes({}), []);
  assert.equal(tamanhoLegivel(3145728), "3.0 MB");
  assert.ok(APPS_DO_PAINEL.length >= 10 && APPS_DO_PAINEL.every((a) => /^tonysantquees95-code\/[\w.-]+$/.test(a.repo)));
});
