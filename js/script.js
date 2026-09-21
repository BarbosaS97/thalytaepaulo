/* =====================================================================
   CONVITE DE CASAMENTO — THALYTA & PAULO
   ---------------------------------------------------------------------
   1. CONFIG  ← é AQUI que você edita nomes, data, links e arquivos
   2. Preenchimento automático dos textos e links
   3. Motor do livro (virar página, arrastar, teclado, roda do mouse)
   4. Vídeo da capa
   5. Música de fundo
   6. Confirmação de presença (janela + agradecimento)
   7. Corações flutuantes e inicialização
   ===================================================================== */

"use strict";

/* ---------------------------------------------------------------------
   1. CONFIG
   --------------------------------------------------------------------- */
/** Celular (ou tablet) em pé: usa a capa vertical, mais leve e nítida nessa tela. */
const CAPA_VERTICAL = window.matchMedia("(orientation: portrait)").matches;

const CONFIG = {
  // ---- Textos ----
  nomes: "Thalyta e Paulo",            // use " e " entre os nomes (vira "Thalyta / e / Paulo")
  data: "07/11/2026",                  // DD/MM/AAAA — daqui saem o mês por extenso, o dia da semana e a contagem
  hora: "16h00",                       // horário de início (ex.: "16h00" ou "16:30")
  antecedenciaMin: 30,                 // "chegar com X minutos de antecedência" (use 0 para ocultar o aviso)
  fusoHorario: "-03:00",               // Brasília; a contagem fica certa mesmo para quem está em outro fuso
  local: "CENTREJUFE",
  localDescricao: "Centro de Treinamento da Justiça Federal",   // deixe "" para ocultar
  endereco: [                          // uma linha por item; use [] para ocultar
    "St. de Clubes Esportivos Sul Trecho 2",
    "Plano Piloto, Brasília - DF",
    "CEP 70297-400"
  ],
  paisNoiva: ["Etelvina", "Valter"],
  paisNoivo: ["Ana Paula", "Valdenir"],

  // ---- WhatsApp dos noivos (aparecem em "Tem alguma dúvida?") ----
  contatos: [
    { nome: "Thalyta", whatsapp: "+55 61 9223-3654" },
    { nome: "Paulo",   whatsapp: "+55 61 9400-8042" }
  ],
  mensagemDuvida: "Olá! Tenho uma dúvida sobre o casamento.",

  // ---- Confirmação de presença (botão grande da última página) ----
  // As confirmações são gravadas no Supabase (js/api.js) e aparecem no painel privado dos noivos.
  // Se o banco estiver fora do ar, a janela oferece confirmar pelo WhatsApp deste contato:
  confirmarCom: "Thalyta",
  mensagemConfirmacao: "Olá! Confirmo minha presença no casamento de Thalyta e Paulo. Meu nome é ",

  // ---- Botão "Saiba como chegar" (página 4) ----
  linkMapa: "https://maps.app.goo.gl/fzCWdRTDXXGtgAvj6",   // CENTREJUFE no Google Maps

  // ---- Arquivos (pasta /midias/) ----
  // Capa: duas versões do mesmo vídeo. O celular em pé baixa a VERTICAL (720×1280, recortada em volta do
  // casal, 5 MB, mais nítida na tela pequena); computador/tela deitada usa a horizontal (1080p).
  videoCapa: "midias/video.mp4",                   // horizontal
  videoCapaMobile: "midias/video-mobile.mp4",      // vertical
  posterCapa: "midias/capa-video.jpg",             // quadro exibido enquanto o vídeo carrega (ou se ele falhar)
  posterCapaMobile: "midias/capa-mobile.jpg",
  fotosPaginas: [                      // fundos das páginas 2, 3, 4 e 5 (nessa ordem)
    "midias/foto2.jpg",                //   2 — convite (pais e nomes)
    "midias/foto1.jpg",                //   3 — save the date
    "midias/foto4.jpg",                //   4 — cerimônia (endereço)
    "midias/foto3.jpg"                 //   5 — confirmação de presença
  ],
  // Ponto de foco de cada foto/vídeo (evita cortar rostos em telas largas). Formato CSS: "x% y%"
  posicaoCapa: "47% 50%",              // capa horizontal (vídeo e quadro de reserva)
  posicaoCapaMobile: "50% 50%",        // capa vertical (o recorte já está centralizado no casal)
  posicaoFotos: ["50% 55%", "50% 80%", "50% 32%", "50% 62%"],

  // ---- Música ----
  musica: "midias/musica-web.mp3",     // mesma faixa em 128 kbps (2,7 MB); o arquivo original de 320 kbps continua na pasta
  musicaAutoplay: true,                // começa já na capa (ver nota em "5. Música de fundo")
  volumeMusica: 0.5                    // 0 a 1
};


