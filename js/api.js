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

/** Erro com um código curto: "senha_invalida", "nome_invalido", "nao_configurado", "rede" ou "http_NNN". */
class ErroApi extends Error {
  constructor(codigo) { super(codigo); this.codigo = codigo; }
}

const Api = (() => {
  /** Chama uma função do banco (RPC) e devolve o JSON da resposta. */
  async function rpc(nome, args) {
    if (!SUPABASE.url || !SUPABASE.anonKey) throw new ErroApi("nao_configurado");

    let resp;
    try {
      resp = await fetch(`${SUPABASE.url.replace(/\/+$/, "")}/rest/v1/rpc/${nome}`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE.anonKey,
          "Authorization": `Bearer ${SUPABASE.anonKey}`,
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
    excluir: (id, senha) => rpc("excluir_confirmado", { p_id: id, p_senha: senha })
  };
})();
