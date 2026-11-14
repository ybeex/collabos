export const PLAN_LIMITS = {
    free: {
        maxMembers: 3,
        maxDocs: 5,
        maxCanvases: 3,
        maxProjects: 1,
        messageHistoryDays: 90,
        storageMB: 5120,
        aiEnabled: false,
        automationsEnabled: false,
    },
    pro: {
        maxMembers: Infinity,
        maxDocs: Infinity,
        maxCanvases: Infinity,
        maxProjects: Infinity,
        messageHistoryDays: Infinity,
        storageMB: 102400,
        aiEnabled: true,
        automationsEnabled: false,
    },
    business: {
        maxMembers: Infinity,
        maxDocs: Infinity,
        maxCanvases: Infinity,
        maxProjects: Infinity,
        messageHistoryDays: Infinity,
        storageMB: 1048576,
        aiEnabled: true,
        automationsEnabled: true,
    },
    enterprise: {
        maxMembers: Infinity,
        maxDocs: Infinity,
        maxCanvases: Infinity,
        maxProjects: Infinity,
        messageHistoryDays: Infinity,
        storageMB: Infinity,
        aiEnabled: true,
        automationsEnabled: true,
    },
};
export const RATE_LIMITS = {
    free: 60,
    pro: 600,
    business: 1200,
    enterprise: 6000,
};
export const WS_EVENTS = {
    MESSAGE_CREATED: 'message.created',
    MESSAGE_UPDATED: 'message.updated',
    MESSAGE_DELETED: 'message.deleted',
    MESSAGE_REACTION: 'message.reaction',
    TASK_CREATED: 'task.created',
    TASK_STATUS_CHANGED: 'task.status_changed',
    TASK_DELETED: 'task.deleted',
    CHANNEL_CREATED: 'channel.created',
    DOC_CREATED: 'doc.created',
    DOC_UPDATED: 'doc.meta_updated',
    PRESENCE_UPDATED: 'presence.updated',
    CONNECTED: 'connected',
    PING: 'ping',
    PONG: 'pong',
};
export const TASK_STATUS_ORDER = {
    todo: 0,
    in_progress: 1,
    in_review: 2,
    done: 3,
    cancelled: 4,
};
export const PRIORITY_ORDER = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
};
//# sourceMappingURL=index.js.map