/* ---------------------------------------------------------------------
   2. PREENCHIMENTO DOS TEXTOS E LINKS
   --------------------------------------------------------------------- */

const MESES   = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const doisDigitos = n => String(n).padStart(2, "0");

/** "07/11/2026" → { dia:"07", mes:"Novembro", ano:"2026", semana:"Sábado", n:{dia,mes,ano} }.
 *  Se a data não for válida (ex.: o placeholder "00/00/2026"), devolve o texto cru em `dia`. */
function interpretarData(texto) {
  const m = String(texto).match(/^\s*(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})\s*$/);
  const cru = { dia: String(texto), mes: "", ano: "", semana: "", n: null };
  if (!m) return cru;
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ref = new Date(Date.UTC(ano, mes - 1, dia));
  if (mes < 1 || mes > 12 || ref.getUTCDate() !== dia) return cru;
  return { dia: doisDigitos(dia), mes: MESES[mes - 1], ano: String(ano), semana: SEMANAS[ref.getUTCDay()], n: { dia, mes, ano } };
}

/** "16h00" / "16:30" / "16h" → { h, min } (ou null se não entender). */
function interpretarHora(texto) {
  const m = String(texto).match(/^\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*$/i);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2] || 0);
  return h < 24 && min < 60 ? { h, min } : null;
}

/** Momento exato do casamento (para a contagem regressiva) ou null. */
function calcularAlvo() {
  const d = interpretarData(CONFIG.data);
  if (!d.n) return null;
  const hr = interpretarHora(CONFIG.hora) || { h: 0, min: 0 };
  const iso = `${d.ano}-${doisDigitos(d.n.mes)}-${doisDigitos(d.n.dia)}T${doisDigitos(hr.h)}:${doisDigitos(hr.min)}:00${CONFIG.fusoHorario}`;
  const alvo = new Date(iso);
  return isNaN(alvo) ? null : alvo;
}

/** "Pedimos que chegue com 30 minutos de antecedência (15h30)." */
function textoChegada() {
  const min = Number(CONFIG.antecedenciaMin);
  if (!min) return "";
  let texto = `Pedimos que chegue com ${min} minutos de antecedência`;
  const hr = interpretarHora(CONFIG.hora);
  if (hr) {
    const total = ((hr.h * 60 + hr.min - min) % 1440 + 1440) % 1440;
    texto += ` (${Math.floor(total / 60)}h${doisDigitos(total % 60)})`;
  }
  return texto + ".";
}

/** Valores que podem ser usados em data-cfg="..." no HTML. */
function montarValores() {
  const d = interpretarData(CONFIG.data);
  return {
    dia: d.dia,
    mes: d.mes,
    ano: d.ano,
    dataBarras: d.mes ? `${d.dia} | ${d.mes} | ${d.ano}` : d.dia,
    diaHora: [d.semana, CONFIG.hora && `às ${CONFIG.hora}`].filter(Boolean).join(", "),
    chegada: textoChegada(),
    local: CONFIG.local,
    localDescricao: CONFIG.localDescricao,
    endereco: CONFIG.endereco,
    paisNoiva: CONFIG.paisNoiva,
    paisNoivo: CONFIG.paisNoivo
  };
}

/** "Thalyta e Paulo" → <span>Thalyta</span><span>e</span><span>Paulo</span> */
function preencherNomes(el) {
  el.textContent = "";
  const partes = CONFIG.nomes.split(/\s+e\s+|\s*&\s*/i);
  const criar = (classe, texto) => {
    const s = document.createElement("span");
    s.className = classe;
    s.textContent = texto;
    el.appendChild(s);
  };
  // Elementos pequenos (assinatura) mostram os nomes numa linha só, sem estilo de script
  if (!el.classList.contains("nomes") || partes.length !== 2) {
    el.textContent = CONFIG.nomes;
    return;
  }
  criar("nome", partes[0]);
  criar("nome-e", "e");
  criar("nome", partes[1]);
  el.setAttribute("aria-label", CONFIG.nomes);
}

