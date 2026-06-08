@AGENTS.md

# Queponemos — Contexto del proyecto

App mobile (React Native + Expo 52) para recomendaciones de streaming en grupo, impulsada por Claude AI.

## Stack

- **Framework**: Expo SDK 52 (bare workflow con Expo Go compatible)
- **Lenguaje**: TypeScript estricto
- **Estado**: Zustand (`useAuthStore`, `useGroupStore`, `useMatchStore`)
- **Backend**: Firebase (Auth + Firestore)
- **IA**: Anthropic Claude (`claude-sonnet-4-5`) vía API directa desde el cliente
- **Imágenes**: TMDB API para pósters
- **Notificaciones**: expo-notifications + Expo Push API
- **Navegación**: React Navigation (native stack + bottom tabs)
- **Tema**: ThemeContext con dark/light/system, guardado en AsyncStorage

## Variables de entorno (EXPO_PUBLIC_*)

```
EXPO_PUBLIC_ANTHROPIC_API_KEY   # Claude API
EXPO_PUBLIC_TMDB_API_KEY        # TMDB para pósters
EXPO_PUBLIC_FIREBASE_*          # Config Firebase (6 vars)
EXPO_PUBLIC_USE_MOCK=true/false # Mock mode (sin Firebase/Claude)
```

Cuando `USE_MOCK=true`, toda la app funciona sin Firebase ni Claude usando datos de `src/utils/mock.ts`.

## Arquitectura clave

### Flujo de matching (modo grupo)
**Líder** = el creador del grupo. Solo el líder llama a Claude. Los demás seguidores hacen polling en Firestore hasta que aparece el `matchId` en `groups/{id}/currentSession.matchId`.

```
MoodScreen → cada miembro escribe su mood en Firestore
           → cuando todos están listos, navegan a MatchingScreen
           → líder llama a Claude, guarda match, escribe matchId
           → seguidores leen matchId y obtienen el match
           → todos navegan a ResultsScreen
```

### Flujo solo
Sin grupo. Usa `user.platforms` del perfil. No toca Firestore de grupos.
```
HomeScreen (card "¿Qué ves hoy?") → MoodScreen { solo: true }
→ MatchingScreen { solo: true } → ResultsScreen
```
Historial guardado como `groupName: "Solo"`, `groupId: "solo-{uid}"`.

### Tema (colors)
- `Colors` = `darkColors` (retrocompatibilidad, usado en `StyleSheet.create()` estático)
- Para estilos dinámicos (bg del root) usar `const themeColors = useColors()` y aplicar como inline style
- `darkColors` e `lightColors` definidos en `src/constants/colors.ts`
- Nunca reemplazar `Colors.xxx` en StyleSheet estático — solo el bg del root container va dinámico

## Estructura de datos Firestore

```
users/{uid}
  .platforms: PlatformId[]
  .ratings: Record<tmdbId, 'loved'|'seen_disliked'|'not_seen'>
  .tasteProfile: TasteProfile
  .onboardingDone: boolean
  /history/{matchId}   ← HistoryEntry
  /watchlist/{tmdbId}  ← PersonalWatchlistItem (modo solo "Para después")

groups/{groupId}
  .members: string[]
  .createdBy: string
  .inviteCode: string (6 chars, uppercase)
  .platforms: PlatformId[]
  .currentSession.moods: Record<uid, MoodId>
  .currentSession.matchId: string | null

matches/{matchId}
  .groupId, .members, .recommendations, .moods, .createdAt
```

## Pantallas y navegación

```
RootStack:
  Login → Onboarding → App (tabs) → Group → Mood → Matching → Results → PostView

AppTabs:
  Home | History | Profile
```

- **HomeScreen**: grupos + card "¿Qué ves hoy?" (solo mode) + modales crear/unirse grupo
- **GroupScreen**: detalle del grupo, QR code, botón "Buscar match" (envía push a miembros)
- **MoodScreen**: selección de mood; espera al partner en modo grupo; directo en modo solo
- **MatchingScreen**: spinner mientras Claude procesa
- **ResultsScreen**: 3 recomendaciones con acciones (Vista / Para después / Pasar)
- **HistoryScreen**: tabs "Historial" | "Para después" (watchlist personal)
- **ProfileScreen**: géneros, plataformas personales, tema, onboarding, logout/delete

