import { create } from 'zustand'

interface UserPresence {
  userId: string
  status: 'online' | 'away' | 'offline'
  activeChannel?: string
  lastSeen: string
}

interface PresenceState {
  presence: Record<string, UserPresence>
  updatePresence: (userId: string, data: Partial<UserPresence>) => void
  clearPresence: () => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  presence: {},

  updatePresence: (userId, data) =>
    set((state) => ({
      presence: {
        ...state.presence,
        [userId]: {
          ...state.presence[userId],
          userId,
          status: data.status ?? state.presence[userId]?.status ?? 'offline',
          activeChannel: data.activeChannel ?? state.presence[userId]?.activeChannel,
          lastSeen: data.lastSeen ?? new Date().toISOString(),
        },
      },
    })),

  clearPresence: () => set({ presence: {} }),
}))