function preencherTextos() {
  const valores = montarValores();
  document.querySelectorAll("[data-cfg]").forEach(el => {
    const chave = el.dataset.cfg;
    if (chave === "nomes") return preencherNomes(el);

    const valor = valores[chave];
    if (Array.isArray(valor)) {                       // lista: uma linha por item
      el.textContent = "";
      valor.forEach(item => {
        const linha = document.createElement("span");
        linha.textContent = item;
        el.appendChild(linha);
      });
    } else {
      el.textContent = valor || "";
    }
    el.hidden = !valor || (Array.isArray(valor) && !valor.length);
  });

  // Some o que não tem conteúdo: "mês · ano" sem data válida, aviso de chegada sem antecedência
  const resto = document.querySelector(".data__resto");
  if (resto && !valores.mes) resto.hidden = true;
  const chegada = document.querySelector(".chegada");
  if (chegada && !valores.chegada) chegada.hidden = true;

  document.title = `${CONFIG.nomes.replace(/\s+e\s+/i, " & ")} — Convite de Casamento`;
}

/** "+55 61 9223-3654" + texto → https://wa.me/556192233654?text=... */
function linkWhatsApp(numero, texto) {
  const digitos = String(numero).replace(/\D/g, "");
  return `https://wa.me/${digitos}` + (texto ? `?text=${encodeURIComponent(texto)}` : "");
}

/** Contato que recebe as confirmações (CONFIG.confirmarCom); se não achar, o primeiro da lista. */
function contatoDeConfirmacao() {
  const nome = String(CONFIG.confirmarCom || "").trim().toLowerCase();
  return CONFIG.contatos.find(c => c.nome.toLowerCase() === nome) || CONFIG.contatos[0];
}

/** Cria os botões de WhatsApp de "Tem alguma dúvida?" (um por contato do CONFIG). */
function montarContatos() {
  const caixa = document.querySelector("[data-contatos]");
  if (!caixa) return;
  const svg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.5-4.3a8.5 8.5 0 1 1 15.5-4.6z"/><path d="M9.2 8.6c.2 2.4 2.3 4.7 5.3 5.8l1.3-1.3-1.9-1-.9.8a4.6 4.6 0 0 1-2-2l.8-.9-1-1.9-1.6.5z"/></svg>';
  CONFIG.contatos.forEach(c => {
    const a = document.createElement("a");
    a.className = "contato";
    a.href = linkWhatsApp(c.whatsapp, CONFIG.mensagemDuvida);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", `Chamar ${c.nome} no WhatsApp`);
    a.innerHTML = svg;                                // ícone fixo, sem dados de terceiros
    const nome = document.createElement("span");
    nome.textContent = c.nome;
    a.appendChild(nome);
    caixa.appendChild(a);
  });
  const bloco = caixa.closest(".duvidas");
  if (bloco && !CONFIG.contatos.length) bloco.hidden = true;
}

/** Liga o botão "Saiba como chegar" ao mapa. Se o link for "#", mostra um aviso em vez de navegar. */
function configurarLinks() {
  const mapa = { mapa: CONFIG.linkMapa };
  document.querySelectorAll("a[data-link]").forEach(a => {
    const url = mapa[a.dataset.link];
    if (url && url !== "#") {
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else {
      a.addEventListener("click", e => {
        e.preventDefault();
        mostrarAviso("Este link ainda não foi configurado (CONFIG no script.js).");
      });
    }
  });
}

/** Contagem regressiva (página 3): atualiza a cada segundo; no grande dia mostra uma mensagem. */
function iniciarContagem() {
  const caixa = document.querySelector(".contagem");
  if (!caixa) return;
  const alvo = calcularAlvo();
  if (!alvo) { caixa.hidden = true; return; }       // data ainda é placeholder: não mostra contagem

  const itens = caixa.querySelector(".contagem__itens");
  const fim = caixa.querySelector(".contagem__fim");
  const campo = nome => caixa.querySelector(`[data-c="${nome}"]`);
  const [cDias, cHoras, cMin, cSeg] = ["dias", "horas", "min", "seg"].map(campo);

  function atualizar() {
    const restante = Math.floor((alvo - Date.now()) / 1000);
    if (restante <= 0) {
      itens.hidden = true;
      fim.hidden = false;
      clearInterval(relogio);
      return;
    }
    cDias.textContent  = Math.floor(restante / 86400);
    cHoras.textContent = doisDigitos(Math.floor(restante % 86400 / 3600));
    cMin.textContent   = doisDigitos(Math.floor(restante % 3600 / 60));
    cSeg.textContent   = doisDigitos(restante % 60);
  }
  const relogio = setInterval(atualizar, 1000);
  atualizar();
}

let timerAviso;
function mostrarAviso(texto) {
  const el = document.getElementById("aviso");
  el.textContent = texto;
  el.classList.add("visivel");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove("visivel"), 3200);
}


/* ---------------------------------------------------------------------
   3. MOTOR DO LIVRO
   --------------------------------------------------------------------- */
