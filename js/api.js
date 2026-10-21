/* =====================================================================
   ACESSO AO BANCO (Supabase) — usado pelo convite e pelo painel dos noivos
   ---------------------------------------------------------------------
   A chave "anon" é PÚBLICA por projeto (pode ficar no site). Quem protege
   os dados são as funções do banco (veja supabase/setup.sql): a tabela não
   é acessível diretamente, e listar/excluir exigem a senha do painel.
   ===================================================================== */

"use strict";

const SUPABASE = {
  url: "https://vlwvprrmgciymuhbzupv.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsd3ZwcnJtZ2NpeW11aGJ6dXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5OTc0OTMsImV4cCI6MjEwNTU3MzQ5M30.1qgbRYwGJRoZHkXjA-81Wo7iI5SCr1r8wD11iXEHdI8"
};

/** Fotos/vídeos dos convidados: Worker da Cloudflare + bucket R2 (veja cloudflare/LEIA-ME.md). Cole aqui o endereço do Worker. */
const MIDIAS = { api: "https://midias-casamento.explicandoexatas.workers.dev", limiteMB: 100 };

/** Erro com um código curto: "senha_invalida", "nome_invalido", "nao_configurado", "rede" ou "http_NNN". */
class ErroApi extends Error {
  constructor(codigo) { super(codigo); this.codigo = codigo; }
}

const Api = (() => {
  /** Chama uma função do banco (RPC) e devolve o JSON da resposta. */
  async function rpc(nome, args, bd = SUPABASE) {
    if (!bd.url || !bd.anonKey) throw new ErroApi("nao_configurado");

    let resp;
    try {
      resp = await fetch(`${bd.url.replace(/\/+$/, "")}/rest/v1/rpc/${nome}`, {
        method: "POST",
        headers: {
          "apikey": bd.anonKey,
          "Authorization": `Bearer ${bd.anonKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(args)
      });
    } catch (_) {
      throw new ErroApi("rede");
    }

    const texto = await resp.text();
    let dados = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch (_) { /* resposta vazia ou não-JSON */ }

    if (!resp.ok) throw new ErroApi((dados && dados.message) || `http_${resp.status}`);
    return dados;
  }

  return {
    /** Convidado confirma presença. Telefone é opcional. */
    confirmar: (nome, telefone) => rpc("confirmar_presenca", { p_nome: nome, p_telefone: telefone || null }),
    /** Painel: lista de confirmados (mais recentes primeiro). */
    listar: senha => rpc("listar_confirmados", { p_senha: senha }),
    /** Painel: remove uma confirmação. */
    excluir: (id, senha) => rpc("excluir_confirmado", { p_id: id, p_senha: senha }),
    /** Batimento: mantém o banco gratuito ativo (grava e apaga um registro de controle; no máx. 1x a cada 12 h). */
    manterAtivo: () => rpc("manter_ativo", {}),

    /* ---------- Mídias dos convidados (Worker da Cloudflare) ---------- */
    /** Painel: lista de mídias (mais recentes primeiro). */
    listarMidias: senha => chamarMidias("/lista", { headers: { "X-Senha": senha } }),
    /** Painel: apaga a mídia (e a miniatura). */
    excluirMidia: (midia, senha) => chamarMidias(`/midia/${encodeURIComponent(midia.caminho)}`, { method: "DELETE", headers: { "X-Senha": senha } }),
    /** Endereço público de um arquivo. */
    urlMidia: caminho => `${baseMidias()}/m/${encodeURIComponent(caminho)}`,
    /** Convidado: envia um arquivo, com progresso (0–1). meta = { convidado, tipo }. */
    enviarArquivo
  };

  function baseMidias() { return MIDIAS.api.replace(/\/+$/, ""); }

  async function chamarMidias(caminho, opcoes) {
    if (!MIDIAS.api) throw new ErroApi("nao_configurado");
    let resp;
    try { resp = await fetch(baseMidias() + caminho, opcoes); } catch (_) { throw new ErroApi("rede"); }
    const texto = await resp.text();
    let dados = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch (_) { /* resposta vazia */ }
    if (!resp.ok) throw new ErroApi((dados && dados.message) || `http_${resp.status}`);
    return dados;
  }

  /** fetch não informa o progresso do envio; por isso XMLHttpRequest. */
  function enviarArquivo(caminho, arquivo, aoProgredir, meta = {}) {
    return new Promise((resolve, reject) => {
      if (!MIDIAS.api) return reject(new ErroApi("nao_configurado"));
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${baseMidias()}/upload/${encodeURIComponent(caminho)}`);
      xhr.setRequestHeader("Content-Type", arquivo.type || "application/octet-stream");
      if (meta.convidado) xhr.setRequestHeader("X-Convidado", encodeURIComponent(meta.convidado));
      if (meta.tipo) xhr.setRequestHeader("X-Tipo", meta.tipo);
      if (aoProgredir) xhr.upload.onprogress = e => { if (e.lengthComputable) aoProgredir(e.loaded / e.total); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new ErroApi(xhr.status === 413 ? "arquivo_grande" : xhr.status === 401 ? "senha_invalida" : `http_${xhr.status}`));
      xhr.onerror = xhr.ontimeout = () => reject(new ErroApi("rede"));
      xhr.send(arquivo);
    });
  }
})();
