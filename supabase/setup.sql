-- =====================================================================
-- CONVITE THALYTA & PAULO — banco das confirmações de presença
--
-- COMO USAR (uma única vez):
--   Supabase → menu "SQL Editor" → "New query" → cole TUDO isto → "Run".
--   Pode rodar de novo sem medo: o script é idempotente (não apaga dados).
--
-- COMO FUNCIONA A SEGURANÇA:
--   • As tabelas ficam TRAVADAS (RLS ligado e nenhum acesso direto para o público).
--   • O site só consegue chamar 3 funções:
--       confirmar_presenca(nome, telefone)   → qualquer convidado (só grava)
--       listar_confirmados(senha)            → só com a senha do painel
--       excluir_confirmado(id, senha)        → só com a senha do painel
--   • A senha é conferida AQUI no banco (guardada com hash), nunca no navegador.
--
-- SENHA INICIAL DO PAINEL: 123
--   Para trocar depois, rode:
--     update public.painel_config
--        set valor = extensions.crypt('NOVA_SENHA', extensions.gen_salt('bf'))
--      where chave = 'senha_hash';
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tabelas ----------
create table if not exists public.confirmados (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(btrim(nome)) between 2 and 120),
  telefone   text          check (telefone is null or char_length(telefone) <= 30),
  criado_em  timestamptz not null default now()
);

create table if not exists public.painel_config (
  chave  text primary key,
  valor  text not null
);

-- Trava total: sem policies, ninguém lê/escreve direto pela API pública
alter table public.confirmados   enable row level security;
alter table public.painel_config enable row level security;
revoke all on public.confirmados   from anon, authenticated;
revoke all on public.painel_config from anon, authenticated;

-- Senha inicial (só é criada se ainda não existir)
insert into public.painel_config (chave, valor)
values ('senha_hash', extensions.crypt('123', extensions.gen_salt('bf')))
on conflict (chave) do nothing;

-- ---------- Conferência da senha (uso interno; não é chamável pelo site) ----------
create or replace function public.senha_painel_ok(p_senha text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
      from public.painel_config
     where chave = 'senha_hash'
       and valor = crypt(coalesce(p_senha, ''), valor)
  );
$$;

revoke all on function public.senha_painel_ok(text) from public, anon, authenticated;

-- ---------- 1) Convidado confirma presença ----------
create or replace function public.confirmar_presenca(p_nome text, p_telefone text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_nome is null or char_length(btrim(p_nome)) < 2 then
    raise exception 'nome_invalido';
  end if;

  insert into public.confirmados (nome, telefone)
  values (
    left(btrim(p_nome), 120),
    nullif(left(btrim(coalesce(p_telefone, '')), 30), '')
  );
end;
$$;

-- ---------- 2) Painel dos noivos: lista (mais recentes primeiro) ----------
create or replace function public.listar_confirmados(p_senha text)
returns table (id uuid, nome text, telefone text, criado_em timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.senha_painel_ok(p_senha) then
    raise exception 'senha_invalida';
  end if;

  return query
    select c.id, c.nome, c.telefone, c.criado_em
      from public.confirmados c
     order by c.criado_em desc;
end;
$$;

-- ---------- 3) Painel dos noivos: excluir uma confirmação ----------
create or replace function public.excluir_confirmado(p_id uuid, p_senha text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.senha_painel_ok(p_senha) then
    raise exception 'senha_invalida';
  end if;

  delete from public.confirmados where id = p_id;
end;
$$;

-- ---------- Permissões: o site (anon) só pode chamar estas 3 funções ----------
revoke all on function public.confirmar_presenca(text, text)   from public;
revoke all on function public.listar_confirmados(text)         from public;
revoke all on function public.excluir_confirmado(uuid, text)   from public;

grant execute on function public.confirmar_presenca(text, text)  to anon, authenticated;
grant execute on function public.listar_confirmados(text)        to anon, authenticated;
grant execute on function public.excluir_confirmado(uuid, text)  to anon, authenticated;
