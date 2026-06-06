import { create } from 'zustand';
import type { GroupDoc } from '../services/firebase';

export interface PendingInvite {
  email: string;
  groupId: string;
  status: 'pending' | 'accepted';
}

interface GroupStore {
  groups: GroupDoc[];
  currentGroup: GroupDoc | null;
  pendingInvites: PendingInvite[];
  pendingInviteCode: string | null;
  setGroups: (groups: GroupDoc[]) => void;
  setCurrentGroup: (group: GroupDoc | null) => void;
  addGroup: (group: GroupDoc) => void;
  addMemberToGroup: (groupId: string, uid: string) => void;
  addPendingInvite: (invite: PendingInvite) => void;
  acceptInvite: (email: string) => void;
  updateGroup: (groupId: string, patch: Partial<GroupDoc>) => void;
  removeGroup: (groupId: string) => void;
  setPendingInviteCode: (code: string | null) => void;
  reset: () => void;
}

export const useGroupStore = create<GroupStore>(set => ({
  groups: [],
  currentGroup: null,
  pendingInvites: [],
  pendingInviteCode: null,
  setPendingInviteCode: code => set({ pendingInviteCode: code }),
  setGroups: groups => set({ groups }),
  setCurrentGroup: group => set({ currentGroup: group }),
  addGroup: group => set(s => ({
    groups: s.groups.find(g => g.id === group.id) ? s.groups : [...s.groups, group],
  })),
  addMemberToGroup: (groupId, uid) => set(s => ({
    groups: s.groups.map(g =>
      g.id === groupId && !g.members.includes(uid)
        ? { ...g, members: [...g.members, uid] }
        : g
    ),
    currentGroup: s.currentGroup?.id === groupId && !s.currentGroup.members.includes(uid)
      ? { ...s.currentGroup, members: [...s.currentGroup.members, uid] }
      : s.currentGroup,
  })),
  addPendingInvite: invite => set(s => ({ pendingInvites: [...s.pendingInvites, invite] })),
  acceptInvite: email => set(s => ({
    pendingInvites: s.pendingInvites.map(i =>
      i.email === email ? { ...i, status: 'accepted' as const } : i
    ),
  })),
  updateGroup: (groupId, patch) => set(s => ({
    groups: s.groups.map(g => g.id === groupId ? { ...g, ...patch } : g),
    currentGroup: s.currentGroup?.id === groupId ? { ...s.currentGroup, ...patch } : s.currentGroup,
  })),
  removeGroup: groupId => set(s => ({
    groups: s.groups.filter(g => g.id !== groupId),
    currentGroup: s.currentGroup?.id === groupId ? null : s.currentGroup,
  })),
  reset: () => set({ groups: [], currentGroup: null, pendingInvites: [], pendingInviteCode: null }),
}));
