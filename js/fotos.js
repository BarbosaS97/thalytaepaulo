/* =====================================================================
   ENVIO DE FOTOS E VÍDEOS PELOS CONVIDADOS (página aberta pelo QR Code)
   ---------------------------------------------------------------------
   Para cada arquivo: envia ao Cloudflare R2 (nome aleatório) → para fotos, envia
   também uma miniatura leve; o nome e o tipo vão junto e aparecem
   no painel dos noivos. Veja cloudflare/worker.js.
   ===================================================================== */

"use strict";

const SIMULTANEOS = 2;                 // envios ao mesmo tempo (evita travar o celular)
const LIMITE_BYTES = MIDIAS.limiteMB * 1024 * 1024;
const CHAVE_NOME = "convidadoNome";

const $ = id => document.getElementById(id);
const campoNome = $("campoNome"), campoArquivos = $("campoArquivos"), btnEscolher = $("btnEscolher");
const erroEnvio = $("erroEnvio"), areaFila = $("areaFila"), filaEl = $("fila"), resumoEl = $("resumoFila"), btnMais = $("btnMais");

$("limiteMB").textContent = MIDIAS.limiteMB;

/** Tipos que alguns celulares deixam em branco; deduzidos pela extensão. */
const TIPO_POR_EXTENSAO = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v", webm: "video/webm", "3gp": "video/3gpp", avi: "video/x-msvideo"
};

const ICONE_VIDEO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>';
const ICONE_OK = '<svg class="item__marca" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>';

let fila = [];            // itens (um por arquivo) desta visita
let emAndamento = 0;

/* ---------- Utilidades ---------- */
function guardarNome(valor) { try { localStorage.setItem(CHAVE_NOME, valor); } catch (_) { /* modo privado */ } }
function lerNome() { try { return localStorage.getItem(CHAVE_NOME) || ""; } catch (_) { return ""; } }

function mostrarErro(texto) { erroEnvio.textContent = texto; erroEnvio.hidden = !texto; }

function idAleatorio() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}

function extensaoDe(arquivo) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(arquivo.name || "");
  return m ? m[1].toLowerCase() : "";
}

/** Descobre "image/..." ou "video/..." mesmo quando o celular não informa o tipo. */
function tipoMime(arquivo) {
  return arquivo.type || TIPO_POR_EXTENSAO[extensaoDe(arquivo)] || "";
}

function formatarTamanho(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function mensagemDeErro(err) {
  switch (err && err.codigo) {
    case "rede":           return "Sem conexão. Toque em “Tentar de novo”.";
    case "arquivo_grande": return `Arquivo maior que ${MIDIAS.limiteMB} MB.`;
    case "nao_configurado": return "Envio ainda não configurado.";
    default:               return "Não foi possível enviar. Toque em “Tentar de novo”.";
  }
}

/** Miniatura JPEG (lado maior = 480 px). Se o navegador não conseguir abrir a imagem, devolve null. */
async function criarMiniatura(arquivo) {
  try {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * escala));
    canvas.height = Math.max(1, Math.round(bmp.height * escala));
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    if (bmp.close) bmp.close();
    return await new Promise(res => canvas.toBlob(b => res(b), "image/jpeg", 0.8));
  } catch (_) {
    return null;
  }
}

/* ---------- Fila ---------- */
function criarItem(arquivo) {
  const mime = tipoMime(arquivo);
  const tipo = mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "foto" : null;

  const li = document.createElement("li");
  li.className = "item";
  const mini = document.createElement("div");
  mini.className = "item__mini";
  const dados = document.createElement("div");
  dados.className = "item__dados";
  const nome = document.createElement("span");
  nome.className = "item__nome";
  nome.textContent = arquivo.name || (tipo === "video" ? "vídeo" : "foto");
  const status = document.createElement("span");
  status.className = "item__status";
  const barra = document.createElement("div");
  barra.className = "barra";
  const preenchida = document.createElement("i");
  barra.appendChild(preenchida);
  dados.append(nome, status, barra);
  const lado = document.createElement("div");
  li.append(mini, dados, lado);

  if (tipo === "foto") {
    const img = document.createElement("img");
    img.alt = "";
    img.className = "item__mini";
    img.src = URL.createObjectURL(arquivo);
    img.onload = img.onerror = () => URL.revokeObjectURL(img.src);
    mini.replaceWith(img);
  } else {
    mini.insertAdjacentHTML("beforeend", ICONE_VIDEO);
  }

  const item = { arquivo, mime, tipo, li, status, preenchida, lado, estado: "espera" };
  if (!tipo) falhar(item, "Formato não aceito (só fotos e vídeos).", false);
  else if (arquivo.size > LIMITE_BYTES) falhar(item, `Arquivo grande demais (${formatarTamanho(arquivo.size)}; máximo ${MIDIAS.limiteMB} MB).`, false);
  else status.textContent = "Na fila…";
  return item;
}

