import test from "node:test";
import assert from "node:assert/strict";
import { formatarTempo, saude, mensagemDeSaude, lerLinha, porcentagem } from "../src/andamento.ts";

test("tempo em palavras", () => {
  assert.equal(formatarTempo(9), "9 s"); assert.equal(formatarTempo(75), "1 min 15 s"); assert.equal(formatarTempo(120), "2 min");
  assert.equal(formatarTempo(3700), "1 h 1 min"); assert.equal(formatarTempo(-5), "0 s");
});
test("saúde: andando, lento e parado", () => {
  assert.equal(saude(30), "andando");
  assert.equal(saude(100), "lento");
  assert.equal(saude(400), "parado");
  assert.equal(saude(400, 10), "lento", "com sinal de vida recente nunca é parado");
  assert.equal(saude(400, 120), "parado", "sinal de vida velho não vale");
});
test("mensagens só quando precisa", () => {
  assert.equal(mensagemDeSaude("andando", 5, false), "");
  assert.match(mensagemDeSaude("lento", 100, true), /respondendo/);
  assert.match(mensagemDeSaude("parado", 400, false), /travado/);
});
test("lê as linhas do script de importação", () => {
  assert.deepEqual(lerLinha("[3/12] vynx"), { tipo: "projeto", atual: 3, total: 12 });
  assert.deepEqual(lerLinha("Etapa 2 de 4: Conferindo a internet"), { tipo: "etapa", atual: 2, total: 4, texto: "Conferindo a internet" });
  assert.equal(lerLinha("… vivo (45s)").tipo, "vivo");
  assert.equal(lerLinha("[9/3] x").tipo, "texto");
  assert.equal(lerLinha("apt: Get:1 http://x").tipo, "texto");
});
test("porcentagem", () => {
  assert.equal(porcentagem(1, 4), 0); assert.equal(porcentagem(3, 4, 0.5), 63); assert.equal(porcentagem(4, 4, 1), 100); assert.equal(porcentagem(1, 0), 0);
});
