/* =====================================================================
   WORKER DA CLOUDFLARE — fotos e vídeos dos convidados (bucket R2)
   ---------------------------------------------------------------------
   Configuração (veja cloudflare/LEIA-ME.md):
     • Binding R2:  nome da variável = BUCKET  → bucket midias-casamento
     • Secret:      SENHA_PAINEL               → senha do painel dos noivos
   Rotas:
     POST   /upload/<chave>   convidado envia um arquivo (sem senha; só cria, nunca sobrescreve)
     GET    /m/<chave>        entrega o arquivo (público por link; chaves são aleatórias)
     GET    /lista            painel: lista as mídias   (header X-Senha)
     DELETE /midia/<chave>    painel: apaga a mídia      (header X-Senha)
   ===================================================================== */

const LIMITE_BYTES = 100 * 1024 * 1024;   // limite de corpo de requisição do plano gratuito da Cloudflare
const CHAVE_OK = /^[0-9a-f-]{20,40}(_t)?\.[a-z0-9]{1,5}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Senha, X-Convidado, X-Tipo",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
  "Access-Control-Max-Age": "86400"
};

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const erro = (codigo, status) => json({ message: codigo }, status);

/** Compara senhas sem vazar o tamanho/tempo. */
async function senhaOk(request, env) {
  const enviada = request.headers.get("X-Senha") || "";
  if (!env.SENHA_PAINEL || !enviada) return false;
  const hash = s => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(b => new Uint8Array(b));
  const [a, b] = await Promise.all([hash(enviada), hash(env.SENHA_PAINEL)]);
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

const ehMiniatura = chave => chave.includes("_t.");
const baseDe = chave => chave.replace(/(_t)?\.[a-z0-9]+$/, "");

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const caminho = url.pathname.split("/").filter(Boolean);
    const rota = caminho[0];
    const chave = decodeURIComponent(caminho[1] || "");

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    /* ---------- Convidado envia ---------- */
    if (rota === "upload" && request.method === "POST") {
      if (!CHAVE_OK.test(chave)) return erro("chave_invalida", 400);

      const tipoMime = request.headers.get("Content-Type") || "";
      if (!/^(image|video)\//.test(tipoMime)) return erro("tipo_invalido", 415);

      const tamanho = Number(request.headers.get("Content-Length") || 0);
      if (tamanho > LIMITE_BYTES) return erro("arquivo_grande", 413);

      if (await env.BUCKET.head(chave)) return erro("ja_existe", 409);   // nunca sobrescreve

      const convidado = decodeURIComponent(request.headers.get("X-Convidado") || "").trim().slice(0, 80);
      const tipo = request.headers.get("X-Tipo") === "video" || tipoMime.startsWith("video/") ? "video" : "foto";

      await env.BUCKET.put(chave, request.body, {
        httpMetadata: { contentType: tipoMime },
        customMetadata: { convidado, tipo }
      });
      return json({ ok: true }, 201);
    }

    /* ---------- Entrega o arquivo (com suporte a vídeo: Range) ---------- */
    if (rota === "m" && (request.method === "GET" || request.method === "HEAD")) {
      if (!CHAVE_OK.test(chave)) return erro("nao_encontrado", 404);
      const obj = await env.BUCKET.get(chave, { range: request.headers });
      if (!obj) return erro("nao_encontrado", 404);

      const h = new Headers(CORS);
      obj.writeHttpMetadata(h);
      h.set("ETag", obj.httpEtag);
      h.set("Accept-Ranges", "bytes");
      h.set("Cache-Control", "public, max-age=31536000, immutable");

      let status = 200;
      if (obj.range) {
        const r = obj.range;
        const inicio = r.suffix !== undefined ? obj.size - r.suffix : (r.offset || 0);
        const comp = r.suffix !== undefined ? r.suffix : (r.length !== undefined ? r.length : obj.size - inicio);
        h.set("Content-Range", `bytes ${inicio}-${inicio + comp - 1}/${obj.size}`);
        h.set("Content-Length", String(comp));
        status = 206;
      } else {
        h.set("Content-Length", String(obj.size));
      }
      return new Response(request.method === "HEAD" ? null : obj.body, { status, headers: h });
    }

    /* ---------- Painel: tudo daqui para baixo exige a senha ---------- */
    if (rota === "lista" || rota === "midia") {
      if (!(await senhaOk(request, env))) return erro("senha_invalida", 401);

      if (rota === "lista" && request.method === "GET") {
        const objetos = [];
        let cursor;
        do {
          const pagina = await env.BUCKET.list({ cursor, limit: 1000, include: ["customMetadata"] });
          objetos.push(...pagina.objects);
          cursor = pagina.truncated ? pagina.cursor : undefined;
        } while (cursor);

        const chaves = new Set(objetos.map(o => o.key));
        const lista = objetos
          .filter(o => !ehMiniatura(o.key))
          .map(o => {
            const mini = `${baseDe(o.key)}_t.jpg`;
            const meta = o.customMetadata || {};
            return {
              id: o.key,
              caminho: o.key,
              miniatura: chaves.has(mini) ? mini : null,
              tipo: meta.tipo === "video" ? "video" : "foto",
              convidado: meta.convidado || null,
              tamanho: o.size,
              criado_em: o.uploaded.toISOString()
            };
          })
          .sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
        return json(lista);
      }

      if (rota === "midia" && request.method === "DELETE") {
        if (!CHAVE_OK.test(chave) || ehMiniatura(chave)) return erro("chave_invalida", 400);
        await env.BUCKET.delete([chave, `${baseDe(chave)}_t.jpg`]);
        return json({ ok: true });
      }
    }

    return erro("nao_encontrado", 404);
  }
};
