import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { getApp } from './firebase';

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushToken(uid: string): Promise<void> {
  const { status: existing } = await ExpoNotifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const tokenData = await ExpoNotifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  const db = getFirestore(getApp());
  await updateDoc(doc(db, 'users', uid), { pushToken: token });

  if (Platform.OS === 'android') {
    await ExpoNotifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: ExpoNotifications.AndroidImportance.MAX,
    });
  }
}

export async function sendMoodSelectedNotification(
  partnerToken: string,
  senderName: string,
): Promise<void> {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: partnerToken,
        sound: 'default',
        title: '¡Tu compañero eligió!',
        body: `${senderName} ya eligió su mood para esta noche`,
        data: { type: 'mood_selected' },
      }),
    });
  } catch { /* non-blocking */ }
}

export async function sendGroupVoteNotification(
  memberTokens: string[],
  groupName: string,
): Promise<void> {
  const messages = memberTokens.map(to => ({
    to,
    sound: 'default' as const,
    title: '¡Es hora de elegir!',
    body: `${groupName} quiere saber tu mood para esta noche`,
    data: { type: 'vote_request' },
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch { /* non-blocking */ }
}

export async function getGroupMemberTokens(
  memberUids: string[],
  currentUid: string,
): Promise<string[]> {
  const { getDoc, doc: fbDoc, getFirestore: fbDb } = await import('firebase/firestore');
  const db = fbDb(getApp());
  const tokens: string[] = [];
  await Promise.all(
    memberUids
      .filter(uid => uid !== currentUid)
      .map(async uid => {
        const snap = await getDoc(fbDoc(db, 'users', uid));
        const token = snap.data()?.pushToken as string | undefined;
        if (token) tokens.push(token);
      })
  );
  return tokens;
}
