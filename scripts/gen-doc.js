const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, Header, Footer, PageNumber, VerticalAlign,
} = require('docx');
const fs = require('fs');

const ACCENT  = 'E8C547';
const DARK    = '0A0A0F';
const GRAY    = 'F5F5F5';
const BORDER  = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text, bold: true, size: 32, font: 'Arial' })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Arial' })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text, bold: true, size: 22, font: 'Arial', color: '555555' })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 22, font: 'Arial', ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: 'Arial' })],
  });
}

function note(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 20, font: 'Arial', color: '888888', italics: true })],
  });
}

function pageBreak() {
  return new Paragraph({ pageBreakBefore: true, children: [new TextRun('')] });
}

function spacer() {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun('')] });
}

function statusBadge(text, color) {
  return new TextRun({ text: ` ${text} `, bold: true, size: 18, font: 'Arial', color, highlight: 'yellow' });
}

function headerRow(cols, widths) {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c, i) => new TableCell({
      borders: BORDERS,
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: '2A2A3A', type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, size: 20, font: 'Arial', color: 'FFFFFF' })] })],
    })),
  });
}

function dataRow(cols, widths, shade = false) {
  return new TableRow({
    children: cols.map((c, i) => new TableCell({
      borders: BORDERS,
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: shade ? 'F9F9F9' : 'FFFFFF', type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: c, size: 20, font: 'Arial' })] })],
    })),
  });
}

function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      headerRow(headers, widths),
      ...rows.map((r, i) => dataRow(r, widths, i % 2 === 1)),
    ],
  });
}

// ── Secciones de pantalla ──────────────────────────────────────────────────

