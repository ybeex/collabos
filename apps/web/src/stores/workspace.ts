import { create } from 'zustand'
import type { Workspace, Channel } from '@collabos/shared'

interface WorkspaceState {
  currentWorkspace: Workspace | null
  currentChannelId: string | null
  channels: Channel[]
  sidebarOpen: boolean

  setWorkspace: (workspace: Workspace) => void
  setChannels: (channels: Channel[]) => void
  setCurrentChannel: (channelId: string) => void
  setSidebarOpen: (open: boolean) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentWorkspace: null,
  currentChannelId: null,
  channels: [],
  sidebarOpen: true,

  setWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  setChannels: (channels) => set({ channels }),
  setCurrentChannel: (channelId) => set({ currentChannelId: channelId }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
