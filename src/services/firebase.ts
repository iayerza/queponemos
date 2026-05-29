import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  Unsubscribe,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  addDoc,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import type { NormalizedTitle } from './tmdb';
import type { TasteProfile } from '../utils/tasteProfile';
import type { PlatformId } from '../constants/platforms';
import type { Recommendation, MoodId } from './claude';
import { generateInviteCode } from '../utils/inviteCode';
import { recalculateTasteProfile } from '../utils/tasteProfile';

// ─── Types ──────────────────────────────────────────────────────────────────

export type Rating = 'loved' | 'seen_disliked' | 'not_seen';
export type TitleStatus = 'watched' | 'watchlist' | 'skipped' | 'pending';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  ratings: Record<number, Rating>;
  tasteProfile: TasteProfile;
  onboardingDone: boolean;
}

export interface GroupDoc {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
  inviteCode: string;
  platforms: PlatformId[];
  country: string;
}

export interface MatchDoc {
  id: string;
  groupId: string;
  members: string[];
  recommendations: Recommendation[];
  moods: Record<string, MoodId>;
  createdAt: { seconds: number };
}

export interface WatchlistItem {
  matchId: string;
  tmdbId: number;
  title: string;
  platform: PlatformId;
  groupId: string;
}

export interface CreateGroupOpts {
  name: string;
  platforms: PlatformId[];
  country: string;
}

// ─── Init ───────────────────────────────────────────────────────────────────

let app: FirebaseApp;

export function getApp(): FirebaseApp {
  if (getApps().length) return getApps()[0];
  app = initializeApp({
    apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  });
  return app;
}

function auth() { return getAuth(getApp()); }
function db()   { return getFirestore(getApp()); }

const DEFAULT_PROFILE: TasteProfile = {
  genres: {},
  intensity: 0.5,
  seriesVsMovies: 0.5,
  implicitGenres: [],
};

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function loginWithGoogleCredential(idToken: string): Promise<UserProfile> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth(), credential);
  const { user } = result;

  const existing = await getUserProfile(user.uid);
  if (existing) return existing;

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? 'Usuario',
    photoURL: user.photoURL,
    ratings: {},
    tasteProfile: DEFAULT_PROFILE,
    onboardingDone: false,
  };
  await setDoc(doc(db(), 'users', user.uid), {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return profile;
}

export async function loginWithEmailUser(fireUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): Promise<UserProfile> {
  const existing = await getUserProfile(fireUser.uid);
  if (existing) return existing;

  const profile: UserProfile = {
    uid: fireUser.uid,
    email: fireUser.email ?? '',
    displayName: fireUser.displayName ?? fireUser.email?.split('@')[0] ?? 'Usuario',
    photoURL: fireUser.photoURL,
    ratings: {},
    tasteProfile: DEFAULT_PROFILE,
    onboardingDone: false,
  };
  await setDoc(doc(db(), 'users', fireUser.uid), {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return profile;
}

export async function logout(): Promise<void> {
  await signOut(auth());
}

export function onAuthChange(cb: (user: UserProfile | null) => void): Unsubscribe {
  return onAuthStateChanged(auth(), async fireUser => {
    if (!fireUser) { cb(null); return; }
    const profile = await getUserProfile(fireUser.uid);
    cb(profile);
  });
}

// ─── Profile ────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db(), 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function rateTitleAndUpdateProfile(
  uid: string,
  titleId: number,
  rating: Rating,
  titleMeta: NormalizedTitle,
): Promise<TasteProfile> {
  const profile = await getUserProfile(uid);
  if (!profile) throw new Error('Usuario no encontrado');

  const newRatings = { ...profile.ratings, [titleId]: rating };
  const allTitles  = [titleMeta];
  const newProfile = recalculateTasteProfile(newRatings, allTitles, profile.tasteProfile);

  await updateDoc(doc(db(), 'users', uid), {
    [`ratings.${titleId}`]: rating,
    tasteProfile: newProfile,
    updatedAt: serverTimestamp(),
  });
  return newProfile;
}

export async function completeOnboarding(uid: string): Promise<void> {
  await updateDoc(doc(db(), 'users', uid), {
    onboardingDone: true,
    updatedAt: serverTimestamp(),
  });
}

// ─── Groups ─────────────────────────────────────────────────────────────────

export async function createGroup(
  uid: string,
  opts: CreateGroupOpts,
): Promise<{ groupId: string; inviteCode: string }> {
  const inviteCode = generateInviteCode();
  const ref = await addDoc(collection(db(), 'groups'), {
    name: opts.name,
    members: [uid],
    createdBy: uid,
    inviteCode,
    platforms: opts.platforms,
    country: opts.country,
    createdAt: serverTimestamp(),
  });
  return { groupId: ref.id, inviteCode };
}

export async function joinGroupByCode(
  uid: string,
  code: string,
): Promise<{ groupId: string; group: GroupDoc }> {
  const q = query(collection(db(), 'groups'), where('inviteCode', '==', code.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Código de invitación inválido');

  const docSnap = snap.docs[0];
  await updateDoc(docSnap.ref, { members: arrayUnion(uid) });
  return { groupId: docSnap.id, group: { id: docSnap.id, ...docSnap.data() } as GroupDoc };
}

export async function getUserGroups(uid: string): Promise<GroupDoc[]> {
  const q = query(collection(db(), 'groups'), where('members', 'array-contains', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as GroupDoc);
}

export function onGroupChange(
  groupId: string,
  cb: (group: GroupDoc) => void,
): Unsubscribe {
  return onSnapshot(doc(db(), 'groups', groupId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() } as GroupDoc);
  });
}

// ─── Matches ────────────────────────────────────────────────────────────────

export async function saveMatch(
  groupId: string,
  members: string[],
  recs: Recommendation[],
  moods: Record<string, MoodId>,
): Promise<string> {
  const ref = await addDoc(collection(db(), 'matches'), {
    groupId,
    members,
    recommendations: recs,
    moods,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getGroupMatches(groupId: string): Promise<MatchDoc[]> {
  const q = query(collection(db(), 'matches'), where('groupId', '==', groupId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as MatchDoc);
}

export async function updateTitleStatus(
  matchId: string,
  tmdbId: number,
  status: TitleStatus,
): Promise<void> {
  const matchRef = doc(db(), 'matches', matchId);
  const snap = await getDoc(matchRef);
  if (!snap.exists()) return;

  const match = snap.data() as MatchDoc;
  const recs = match.recommendations.map(r =>
    r.tmdbId === tmdbId ? { ...r, groupStatus: status } : r
  );
  await updateDoc(matchRef, { recommendations: recs });
}

export async function getGroupWatchlist(groupId: string): Promise<WatchlistItem[]> {
  const matches = await getGroupMatches(groupId);
  const items: WatchlistItem[] = [];
  for (const m of matches) {
    for (const r of m.recommendations) {
      if (r.groupStatus === 'watchlist' && r.tmdbId) {
        items.push({
          matchId: m.id,
          tmdbId: r.tmdbId,
          title: r.title,
          platform: r.platform,
          groupId,
        });
      }
    }
  }
  return items;
}