const livro   = document.getElementById("livro");
const paginas = Array.from(livro.querySelectorAll(".pagina"));
const TOTAL   = paginas.length;
const pontos  = document.getElementById("pontos");
const btnAnt  = document.getElementById("btnAnt");
const btnProx = document.getElementById("btnProx");

let atual = 0;   // índice da página que está aberta

/** Prepara z-index, atrasos das animações de texto e os pontos de progresso. */
function prepararPaginas() {
  paginas.forEach((p, i) => {
    p.style.zIndex = TOTAL - i;                      // a página 1 fica por cima
    p.querySelectorAll(".anima").forEach((el, n) => el.style.setProperty("--i", n));

    const ponto = document.createElement("button");
    ponto.className = "ponto";
    ponto.type = "button";
    ponto.setAttribute("aria-label", `Ir para a página ${i + 1}`);
    ponto.addEventListener("click", () => irPara(i));
    pontos.appendChild(ponto);
  });
}

/** Carrega a foto de uma página só quando ela está perto de ser vista (lazy loading). */
function carregarFoto(i) {
  const img = paginas[i] && paginas[i].querySelector("img[data-src]");
  if (!img) return;
  img.src = img.dataset.src;
  img.removeAttribute("data-src");
}

/** Define a foto de cada página a partir do CONFIG (sem carregar ainda). */
function prepararFotos() {
  const poster = document.querySelector("[data-capa-poster]");
  poster.dataset.src = CAPA_VERTICAL ? CONFIG.posterCapaMobile : CONFIG.posterCapa;
  poster.style.setProperty("--pos", CAPA_VERTICAL ? CONFIG.posicaoCapaMobile : CONFIG.posicaoCapa);

  document.querySelectorAll("img[data-foto]").forEach(img => {
    const n = Number(img.dataset.foto);
    if (CONFIG.fotosPaginas[n]) img.dataset.src = CONFIG.fotosPaginas[n];
    if (CONFIG.posicaoFotos[n]) img.style.setProperty("--pos", CONFIG.posicaoFotos[n]);
  });
  // Se uma foto não existir, esconde a imagem quebrada e deixa o fundo de reserva
  document.querySelectorAll(".pagina__foto").forEach(img => {
    img.addEventListener("error", () => { img.style.display = "none"; });
  });
}

/* Ao abrir o link, só a capa (quadro + vídeo) usa a internet. As fotos das páginas seguintes
   só começam a baixar depois que o vídeo toca ou no primeiro toque — para o vídeo não brigar por banda. */
let vizinhasLiberadas = false;
function carregarVizinhas() { for (let k = -1; k <= 2; k++) carregarFoto(atual + k); }
function liberarVizinhas() {
  if (vizinhasLiberadas) return;
  vizinhasLiberadas = true;
  carregarVizinhas();
}

/** Atualiza tudo que depende da página atual. */
function atualizarEstado() {
  paginas.forEach((p, i) => {
    p.classList.toggle("virada", i < atual);
    p.inert = i !== atual;                           // só a página aberta recebe foco/toques
    if (i === atual) p.classList.add("ativa");       // dispara as animações de entrada
  });
  Array.from(pontos.children).forEach((b, i) => {
    b.classList.toggle("ativo", i === atual);
    if (i === atual) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
  });
  btnAnt.hidden  = atual === 0;
  btnProx.hidden = atual === TOTAL - 1;

  // Carrega a foto desta página e, liberado o carregamento das vizinhas, também da anterior e das próximas
  if (vizinhasLiberadas) carregarVizinhas(); else carregarFoto(atual);

  // Depois que a virada termina, "desativa" as páginas antigas (reinicia as animações) e pausa o vídeo
  setTimeout(() => {
    paginas.forEach((p, i) => { if (i !== atual) p.classList.remove("ativa"); });
    controlarVideo();
  }, 1600);
  if (atual === 0) controlarVideo();
}

/** Vai para uma página. Se pular várias, elas viram em cascata. */
function irPara(destino) {
  destino = Math.max(0, Math.min(TOTAL - 1, destino));
  if (destino === atual) return;
  vizinhasLiberadas = true;                          // o convidado já está navegando: carrega tudo
  const origem = atual;
  atual = destino;

  paginas.forEach((p, i) => {
    const deveVirar = i < atual;
    const mudou = p.classList.contains("virada") !== deveVirar;
    const ordem = destino > origem ? i - origem : origem - 1 - i;
    p.style.setProperty("--atraso", mudou ? `${Math.max(0, ordem) * 0.12}s` : "0s");
  });
  atualizarEstado();
}

