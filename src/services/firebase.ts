import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  Unsubscribe,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  addDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  runTransaction,
} from 'firebase/firestore';
import type { NormalizedTitle } from './tmdb';
import type { TasteProfile } from '../utils/tasteProfile';
import type { PlatformId } from '../constants/platforms';
import type { Recommendation, MoodId } from './claude';
import { generateInviteCode } from '../utils/inviteCode';
import { recalculateTasteProfile } from '../utils/tasteProfile';

// ─── Types ──────────────────────────────────────────────────────────────────

export type Rating = 'loved' | 'liked' | 'seen_disliked' | 'not_seen';
export type TitleStatus = 'watched' | 'watchlist' | 'skipped' | 'pending' | 'chosen';

export interface PersonalWatchlistItem {
  tmdbId: number;
  title: string;
  year: number;
  type: 'movie' | 'series';
  posterPath: string | null;
  genres: string[];
  platform: PlatformId;
  synopsis: string;
  rating: number;
  addedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  ratings: Record<number, Rating>;
  tasteProfile: TasteProfile;
  onboardingDone: boolean;
  platforms: PlatformId[];
}

export interface GroupDoc {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
  inviteCode: string;
  platforms: PlatformId[];
  country: string;
  turnIndex?: number;
  currentSession?: {
    moods: Record<string, MoodId>;
    matchId?: string;
    leaderUid?: string;
  };
}

export interface MatchDoc {
  id: string;
  groupId: string;
  members: string[];
  recommendations: Recommendation[];
  moods: Record<string, MoodId>;
  createdAt: { seconds: number };
  groupInsight?: string;
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
    platforms: [],
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
    platforms: [],
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

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth(), email);
}