function falhar(item, texto, podeRepetir = true) {
  item.estado = "erro";
  item.li.classList.remove("item--ok");
  item.li.classList.add("item--erro");
  item.status.textContent = texto;
  item.lado.textContent = "";
  if (podeRepetir) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "item__acao";
    b.textContent = "Tentar de novo";
    b.addEventListener("click", () => { item.estado = "espera"; item.li.classList.remove("item--erro"); item.status.textContent = "Na fila…"; item.lado.textContent = ""; andar(); });
    item.lado.appendChild(b);
  }
  atualizarResumo();
}

async function enviar(item) {
  item.estado = "enviando";
  emAndamento++;
  item.status.textContent = "Enviando… 0%";
  const base = idAleatorio();
  const caminho = `${base}.${extensaoDe(item.arquivo).replace(/[^a-z0-9]/g, "") || (item.tipo === "video" ? "mp4" : "jpg")}`;
  try {
    const corpo = item.mime === item.arquivo.type ? item.arquivo : new File([item.arquivo], item.arquivo.name, { type: item.mime });
    await Api.enviarArquivo(caminho, corpo, p => {
      item.preenchida.style.width = `${Math.round(p * 100)}%`;
      item.status.textContent = `Enviando… ${Math.round(p * 100)}%`;
    }, { convidado: campoNome.value.trim(), tipo: item.tipo });

    if (item.tipo === "foto") {
      const blob = await criarMiniatura(item.arquivo);
      if (blob) {
        try { await Api.enviarArquivo(`${base}_t.jpg`, blob, null, { tipo: "foto" }); } catch (_) { /* miniatura é opcional */ }
      }
    }

    item.estado = "ok";
    item.li.classList.add("item--ok");
    item.status.textContent = "Enviado!";
    item.lado.insertAdjacentHTML("beforeend", ICONE_OK);
  } catch (err) {
    falhar(item, mensagemDeErro(err));
  } finally {
    emAndamento--;
    atualizarResumo();
    andar();
  }
}

function andar() {
  while (emAndamento < SIMULTANEOS) {
    const proximo = fila.find(i => i.estado === "espera");
    if (!proximo) break;
    enviar(proximo);
  }
}

function atualizarResumo() {
  const ok = fila.filter(i => i.estado === "ok").length;
  const pendentes = fila.filter(i => i.estado === "espera" || i.estado === "enviando").length;
  const erros = fila.filter(i => i.estado === "erro").length;
  if (pendentes) resumoEl.textContent = `Enviando… ${ok} de ${fila.length} prontos. Mantenha esta tela aberta.`;
  else if (erros) resumoEl.textContent = `${ok} enviado${ok === 1 ? "" : "s"}; ${erros} com problema.`;
  else resumoEl.textContent = ok === 1 ? "Pronto! Seu arquivo foi enviado aos noivos. 💛" : `Pronto! Seus ${ok} arquivos foram enviados aos noivos. 💛`;
  btnMais.hidden = pendentes > 0;
}

/* ---------- Eventos ---------- */
campoNome.value = lerNome();
campoNome.addEventListener("change", () => guardarNome(campoNome.value.trim()));

btnEscolher.addEventListener("click", () => campoArquivos.click());
btnMais.addEventListener("click", () => campoArquivos.click());

campoArquivos.addEventListener("change", () => {
  const escolhidos = Array.from(campoArquivos.files || []);
  campoArquivos.value = "";            // permite escolher o mesmo arquivo de novo
  if (!escolhidos.length) return;
  mostrarErro("");
  guardarNome(campoNome.value.trim());
  areaFila.hidden = false;
  for (const arquivo of escolhidos) {
    const item = criarItem(arquivo);
    fila.push(item);
    filaEl.prepend(item.li);
  }
  atualizarResumo();
  andar();
});

/* Evita perder envios sem querer */
window.addEventListener("beforeunload", e => {
  if (fila.some(i => i.estado === "espera" || i.estado === "enviando")) { e.preventDefault(); e.returnValue = ""; }
});
