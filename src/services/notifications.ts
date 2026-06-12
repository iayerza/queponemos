import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, updateDoc, getDoc, getFirestore, deleteField } from 'firebase/firestore';
import { getApp } from './firebase';

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface PushTarget {
  uid: string;
  token: string;
}

export async function registerPushToken(uid: string): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await ExpoNotifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: ExpoNotifications.AndroidImportance.MAX,
      });
    }

    const { status: existing } = await ExpoNotifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await ExpoNotifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const tokenData = await ExpoNotifications.getExpoPushTokenAsync({
      projectId: '716f60da-b777-4a66-aa39-20a1c788f254',
    });
    const token = tokenData.data;

    const db = getFirestore(getApp());
    await updateDoc(doc(db, 'users', uid), { pushToken: token });
  } catch { /* non-blocking — don't crash app if notifications fail */ }
}

export async function clearPushToken(uid: string): Promise<void> {
  const db = getFirestore(getApp());
  await updateDoc(doc(db, 'users', uid), { pushToken: deleteField() });
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

async function postExpoPush(messages: object[]): Promise<ExpoPushTicket[]> {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!res.ok) return [];
  const json = await res.json() as { data?: ExpoPushTicket[] };
  return json.data ?? [];
}

async function purgeDeadTokens(targets: PushTarget[], tickets: ExpoPushTicket[]): Promise<void> {
  const db = getFirestore(getApp());
  await Promise.all(
    tickets.map(async (ticket, i) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const target = targets[i];
        if (target) {
          try { await updateDoc(doc(db, 'users', target.uid), { pushToken: deleteField() }); }
          catch { /* silenciar */ }
        }
      }
    })
  );
}

export async function sendMoodSelectedNotification(
  targets: PushTarget[],
  senderName: string,
  groupId: string,
): Promise<void> {
  if (targets.length === 0) return;
  try {
    const messages = targets.map(t => ({
      to: t.token,
      sound: 'default',
      title: '¡Tu compañero eligió!',
      body: `${senderName} ya eligió su mood para esta noche`,
      data: { type: 'mood_selected', groupId },
    }));
    const tickets = await postExpoPush(messages);
    purgeDeadTokens(targets, tickets).catch(() => {});
  } catch { /* non-blocking */ }
}

export async function sendGroupVoteNotification(
  targets: PushTarget[],
  groupName: string,
  groupId: string,
): Promise<void> {
  if (targets.length === 0) return;
  try {
    const messages = targets.map(t => ({
      to: t.token,
      sound: 'default' as const,
      title: '¡Es hora de elegir!',
      body: `${groupName} quiere saber tu mood para esta noche`,
      data: { type: 'vote_request', groupId },
    }));
    const tickets = await postExpoPush(messages);
    purgeDeadTokens(targets, tickets).catch(() => {});
  } catch { /* non-blocking */ }
}

export async function getGroupMemberTokens(
  memberUids: string[],
  currentUid: string,
): Promise<PushTarget[]> {
  const db = getFirestore(getApp());
  const targets: PushTarget[] = [];
  await Promise.all(
    memberUids
      .filter(uid => uid !== currentUid)
      .map(async uid => {
        const snap = await getDoc(doc(db, 'users', uid));
        const token = snap.data()?.pushToken as string | undefined;
        if (token) targets.push({ uid, token });
      })
  );
  return targets;
}