const proxima  = () => irPara(atual + 1);
const anterior = () => irPara(atual - 1);

/* ---- Botões e cliques ---- */
btnProx.addEventListener("click", proxima);
btnAnt.addEventListener("click", anterior);

livro.addEventListener("click", e => {
  const alvo = e.target.closest("[data-acao]");
  if (alvo) {
    if (alvo.dataset.acao === "proxima") proxima();
    if (alvo.dataset.acao === "inicio") irPara(0);
    if (alvo.dataset.acao === "confirmar") abrirConfirmacao();
    return;
  }
  // Na capa, tocar em qualquer lugar abre o livro
  if (atual === 0 && e.target.closest(".pagina--capa")) proxima();
});

/* ---- Teclado ---- */
document.addEventListener("keydown", e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (document.querySelector("dialog[open]")) return;            // janela de confirmação aberta: teclas são dela
  if (e.target.closest && e.target.closest("input, textarea")) return;
  switch (e.key) {
    case "ArrowRight": case "ArrowDown": case "PageDown": proxima(); break;
    case "ArrowLeft":  case "ArrowUp":   case "PageUp":   anterior(); break;
    case "Home": irPara(0); break;
    case "End":  irPara(TOTAL - 1); break;
    case " ":
      // Espaço vira a página, exceto quando um botão/link está focado (aí ele o aciona)
      if (!e.target.closest("button, a")) { e.preventDefault(); proxima(); }
      break;
  }
});

/* ---- Roda do mouse / trackpad (com intervalo, para não pular páginas) ---- */
let ultimaRoda = 0;
livro.addEventListener("wheel", e => {
  const rolavel = e.target.closest(".pagina__conteudo");
  if (rolavel && rolavel.scrollHeight > rolavel.clientHeight + 2) return;   // deixa rolar o conteúdo
  const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
  const agora = Date.now();
  if (Math.abs(delta) < 25 || agora - ultimaRoda < 1200) return;
  ultimaRoda = agora;
  // Rolar não é um "gesto" que libera o som no navegador. Na capa, pedimos um clique/toque,
  // que abre o convite E liga a música ao mesmo tempo.
  if (atual === 0 && delta > 0 && somBloqueado()) {
    mostrarAviso("Clique ou toque na capa para abrir o convite");
    return;
  }
  irPara(atual + (delta > 0 ? 1 : -1));
}, { passive: true });

/* ---- Arrastar (dedo ou mouse): a página acompanha o gesto ---- */
let arrasto = null;          // estado do gesto em andamento
let bloquearClique = false;  // evita "clicar" em um botão logo após um arrasto

function progressoDoArrasto(dx) {
  const largura = window.innerWidth * 0.85;
  const bruto = arrasto.dir === 1 ? -dx : dx;        // dir 1 = avançando (arrasta p/ esquerda)
  return Math.max(0, Math.min(1, bruto / largura));
}

function aplicarArrasto(prog) {
  const { pagina, sombra, dir } = arrasto;
  const angulo = dir === 1 ? -180 * prog : -180 * (1 - prog);
  pagina.style.transform = `rotateY(${angulo}deg)`;
  sombra.style.opacity = dir === 1 ? prog : 1 - prog;
  arrasto.prog = prog;
}

livro.addEventListener("pointerdown", e => {
  liberarVizinhas();                                  // a página de baixo precisa estar pronta se o gesto virar a página
  if (e.pointerType === "mouse" && e.button !== 0) return;
  arrasto = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), ativo: false, dir: 0, prog: 0 };
});

