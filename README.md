# Concurso de Murales · Casa Abierta 2026 · UTEQ

Plataforma web para la inscripción de equipos, publicación de bocetos y votación en línea
de preselección, conforme a las bases del concurso de la Facultad de Ciencias de la Ingeniería.

**Todo el sistema funciona con servicios gratuitos.**

---

## ⚠️ Lo primero: GitHub solo no alcanza

GitHub Pages sirve **archivos estáticos**. No puede guardar inscripciones, no puede
almacenar bocetos, no puede enviar correos y no puede contar votos. Un sitio "solo GitHub"
no puede impedir que alguien vote diez veces.

La combinación que sí funciona, y sigue siendo gratuita:

| Pieza | Servicio | Costo | Para qué |
|---|---|---|---|
| Sitio web (estas páginas) | **GitHub Pages** | Gratis | Servir el HTML/CSS/JS |
| Base de datos + login + imágenes | **Supabase** (plan Free) | Gratis | Guardar equipos, bocetos y votos; verificar el correo @uteq.edu.ec |

Supabase se configura desde el navegador, sin instalar nada. Toma unos 20 minutos.

---

## Qué incluye

```
concurso-murales-uteq/
├── index.html            Portada: bases resumidas y cronograma
├── inscripcion.html      Formulario de inscripción de equipos
├── galeria.html          Galería pública + votación
├── admin.html            Panel del Comité Organizador
├── assets/
│   ├── config.js         ← ÚNICO archivo que debes editar
│   ├── app.js            Lógica compartida (sesión, acceso, utilidades)
│   ├── styles.css        Diseño con la paleta de la infografía oficial
│   └── infografia.png    Infografía oficial del concurso
├── supabase/
│   └── schema.sql        Base de datos, reglas de seguridad y almacenamiento
└── bases-concurso-murales.pdf
```

### Reglas de las bases que el sistema aplica automáticamente

- Equipos de **mínimo 3 y máximo 6** integrantes (validado en el navegador y en la base de datos).
- Descripción conceptual de **150 a 200 palabras**, con contador en vivo.
- Correo del representante obligatoriamente **@uteq.edu.ec**.
- Las tres declaraciones obligatorias (autoría, difusión, aceptación de bases) son requisito.
- Las propuestas entran como **pendientes**: nadie ve nada en la galería hasta que el Comité aprueba.
- Las **cédulas, teléfonos y correos** de los integrantes nunca son visibles al público:
  la galería consume una vista que solo expone los campos que el artículo 12 autoriza a publicar.
- El boceto se guarda dentro del proyecto (no se admiten imágenes enlazadas desde fuera)
  y el bucket rechaza en el servidor archivos de más de 8 MB o que no sean JPG, PNG o WEBP.
- **Un solo voto por persona**, garantizado por dos restricciones únicas en la base de datos
  (por usuario y por correo) más un disparador que valida la sesión del lado del servidor.
- El voto solo se acepta si la votación está abierta y la propuesta fue aprobada.
- Los conteos permanecen ocultos hasta que el Comité los publica.
- Nadie puede leer quién votó por quién, salvo el Comité.

---

## Instalación paso a paso

### 1 · Crear el proyecto en Supabase

1. Entra a <https://supabase.com> y crea una cuenta (puedes usar GitHub).
2. **New project**. Nombre: `concurso-murales-uteq`. Región: *East US* o *South America (São Paulo)*.
   Guarda la contraseña de la base de datos.
3. Espera ~2 minutos a que el proyecto termine de aprovisionarse.

### 2 · Cargar la base de datos

1. En el menú lateral: **SQL Editor → New query**.
2. Abre `supabase/schema.sql`, copia **todo** el contenido y pégalo.
3. **Antes de ejecutar**, busca la sección `2. ADMINISTRADORES` y reemplaza
   `cambia.este.correo@uteq.edu.ec` por los correos reales del Comité Organizador
   (deben ser institucionales y en minúsculas). Puedes poner varios:

   ```sql
   insert into public.admins (email, nombre) values
     ('gonzalo.zambrano@uteq.edu.ec', 'Ing. Gonzalo Zambrano'),
     ('coordinacion.fci@uteq.edu.ec', 'Coordinación FCI')
   on conflict (email) do nothing;
   ```

4. Presiona **Run**. Debe decir *Success*.

### 3 · Configurar el ingreso con correo institucional

Elige **una** de estas dos vías según cómo maneje la UTEQ sus correos.

#### Opción A — Google (recomendada si los correos @uteq.edu.ec son Google Workspace)

Es instantánea, no envía correos y no tiene límites de envío.

