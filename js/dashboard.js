/* =====================================================================
   PAINEL DOS NOIVOS — lista de confirmados + mídias dos convidados
   ---------------------------------------------------------------------
   • A senha é conferida no banco (js/api.js → supabase/setup.sql).
   • Guardamos a senha só na aba aberta (sessionStorage) para não pedir
     de novo ao atualizar a página; fechar a aba = sair.
   • Excluir (pessoa ou mídia) SEMPRE pede a senha de novo.
   ===================================================================== */

"use strict";

const CHAVE_SESSAO = "painelNoivos";
const CHAVE_ABA = "painelNoivosAba";
const ATUALIZAR_A_CADA = 30000;   // ms

const $ = id => document.getElementById(id);
const telaLogin = $("telaLogin"), telaPainel = $("telaPainel");
const formLogin = $("formLogin"), campoSenha = $("campoSenha"), erroLogin = $("erroLogin"), btnEntrar = $("btnEntrar");
const listaEl = $("lista"), estadoEl = $("estadoLista"), buscaEl = $("busca");
const btnAtualizar = $("btnAtualizar");
const abaConfirmados = $("abaConfirmados"), abaMidias = $("abaMidias"), painelConfirmados = $("painelConfirmados"), painelMidias = $("painelMidias");
const grade = $("grade"), estadoMidias = $("estadoMidias");
const visor = $("dlgVisor"), visorPalco = $("visorPalco"), visorInfo = $("visorInfo");
const dlg = $("dlgExcluir"), formExcluir = $("formExcluir"), senhaExcluir = $("senhaExcluir"), erroExcluir = $("erroExcluir"), btnExcluir = $("btnExcluir");

let senhaSessao = "";      // senha aceita nesta aba
let confirmados = [];      // última lista recebida
let alvoExclusao = null;   // { tipo: "pessoa" | "midia", item } que está sendo excluído
let midias = [];           // última lista de mídias recebida
let midiasErro = "";       // mensagem se a lista de mídias não carregou
let filtroMidias = "todas";
let midiaAberta = null;    // mídia no visualizador
let relogio = null;

/* ---------- Utilidades ---------- */
function guardarSessao(valor) {
  try { valor ? sessionStorage.setItem(CHAVE_SESSAO, valor) : sessionStorage.removeItem(CHAVE_SESSAO); } catch (_) { /* modo privado */ }
}
function lerSessao() {
  try { return sessionStorage.getItem(CHAVE_SESSAO) || ""; } catch (_) { return ""; }
}

let timerAviso;
function aviso(texto) {
  const el = $("aviso");
  el.textContent = texto;
  el.classList.add("visivel");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove("visivel"), 3000);
}

function mostrarErro(el, texto) { el.textContent = texto; el.hidden = !texto; }

function mensagemDeErro(err) {
  switch (err && err.codigo) {
    case "senha_invalida":   return "Senha incorreta.";
    case "nao_configurado":  return "O banco de dados ainda não foi configurado (js/api.js).";
    case "arquivo_inexistente": return "Arquivo não encontrado.";
    case "rede":             return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
    default:                 return "Não foi possível concluir agora. Confira se o SQL (supabase/setup.sql) foi executado e tente de novo.";
  }
}

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const formatoHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const normalizar = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* ---------- Entrada ---------- */
function mostrarPainel() {
  telaLogin.hidden = true;
  telaPainel.hidden = false;
  clearInterval(relogio);
  relogio = setInterval(() => { if (!document.hidden && !dlg.open && !visor.open) carregar(true); }, ATUALIZAR_A_CADA);
}

function sair() {
  clearInterval(relogio);
  guardarSessao("");
  senhaSessao = "";
  confirmados = [];
  midias = [];
  fecharVisor();
  formLogin.reset();
  mostrarErro(erroLogin, "");
  telaPainel.hidden = true;
  telaLogin.hidden = false;
  campoSenha.focus();
}

formLogin.addEventListener("submit", async e => {
  e.preventDefault();
  const senha = campoSenha.value;
  if (!senha) return mostrarErro(erroLogin, "Digite a senha.");
  mostrarErro(erroLogin, "");
  btnEntrar.disabled = true;
  try {
    confirmados = await Api.listar(senha) || [];
    senhaSessao = senha;
    guardarSessao(senha);
    formLogin.reset();
    mostrarPainel();
    desenhar();
    marcarAtualizacao();
    carregarMidias().catch(() => {});
  } catch (err) {
    mostrarErro(erroLogin, mensagemDeErro(err));
    if (err.codigo === "senha_invalida") { campoSenha.select(); }
  } finally {
    btnEntrar.disabled = false;
  }
});

