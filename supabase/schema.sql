-- ============================================================================
--  CONCURSO DE MURALES · CASA ABIERTA 2026
--  Facultad de Ciencias de la Ingeniería · Universidad Técnica Estatal de Quevedo
--
--  Esquema completo para Supabase (PostgreSQL).
--  Copia TODO este archivo y pégalo en:  Supabase -> SQL Editor -> New query -> Run
--
--  ANTES DE EJECUTAR: cambia el correo de la sección 2 (ADMINISTRADORES).
--  El valor por defecto es inválido a propósito, para que no pase inadvertido.
-- ============================================================================

create extension if not exists "pgcrypto";


-- ----------------------------------------------------------------------------
-- 1. CONFIGURACIÓN GLOBAL DEL CONCURSO (una sola fila)
-- ----------------------------------------------------------------------------
create table if not exists public.config (
  id                   int primary key default 1,
  inscripcion_abierta  boolean not null default true,
  votacion_abierta     boolean not null default false,
  mostrar_resultados   boolean not null default false,
  mensaje_portada      text,
  constraint config_fila_unica check (id = 1)
);

insert into public.config (id, mensaje_portada)
values (1, 'Inscripciones abiertas hasta el 23 de agosto de 2026.')
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- 2. ADMINISTRADORES (Comité Organizador)
--    >>> REEMPLAZA ESTOS CORREOS POR LOS REALES DEL COMITÉ <<<
-- ----------------------------------------------------------------------------
create table if not exists public.admins (
  email  text primary key,
  nombre text,
  -- Solo cuentas institucionales pueden administrar el concurso
  constraint admin_institucional check (email like '%@uteq.edu.ec'),
  constraint admin_minusculas    check (email = lower(email))
);

insert into public.admins (email, nombre) values
  ('cambia.este.correo@uteq.edu.ec', 'PENDIENTE DE CONFIGURAR')
on conflict (email) do nothing;


-- Funciones auxiliares de autorización
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.es_uteq() returns boolean
language sql stable set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@uteq.edu.ec';
$$;


-- ----------------------------------------------------------------------------
-- 3. EQUIPOS / PROPUESTAS
-- ----------------------------------------------------------------------------
create table if not exists public.equipos (
  id              uuid primary key default gen_random_uuid(),
  folio           serial,

  -- Identificación de la propuesta
  nombre_equipo   text not null,
  nombre_mural    text not null,
  carreras        text not null,
  ods             text[] not null default '{}',
  descripcion     text not null,          -- 150 a 200 palabras
  -- RUTA dentro del bucket 'bocetos' (NO una URL). Formato: <uuid-usuario>/<epoch>.<ext>
  boceto_url      text not null,

  -- Representante del equipo
  rep_nombre      text not null,
  rep_email       text not null,
  rep_telefono    text,
  rep_carrera     text,
  rep_semestre    text,

  -- Integrantes: [{ "nombre": "...", "cedula": "...", "carrera": "...", "semestre": "..." }]
  integrantes     jsonb not null default '[]'::jsonb,

  -- Declaraciones obligatorias (bases, art. 10 y 11)
  declara_autoria     boolean not null default false,
  autoriza_difusion   boolean not null default false,
  acepta_bases        boolean not null default false,

  -- Control del comité
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente','aprobado','rechazado')),
  observaciones   text,

  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),

  -- Reglas de las bases
  constraint equipo_min_3_integrantes check (jsonb_array_length(integrantes) >= 3),
  constraint equipo_max_6_integrantes check (jsonb_array_length(integrantes) <= 6),
  constraint descripcion_longitud check (
    array_length(regexp_split_to_array(btrim(descripcion), '[[:space:]]+'), 1) between 150 and 200
  ),
  constraint declaraciones_obligatorias check (
    declara_autoria and autoriza_difusion and acepta_bases
  ),
  constraint rep_email_institucional check (lower(rep_email) like '%@uteq.edu.ec'),

  -- El boceto debe vivir en la carpeta del propio autor dentro del bucket.
  -- Impide que se registre una URL externa que luego se renderice en la galería.
  constraint boceto_ruta_valida check (
    boceto_url ~ ('^' || coalesce(created_by::text, '[0-9a-f-]+') || '/[0-9]+\.(jpg|jpeg|png|webp)$')
  )
);

create index if not exists equipos_estado_idx on public.equipos (estado);


-- ----------------------------------------------------------------------------
-- 4. VOTOS  —  UN SOLO VOTO POR CORREO @uteq.edu.ec
-- ----------------------------------------------------------------------------
create table if not exists public.votos (
  id            uuid primary key default gen_random_uuid(),
  equipo_id     uuid not null references public.equipos(id) on delete cascade,
  votante_id    uuid not null references auth.users(id) on delete cascade,
  votante_email text not null,
  created_at    timestamptz not null default now(),

  -- Estas dos restricciones son la garantía real de "un voto por persona"
  constraint un_voto_por_usuario unique (votante_id),
  constraint un_voto_por_correo  unique (votante_email),
  constraint votante_institucional check (lower(votante_email) like '%@uteq.edu.ec')
);

create index if not exists votos_equipo_idx on public.votos (equipo_id);


-- Trigger: valida en el servidor que la votación esté abierta, que el equipo
-- esté aprobado y que el correo del voto sea el del usuario realmente logueado.
create or replace function public.validar_voto() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_abierta boolean;
  v_estado  text;
  v_email   text;
