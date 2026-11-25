import test from "node:test";
import assert from "node:assert/strict";
import { estadoDoApp, totais, ultimaPublicacao, atividade, tiraDeBuilds } from "../src/painel.ts";

const app = (id) => ({ id, nome: id, repo: `x/${id}`, plataforma: "Android" });
const r = (id, estado, nome = "CI", quando = "2026-11-25T10:00:00Z") => ({ id: Math.random(), nome, ramo: "main", estado, quando, link: "" });
const res = (id, rodadas, versao = null, erro = false) => ({ app: app(id), versao, rodadas, erro });

test("estado do app", () => {
  assert.equal(estadoDoApp(res("a", [r(1, "ok")])), "ok");
  assert.equal(estadoDoApp(res("a", [r(1, "rodando")])), "rodando");
  assert.equal(estadoDoApp(res("a", [r(1, "falhou")])), "falhou");
  assert.equal(estadoDoApp(res("a", [r(1, "ok", "CI"), r(2, "falhou", "CI")])), "ok", "falha antiga já corrigida por uma verde mais nova do mesmo fluxo");
  assert.equal(estadoDoApp(res("a", [])), "nd");
  assert.equal(estadoDoApp(res("a", [r(1, "ok")], null, true)), "nd");
});
test("totais", () => {
  const t = totais([res("a", [r(1, "ok")]), res("b", [r(1, "falhou")]), res("c", [r(1, "rodando")]), res("d", [])]);
  assert.deepEqual(t, { apps: 4, quebrados: 1, rodando: 1, ok: 1, semDados: 1 });
});
test("última publicação", () => {
  const v = (q) => ({ tag: "1.1", titulo: "", quando: q, arquivos: [] });
  assert.equal(ultimaPublicacao([res("a", [], v("2026-11-24T10:00:00Z")), res("b", [], v("2026-11-25T10:00:00Z")), res("c", [])]).app.id, "b");
  assert.equal(ultimaPublicacao([res("a", [])]), null);
});
test("atividade mistura e ordena do mais novo", () => {
  const a = atividade([res("a", [r(1, "ok", "CI", "2026-11-25T08:00:00Z")]), res("b", [r(2, "falhou", "CI", "2026-11-25T09:00:00Z"), r(3, "ok", "CI", "lixo")])], 5);
  assert.deepEqual(a.map((x) => x.app.id), ["b", "a"]);
});
test("tira de builds vai do mais velho ao mais novo", () => {
  assert.deepEqual(tiraDeBuilds(res("a", [r(1, "ok"), r(2, "falhou"), r(3, "ok")])), ["ok", "falhou", "ok"]);
});
