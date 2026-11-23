import test from "node:test";
import assert from "node:assert/strict";
import { APPS_ANDROID, PERFIS, nomeDoCelular, passoAtual, resumo, rotuloDoCelular, urlDaApi, urlDoApk } from "../src/android.ts";

const base = { jdk: true, ferramentas: true, emulador: true, imagem: true, preparado: true, celulares: [], ligado: null, pronto: false, aceleracao: true };

test("passos: preparar → celular → ligar → usar", () => {
  assert.equal(passoAtual({ ...base, preparado: false, imagem: false }), "preparar");
  assert.equal(passoAtual(base), "celular");
  assert.equal(passoAtual({ ...base, celulares: ["vynx-celular"] }), "ligar");
  assert.equal(passoAtual({ ...base, celulares: ["vynx-celular"], ligado: "emulator-5554" }), "usar");
});

test("resumo do cartão do Início", () => {
  assert.match(resumo(null), /Procurando/);
  assert.match(resumo({ ...base, preparado: false }), /Ainda não preparado/);
  assert.match(resumo({ ...base, celulares: ["a", "b"] }), /2 celulares virtuais/);
  assert.match(resumo({ ...base, celulares: ["a"], ligado: "emulator-5554", pronto: false }), /ligando/);
  assert.match(resumo({ ...base, celulares: ["a"], ligado: "emulator-5554", pronto: true }), /Instale um app/);
});

test("nomes dos celulares batem com o que o Rust aceita (vynx- + minúsculas)", () => {
  for (const p of PERFIS) assert.match(nomeDoCelular(p.id), /^vynx-[a-z0-9-]+$/);
  assert.equal(rotuloDoCelular("vynx-tablet"), "Tablet");
  assert.equal(rotuloDoCelular("vynx-outro"), "vynx-outro");
});

test("apps: pacote tech.vetorial.*, repositório da conta e APK .apk, sem repetição", () => {
  const ids = APPS_ANDROID.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const a of APPS_ANDROID) {
    // a Vênus (privada) é a única com outro pacote, e só ela baixa pela API com o token
    if (a.id === "venus") { assert.equal(a.pacote, "com.tonimarques.sextafeira"); assert.equal(a.privado, true); }
    else { assert.match(a.pacote, /^tech\.vetorial\.[a-z0-9]+$/); assert.ok(!a.privado); }
    assert.match(a.repo, /^tonysantquees95-code\/[A-Za-z0-9_.-]+$/);
    assert.match(a.apk, /\.apk$/);
  }
});

test("urlDaApi só aceita endereço da API de release da conta", () => {
  const ok = [{ name: "Venus.apk", browser_download_url: "x", url: "https://api.github.com/repos/tonysantquees95-code/Venus-core/releases/assets/99" }];
  assert.equal(urlDaApi(ok, "Venus.apk"), ok[0].url);
  assert.equal(urlDaApi([{ name: "Venus.apk", browser_download_url: "x", url: "https://evil.com/repos/tonysantquees95-code/V/releases/assets/9" }], "Venus.apk"), null);
  assert.equal(urlDaApi(ok, "Outro.apk"), null);
});

test("urlDoApk só aceita o arquivo esperado, vindo de release da conta", () => {
  const ok = { name: "Voxix.apk", browser_download_url: "https://github.com/tonysantquees95-code/voxix/releases/download/1.9/Voxix.apk" };
  assert.equal(urlDoApk([{ name: "x.txt", browser_download_url: "https://github.com/a" }, ok], "voxix.apk"), ok.browser_download_url);
  assert.equal(urlDoApk([], "Voxix.apk"), null);
  assert.equal(urlDoApk(undefined, "Voxix.apk"), null);
  assert.equal(urlDoApk([{ name: "Voxix.apk", browser_download_url: "https://evil.com/x/releases/download/1/Voxix.apk" }], "Voxix.apk"), null);
});