/* ---------- Lista ---------- */
function marcarAtualizacao() { $("atualizadoEm").textContent = "· " + formatoHora.format(new Date()); }

async function carregar(silencioso = false) {
  if (!senhaSessao) return;
  btnAtualizar.classList.add("girando");
  try {
    const [lista] = await Promise.all([Api.listar(senhaSessao), carregarMidias()]);
    confirmados = lista || [];
    marcarAtualizacao();
    desenhar();
  } catch (err) {
    if (err.codigo === "senha_invalida") { sair(); mostrarErro(erroLogin, "Sessão expirada: digite a senha de novo."); return; }
    if (!silencioso) aviso(mensagemDeErro(err));
  } finally {
    btnAtualizar.classList.remove("girando");
  }
}

function telefoneWhatsApp(tel) {
  const d = String(tel || "").replace(/\D/g, "");
  return d.length >= 10 && d.length <= 11 ? `https://wa.me/55${d}` : "";
}

const ICONE_ZAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.5-4.3a8.5 8.5 0 1 1 15.5-4.6z"/></svg>';
const ICONE_LIXO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg>';

/** Monta a lista respeitando a busca. Todo texto entra via textContent (nomes vêm de convidados). */
function desenhar() {
  const total = confirmados.length;
  const termo = normalizar(buscaEl.value.trim());
  const visiveis = (termo ? confirmados.filter(p => normalizar(p.nome).includes(termo)) : confirmados.slice())
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));

  $("total").textContent = total;
  $("totalRotulo").textContent = total === 1 ? "confirmado" : "confirmados";
  $("ultima").textContent = total ? `Última confirmação em ${formatoData.format(new Date(confirmados[0].criado_em))}` : "";

  listaEl.textContent = "";
  estadoEl.hidden = true;

  if (!total) {
    estadoEl.textContent = "Ainda não há confirmações. Assim que alguém confirmar, aparece aqui.";
    estadoEl.hidden = false;
    return;
  }
  if (!visiveis.length) {
    estadoEl.textContent = `Ninguém encontrado para “${buscaEl.value.trim()}”.`;
    estadoEl.hidden = false;
    return;
  }

  visiveis.forEach((p, i) => {
    const li = document.createElement("li");
    li.className = "pessoa";
    li.style.setProperty("--i", Math.min(i, 12));

    const inicial = document.createElement("span");
    inicial.className = "pessoa__inicial";
    inicial.textContent = (p.nome.trim()[0] || "?");

    const dados = document.createElement("div");
    dados.className = "pessoa__dados";
    const nome = document.createElement("span");
    nome.className = "pessoa__nome";
    nome.textContent = p.nome;
    const meta = document.createElement("div");
    meta.className = "pessoa__meta";

    if (p.telefone) {
      const zap = telefoneWhatsApp(p.telefone);
      const tel = document.createElement(zap ? "a" : "span");
      tel.className = "pessoa__tel";
      if (zap) { tel.href = zap; tel.target = "_blank"; tel.rel = "noopener noreferrer"; tel.setAttribute("aria-label", `Abrir WhatsApp de ${p.nome}`); tel.insertAdjacentHTML("beforeend", ICONE_ZAP); }
      tel.appendChild(document.createTextNode(p.telefone));
      meta.appendChild(tel);
    }
    const quando = document.createElement("span");
    quando.textContent = formatoData.format(new Date(p.criado_em));
    meta.appendChild(quando);
    dados.append(nome, meta);

    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.className = "pessoa__excluir";
    excluir.setAttribute("aria-label", `Excluir ${p.nome}`);
    excluir.title = "Excluir";
    excluir.insertAdjacentHTML("beforeend", ICONE_LIXO);
    excluir.addEventListener("click", () => abrirExclusao({ tipo: "pessoa", item: p }));

    li.append(inicial, dados, excluir);
    listaEl.appendChild(li);
  });
}

buscaEl.addEventListener("input", desenhar);
btnAtualizar.addEventListener("click", () => carregar(false));
$("btnSair").addEventListener("click", sair);
document.addEventListener("visibilitychange", () => { if (!document.hidden && senhaSessao) carregar(true); });

/* ---------- Abas ---------- */
function irParaAba(qual) {
  const midia = qual === "midias";
  abaConfirmados.setAttribute("aria-selected", String(!midia));
  abaMidias.setAttribute("aria-selected", String(midia));
  painelConfirmados.hidden = midia;
  painelMidias.hidden = !midia;
  btnAtualizar.setAttribute("aria-label", midia ? "Atualizar mídias" : "Atualizar lista");
  try { sessionStorage.setItem(CHAVE_ABA, qual); } catch (_) { /* modo privado */ }
}
abaConfirmados.addEventListener("click", () => irParaAba("confirmados"));
abaMidias.addEventListener("click", () => irParaAba("midias"));