1. En Supabase: **Authentication → Providers → Google → Enable**.
2. En [Google Cloud Console](https://console.cloud.google.com): crea un proyecto,
   ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**,
   tipo *Aplicación web*.
3. En **URI de redireccionamiento autorizados** pega la *Callback URL* que muestra Supabase
   (algo como `https://xxxxx.supabase.co/auth/v1/callback`).
4. Copia el *Client ID* y el *Client Secret* a Supabase y guarda.
5. En `assets/config.js` deja `METODO_LOGIN: "google"`.

> El sistema envía `hd=uteq.edu.ec` para que Google sugiera la cuenta institucional, y
> además la base de datos rechaza cualquier correo que no termine en `@uteq.edu.ec`.
> La verificación real está en la base de datos, no en el navegador.

#### Opción B — Enlace mágico por correo (funciona con cualquier proveedor)

1. En Supabase: **Authentication → Providers → Email → Enable**, con *Confirm email* activado.
2. **Importante:** el servidor de correo incluido en el plan gratuito solo permite unas pocas
   decenas de correos por hora — insuficiente para una votación masiva. Configura un SMTP propio en
   **Project Settings → Authentication → SMTP Settings**. Alternativas gratuitas:
   - [Resend](https://resend.com) — 3.000 correos/mes gratis.
   - [Brevo](https://brevo.com) — 300 correos/día gratis.
   - El SMTP institucional de la UTEQ, si el área de TI lo facilita (lo ideal).
3. En `assets/config.js` deja `METODO_LOGIN: "magic"`.

Si no estás seguro, deja `"ambos"`: se muestran las dos opciones.

### 4 · Registrar las URLs del sitio

En Supabase: **Authentication → URL Configuration**

- *Site URL*: `https://TU-USUARIO.github.io/concurso-murales-uteq/`
- *Redirect URLs*: agrega esa misma URL y también `http://localhost:*` si vas a probar en tu equipo.

Sin este paso, el login redirige a una página en blanco.

### 5 · Conectar el sitio

En Supabase: **Project Settings → API**. Copia:

- *Project URL*
- *anon public key*

Pégalas en `assets/config.js`:

```js
SUPABASE_URL:      "https://xxxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
```

Ajusta también `CONTACTO` con el correo del Comité.

> La *anon key* es pública por diseño: va en el navegador de todos los visitantes.
> Quien la tenga solo puede hacer lo que las políticas RLS permiten. **Nunca** publiques
> la *service_role key*.

### 6 · Publicar en GitHub Pages

1. Crea un repositorio público llamado `concurso-murales-uteq`.
2. Sube el contenido de esta carpeta (arrastra los archivos en **Add file → Upload files**).
3. **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `root` → Save**.
4. En 1–2 minutos el sitio queda en `https://TU-USUARIO.github.io/concurso-murales-uteq/`.

**Alternativa más cómoda:** arrastra la carpeta a <https://app.netlify.com/drop>.
Publica en segundos y permite un dominio personalizado gratuito.

---

## Operación durante el concurso

Todo se maneja desde `admin.html` (visible solo para los correos de la tabla `admins`).

| Fecha | Acción en el panel |
|---|---|
| Hasta el 23 de agosto | `Inscripciones abiertas` ✅ · `Votación` ❌ · `Resultados` ❌ |
| 23 de agosto, al cierre | Desactiva `Inscripciones abiertas` |
| 23–24 de agosto | Revisa cada propuesta y presiona **Aprobar** o **Rechazar** |
| 24 de agosto | Activa `Votación habilitada` |
| 26 de agosto | Desactiva `Votación habilitada` |
| 27 de agosto | Activa `Resultados visibles` y descarga el CSV para el acta |

El panel también exporta las inscripciones completas en CSV, útil para el expediente del Comité.

---

## Dos observaciones para el Comité Organizador

**1. Las bases dicen "un voto por dispositivo"; esta plataforma aplica "un voto por persona".**
La restricción por dispositivo es trivialmente evadible (modo incógnito, otro navegador, datos
móviles) y es justamente el escenario que el artículo 25 tipifica como causal de descalificación.
La verificación por correo institucional es sustancialmente más robusta y además limita la
votación a la comunidad universitaria. Conviene que el Comité formalice el cambio mediante una
nota aclaratoria o adenda, amparado en el artículo 14 ("El Comité Organizador podrá implementar
mecanismos técnicos adicionales para garantizar la transparencia y confiabilidad del proceso").

**2. El cronograma de las bases tiene una inconsistencia.**
El artículo 27 indica votación del **24 al 26 de agosto** y, en la línea siguiente, cierre de
votación el **25 de agosto**. Conviene corregirlo antes de difundir la convocatoria, ya que el
cierre de la votación se acciona manualmente y en un solo momento.

---

**3. Una verificación queda a cargo del Comité.**
Las bases establecen que "un estudiante podrá formar parte de un solo equipo participante".
El sistema no puede comprobarlo automáticamente, porque las cédulas se registran como texto
libre y un mismo estudiante podría escribirlas de formas distintas. El CSV de inscripciones
que exporta el panel incluye la cédula de cada integrante, lo que permite detectar duplicados
ordenando esa columna en Excel durante la validación.

---

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| "Sitio en modo demostración" | Falta pegar la URL y la anon key en `assets/config.js`. |
| El login abre una página en blanco | Falta registrar la URL del sitio en *Authentication → URL Configuration*. |
| El enlace mágico nunca llega | Límite del SMTP gratuito de Supabase. Configura Resend, Brevo o el SMTP de la UTEQ (paso 3B). |
| "La cuenta no está registrada como administradora" | Agrega el correo a la tabla `admins` desde *Table Editor*, **en minúsculas** y con dominio `@uteq.edu.ec`. |
| Un miembro del comité no puede aprobar una propuesta | Es intencional: nadie puede validar la propuesta que él mismo inscribió. Debe hacerlo otro integrante del comité. |
| Error al inscribir: `descripcion_longitud` | La descripción no está entre 150 y 200 palabras. |
| El boceto no se sube | El bucket `bocetos` no se creó. Vuelve a ejecutar la sección 7 del `schema.sql`. |
| La galería aparece vacía | Ninguna propuesta está en estado `aprobado`. Apruébalas desde el panel. |

---

## Prueba local

```bash
cd concurso-murales-uteq
python -m http.server 8000
```

Abre <http://localhost:8000> y agrega `http://localhost:8000` a las *Redirect URLs* de Supabase.
