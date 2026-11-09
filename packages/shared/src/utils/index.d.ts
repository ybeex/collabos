export declare const slugify: (text: string) => string;
export declare const truncate: (str: string, length: number) => string;
export declare const formatBytes: (bytes: number, decimals?: number) => string;
export declare const isValidUrl: (url: string) => boolean;
export declare const sleep: (ms: number) => Promise<void>;
export declare const retryWithBackoff: <T>(fn: () => Promise<T>, retries?: number, baseDelay?: number) => Promise<T>;
export declare const debounce: <T extends (...args: unknown[]) => unknown>(fn: T, ms: number) => ((...args: Parameters<T>) => void);
//# sourceMappingURL=index.d.ts.map