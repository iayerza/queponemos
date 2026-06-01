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

## EAS Build

- **Preview** (APK para testing): `eas build --profile preview --platform android`
- **Production** (AAB para Play Store): `eas build --profile production --platform android`
- EAS project ID: `716f60da-b777-4a66-aa39-20a1c788f254`
- Bundle ID: `com.queponemos.app`
- Cuenta Expo: ayerza@gmail.com
