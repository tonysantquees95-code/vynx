import test from "node:test";
import assert from "node:assert/strict";
import { bases, laboratorios, lerListaWsl, limparNome, nomeValido, WSL_CONF_ISOLADO } from "../src/laboratorio.ts";

test("nome do laboratório: limpa acento e símbolo, e só aceita o que cabe no nome da distribuição", () => {
  assert.equal(limparNome("Meu Teste Ñ #1!"), "meu-teste-n-1");
  assert.ok(nomeValido("teste-1") && !nomeValido("Teste") && !nomeValido("a b") && !nomeValido("") && !nomeValido("-x") && !nomeValido("a".repeat(25)));
});

test("lista do WSL: lê nome, estado e versão (com o asterisco da padrão e caracteres nulos)", () => {
  const txt = "  NAME            STATE           VERSION\r\n* Ubuntu          Running         2\r\n  vynx-lab-um     Stopped         2\r\n  docker-desktop  Stopped         2\r\n".replace(/(.)/g, "$1\u0000");
  const ds = lerListaWsl(txt);
  assert.deepEqual(ds.map((d) => d.nome), ["Ubuntu", "vynx-lab-um", "docker-desktop"]);
  assert.deepEqual(laboratorios(ds).map((l) => l.nome), ["um"]);
  assert.deepEqual(bases(ds).map((d) => d.nome), ["Ubuntu"]);
});

test("o laboratório nasce sem acesso aos arquivos e programas do Windows", () => {
  assert.match(WSL_CONF_ISOLADO, /\[automount\]\nenabled=false/);
  assert.match(WSL_CONF_ISOLADO, /\[interop\]\nenabled=false/);
});