livro.addEventListener("pointermove", e => {
  if (!arrasto || e.pointerId !== arrasto.id) return;
  const dx = e.clientX - arrasto.x0;
  const dy = e.clientY - arrasto.y0;

  if (!arrasto.ativo) {
    // Só começa a virar quando o gesto é claramente horizontal
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    const dir = dx < 0 ? 1 : -1;
    if ((dir === 1 && atual === TOTAL - 1) || (dir === -1 && atual === 0)) { arrasto = null; return; }

    arrasto.dir = dir;
    arrasto.pagina = dir === 1 ? paginas[atual] : paginas[atual - 1];
    arrasto.sombra = arrasto.pagina.querySelector(".pagina__sombra");
    arrasto.pagina.style.setProperty("--atraso", "0s");
    arrasto.pagina.classList.add("arrastando");
    if (dir === -1) carregarFoto(atual - 1);
    try { livro.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
    arrasto.ativo = true;
  }
  aplicarArrasto(progressoDoArrasto(dx));
});

function terminarArrasto(e) {
  if (!arrasto || e.pointerId !== arrasto.id) return;
  const g = arrasto;
  arrasto = null;
  if (!g.ativo) return;

  const dx = e.clientX - g.x0;
  const velocidade = Math.abs(dx) / Math.max(1, performance.now() - g.t0);   // px/ms
  const cancelado = e.type === "pointercancel";
  const concluir = !cancelado && (g.prog > 0.28 || (velocidade > 0.45 && g.prog > 0.05));

  void g.pagina.offsetWidth;                          // garante que a transição parta do ângulo atual
  g.pagina.style.transform = "";
  g.sombra.style.opacity = "";
  g.pagina.classList.remove("arrastando");

  if (concluir) { atual += g.dir; }
  atualizarEstado();

  bloquearClique = true;
  setTimeout(() => { bloquearClique = false; }, 60);
}
livro.addEventListener("pointerup", terminarArrasto);
livro.addEventListener("pointercancel", terminarArrasto);

// Depois de arrastar, engole o "click" para não abrir link nem virar a capa duas vezes
livro.addEventListener("click", e => {
  if (bloquearClique) { e.preventDefault(); e.stopPropagation(); }
}, true);


/* ---------------------------------------------------------------------
   4. VÍDEO DA CAPA
   --------------------------------------------------------------------- */
const video = document.querySelector(".capa__video");

/** Conexão que não vale gastar 5 MB de vídeo: "economizar dados" ligado ou rede 2G. */
function conexaoFraca() {
  const c = navigator.connection;
  return !!c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ""));
}

/** Roda `fn` quando o vídeo começa a tocar (ou após `limite` ms; ou já, se não há vídeo).
 *  Serve para adiar o que compete por banda com o vídeo (música, fotos das outras páginas). */
function depoisDoVideo(fn, limite = 3500) {
  if (!video.getAttribute("src")) return fn();
  let feito = false;
  const ir = () => { if (!feito) { feito = true; fn(); } };
  video.addEventListener("playing", () => setTimeout(ir, 300), { once: true });
  setTimeout(ir, limite);
}

function iniciarVideo() {
  if (conexaoFraca()) return;                        // fica só o quadro de reserva (foto)
  video.muted = true;                                // necessário para o autoplay funcionar
  video.defaultMuted = true;
  video.setAttribute("playsinline", "");
  video.style.setProperty("--pos", CAPA_VERTICAL ? CONFIG.posicaoCapaMobile : CONFIG.posicaoCapa);
  // O vídeo só aparece (fade) quando começa a tocar; até lá (ou se falhar) fica a foto de reserva
  video.addEventListener("playing", () => video.classList.add("pronto"));
  video.addEventListener("error", () => video.classList.remove("pronto"));
  video.src = CAPA_VERTICAL ? CONFIG.videoCapaMobile : CONFIG.videoCapa;
  video.play().catch(() => { /* iOS em economia de energia: tenta de novo no primeiro toque */ });

  document.addEventListener("pointerup", () => {
    if (atual === 0 && video.paused && video.currentSrc) video.play().catch(() => {});
  }, { once: true });
}

/** Toca o vídeo só quando a capa está visível (poupa bateria). */
function controlarVideo() {
  if (!video.currentSrc) return;
  if (atual === 0) video.play().catch(() => {});
  else video.pause();
}


/* ---------------------------------------------------------------------
   5. MÚSICA DE FUNDO
   --------------------------------------------------------------------- */
const audio     = document.getElementById("audio");
const btnMusica = document.getElementById("btnMusica");
let escolhaManual = false;   // true se o convidado já mexeu no botão (aí não forçamos o autoplay)

/** A música deveria estar tocando, mas o navegador ainda está segurando o som (falta o 1º gesto)? */
function somBloqueado() {
  return CONFIG.musicaAutoplay && !!CONFIG.musica && !escolhaManual && !btnMusica.hidden && audio.paused;
}

/** O arquivo da música só começa a baixar aqui (depois do vídeo, ou no 1º gesto do convidado). */
let audioPreparado = false;
function prepararAudio() {
  if (audioPreparado) return;
  audioPreparado = true;
  audio.preload = "auto";
  audio.src = CONFIG.musica;
}

