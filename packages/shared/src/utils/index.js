export const slugify = (text) => text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
export const truncate = (str, length) => str.length > length ? `${str.slice(0, length)}...` : str;
export const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i] ?? 'B'}`;
};
export const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
};
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const retryWithBackoff = async (fn, retries = 3, baseDelay = 200) => {
    let lastError;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            if (attempt < retries - 1) {
                await sleep(baseDelay * Math.pow(2, attempt));
            }
        }
    }
    throw lastError;
};
export const debounce = (fn, ms) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
};
//# sourceMappingURL=index.js.map