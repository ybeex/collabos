export declare const PLAN_LIMITS: {
    readonly free: {
        readonly maxMembers: 3;
        readonly maxDocs: 5;
        readonly maxCanvases: 3;
        readonly maxProjects: 1;
        readonly messageHistoryDays: 90;
        readonly storageMB: 5120;
        readonly aiEnabled: false;
        readonly automationsEnabled: false;
    };
    readonly pro: {
        readonly maxMembers: number;
        readonly maxDocs: number;
        readonly maxCanvases: number;
        readonly maxProjects: number;
        readonly messageHistoryDays: number;
        readonly storageMB: 102400;
        readonly aiEnabled: true;
        readonly automationsEnabled: false;
    };
    readonly business: {
        readonly maxMembers: number;
        readonly maxDocs: number;
        readonly maxCanvases: number;
        readonly maxProjects: number;
        readonly messageHistoryDays: number;
        readonly storageMB: 1048576;
        readonly aiEnabled: true;
        readonly automationsEnabled: true;
    };
    readonly enterprise: {
        readonly maxMembers: number;
        readonly maxDocs: number;
        readonly maxCanvases: number;
        readonly maxProjects: number;
        readonly messageHistoryDays: number;
        readonly storageMB: number;
        readonly aiEnabled: true;
        readonly automationsEnabled: true;
    };
};
export declare const RATE_LIMITS: {
    readonly free: 60;
    readonly pro: 600;
    readonly business: 1200;
    readonly enterprise: 6000;
};
export declare const WS_EVENTS: {
    readonly MESSAGE_CREATED: "message.created";
    readonly MESSAGE_UPDATED: "message.updated";
    readonly MESSAGE_DELETED: "message.deleted";
    readonly MESSAGE_REACTION: "message.reaction";
    readonly TASK_CREATED: "task.created";
    readonly TASK_STATUS_CHANGED: "task.status_changed";
    readonly TASK_DELETED: "task.deleted";
    readonly CHANNEL_CREATED: "channel.created";
    readonly DOC_CREATED: "doc.created";
    readonly DOC_UPDATED: "doc.meta_updated";
    readonly PRESENCE_UPDATED: "presence.updated";
    readonly CONNECTED: "connected";
    readonly PING: "ping";
    readonly PONG: "pong";
};
export declare const TASK_STATUS_ORDER: Record<string, number>;
export declare const PRIORITY_ORDER: Record<string, number>;
//# sourceMappingURL=index.d.ts.map