function screenBlock(id, name, desc, rows) {
  const W = [1400, 2800, 4160];
  return [
    spacer(),
    table(
      [id, name, ''],
      [[' ', desc, ' ']],
      [1400, 4320, 2640],
    ),
    spacer(),
    ...(rows.length ? [
      table(['Elemento', 'Tipo de control', 'Comportamiento / Notas'], rows, W),
    ] : []),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    }],
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial', color: DARK },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: DARK },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Arial', color: '444444' },
        paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } },
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 1 } },
        children: [
          new TextRun({ text: 'Queponemos', bold: true, font: 'Arial', size: 20, color: DARK }),
          new TextRun({ text: ' — Spec funcional UX · Mayo 2026', font: 'Arial', size: 18, color: '888888' }),
        ],
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: 'Página ', font: 'Arial', size: 18, color: '888888' }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: '888888' }),
        ],
      })] }),
    },
    children: [

      // ── PORTADA ────────────────────────────────────────────────────────────
      new Paragraph({
        spacing: { before: 1440, after: 160 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Queponemos', bold: true, size: 64, font: 'Arial' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: 'Decisiones UX — Spec funcional completa', size: 28, font: 'Arial', color: '666666', italics: true })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 480 },
        children: [new TextRun({ text: 'Versión 1.1  ·  Mayo 2026  ·  Plataforma: Android (iOS futuro)', size: 20, font: 'Arial', color: '999999' })],
      }),
      // Estado real actual
      table(
        ['', ''],
        [
          ['Pantallas implementadas', '10 de 13 especificadas'],
          ['Stack activo', 'Expo SDK 52 · Firebase Auth+Firestore · Claude AI · TMDB · Zustand'],
          ['Firebase Hosting', 'queponemosapp.web.app'],
          ['Repo', 'github.com/iayerza/queponemos'],
          ['Fase', 'MVP en desarrollo activo'],
        ],
        [2800, 6560],
      ),

      pageBreak(),

      // ── DECISIONES GENERALES ───────────────────────────────────────────────
      h1('Decisiones UX tomadas'),

      h2('Cuentas y sesión'),
      bullet('Cada usuario tiene su propia cuenta — la app vive en el teléfono de cada uno'),
      bullet('Login con email/password y con Google vía Firebase Auth'),
      bullet('El perfil de gustos queda asociado a la cuenta para siempre'),
      bullet('El onboarding se hace una sola vez — no se repite en cada sesión'),
      bullet('El usuario puede volver a afinar su perfil desde la pantalla de perfil en cualquier momento'),
      bullet('Mínimo 12 títulos calificados para habilitar el matching'),
      bullet('Mock mode completo disponible (EXPO_PUBLIC_USE_MOCK=true) — funciona sin Firebase ni API keys'),

      spacer(),
      h2('Onboarding de gustos'),
      bullet('Se muestran 25 títulos reales de a uno, con póster, año, tipo y géneros'),
      bullet('Tres opciones de calificación: Me encantó / No me convenció / No la vi'),
      bullet('"No la vi" no suma ni resta al perfil — solo registra que no fue visto'),
      bullet('Al seleccionar una opción, avanza automáticamente al siguiente título'),
      bullet('El sistema infiere géneros, preferencia serie/película y estilos — no se los pregunta directamente'),
      bullet('Navegación libre con flechas — el usuario puede volver y cambiar su calificación'),
      bullet('El progreso se muestra como contador (ej: 12/25), no como porcentaje'),

      spacer(),
      h2('Invitación y conexión'),
      bullet('Dos formas de invitar: por email o por QR'),
      bullet('QR apunta a queponemosapp.web.app con deep link a la app'),
      bullet('Cuando la otra persona acepta, el matching se dispara automáticamente'),
      bullet('Las invitaciones pendientes quedan listadas en la pantalla de invitación'),

      spacer(),
      h2('Motor de matching'),
      bullet('Claude AI analiza los perfiles cruzados y devuelve 3 recomendaciones con score y explicación personalizada'),
      bullet('La explicación "¿Por qué a ustedes?" menciona los gustos específicos de cada persona'),
      bullet('El score va de 62 a 97% — se muestra con barra de progreso animada'),
      bullet('Costo estimado por match: ~$0.01 con Claude Sonnet · con prompt caching baja a ~$0.003'),
      bullet('Claude API llamado desde cliente en MVP — mover a Firebase Function en V1.0'),

      spacer(),
      h2('Acciones post-match'),
      bullet('Tres acciones por título: La vimos / No la terminamos / La vemos después'),
      bullet('Los botones son toggle — se pueden desmarcar'),
      bullet('Los títulos en "La vemos después" aparecen en el home como lista de pendientes'),

      pageBreak(),

      // ── MÓDULOS Y PANTALLAS ────────────────────────────────────────────────
      h1('Módulos y pantallas'),

      h2('Módulo 1 — Autenticación y sesión'),

      ...screenBlock('S01', 'Pantalla de entrada', 'Primera pantalla que ve el usuario. Sin sesión activa. ✔ Implementado', [
        ['Botón: Entrar con Google', 'OAuth button', 'Dispara Firebase Auth con Google. Redirige a S02 si es nuevo usuario o a S05 si ya tiene perfil.'],
        ['Botón: Entrar con email', 'Input + botón', 'Email + contraseña. Incluye "Olvidé mi contraseña".'],
        ['Botón: Registrarse', 'Text link', 'Flujo de registro con email + contraseña + nombre.'],
      ]),

      ...screenBlock('S02', 'Onboarding — Calificación de títulos', '25 títulos reales de IMDB Top 250. Solo para usuarios nuevos. ✔ Implementado', [
        ['Tarjeta de título', 'Card con imagen', 'Póster (TMDB), título, año, género. Una a la vez.'],
        ['Me encantó', 'Botón primario', 'Peso positivo alto en el perfil.'],
        ['La vi, no me convenció', 'Botón secundario', 'Peso negativo moderado. Registra que la vio.'],
        ['No la vi', 'Botón terciario', 'No suma ni resta al perfil de gustos.'],
        ['Contador de progreso', 'Label', 'Ej: 12/25. No porcentaje.'],
        ['Navegación con flechas', 'Flechas prev/next', 'Permite volver y cambiar calificación.'],
      ]),

      ...screenBlock('S03', 'Ronda de afinación', 'Pantalla opcional para refinar el perfil. Accesible desde perfil. ✔ Implementado (básico)', [
        ['Mismos controles que S02', '—', 'Idéntica mecánica de calificación.'],
        ['Indicador de mejora', 'Label', 'Al final muestra: "Tu perfil mejoró un X% en precisión".'],
        ['Botón: Terminar', 'Botón primario', 'Guarda y vuelve a la pantalla anterior.'],
      ]),

      ...screenBlock('S04', 'Actualización de título individual', 'Buscar un título ya visto y actualizar su valoración. □ Pendiente V1.0', [
        ['Buscador', 'Input con autocompletar', 'Busca en TMDB en tiempo real.'],
        ['Resultado seleccionado', 'Card', 'Muestra valoración actual si ya existe.'],
        ['Selector de valoración', '3 botones', 'Me encantó / No me convenció / Quitar valoración.'],
        ['Botón: Guardar', 'Botón primario', 'Actualiza el perfil y vuelve.'],
      ]),

      pageBreak(),
      h2('Módulo 2 — Perfil de usuario'),

      ...screenBlock('S05', 'Mi perfil', 'Vista personal del usuario. Accesible desde navegación principal. ✔ Implementado', [
        ['Nombre de usuario', 'Label', 'Visible, edición desde configuración.'],
        ['Plataformas activas', 'Multi-select chips', 'Netflix, Disney+, HBO/Max, Prime, Apple TV+.'],
        ['Mis géneros top', 'Lista generada', 'Los 3–5 géneros con mayor peso. Solo lectura.'],
        ['Géneros ocultos', 'Lista colapsable', 'Géneros detectados implícitamente. □ Pendiente'],
        ['Gráfico de evolución', 'Line chart', 'Evolución del perfil en el tiempo. □ Pendiente'],
        ['Botón: Afinar perfil', 'Botón', 'Redirige a S03.'],
        ['Historial personal', 'Lista scrollable', 'Títulos calificados con fecha y valoración.'],
      ]),

      pageBreak(),
      h2('Módulo 3 — Grupos'),

      ...screenBlock('S06', 'Mis grupos (Home)', 'Lista de grupos del usuario. ✔ Implementado', [
        ['Lista de grupos', 'Cards clickeables', 'Nombre, integrantes, última sesión.'],
        ['Botón: Crear grupo nuevo', 'Botón primario', 'Abre modal S07.'],
        ['Botón: Unirse a grupo', 'Botón secundario', 'Input de código de 6 dígitos.'],
        ['Indicador de turno', 'Badge en card', '"Es tu turno" si le toca elegir. □ Pendiente V1.0'],
      ]),

      ...screenBlock('S07', 'Crear grupo', 'Modal para configurar un grupo nuevo. ✔ Implementado', [
        ['Nombre del grupo', 'Input text', 'Requerido. Ej: "El grupo del viernes".'],
        ['Código generado', 'Label copiable', 'Código de 6 caracteres auto-generado.'],
        ['Modo familia', 'Toggle on/off', 'Habilita filtro por clasificación de edad. □ Pendiente V1.0'],
        ['Plataformas del grupo', 'Multi-select chips', 'Por defecto toma las del creador. Editable.'],
        ['Botón: Crear', 'Botón primario', 'Guarda y redirige a S08.'],
      ]),

      ...screenBlock('S08', 'Vista de grupo (hub)', 'Pantalla principal de un grupo. ✔ Implementado', [
        ['Integrantes', 'Avatar list', 'Foto/inicial + nombre. Verde si registró mood.'],
        ['Botón: Registrar mood', 'Botón primario', 'Abre S09. Solo si no registró mood hoy.'],
        ['Botón: Ver recomendaciones', 'Botón primario', 'Solo si todos registraron mood. → S10.'],
        ['Lista de pendientes', 'Lista colapsable', 'Títulos guardados por el grupo.'],
        ['Historial grupal', 'Lista colapsable', 'Lo que vieron juntos. Ordenado por fecha.'],
        ['Alertas de catálogo', 'Banner/badge', 'Títulos por salir del catálogo. □ Pendiente V1.0'],
      ]),

      pageBreak(),
      h2('Módulo 4 — Sesión de matching'),

      ...screenBlock('S09', 'Mood del momento', 'Cada usuario registra cómo se siente antes de la sesión. ✔ Implementado', [
        ['Selector de mood', '6 opciones visuales', 'Para reír / Para pensar / Para llorar / Adrenalina / Relajarse / Sorpéndeme.'],
        ['Duración disponible', 'Selector', 'Menos de 1h / 1–2h / Más de 2h / Sin límite.'],
        ['Botón: Listo', 'Botón primario', 'Guarda y vuelve a S08. Indicador pasa a verde.'],
      ]),

      note('→ El mood es privado. Nadie ve el mood del otro, solo si ya lo registró.'),

      ...screenBlock('S10', 'Recomendaciones del grupo', 'Pantalla central. 3 recomendaciones con score y explicación. ✔ Implementado', [
        ['Card de título', 'Card con imagen', 'Póster + título + año + género + plataforma + duración.'],
        ['Score de match', 'Porcentaje + barra', 'Ej: "87% de match grupal". Calculado por Claude AI.'],
        ['¿Por qué a ustedes?', 'Texto expandible', 'Explicación personalizada. Menciona usuarios por nombre.'],
        ['Veto', 'Ícono X', 'Veto anónimo. El título desaparece sin revelar quién. □ Pendiente V1.0'],
        ['Guardar en pendientes', 'Ícono bookmark', 'Agrega a la lista de pendientes del grupo.'],
        ['Modo debate', 'Botón activable', 'Los 2 títulos con más votos pasan a S11. □ Pendiente'],
      ]),

      ...screenBlock('S11', 'Modo debate', 'Comparación directa entre 2 finalistas. □ Pendiente', [
        ['Panel izquierdo/derecho', 'Dos columnas', 'Un título por columna con póster y argumentos.'],
        ['Votación', 'Botón por columna', 'Cada usuario vota. Se revela al votar todos.'],
        ['Resultado', 'Animación', 'Revela ganador y votos de cada uno.'],
        ['Botón: Elegido', 'Botón primario en ganador', 'Confirma y agrega al historial grupal.'],
      ]),

      pageBreak(),
      h2('Módulo 5 — Post-visionado'),

      ...screenBlock('S12', 'Reacción post-visionado', 'Aparece la sesión siguiente para calificar lo que vieron. □ Pendiente V1.0', [
        ['Título a calificar', 'Card pequeña', 'El último título visto por el grupo.'],
        ['Puntuación grupal', '1 a 5 estrellas', 'Cada usuario califica individualmente. Se promedia.'],
        ['Comentario libre', 'Textarea opcional', 'Máximo 280 caracteres.'],
        ['Botón: Enviar', 'Botón primario', 'Guarda y alimenta perfiles individuales.'],
        ['Botón: Saltear', 'Text link', 'Cierra sin registrar.'],
      ]),

      h2('Módulo 6 — Estadísticas'),

      ...screenBlock('S13', 'Estadísticas del grupo', 'Vista analítica del grupo desde S08. □ Pendiente V1.0', [
        ['Score de compatibilidad', 'Número grande', 'Compatibilidad general. Ej: "73% compatibles".'],
        ['Compatibilidad por género', 'Bar chart', 'Ej: Thriller 91% / Comedia 34%.'],
        ['Quién cede más', 'Indicador por usuario', 'Detecta desequilibrio en elecciones. Sugiere equilibrar.'],
        ['Títulos vistos juntos', 'Contador', 'Total de películas y series vistas como grupo.'],
      ]),

      pageBreak(),
      h2('Módulo 7 — Notificaciones'),

      spacer(),
      table(
        ['Evento', 'Canal', 'Mensaje'],
        [
          ['Título en pendientes por salir del catálogo', 'Push + badge', '"Atención: [Título] sale de Netflix en 5 días"'],
          ['Nuevo integrante se unió al grupo', 'Push', '"[Nombre] se unió a [Grupo]"'],
          ['Todos registraron el mood', 'Push a todos', '"¡El grupo está listo! Ya podés ver las recomendaciones"'],
          ['Le toca elegir al usuario', 'Push + badge S06', '"Esta noche te toca elegir en [Grupo]"'],
          ['Resumen semanal', 'Push (configurable)', '"Esta semana llegó a Netflix: [X títulos que cruzan con tu perfil]"'],
        ],
        [2800, 1400, 4160],
      ),

      pageBreak(),

      // ── RESUMEN DE PANTALLAS ──────────────────────────────────────────────
      h1('Resumen de pantallas'),
      spacer(),
      table(
        ['ID', 'Pantalla', 'Módulo', 'Estado'],
        [
          ['S01', 'Entrada / Login', 'Autenticación', '✔ Implementado'],
          ['S02', 'Onboarding — 25 títulos', 'Autenticación', '✔ Implementado'],
          ['S03', 'Ronda de afinación', 'Autenticación', '✔ Implementado (básico)'],
          ['S04', 'Actualización de título individual', 'Autenticación', '□ Pendiente V1.0'],
          ['S05', 'Mi perfil', 'Perfil', '✔ Implementado'],
          ['S06', 'Mis grupos / Home', 'Grupos', '✔ Implementado'],
          ['S07', 'Crear grupo', 'Grupos', '✔ Implementado'],
          ['S08', 'Vista de grupo (hub)', 'Grupos', '✔ Implementado'],
          ['S09', 'Mood del momento', 'Matching', '✔ Implementado'],
          ['S10', 'Recomendaciones del grupo', 'Matching', '✔ Implementado'],
          ['S11', 'Modo debate', 'Matching', '□ Pendiente'],
          ['S12', 'Reacción post-visionado', 'Post-visionado', '□ Pendiente V1.0'],
          ['S13', 'Estadísticas del grupo', 'Estadísticas', '□ Pendiente V1.0'],
        ],
        [800, 2800, 2000, 2760],
      ),

      pageBreak(),

      // ── PENDIENTE V1.0 ────────────────────────────────────────────────────
      h1('Pendiente para V1.0'),
      spacer(),
      table(
        ['Feature', 'Por qué importa', 'Esfuerzo'],
        [
          ['Pósters TMDB reales en UI', 'Hace la app visualmente válida para testing real', 'Bajo'],
          ['S04 — Actualización de título', 'El usuario puede corregir su perfil', 'Medio'],
          ['Veto anónimo en S10', 'Evita conflictos sociales en el grupo', 'Bajo'],
          ['S12 — Reacción post-visionado', 'Retroalimentación que mejora el perfil', 'Medio'],
          ['S13 — Estadísticas del grupo', 'Fidelización y valor percibido', 'Alto'],
          ['S11 — Modo debate', 'Feature diferenciador vs competencia', 'Alto'],
          ['Grupos 3–5 personas', 'Ampliar el caso de uso principal', 'Alto'],
          ['Claude → Firebase Function', 'Ocultar API key en producción', 'Medio'],
          ['Push notifications', 'Flujo de invitación completo', 'Alto'],
          ['JustWatch filtrado', 'Solo mostrar lo disponible hoy', 'Alto'],
        ],
        [3000, 3800, 1560],
      ),

      pageBreak(),

      // ── STACK TÉCNICO ─────────────────────────────────────────────────────
      h1('Stack técnico — estado real'),
      spacer(),
      table(
        ['Componente', 'Tecnología', 'Estado'],
        [
          ['Frontend', 'Expo SDK 52 / React Native 0.76 / TypeScript', '✔ Activo'],
          ['Autenticación', 'Firebase Auth v12 (email + Google)', '✔ Activo'],
          ['Base de datos', 'Firebase Firestore v12', '✔ Activo'],
          ['IA / Matching', 'Claude AI — claude-sonnet-4-20250514', '✔ Activo'],
          ['Catálogo', 'TMDB API (servicio listo, UI pendiente)', '⚠ Parcial'],
          ['Estado global', 'Zustand v5 (3 stores: auth, group, match)', '✔ Activo'],
          ['Navegación', 'React Navigation v7', '✔ Activo'],
          ['Hosting web', 'Firebase Hosting — queponemosapp.web.app', '✔ Activo'],
          ['Disponibilidad', 'JustWatch (no oficial)', '□ Pendiente V1.0'],
          ['Push notifications', 'A definir (Expo Notifications / FCM)', '□ Pendiente V1.0'],
        ],
        [2200, 4000, 2160],
      ),

      pageBreak(),

      // ── ROADMAP ───────────────────────────────────────────────────────────
      h1('Roadmap'),
      spacer(),
      table(
        ['Fase', 'Alcance', 'Estado'],
        [
          ['MVP', 'Login + onboarding + matching Claude + 2 usuarios · Mock mode completo · 10 pantallas', '🟡 En desarrollo'],
          ['V1.0 Alpha', 'Pósters TMDB + JustWatch + grupos 3–5 + Claude en backend + veto', '□ Pendiente'],
          ['V1.0 Beta', 'Historial + stats + alertas de catálogo + reacción post-visionado', '□ Pendiente'],
          ['V1.0 Launch', 'Modo familia + turno rotativo + modo debate + push notifications + UX final', '□ Pendiente'],
          ['V2.0', 'Módulo música · Spotify · playlists · perfil audiovisual unificado', '\u{1F535} Futuro'],
        ],
        [1600, 5200, 1560],
      ),

      spacer(),
      spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240 },
        children: [new TextRun({ text: 'Queponemos — Spec funcional UX — Mayo 2026 — Confidencial', size: 18, font: 'Arial', color: '999999', italics: true })],
      }),

    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('Queponemos_UX_Spec.docx', buf);
  console.log('OK');
});
