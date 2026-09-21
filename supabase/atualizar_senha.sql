-- =====================================================================
-- TROCAR A SENHA DO PAINEL DOS NOIVOS  →  07082026
--
-- COMO USAR: Supabase → SQL Editor → New query → cole isto → Run.
-- Serve para quem JÁ rodou o setup.sql antes (a senha antiga era 123).
-- Não mexe em nenhuma confirmação; só troca a senha (guardada com hash).
--
-- Para usar outra senha no futuro, troque o texto '07082026' abaixo e rode de novo.
-- =====================================================================

insert into public.painel_config (chave, valor)
values ('senha_hash', extensions.crypt('07082026', extensions.gen_salt('bf')))
on conflict (chave) do update set valor = excluded.valor;