/* ---------- Mídias dos convidados ---------- */
const ICONE_BAIXAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>';
const ICONE_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>';

async function carregarMidias() {
  try {
    midias = await Api.listarMidias(senhaSessao) || [];
    midiasErro = "";
  } catch (err) {
    if (err.codigo === "senha_invalida") throw err;          // quem chamou trata (volta ao login)
    midiasErro = err.codigo === "rede" ? mensagemDeErro(err)
      : "Não foi possível carregar as mídias. Confira o endereço do Worker em js/api.js (cloudflare/LEIA-ME.md).";
  }
  desenharMidias();
}

function nomeDoArquivo(m) {
  const achado = /\.([a-z0-9]+)$/i.exec(m.caminho);
  const ext = achado ? achado[1].toLowerCase() : (m.tipo === "video" ? "mp4" : "jpg");
  const quem = m.convidado ? "-" + normalizar(m.convidado).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
  const q = new Date(m.criado_em);
  const data = [q.getFullYear(), q.getMonth() + 1, q.getDate(), q.getHours(), q.getMinutes(), q.getSeconds()].map(n => String(n).padStart(2, "0")).join("");
  return `casamento${quem}-${data}-${m.id.slice(0, 4)}.${ext}`;
}

/** Baixa o arquivo (fetch → blob, porque o atributo "download" não funciona entre domínios). */
async function baixarMidia(m) {
  aviso("Baixando…");
  try {
    const resp = await fetch(Api.urlMidia(m.caminho));
    if (!resp.ok) throw new Error(resp.status);
    const url = URL.createObjectURL(await resp.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeDoArquivo(m);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (_) {
    window.open(Api.urlMidia(m.caminho), "_blank", "noopener");   // plano B: abre o arquivo para salvar manualmente
  }
}

function botaoMidia(rotulo, icone, classe, aoClicar) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "midia__btn " + classe;
  b.setAttribute("aria-label", rotulo);
  b.title = rotulo;
  b.insertAdjacentHTML("beforeend", icone);
  b.addEventListener("click", aoClicar);
  return b;
}

function desenharMidias() {
  const fotos = midias.filter(m => m.tipo === "foto").length;
  const videos = midias.length - fotos;
  $("totalMidias").textContent = midias.length;
  $("totalMidiasRotulo").textContent = midias.length === 1 ? "arquivo" : "arquivos";
  $("detalheMidias").textContent = midias.length ? `${fotos} ${fotos === 1 ? "foto" : "fotos"} · ${videos} ${videos === 1 ? "vídeo" : "vídeos"}` : "";

  const visiveis = filtroMidias === "todas" ? midias : midias.filter(m => m.tipo === filtroMidias);
  grade.textContent = "";
  estadoMidias.hidden = true;

  if (midiasErro) { estadoMidias.textContent = midiasErro; estadoMidias.hidden = false; return; }
  if (!midias.length) {
    estadoMidias.textContent = "Ainda não há fotos nem vídeos. Quando os convidados enviarem, aparecem aqui.";
    estadoMidias.hidden = false;
    return;
  }
  if (!visiveis.length) {
    estadoMidias.textContent = filtroMidias === "foto" ? "Nenhuma foto por enquanto." : "Nenhum vídeo por enquanto.";
    estadoMidias.hidden = false;
    return;
  }

  visiveis.forEach((m, i) => {
    const li = document.createElement("li");
    li.className = "midia";
    li.style.setProperty("--i", Math.min(i, 12));

    const ver = document.createElement("button");
    ver.type = "button";
    ver.className = "midia__ver";
    ver.setAttribute("aria-label", m.tipo === "video" ? "Assistir vídeo" : "Ver foto");
    if (m.tipo === "video") {
      const v = document.createElement("video");
      v.src = Api.urlMidia(m.caminho) + "#t=0.1";
      v.preload = "metadata";
      v.muted = true;
      v.playsInline = true;
      ver.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = "";
      img.src = Api.urlMidia(m.miniatura || m.caminho);
      ver.appendChild(img);
    }
    ver.addEventListener("click", () => abrirVisor(m));

    const selo = document.createElement("span");
    selo.className = "midia__selo";
    if (m.tipo === "video") { selo.insertAdjacentHTML("beforeend", ICONE_PLAY); selo.appendChild(document.createTextNode("Vídeo")); }
    else selo.hidden = true;

    const rodape = document.createElement("div");
    rodape.className = "midia__rodape";
    const quem = document.createElement("span");
    quem.className = "midia__quem";
    quem.textContent = m.convidado || "";
    const acoes = document.createElement("div");
    acoes.className = "midia__acoes";
    acoes.append(
      botaoMidia("Baixar", ICONE_BAIXAR, "", () => baixarMidia(m)),
      botaoMidia("Excluir", ICONE_LIXO, "midia__btn--perigo", () => abrirExclusao({ tipo: "midia", item: m }))
    );
    rodape.append(quem, acoes);

    li.append(ver, selo, rodape);
    grade.appendChild(li);
  });
}

document.querySelectorAll("[data-filtro]").forEach(b => b.addEventListener("click", () => {
  filtroMidias = b.dataset.filtro;
  document.querySelectorAll("[data-filtro]").forEach(o => o.setAttribute("aria-pressed", String(o === b)));
  desenharMidias();
}));

/* ---------- Visualizador ---------- */
function abrirVisor(m) {
  midiaAberta = m;
  visorPalco.textContent = "";
  const el = document.createElement(m.tipo === "video" ? "video" : "img");
  el.src = Api.urlMidia(m.caminho);
  if (m.tipo === "video") { el.controls = true; el.autoplay = true; el.playsInline = true; } else { el.alt = ""; }
  visorPalco.appendChild(el);

  visorInfo.textContent = "";
  if (m.convidado) { const b = document.createElement("b"); b.textContent = m.convidado; visorInfo.append(b, document.createElement("br")); }
  visorInfo.appendChild(document.createTextNode(formatoData.format(new Date(m.criado_em))));
  visor.showModal();
}
function fecharVisor() { if (visor.open) visor.close(); }
visor.addEventListener("close", () => { visorPalco.textContent = ""; midiaAberta = null; });
visor.addEventListener("click", e => { if (e.target === visor) fecharVisor(); });
$("btnFecharVisor").addEventListener("click", fecharVisor);
$("visorBaixar").addEventListener("click", () => { if (midiaAberta) baixarMidia(midiaAberta); });
$("visorExcluir").addEventListener("click", () => { if (midiaAberta) abrirExclusao({ tipo: "midia", item: midiaAberta }); });

/* ---------- Excluir (pede a senha de novo) ---------- */
function abrirExclusao(alvo) {
  alvoExclusao = alvo;
  const midia = alvo.tipo === "midia";
  $("dlgTitulo").textContent = midia ? (alvo.item.tipo === "video" ? "Excluir vídeo" : "Excluir foto") : "Excluir confirmação";
  $("dlgNome").textContent = midia ? (alvo.item.convidado ? `de ${alvo.item.convidado}` : "enviado por um convidado") : alvo.item.nome;
  $("dlgDe").textContent = midia ? "para sempre" : "da lista de confirmados";
  formExcluir.reset();
  mostrarErro(erroExcluir, "");
  dlg.showModal();
  senhaExcluir.focus();
}
dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-cancelar]")) dlg.close(); });
dlg.addEventListener("close", () => { alvoExclusao = null; formExcluir.reset(); });