function iniciarMusica() {
  if (!CONFIG.musica) return;
  audio.volume = CONFIG.volumeMusica;
  btnMusica.hidden = false;
  audio.addEventListener("error", () => { btnMusica.hidden = true; });   // arquivo ausente: esconde o botão

  const sincronizar = () => {
    const tocando = !audio.paused;
    btnMusica.classList.toggle("tocando", tocando);
    // Enquanto o navegador segura o som, o botão pulsa convidando ao toque
    btnMusica.classList.toggle("convida", !tocando && !escolhaManual);
    btnMusica.setAttribute("aria-pressed", String(tocando));
    btnMusica.setAttribute("aria-label", tocando ? "Pausar música" : "Tocar música");
    btnMusica.title = tocando ? "Desativar a música" : "Ativar a música";
  };
  audio.addEventListener("play", sincronizar);
  audio.addEventListener("pause", sincronizar);

  btnMusica.addEventListener("click", () => {
    escolhaManual = true;
    prepararAudio();
    if (audio.paused) audio.play().catch(() => mostrarAviso("Não foi possível tocar a música."));
    else audio.pause();
    sincronizar();
  });

  if (CONFIG.musicaAutoplay) {
    /* A música começa já na capa. Os navegadores só liberam som depois de um gesto do
       convidado, então: (1) tentamos tocar assim que a página abre — funciona quando o
       navegador permite — e (2) se for bloqueado, o PRIMEIRO gesto de qualquer tipo na
       capa (toque, clique, arrasto ou tecla) já dispara a música, antes mesmo de a
       página virar. Vários eventos são ouvidos porque cada navegador/aparelho considera
       um deles como "gesto válido" (ex.: no celular só vale ao soltar o dedo). */
    const eventos = ["pointerdown", "pointerup", "touchend", "click", "keydown"];
    const limpar = () => eventos.forEach(ev => document.removeEventListener(ev, tentar, true));
    const tocar = () => { prepararAudio(); return audio.play().then(limpar).catch(() => { /* aguarda o próximo gesto */ }); };
    function tentar(e) {
      if (escolhaManual || !audio.paused) return limpar();
      if (e.target.closest && e.target.closest("#btnMusica")) return;   // o botão cuida de si
      tocar();
    }
    eventos.forEach(ev => document.addEventListener(ev, tentar, true));   // captura: roda antes de qualquer outro tratamento
    depoisDoVideo(() => { if (!escolhaManual && audio.paused) tocar(); });  // tentativa sem gesto, sem atrapalhar o vídeo
  } else {
    depoisDoVideo(prepararAudio);
  }
  sincronizar();
}


/* ---------------------------------------------------------------------
   6. CONFIRMAÇÃO DE PRESENÇA (janela + agradecimento)
   --------------------------------------------------------------------- */
const modal        = document.getElementById("modalConfirmar");
const formConfirma = document.getElementById("formConfirmar");
const etapaObrigado = document.getElementById("modalObrigado");
const erroConfirma = modal.querySelector(".modal__erro");
const btnEnviar    = modal.querySelector(".modal__enviar");
const campoNome    = formConfirma.elements.nome;
const campoTel     = formConfirma.elements.telefone;

/** "61900001111" → "(61) 90000-1111" (aceita fixo de 10 dígitos e celular de 11). */
function formatarTelefone(valor) {
  const d = String(valor).replace(/\D/g, "").slice(0, 11);
  if (d.length > 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 6)  return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length > 2)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d ? `(${d}` : "";
}

/** "maria da silva" / "MARIA DA SILVA" → "Maria da Silva". Nomes já bem escritos ficam como estão. */
function arrumarNome(nome) {
  if (nome !== nome.toLocaleLowerCase("pt-BR") && nome !== nome.toLocaleUpperCase("pt-BR")) return nome;
  const particulas = new Set(["da", "de", "do", "das", "dos", "e"]);
  return nome.toLocaleLowerCase("pt-BR").split(" ").map((p, i) =>
    i > 0 && particulas.has(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)
  ).join(" ");
}

/** "MARIA da Silva" → "Maria" (primeiro nome, para o agradecimento). */
function primeiroNome(nome) {
  const p = nome.trim().split(/\s+/)[0] || "";
  return p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR");
}

/** "Sábado, 07 de novembro de 2026 · 16h00" */
function dataPorExtenso() {
  const d = interpretarData(CONFIG.data);
  if (!d.n) return "";
  return `${d.semana}, ${d.dia} de ${d.mes.toLowerCase()} de ${d.ano}` + (CONFIG.hora ? ` · ${CONFIG.hora}` : "");
}

function mostrarErroConfirma(html) {
  erroConfirma.innerHTML = html;                       // só montamos HTML fixo (o link do WhatsApp é gerado por nós)
  erroConfirma.hidden = !html;
}

/** Mensagem de erro amigável + saída pelo WhatsApp caso o banco não responda. */
function erroDeConexao() {
  const c = contatoDeConfirmacao();
  const zap = c ? ` Se preferir, <a href="${linkWhatsApp(c.whatsapp, CONFIG.mensagemConfirmacao)}" target="_blank" rel="noopener noreferrer">confirme pelo WhatsApp</a>.` : "";
  return "Não conseguimos registrar sua confirmação agora. Tente novamente em instantes." + zap;
}

