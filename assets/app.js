/* ===========================================================================
   Núcleo compartido — Concurso de Murales · Casa Abierta 2026 · UTEQ
   Requiere: supabase-js v2 (CDN) y assets/config.js
   =========================================================================== */

(function () {
  "use strict";

  const C = window.CONFIG;

  /* ---------------------------------------------------------------------
     Cliente Supabase
     --------------------------------------------------------------------- */
  const configurado =
    C.SUPABASE_URL &&
    !C.SUPABASE_URL.includes("TU-PROYECTO") &&
    C.SUPABASE_ANON_KEY &&
    !C.SUPABASE_ANON_KEY.includes("PEGA_AQUI");

  const db = configurado
    ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY)
    : null;

  /* ---------------------------------------------------------------------
     Utilidades
     --------------------------------------------------------------------- */
  const $  = (s, ctx) => (ctx || document).querySelector(s);
  const $$ = (s, ctx) => Array.from((ctx || document).querySelectorAll(s));

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function palabras(t) {
    return String(t || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function aviso(contenedor, tipo, texto) {
    const caja = typeof contenedor === "string" ? $(contenedor) : contenedor;
    if (!caja) return;
    caja.innerHTML = `<div class="aviso ${tipo}">${texto}</div>`;
    caja.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function limpiarAviso(contenedor) {
    const caja = typeof contenedor === "string" ? $(contenedor) : contenedor;
    if (caja) caja.innerHTML = "";
  }

  /* En la base de datos se guarda la RUTA dentro del bucket, no una URL.
     Esto evita que alguien registre una imagen alojada fuera de la institución. */
  function urlBoceto(ruta) {
    if (!ruta) return "";
    if (/^https?:\/\//i.test(ruta)) return ruta;   // compatibilidad con datos antiguos
    if (!db) return ruta;
    return db.storage.from("bocetos").getPublicUrl(ruta).data.publicUrl;
  }

  function colorODS(id) {
    const o = (window.ODS_LISTA || []).find((x) => x.id === id);
    return o ? o.color : "#005719";
  }

  /* ---------------------------------------------------------------------
     Sesión
     --------------------------------------------------------------------- */
  let sesion = null;

  async function cargarSesion() {
    if (!db) return null;
    const { data } = await db.auth.getSession();
    sesion = data.session;
    return sesion;
  }

  function usuario() {
    return sesion ? sesion.user : null;
  }

  function correo() {
    const u = usuario();
    return u ? String(u.email || "").toLowerCase() : null;
  }

  function esInstitucional() {
    const e = correo();
    return !!e && e.endsWith("@" + C.DOMINIO);
  }

  async function salir() {
    if (db) await db.auth.signOut();
    location.reload();
  }

  async function esAdmin() {
    if (!db || !usuario()) return false;
    const { data } = await db.rpc("es_admin");
    return data === true;
  }

  /* ---------------------------------------------------------------------
     Modal de acceso
     --------------------------------------------------------------------- */
  function montarModal() {
    if ($("#velo-acceso")) return;
    const metodo = C.METODO_LOGIN || "ambos";
    const html = `
      <div class="velo" id="velo-acceso" role="dialog" aria-modal="true" aria-label="Acceso institucional">
        <div class="modal">
          <button class="cerrar" type="button" data-cerrar-acceso aria-label="Cerrar">&times;</button>
          <h3>Acceso institucional</h3>
          <p>Ingresa con tu correo <strong>@${esc(C.DOMINIO)}</strong>. Cada persona
             puede emitir <strong>un solo voto</strong>, vinculado a su correo.</p>
          <div id="acceso-aviso"></div>

          ${metodo !== "magic" ? `
          <button class="btn btn-verde btn-bloque" type="button" id="btn-google">
            Continuar con mi cuenta institucional
          </button>` : ""}

          ${metodo === "ambos" ? `<div class="separador"><span>o recibe un enlace por correo</span></div>` : ""}

          ${metodo !== "google" ? `
          <form id="form-magic">
            <div class="campo">
              <label for="magic-correo">Correo institucional</label>
              <input type="email" id="magic-correo" required
                     placeholder="nombre.apellido@${esc(C.DOMINIO)}" autocomplete="email">
            </div>
            <button class="btn btn-primario btn-bloque" type="submit">Enviarme el enlace</button>
          </form>` : ""}
        </div>
      </div>`;
    document.body.insertAdjacentHTML("beforeend", html);

    const velo = $("#velo-acceso");
    velo.addEventListener("click", (e) => {
      if (e.target === velo || e.target.hasAttribute("data-cerrar-acceso")) cerrarAcceso();
    });

    const bg = $("#btn-google");
    if (bg) bg.addEventListener("click", entrarGoogle);

    const fm = $("#form-magic");
    if (fm) fm.addEventListener("submit", entrarMagic);
  }

  function abrirAcceso() {
    if (!db) {
      alert("El sitio aún no está conectado a Supabase. Edita assets/config.js con la URL y la anon key del proyecto.");
      return;
    }
    montarModal();
    $("#velo-acceso").classList.add("abierto");
  }

  function cerrarAcceso() {
    const v = $("#velo-acceso");
    if (v) v.classList.remove("abierto");
  }

  async function entrarGoogle() {
    limpiarAviso("#acceso-aviso");
    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: location.href.split("#")[0],
        queryParams: { hd: C.DOMINIO, prompt: "select_account" }
      }
    });
    if (error) aviso("#acceso-aviso", "error", esc(error.message));
  }

  async function entrarMagic(e) {
    e.preventDefault();
    limpiarAviso("#acceso-aviso");
    const email = $("#magic-correo").value.trim().toLowerCase();
    if (!email.endsWith("@" + C.DOMINIO)) {
      aviso("#acceso-aviso", "error",
        `Debes usar un correo institucional que termine en <strong>@${esc(C.DOMINIO)}</strong>.`);
      return;
    }
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Enviando…";
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.href.split("#")[0] }
    });
    btn.disabled = false; btn.textContent = "Enviarme el enlace";
    if (error) {
      aviso("#acceso-aviso", "error", esc(error.message));
    } else {
      aviso("#acceso-aviso", "exito",
        `Listo. Revisa <strong>${esc(email)}</strong> y abre el enlace para continuar. Puede tardar un minuto.`);
    }
  }

  /* ---------------------------------------------------------------------
     Encabezado
     --------------------------------------------------------------------- */
  function pintarBarra(activa) {
    const cont = $("#barra");
    if (!cont) return;
    cont.innerHTML = `
      <div class="contenedor">
        <a class="marca" href="index.html">
          <span class="sello">UTEQ</span>
          <span><b>${esc(C.TITULO)}</b><span>Casa Abierta 2026 · FCI</span></span>
        </a>
        <nav class="menu">
          <a href="index.html"      class="${activa === "inicio" ? "activo" : ""}">Inicio</a>
          <a href="inscripcion.html"class="${activa === "inscripcion" ? "activo" : ""}">Inscripción</a>
          <a href="galeria.html"    class="${activa === "galeria" ? "activo" : ""}">Galería y votación</a>
          <span class="sesion" id="zona-sesion"></span>
        </nav>
      </div>`;
    pintarSesion();
  }

  function pintarSesion() {
    const z = $("#zona-sesion");
    if (!z) return;
    if (usuario()) {
      z.innerHTML = `<span class="correo" title="${esc(correo())}">${esc(correo())}</span>
                     <button class="btn btn-claro btn-chico" type="button" id="btn-salir">Salir</button>`;
      $("#btn-salir").addEventListener("click", salir);
    } else {
      z.innerHTML = `<button class="btn btn-claro btn-chico" type="button" id="btn-entrar">Ingresar</button>`;
      $("#btn-entrar").addEventListener("click", abrirAcceso);
    }
  }

  function pintarPie() {
    const p = $("#pie");
    if (!p) return;
    p.innerHTML = `
      <div class="contenedor">
        <div>
          <strong>Comité Organizador · Casa Abierta 2026</strong><br>
          Facultad de Ciencias de la Ingeniería · Universidad Técnica Estatal de Quevedo
        </div>
        <div>
          Consultas: <a href="mailto:${esc(C.CONTACTO)}">${esc(C.CONTACTO)}</a><br>
          <a href="${esc(C.URL_BASES)}" target="_blank" rel="noopener">Bases del concurso (PDF)</a>
        </div>
      </div>`;
  }

  /* ---------------------------------------------------------------------
     Configuración del concurso
     --------------------------------------------------------------------- */
  async function leerConfig() {
    if (!db) return { inscripcion_abierta: true, votacion_abierta: false, mostrar_resultados: false };
    const { data } = await db.from("config").select("*").eq("id", 1).single();
    return data || {};
  }

  /* ---------------------------------------------------------------------
     Visor de imagen
     --------------------------------------------------------------------- */
  function montarVisor() {
    if ($("#visor")) return;
    document.body.insertAdjacentHTML("beforeend",
      `<div class="visor" id="visor"><button class="cerrar" type="button" aria-label="Cerrar">&times;</button><img alt="Boceto ampliado"></div>`);
    const v = $("#visor");
    v.addEventListener("click", () => v.classList.remove("abierto"));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") v.classList.remove("abierto"); });
  }

  function ampliar(url) {
    montarVisor();
    const v = $("#visor");
    $("img", v).src = url;
    v.classList.add("abierto");
  }

  /* ---------------------------------------------------------------------
     Exportación
     --------------------------------------------------------------------- */
  window.App = {
    db, configurado, C,
    $, $$, esc, palabras, aviso, limpiarAviso, colorODS, urlBoceto,
    cargarSesion, usuario, correo, esInstitucional, esAdmin, salir,
    abrirAcceso, cerrarAcceso,
    pintarBarra, pintarSesion, pintarPie,
    leerConfig, ampliar
  };
})();
