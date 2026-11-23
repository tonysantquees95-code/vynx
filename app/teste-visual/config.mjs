// Telas que o teste visual visita no Vynx OS (modo de demonstração: o WSL é simulado em localStorage "vynx.demo.wsl").
import { readFileSync } from "node:fs";
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const TERMOS = src("apresentacao.ts").match(/VERSAO_DOS_TERMOS\s*=\s*(\d+)/)[1];

const semWsl = JSON.stringify({ instalado: false });
const comLab = JSON.stringify({ instalado: true, distros: [{ nome: "Ubuntu", estado: "Running", versao: 2 }, { nome: "vynx-lab-teste", estado: "Stopped", versao: 2 }] });

export default {
  porta: 4183,
  espera: 800,
  guardado: (modo) => modo === "primeira" ? {} : {
    "vynx.tour": "1", "vynx.termos": TERMOS,
    "vynx.novidades.vistas": modo === "atualizou" ? "0" : "9999",
    ...(modo === "sem-wsl" ? { "vynx.demo.wsl": semWsl } : {}),
    ...(modo === "com-lab" ? { "vynx.demo.wsl": comLab } : {}),
  },
  respostas: { "/user/repos": [], "/atualizacao": {} },
  cenarios: [
    ["primeira-abertura", "primeira", async () => {}],
    ["o-que-ha-de-novo", "atualizou", async (p) => { await p.getByText("O que há de novo").first().waitFor(); }],
    ["inicio", "normal", async (p) => { await p.getByRole("heading", { name: "Vynx OS" }).first().waitFor(); }],
    ["laboratorio-sem-wsl", "sem-wsl", async (p, a) => { await a.aba(p, "Laboratório"); await p.getByText("O WSL2 ainda não está instalado").waitFor(); }],
    ["laboratorio-lista", "com-lab", async (p, a) => { await a.aba(p, "Laboratório"); await p.getByRole("button", { name: "Abrir terminal" }).first().waitFor(); }],
    ["laboratorio-descartar", "com-lab", async (p, a) => { await a.aba(p, "Laboratório"); await p.getByRole("button", { name: "Descartar" }).first().click(); await p.getByRole("dialog", { name: "Descartar laboratório" }).waitFor(); }],
    ["painel-dev", "normal", async (p, a) => { await a.aba(p, "Painel Dev"); await p.getByRole("heading", { name: "Conectar ao GitHub" }).waitFor(); }],
    ["ajustes", "normal", async (p, a) => { await a.aba(p, "Ajustes"); await p.getByRole("heading", { name: "Ajustes" }).waitFor(); }],
    ["feedback", "normal", async (p, a) => { await a.aba(p, "Ajustes"); await p.getByRole("button", { name: "Enviar feedback" }).click(); await p.getByText(/^FEEDBACK/).waitFor(); await p.waitForTimeout(300); }],
  ],
};