## Decisiones de diseño tomadas

- **Plataformas de grupo** se configuran al crear el grupo
- **Plataformas personales** se configuran en ProfileScreen, se usan en modo solo
- **"Para después"** en modo solo → guarda en `users/{uid}/watchlist` (Firestore)
- **"Para después"** en modo grupo → guarda en el match doc (updateTitleStatus)
- Onboarding: 30 títulos para calificar; se puede continuar desde ProfileScreen
- Sin registro de usuarios públicos / perfiles sociales (backlog)

## Backlog (NO implementar aún)

- Chat de grupo en tiempo real
- Feed social ("lo que otros ven")
- Perfiles públicos con gustos y moods visibles
- Comunidades por género/plataforma
- "Match de gustos" entre usuarios
- Rediseño de GroupScreen

## Patrones frecuentes

```typescript
// Leer tema en una pantalla
const themeColors = useColors();
// Solo aplicar en el root container:
style={[styles.root, { backgroundColor: themeColors.bg }]}

// Mock guard
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';
if (!USE_MOCK) { /* llamada Firebase real */ }

// Acceder al store fuera de un componente (ej: en hooks)
const { addToHistory } = useMatchStore.getState();
```

## UI & Manual de marca

### Identidad visual

**Nombre**: queponemos (siempre minúscula)
**Tagline**: "La peli para hoy." (NO "para los dos" — cambiado)
**Concepto**: intersección de dos gustos → diagrama de Venn
**Tono**: cálido, directo, argentino (vos/ustedes). Sin mayúsculas innecesarias.

### Logo

**LogoMark** — ícono cuadrado con bordes redondeados, gradiente azul diagonal (`#0F2EA8` → `#2660EA`), diagrama de Venn SVG blanco en el interior:
- Dos círculos solapados (fillOpacity 0.2)
- Elipse central de intersección (fillOpacity 0.55)
- Punto central sólido blanco
- Proporciones: `box = size × 1.7`, `borderRadius = size × 0.3`

```tsx
<LogoMark size={28} />  // ícono solo
<LogoWordmark markSize={24} />  // ícono + texto
```

**LogoWordmark** — mark + texto en la misma línea:
- "que" en `Colors.text` (blanco en dark)
- "ponemos" en `Colors.coral` (`#E8503A`)
- Font: `DMSans_500Medium`, size 15, letterSpacing -0.2

**AnimatedLogoMark** — versión animada para MatchingScreen y SplashScreen:
- Los dos círculos del Venn laten desfasados (escala 0.90–1.15, 900ms)
- La intersección queda fija
- Usa `react-native-reanimated`

### Paleta de colores

| Token | Dark | Light | Uso |
|-------|------|-------|-----|
| `bg` | `#0D0D0F` | `#F5F5F7` | Fondo de pantalla |
| `s1` | `#1C1C20` | `#FFFFFF` | Cards, modales |
| `s2` | `#252528` | `#EBEBED` | Inputs, chips secundarios |
| `s3` | `#141418` | `#F0F0F2` | Fondos alternativos |
| `border` | `#2A2A2E` | `#DADADE` | Bordes neutros |
| `border2` | `#3A2020` | `#F5D5D3` | Bordes con tinte rojo |
| `accent` | `#C8302A` | `#C8302A` | Rojo primario (CTAs, badges, logo) |
| `accentFaint` | `rgba(200,48,42,0.15)` | `rgba(200,48,42,0.10)` | Fondo de highlights |
| `accentBorder` | `rgba(200,48,42,0.4)` | `rgba(200,48,42,0.35)` | Borde de elementos activos |
| `coral` | `#E8503A` | `#E8503A` | Texto logo "ponemos", acentos cálidos |
| `text` | `#FFFFFF` | `#111114` | Texto principal |
| `sub` | `#888888` | `#666670` | Texto secundario |
| `faint` | `#555555` | `#AAAABC` | Texto terciario, placeholders |
| `success` | `#1D9E75` | `#1D9E75` | Confirmaciones |
| `warning` | `#BA7517` | `#BA7517` | Alertas leves |
| `danger` | `#C8302A` | `#C8302A` | Errores, eliminar |