begin
  select votacion_abierta into v_abierta from public.config where id = 1;
  if not coalesce(v_abierta, false) then
    raise exception 'La votación no está habilitada en este momento.';
  end if;

  select estado into v_estado from public.equipos where id = new.equipo_id;
  if v_estado is distinct from 'aprobado' then
    raise exception 'Solo se puede votar por propuestas aprobadas por el Comité.';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email not like '%@uteq.edu.ec' then
    raise exception 'Solo se permite votar con un correo institucional @uteq.edu.ec.';
  end if;

  new.votante_id    := auth.uid();
  new.votante_email := v_email;
  new.created_at    := now();
  return new;
end;
$$;

drop trigger if exists trg_validar_voto on public.votos;
create trigger trg_validar_voto
  before insert on public.votos
  for each row execute function public.validar_voto();


-- ----------------------------------------------------------------------------
-- 5. VISTAS PÚBLICAS
--    La tabla `equipos` NO es legible por el público: contiene cédulas,
--    teléfonos y correos. Solo se expone esta vista con los campos que las
--    bases (art. 12) autorizan a publicar.
-- ----------------------------------------------------------------------------
create or replace view public.equipos_publicos as
select id, folio, nombre_equipo, nombre_mural, carreras, ods, descripcion, boceto_url
from public.equipos
where estado = 'aprobado';

grant select on public.equipos_publicos to anon, authenticated;


-- Conteo público: solo se revela si el Comité activa `mostrar_resultados`.
create or replace view public.resultados as
select
  e.id,
  e.nombre_equipo,
  e.nombre_mural,
  case when (select mostrar_resultados from public.config where id = 1)
       then count(v.id)
       else null
  end as votos
from public.equipos e
left join public.votos v on v.equipo_id = e.id
where e.estado = 'aprobado'
group by e.id, e.nombre_equipo, e.nombre_mural;

grant select on public.resultados to anon, authenticated;


-- Conteo real, solo para el Comité
create or replace function public.resultados_admin()
returns table (id uuid, nombre_equipo text, nombre_mural text, votos bigint)
language sql stable security definer set search_path = public as $$
  select e.id, e.nombre_equipo, e.nombre_mural, count(v.id) as votos
  from public.equipos e
  left join public.votos v on v.equipo_id = e.id
  where public.es_admin()
  group by e.id, e.nombre_equipo, e.nombre_mural
  order by count(v.id) desc;
$$;


-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.config  enable row level security;
alter table public.admins  enable row level security;
alter table public.equipos enable row level security;
alter table public.votos   enable row level security;

-- config: todos leen (para saber si la votación está abierta), solo admin escribe
drop policy if exists config_lectura on public.config;
create policy config_lectura on public.config
  for select using (true);

drop policy if exists config_admin on public.config;
create policy config_admin on public.config
  for update using (public.es_admin()) with check (public.es_admin());

-- admins: solo un admin ve la lista
drop policy if exists admins_lectura on public.admins;
create policy admins_lectura on public.admins
  for select using (public.es_admin());

-- equipos: la tabla completa la ven solo el Comité y el propio representante.
-- El público consulta la vista `equipos_publicos`.
drop policy if exists equipos_lectura_publica on public.equipos;
drop policy if exists equipos_lectura on public.equipos;
create policy equipos_lectura on public.equipos
  for select using (public.es_admin() or created_by = auth.uid());

-- equipos: se inscribe con el propio correo institucional y siempre como 'pendiente'
drop policy if exists equipos_inscripcion on public.equipos;
create policy equipos_inscripcion on public.equipos
  for insert to authenticated
  with check (
    public.es_uteq()
    and estado = 'pendiente'
    and created_by = auth.uid()
    and lower(rep_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and (select inscripcion_abierta from public.config where id = 1)
  );

-- El Comité valida propuestas, pero no la suya propia (excusación automática)
drop policy if exists equipos_admin_update on public.equipos;
create policy equipos_admin_update on public.equipos
  for update
  using      (public.es_admin() and created_by is distinct from auth.uid())
  with check (public.es_admin() and created_by is distinct from auth.uid());

drop policy if exists equipos_admin_delete on public.equipos;
create policy equipos_admin_delete on public.equipos
  for delete using (public.es_admin());

-- votos: cada quien ve solo el suyo (o el Comité, todos)
drop policy if exists votos_lectura on public.votos;
create policy votos_lectura on public.votos
  for select using (votante_id = auth.uid() or public.es_admin());

drop policy if exists votos_insercion on public.votos;
create policy votos_insercion on public.votos
  for insert to authenticated
  with check (public.es_uteq() and votante_id = auth.uid());

-- El voto es definitivo: no existe política de UPDATE, así que nadie puede cambiarlo.
drop policy if exists votos_admin_delete on public.votos;
create policy votos_admin_delete on public.votos
  for delete using (public.es_admin());


-- ----------------------------------------------------------------------------
-- 7. ALMACENAMIENTO DE BOCETOS
--    Bucket público en lectura, con límite de peso y de tipo aplicados en el
--    servidor (no solo en el navegador), y cada quien solo escribe en su carpeta.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bocetos', 'bocetos', true, 8388608,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bocetos_lectura on storage.objects;
create policy bocetos_lectura on storage.objects
  for select using (bucket_id = 'bocetos');

drop policy if exists bocetos_subida on storage.objects;
create policy bocetos_subida on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bocetos'
    and public.es_uteq()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Permite limpiar un boceto huérfano si la inscripción falla a medio camino
drop policy if exists bocetos_borrado_propio on storage.objects;
create policy bocetos_borrado_propio on storage.objects
  for delete to authenticated
  using (bucket_id = 'bocetos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists bocetos_admin on storage.objects;
create policy bocetos_admin on storage.objects
  for delete using (bucket_id = 'bocetos' and public.es_admin());


-- ============================================================================
--  FIN DEL ESQUEMA
-- ============================================================================
