/* ===========================================================================
   CONFIGURACIÓN — Concurso de Murales · Casa Abierta 2026 · UTEQ

   >>> ESTE ES EL ÚNICO ARCHIVO QUE DEBES EDITAR PARA PONER EL SITIO EN LÍNEA <<<

   1. Crea un proyecto gratuito en https://supabase.com
   2. Ve a  Project Settings -> API  y copia los dos valores de abajo.
   3. La "anon key" es pública por diseño: no es una contraseña. La seguridad
      real la aplican las políticas RLS del archivo supabase/schema.sql.
   =========================================================================== */

window.CONFIG = {

    SUPABASE_URL:      "https://fojqmmddcggrakglvhzn.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvanFtbWRkY2dncmFrZ2x2aHpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwOTQ0MTYsImV4cCI6MjEwMjY3MDQxNn0.Y9QmDx7Rw-G_nyxj39O5l7bW2ufXU3euGa6WF70aoDM",

  // Dominio institucional habilitado para inscribirse y votar
  DOMINIO: "uteq.edu.ec",

  // Método de ingreso: "google" (recomendado, instantáneo)  |  "magic"  |  "ambos"
    METODO_LOGIN: "google",

  // Textos del encabezado
  TITULO:    "Concurso de Murales",
  SUBTITULO: "Casa Abierta 2026 · Facultad de Ciencias de la Ingeniería",
  LEMA:      "Las ingenierías y la arquitectura como impulsores de los Objetivos de Desarrollo Sostenible",

  // Fechas oficiales (bases, art. 27)
  FECHAS: {
    cierre_inscripcion: "23 de agosto de 2026",
    publicacion_bocetos: "24 de agosto de 2026",
    votacion: "24 al 26 de agosto de 2026",
    finalistas: "27 de agosto de 2026"
  },

  // Enlace al PDF de las bases (súbelo al repositorio o a Drive)
  URL_BASES: "bases-concurso-murales.pdf",

  // Correo de contacto del Comité Organizador
  CONTACTO: "casaabierta.fci@uteq.edu.ec"
};

/* Catálogo de ODS orientadores (bases, art. 5) */
window.ODS_LISTA = [
  { id: "ODS 4",  nombre: "Educación de Calidad",                 color: "#C5192D" },
  { id: "ODS 6",  nombre: "Agua Limpia y Saneamiento",            color: "#26BDE2" },
  { id: "ODS 7",  nombre: "Energía Asequible y No Contaminante",  color: "#FCC30B" },
  { id: "ODS 9",  nombre: "Industria, Innovación e Infraestructura", color: "#FD6925" },
  { id: "ODS 11", nombre: "Ciudades y Comunidades Sostenibles",   color: "#FD9D24" },
  { id: "ODS 12", nombre: "Producción y Consumo Responsables",    color: "#BF8B2E" },
  { id: "ODS 13", nombre: "Acción por el Clima",                  color: "#3F7E44" },
  { id: "ODS 15", nombre: "Vida de Ecosistemas Terrestres",       color: "#56C02B" }
];