formExcluir.addEventListener("submit", async e => {
  e.preventDefault();
  if (!alvoExclusao) return;
  if (!senhaExcluir.value) return mostrarErro(erroExcluir, "Digite a senha.");
  mostrarErro(erroExcluir, "");
  btnExcluir.disabled = true;
  try {
    const { tipo, item } = alvoExclusao;
    if (tipo === "midia") {
      await Api.excluirMidia(item, senhaExcluir.value);
      if (midiaAberta && midiaAberta.id === item.id) fecharVisor();
      dlg.close();
      aviso(item.tipo === "video" ? "Vídeo excluído." : "Foto excluída.");
    } else {
      await Api.excluir(item.id, senhaExcluir.value);
      dlg.close();
      aviso(`${item.nome} foi removido(a) da lista.`);
    }
    await carregar(true);
  } catch (err) {
    mostrarErro(erroExcluir, mensagemDeErro(err));
    if (err.codigo === "senha_invalida") senhaExcluir.select();
  } finally {
    btnExcluir.disabled = false;
  }
});

/* ---------- Início: se já entrou nesta aba, retoma ---------- */
(async function iniciar() {
  const guardada = lerSessao();
  if (!guardada) return;
  try {
    confirmados = await Api.listar(guardada) || [];
    senhaSessao = guardada;
    mostrarPainel();
    desenhar();
    marcarAtualizacao();
    carregarMidias().catch(() => {});
    try { if (sessionStorage.getItem(CHAVE_ABA) === "midias") irParaAba("midias"); } catch (_) { /* modo privado */ }
  } catch (_) {
    guardarSessao("");                 // senha guardada não vale mais (ou sem rede): volta para a tela de senha
  }
})();
