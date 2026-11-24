// Telas que o teste visual visita no Vynx OS (modo de demonstração: o WSL é simulado em localStorage "vynx.demo.wsl").
import { readFileSync } from "node:fs";
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const TERMOS = src("apresentacao.ts").match(/VERSAO_DOS_TERMOS\s*=\s*(\d+)/)[1];

const semWsl = JSON.stringify({ instalado: false });
const andPronto = JSON.stringify({ preparado: true, celulares: ["vynx-celular"], ligado: true, pronto: true });
const andCelular = JSON.stringify({ preparado: true, celulares: [] });
const andDesligado = JSON.stringify({ preparado: true, celulares: ["vynx-celular", "vynx-tablet"] });
const comLab = JSON.stringify({ instalado: true, distros: [{ nome: "Ubuntu", estado: "Running", versao: 2 }, { nome: "vynx-lab-teste", estado: "Stopped", versao: 2 }] });

export default {
  porta: 4183,
  espera: 800,
  guardado: (modo) => modo === "primeira" ? {} : {
    "vynx.tour": "1", "vynx.termos": TERMOS,
    ...(modo === "sem-conta" ? {} : { "vynx.sessao": JSON.stringify({ token: "teste", email: "dev@exemplo.com", nome: "Dev", admin: false }) }),
    "vynx.novidades.vistas": modo === "atualizou" ? "0" : "9999",
    ...(modo === "sem-wsl" ? { "vynx.demo.wsl": semWsl } : {}),
    ...(modo === "android-pronto" ? { "vynx.demo.android": andPronto } : {}),
    ...(modo === "android-celular" ? { "vynx.demo.android": andCelular } : {}),
    ...(modo === "android-desligado" ? { "vynx.demo.android": andDesligado } : {}),
    ...(modo === "com-lab" ? { "vynx.demo.wsl": comLab } : {}),
  },
  respostas: { "/user/repos": [], "/atualizacao": {} },
  cenarios: [
    ["primeira-abertura", "primeira", async () => {}],
    ["o-que-ha-de-novo", "atualizou", async (p) => { await p.getByText("O que há de novo").first().waitFor(); }],
    ["entrar", "sem-conta", async (p) => { await p.getByRole("button", { name: "Entrar", exact: true }).waitFor(); }],
    ["inicio", "normal", async (p, a) => { await a.aba(p, "Início"); await p.getByRole("heading", { name: "Vynx OS" }).first().waitFor(); }],
    ["mesa-de-trabalho", "normal", async (p) => { await p.getByRole("region", { name: "Mesa de trabalho" }).waitFor(); await p.getByRole("button", { name: "Abrir Laboratório" }).click(); await p.getByRole("region", { name: "Janela Laboratório" }).waitFor(); }],
    ["laboratorio-sem-wsl", "sem-wsl", async (p, a) => { await a.aba(p, "Laboratório"); await p.getByText("O WSL2 ainda não está instalado").waitFor(); }],
    ["laboratorio-lista", "com-lab", async (p, a) => { await a.aba(p, "Laboratório"); await p.getByRole("button", { name: "Abrir terminal" }).first().waitFor(); await p.getByRole("button", { name: "Criar laboratório principal" }).waitFor(); await p.getByRole("button", { name: "Importar projetos" }).first().waitFor(); await p.getByRole("button", { name: "Instalar Claude" }).first().waitFor(); }],
    ["laboratorio-descartar", "com-lab", async (p, a) => { await a.aba(p, "Laboratório"); await p.getByRole("button", { name: "Descartar" }).first().click(); await p.getByRole("dialog", { name: "Descartar laboratório" }).waitFor(); }],
    ["android-preparar", "normal", async (p, a) => { await a.aba(p, "Android"); await p.getByRole("heading", { name: "1. Preparar o emulador" }).waitFor(); const b = p.getByRole("button", { name: "Preparar emulador" }); if (!(await b.isDisabled())) throw new Error("o botão deveria esperar a licença"); await p.getByRole("checkbox").check(); if (await b.isDisabled()) throw new Error("com a licença aceita o botão deveria liberar"); await b.click(); await p.getByRole("status").first().waitFor(); await p.waitForTimeout(2500); await p.getByRole("heading", { name: "2. Criar um celular virtual" }).waitFor(); }],
    ["android-criar-celular", "android-celular", async (p, a) => { await a.aba(p, "Android"); await p.getByRole("radio", { name: /Tablet/ }).click(); if ((await p.getByRole("radio", { name: /Tablet/ }).getAttribute("aria-checked")) !== "true") throw new Error("o tipo escolhido deveria aparecer selecionado"); await p.getByRole("button", { name: "Criar celular virtual" }).click(); await p.getByText("Tablet", { exact: true }).first().waitFor(); }],
    ["android-ligar", "android-desligado", async (p, a) => { await a.aba(p, "Android"); await p.getByRole("button", { name: "Ligar" }).first().waitFor(); }],
    ["android-instalar", "android-pronto", async (p, a) => { await a.aba(p, "Android"); await p.getByRole("heading", { name: "Instalar um app" }).waitFor(); await p.getByRole("button", { name: "Instalar e abrir" }).first().waitFor(); }],
    ["painel-dev", "normal", async (p, a) => { await a.aba(p, "Painel Dev"); await p.getByRole("heading", { name: "Conectar ao GitHub" }).waitFor(); }],
    ["documentos", "normal", async (p, a) => { await a.aba(p, "Documentos"); await p.getByRole("heading", { name: "Documentos" }).waitFor(); await p.locator("iframe[title=\"Vindex Documentos\"]").waitFor(); }],
    ["ajustes", "normal", async (p, a) => { await a.aba(p, "Ajustes"); await p.getByRole("heading", { name: "Ajustes" }).waitFor(); }],
    ["terminal", "com-lab", async (p, a) => { await a.aba(p, "Terminal"); await p.getByRole("radio", { name: "teste" }).waitFor(); await p.getByRole("button", { name: "Conectar" }).click(); await p.locator(".xterm").first().waitFor(); await p.waitForTimeout(500); }],
    ["casca-janelas", "normal", async (p, a) => { await a.aba(p, "Laboratório"); await a.aba(p, "Android"); await a.aba(p, "Ajustes"); await p.getByRole("region", { name: "Janela Ajustes" }).waitFor(); }],
    ["casca-minimizar", "normal", async (p, a) => { await a.aba(p, "Laboratório"); const m = p.getByRole("button", { name: "Minimizar Laboratório" }); if (await m.count() && await m.isVisible()) { await m.click(); await p.waitForTimeout(200); } }],
    ["feedback", "normal", async (p, a) => { await a.aba(p, "Ajustes"); await p.getByRole("button", { name: "Enviar feedback" }).click(); await p.getByText(/^FEEDBACK/).waitFor(); await p.waitForTimeout(300); }],
  ],
};
