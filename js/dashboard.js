/* =====================================================================
   PAINEL DOS NOIVOS — lista de confirmados
   ---------------------------------------------------------------------
   • A senha é conferida no banco (js/api.js → supabase/setup.sql).
   • Guardamos a senha só na aba aberta (sessionStorage) para não pedir
     de novo ao atualizar a página; fechar a aba = sair.
   • Excluir SEMPRE pede a senha de novo.
   ===================================================================== */

"use strict";

const CHAVE_SESSAO = "painelNoivos";
const ATUALIZAR_A_CADA = 30000;   // ms

const $ = id => document.getElementById(id);
const telaLogin = $("telaLogin"), telaPainel = $("telaPainel");
const formLogin = $("formLogin"), campoSenha = $("campoSenha"), erroLogin = $("erroLogin"), btnEntrar = $("btnEntrar");
const listaEl = $("lista"), estadoEl = $("estadoLista"), buscaEl = $("busca");
const btnAtualizar = $("btnAtualizar");
const dlg = $("dlgExcluir"), formExcluir = $("formExcluir"), senhaExcluir = $("senhaExcluir"), erroExcluir = $("erroExcluir"), btnExcluir = $("btnExcluir");

let senhaSessao = "";      // senha aceita nesta aba
let confirmados = [];      // última lista recebida
let alvoExclusao = null;   // pessoa que está sendo excluída
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
  relogio = setInterval(() => { if (!document.hidden && !dlg.open) carregar(true); }, ATUALIZAR_A_CADA);
}

function sair() {
  clearInterval(relogio);
  guardarSessao("");
  senhaSessao = "";
  confirmados = [];
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
    confirmados = await Api.listar(senhaSessao) || [];
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
    excluir.addEventListener("click", () => abrirExclusao(p));

    li.append(inicial, dados, excluir);
    listaEl.appendChild(li);
  });
}

buscaEl.addEventListener("input", desenhar);
btnAtualizar.addEventListener("click", () => carregar(false));
$("btnSair").addEventListener("click", sair);
document.addEventListener("visibilitychange", () => { if (!document.hidden && senhaSessao) carregar(true); });

/* ---------- Excluir (pede a senha de novo) ---------- */
function abrirExclusao(pessoa) {
  alvoExclusao = pessoa;
  $("dlgNome").textContent = pessoa.nome;
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
    await Api.excluir(alvoExclusao.id, senhaExcluir.value);
    const nome = alvoExclusao.nome;
    dlg.close();
    aviso(`${nome} foi removido(a) da lista.`);
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
  } catch (_) {
    guardarSessao("");                 // senha guardada não vale mais (ou sem rede): volta para a tela de senha
  }
})();