### Tipografía

**Familia única**: DM Sans. Solo dos pesos — nunca usar 600, 700, 800 o 900.

| Constante | Valor real | Uso |
|-----------|-----------|-----|
| `Typography.medium` / `bold` / `semibold` / `black` | `'500'` | Títulos, labels, CTAs |
| `Typography.regular` | `'400'` | Cuerpo, descripción |
| `Typography.fontMedium` | `'DMSans_500Medium'` | Para `fontFamily` |
| `Typography.fontRegular` | `'DMSans_400Regular'` | Para `fontFamily` |

**Escala de tamaños**:
| Token | px | Rol |
|-------|----|-----|
| `hero` | 28 | Título principal de pantalla |
| `h1` | 22 | Sección importante |
| `h2` | 18 | Subtítulo de sección |
| `h3` | 16 | Título de card |
| `body` | 14 | Texto de cuerpo |
| `small` | 12 | Metadata, labels |
| `tiny` | 10 | Eyebrows, badges, timestamps |

### Spacing y radios

```typescript
Spacing: { xs:4, sm:8, md:12, lg:16, xl:20, '2xl':24, '3xl':32 }
Radius:  { sm:8, md:12, lg:16, xl:20, pill:20, full:9999 }
```

### Componentes UI — reglas

**Cards** (`s1` bg, `border` borde, `Radius.md` = 12):
```tsx
{ backgroundColor: Colors.s1, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 16 }
```

**Card activa / seleccionada**:
```tsx
{ borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint }
```

**CTA primario** (rojo lleno):
```tsx
{ backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16 }
// texto: { color: '#fff', fontWeight: Typography.medium }
```

**CTA secundario** (borde):
```tsx
{ borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 16 }
// texto: { color: Colors.sub }
```

**Eyebrow / label de sección**:
```tsx
{ color: Colors.faint, fontSize: Typography.tiny, fontWeight: Typography.medium, textTransform: 'uppercase', letterSpacing: 1 }
```

**Badge de compatibilidad**:
```tsx
{ borderWidth: 1, borderColor: Colors.accentBorder, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }
// texto: { color: Colors.accent, fontSize: Typography.tiny }
```

**"¿Por qué a nosotros?" box**:
```tsx
{ borderLeftWidth: 3, borderLeftColor: Colors.accent, backgroundColor: Colors.accentFaint, borderRadius: 6, padding: 12 }
```

**Platform chips** (multi-select):
- Default: `{ bg: s2, border: border }`
- Seleccionado: `{ bg: accentFaint, border: accentBorder }`

**Inputs**:
```tsx
{ backgroundColor: Colors.s2, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.border }
// placeholder: Colors.faint
```

### Reglas de estilo que NO romper

1. **Solo DM Sans**, solo pesos 400 y 500. Si hay duda, usar 500.
2. **`StyleSheet.create()`** siempre usa `Colors.*` (estáticos). Solo el `backgroundColor` del root container va como inline style dinámico con `themeColors.bg`.
3. **Sin sombras** (`shadow*`, `elevation`). Profundidad = solo bordes y capas de color.
4. **Sin gradientes** salvo en SplashScreen/MatchingOrb donde es intencional.
5. **Padding horizontal de pantalla**: siempre `paddingHorizontal: 24`.
6. **Gap entre elementos**: usar `gap` en lugar de `margin` cuando hay flexbox.
7. **Textos en español argentino** ("vos", "vas", "tenés", "hacé").

## EAS Build

- **Preview** (APK para testing): `eas build --profile preview --platform android`
- **Production** (AAB para Play Store): `eas build --profile production --platform android`
- EAS project ID: `716f60da-b777-4a66-aa39-20a1c788f254`
- Bundle ID: `com.queponemos.app`
- Cuenta Expo: ayerza@gmail.com
