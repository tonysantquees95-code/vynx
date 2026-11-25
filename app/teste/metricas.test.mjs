import test from "node:test";
import assert from "node:assert/strict";
import { nivel, ramPct, gb, texto, diagnostico } from "../src/metricas.ts";

test("níveis de cor", () => {
  assert.equal(nivel(10), "ok"); assert.equal(nivel(69), "ok"); assert.equal(nivel(70), "aviso");
  assert.equal(nivel(89), "aviso"); assert.equal(nivel(90), "erro"); assert.equal(nivel(null), "nd"); assert.equal(nivel(NaN), "nd");
});
test("memória em porcentagem e GB", () => {
  assert.equal(ramPct({ cpu: 1, ram_usada_mb: 4096, ram_total_mb: 8192, gpu: null }), 50);
  assert.equal(ramPct({ cpu: 1, ram_usada_mb: 1, ram_total_mb: 0, gpu: null }), null);
  assert.equal(gb(1536), "1,5 GB"); assert.equal(texto(null), "—"); assert.equal(texto(42), "42%");
});
test("diagnóstico", () => {
  const base = { cpu: 10, ram_usada_mb: 1000, ram_total_mb: 8000, gpu: 5 };
  assert.equal(diagnostico(base), "Tudo tranquilo.");
  assert.match(diagnostico({ ...base, ram_usada_mb: 7500 }), /memória/);
  assert.match(diagnostico({ ...base, cpu: 95 }), /processador/);
  assert.match(diagnostico({ ...base, gpu: 95 }), /vídeo/);
  assert.match(diagnostico({ ...base, cpu: 75 }), /puxado/);
});
