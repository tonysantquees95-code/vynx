import test from "node:test";
import assert from "node:assert/strict";
import { abrir, focar, fechar, minimizar, mover, ajustarA, alternarMaximizada, ativa, abertas, TAMANHO } from "../src/janelas.ts";

const area = { w: 1200, h: 700 };

test("abrir: nova janela fica na frente e cabe na área", () => {
  let l = abrir([], "inicio", area);
  l = abrir(l, "laboratorio", area);
  assert.equal(ativa(l), "laboratorio");
  for (const j of l) { assert.ok(j.x >= 0 && j.y >= 0 && j.x + j.w <= area.w && j.y + j.h <= area.h); }
  assert.deepEqual(l.map((j) => j.z).sort(), [1, 2]);
});

test("abrir uma janela que já existe só traz para a frente (sem duplicar)", () => {
  let l = abrir(abrir([], "inicio", area), "android", area);
  l = abrir(l, "inicio", area);
  assert.equal(l.length, 2);
  assert.equal(ativa(l), "inicio");
});

test("minimizar tira da frente; abrir de novo restaura", () => {
  let l = abrir(abrir([], "inicio", area), "android", area);
  l = minimizar(l, "android");
  assert.equal(ativa(l), "inicio");
  l = abrir(l, "android", area);
  assert.equal(ativa(l), "android");
  assert.equal(l.find((j) => j.id === "android").min, false);
});

test("fechar remove e renumera; sem janelas não há ativa", () => {
  let l = abrir(abrir([], "inicio", area), "android", area);
  l = fechar(l, "android");
  assert.deepEqual(l.map((j) => j.z), [1]);
  assert.equal(abertas(l, "android"), false);
  assert.equal(ativa(fechar(l, "inicio")), null);
});

test("mover nunca deixa a barra de título sair da área", () => {
  let l = abrir([], "inicio", area);
  l = mover(l, "inicio", -500, -500, area);
  assert.equal(l[0].x, 0); assert.equal(l[0].y, 0);
  l = mover(l, "inicio", 99999, 99999, area);
  assert.equal(l[0].x, area.w - l[0].w);
  assert.ok(l[0].y <= area.h - 40);
});

test("área menor que a janela: ela encolhe", () => {
  const pequena = { w: 500, h: 400 };
  const l = abrir([], "documentos", pequena);
  assert.equal(l[0].w, 500); assert.equal(l[0].h, 400);
  const maior = abrir([], "documentos", area);
  const r = ajustarA(maior, pequena);
  assert.ok(r[0].x + r[0].w <= 500 && r[0].y + r[0].h <= 400);
  assert.ok(TAMANHO.documentos.w > 500);
});

test("maximizar alterna e traz para a frente", () => {
  let l = abrir(abrir([], "inicio", area), "android", area);
  l = alternarMaximizada(l, "inicio");
  assert.equal(l.find((j) => j.id === "inicio").max, true);
  assert.equal(ativa(l), "inicio");
  l = alternarMaximizada(l, "inicio");
  assert.equal(l.find((j) => j.id === "inicio").max, false);
});

test("focar um id que não existe não muda nada", () => {
  const l = abrir([], "inicio", area);
  assert.deepEqual(focar(l, "ajustes"), l);
});