export async function verifyEmail(): Promise<void> {
  const user = auth().currentUser;
  if (user) await sendEmailVerification(user);
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

export async function deleteGroup(groupId: string): Promise<void> {
  await deleteDoc(doc(db(), 'groups', groupId));
}

export async function incrementGroupTurn(groupId: string): Promise<void> {
  const { increment } = await import('firebase/firestore');
  await updateDoc(doc(db(), 'groups', groupId), { turnIndex: increment(1) });
}

export async function clearGroupSession(groupId: string): Promise<void> {
  await updateDoc(doc(db(), 'groups', groupId), {
    'currentSession.moods': {},
    'currentSession.matchId': null,
  });
}

export async function startGroupSession(groupId: string, leaderUid: string): Promise<void> {
  await updateDoc(doc(db(), 'groups', groupId), {
    'currentSession.moods': {},
    'currentSession.matchId': null,
    'currentSession.leaderUid': leaderUid,
  });
}

export async function getGroupById(groupId: string): Promise<GroupDoc | null> {
  const snap = await getDoc(doc(db(), 'groups', groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as GroupDoc;
}

export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  await updateDoc(doc(db(), 'groups', groupId), { members: arrayRemove(uid) });
}

export async function reAuthenticateUser(email: string, password: string): Promise<void> {
  const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error('No hay usuario autenticado');
  const credential = EmailAuthProvider.credential(email, password);
  await reauthenticateWithCredential(currentUser, credential);
}

export async function deleteUserData(uid: string): Promise<void> {
  await deleteDoc(doc(db(), 'users', uid));
  const { deleteUser, getAuth } = await import('firebase/auth');
  const currentUser = getAuth(getApp()).currentUser;
  if (currentUser) await deleteUser(currentUser);
}

export async function fetchMemberNames(uids: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  await Promise.all(uids.map(async uid => {
    const snap = await getDoc(doc(db(), 'users', uid));
    if (snap.exists()) {
      const data = snap.data() as { displayName?: string; email?: string };
      names[uid] = data.displayName || data.email?.split('@')[0] || uid;
    }
  }));
  return names;
}

export async function updateGroupPlatforms(
  groupId: string,
  platforms: PlatformId[],
): Promise<void> {
  await updateDoc(doc(db(), 'groups', groupId), { platforms });
}

export async function setSessionMood(groupId: string, uid: string, mood: MoodId): Promise<void> {
  await updateDoc(doc(db(), 'groups', groupId), {
    [`currentSession.moods.${uid}`]: mood,
  });
}

export async function setSessionMatchId(groupId: string, matchId: string): Promise<void> {
  await updateDoc(doc(db(), 'groups', groupId), {
    'currentSession.matchId': matchId,
  });
}

export async function getMatchById(matchId: string): Promise<MatchDoc | null> {
  const snap = await getDoc(doc(db(), 'matches', matchId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MatchDoc;
}

/** Listen via onSnapshot until the leader writes a matchId (max 45s). */
export function pollForMatchId(groupId: string): Promise<string | null> {
  return new Promise(async resolve => {
    const initial = await getDoc(doc(db(), 'groups', groupId));
    const staleMatchId = initial.data()?.currentSession?.matchId as string | undefined;

    const timeout = setTimeout(() => { unsub(); resolve(null); }, 45_000);

    const unsub = onSnapshot(doc(db(), 'groups', groupId), snap => {
      const matchId = snap.data()?.currentSession?.matchId as string | undefined;
      if (matchId && matchId !== staleMatchId) {
        clearTimeout(timeout);
        unsub();
        resolve(matchId);
      }
    });
  });
}

export async function getUserGroups(uid: string): Promise<GroupDoc[]> {
  const q = query(collection(db(), 'groups'), where('members', 'array-contains', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as GroupDoc);
}

export function onGroupChange(
  groupId: string,
  cb: (group: GroupDoc | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db(), 'groups', groupId), snap => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as GroupDoc) : null);
  });
}

// ─── Matches ────────────────────────────────────────────────────────────────

export async function saveMatch(
  groupId: string,
  members: string[],
  recs: Recommendation[],
  moods: Record<string, MoodId>,
  groupInsight?: string,
): Promise<string> {
  const ref = await addDoc(collection(db(), 'matches'), {
    groupId,
    members,
    recommendations: recs,
    moods,
    groupInsight: groupInsight ?? '',
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

export interface HistoryEntry {
  matchId: string;
  groupId: string;
  groupName: string;
  createdAt: number;
  recommendations: Recommendation[];
  moods: Record<string, MoodId>;
}

export async function addMatchToUserHistory(
  uid: string,
  entry: HistoryEntry,
): Promise<void> {
  await setDoc(doc(db(), 'users', uid, 'history', entry.matchId), entry);
}

export async function getUserHistory(uid: string): Promise<HistoryEntry[]> {
  const q = query(
    collection(db(), 'users', uid, 'history'),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as HistoryEntry);
}

export async function updateUserPlatforms(
  uid: string,
  platforms: PlatformId[],
): Promise<void> {
  await updateDoc(doc(db(), 'users', uid), { platforms });
}

export async function addToPersonalWatchlist(
  uid: string,
  item: PersonalWatchlistItem,
): Promise<void> {
  await setDoc(doc(db(), 'users', uid, 'watchlist', String(item.tmdbId)), item);
}

export async function getPersonalWatchlist(uid: string): Promise<PersonalWatchlistItem[]> {
  const q = query(
    collection(db(), 'users', uid, 'watchlist'),
    orderBy('addedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as PersonalWatchlistItem);
}

export async function removeFromPersonalWatchlist(
  uid: string,
  tmdbId: number,
): Promise<void> {
  await deleteDoc(doc(db(), 'users', uid, 'watchlist', String(tmdbId)));
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

// ─── Usernames ──────────────────────────────────────────────────────────────

export async function registerUsername(username: string, email: string, uid: string): Promise<void> {
  const key = username.toLowerCase().trim();
  const ref = doc(db(), 'usernames', key);
  await runTransaction(db(), async tx => {
    const snap = await tx.get(ref);
    if (snap.exists()) throw new Error('username_taken');
    tx.set(ref, { uid, email });
  });
}

export async function getEmailByUsername(username: string): Promise<string | null> {
  const key = username.toLowerCase().trim();
  const snap = await getDoc(doc(db(), 'usernames', key));
  if (!snap.exists()) return null;
  return (snap.data() as { email: string }).email;
}

export async function addToPendingRatings(
  uid: string,
  matchId: string,
  groupName: string,
  rec: Recommendation,
): Promise<void> {
  const key = `${matchId}-${rec.tmdbId ?? rec.title}`;
  await setDoc(doc(db(), 'users', uid, 'pending', key), {
    matchId,
    groupName,
    rec,
    addedAt: Date.now(),
  });
}

export async function removeFromPendingRatings(
  uid: string,
  matchId: string,
  tmdbId?: number,
): Promise<void> {
  if (!tmdbId) return;
  const key = `${matchId}-${tmdbId}`;
  await deleteDoc(doc(db(), 'users', uid, 'pending', key));
}

export interface PendingRatingItem {
  matchId: string;
  groupId?: string;
  groupName: string;
  rec: import('../services/claude').Recommendation;
  addedAt?: number;
}

export async function getPendingRatingsForUser(uid: string): Promise<PendingRatingItem[]> {
  const q = query(collection(db(), 'users', uid, 'pending'), orderBy('addedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as PendingRatingItem);
}