function mostrarEtapa(obrigado) {
  formConfirma.hidden = obrigado;
  etapaObrigado.hidden = !obrigado;
  etapaObrigado.classList.toggle("ativo", obrigado);   // dispara as animações do agradecimento
}

function abrirConfirmacao() {
  if (typeof modal.showModal !== "function") {         // navegador muito antigo: cai no WhatsApp
    const c = contatoDeConfirmacao();
    if (c) window.open(linkWhatsApp(c.whatsapp, CONFIG.mensagemConfirmacao), "_blank", "noopener");
    return;
  }
  mostrarEtapa(false);
  mostrarErroConfirma("");
  modal.showModal();
}

modal.addEventListener("close", () => {                // limpa tudo para a próxima pessoa (ex.: família no mesmo celular)
  formConfirma.reset();
  mostrarEtapa(false);
  mostrarErroConfirma("");
  btnEnviar.disabled = false;
});
modal.addEventListener("click", e => {                 // clicar fora do cartão fecha
  if (e.target === modal || e.target.closest("[data-fechar]")) modal.close();
});
campoTel.addEventListener("input", () => { campoTel.value = formatarTelefone(campoTel.value); });

formConfirma.addEventListener("submit", async e => {
  e.preventDefault();
  const nome = arrumarNome(campoNome.value.trim().replace(/\s+/g, " "));
  const tel = campoTel.value.trim();
  const digitos = tel.replace(/\D/g, "");

  if (nome.length < 2) {
    mostrarErroConfirma("Por favor, digite seu nome.");
    return campoNome.focus();
  }
  if (tel && (digitos.length < 10 || digitos.length > 11)) {
    mostrarErroConfirma("Telefone incompleto. Use o DDD + número, ou deixe em branco.");
    return campoTel.focus();
  }

  mostrarErroConfirma("");
  btnEnviar.disabled = true;                           // evita confirmar duas vezes com toques repetidos
  btnEnviar.querySelector("span").textContent = "Enviando…";
  try {
    await Api.confirmar(nome, tel);
    modal.querySelector("[data-obrigado-nome]").textContent = primeiroNome(nome);
    modal.querySelector("[data-obrigado-data]").textContent = dataPorExtenso();
    mostrarEtapa(true);
  } catch (err) {
    console.error("Falha ao confirmar presença:", err);
    mostrarErroConfirma(err.codigo === "nome_invalido" ? "Por favor, digite seu nome." : erroDeConexao());
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.querySelector("span").textContent = "Confirmar";
  }
});


/* ---------------------------------------------------------------------
   7. CORAÇÕES FLUTUANTES E INICIALIZAÇÃO
   --------------------------------------------------------------------- */
function criarCoracoes(caixa, quantidade = 14) {
  const svg = '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
  for (let i = 0; i < quantidade; i++) {
    const c = document.createElement("span");
    c.className = "flutuante";
    c.innerHTML = svg;                                // conteúdo fixo, sem dados de terceiros
    c.style.setProperty("--x", `${Math.random() * 92 + 2}%`);
    c.style.setProperty("--s", `${10 + Math.random() * 16}px`);
    c.style.setProperty("--dx", `${(Math.random() - 0.5) * 80}px`);
    c.style.setProperty("--t", `${7 + Math.random() * 6}s`);
    c.style.setProperty("--a", `${Math.random() * 8}s`);
    caixa.appendChild(c);
  }
}

function iniciar() {
  // Atalho: index.html#pagina-3 abre direto na página 3 (útil para testar cada página)
  const m = location.hash.match(/pagina-(\d+)/);
  if (m) atual = Math.max(0, Math.min(TOTAL - 1, Number(m[1]) - 1));
  if (atual !== 0) vizinhasLiberadas = true;

  // 1º: o que aparece primeiro — quadro de reserva e vídeo da capa (só se a capa é a página aberta)
  prepararFotos();
  carregarFoto(atual);
  if (atual === 0) iniciarVideo();

  // 2º: o resto (leve, síncrono)
  preencherTextos();
  iniciarContagem();
  montarContatos();
  configurarLinks();
  prepararPaginas();
  criarCoracoes(document.querySelector(".pagina--final .flutuantes"));
  criarCoracoes(etapaObrigado.querySelector(".flutuantes"), 10);
  atualizarEstado();
  iniciarMusica();
  depoisDoVideo(liberarVizinhas);
}

iniciar();
