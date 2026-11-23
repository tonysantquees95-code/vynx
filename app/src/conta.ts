export const SERVIDOR = "https://venus-servidor.tonysantquees95.workers.dev";
export const plataforma = (): "windows" | "web" => (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? "windows" : "web");
