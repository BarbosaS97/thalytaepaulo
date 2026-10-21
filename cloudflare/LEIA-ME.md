# Mídias dos convidados — Cloudflare (R2 + Worker)

1. **Bucket**: Storage & databases → R2 object storage → Create bucket → nome `midias-casamento`
   (deixe "Automatic" na localização; NÃO precisa ativar acesso público).
2. **Worker**: Compute → Workers & Pages → Create → Create Worker → nome `midias-casamento` → Deploy →
   "Edit code" → apague o exemplo, cole o conteúdo de `cloudflare/worker.js` → Deploy.
3. **Ligar o bucket**: no Worker → Settings → Bindings → Add → R2 bucket →
   Variable name `BUCKET` → bucket `midias-casamento` → Deploy.
4. **Senha**: Settings → Variables and Secrets → Add → tipo **Secret** → nome `SENHA_PAINEL` → valor = senha do painel → Deploy.
5. Copie o endereço do Worker (algo como `https://midias-casamento.SEU-USUARIO.workers.dev`)
   e cole em `MIDIAS.api` no arquivo `js/api.js`.
