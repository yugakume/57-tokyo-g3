// ============================================================
// Firestore localStorage キャッシュ共通ユーティリティ
// 全Contextで使用する。onSnapshotの代替として読み取り回数を削減する。
// ============================================================

const DEFAULT_TTL = 5 * 60 * 1000; // 5分

interface CacheEntry<T> {
  data: T[];
  ts: number;
}

export function loadCache<T>(key: string, ttl = DEFAULT_TTL): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.ts > ttl) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function saveCache<T>(key: string, data: T[]): void {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch { /* ignore quota/security errors */ }
}

export function clearCache(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ============================================================
// クォータエラー追跡 (管理者警告バナー用)
// ============================================================
const QUOTA_ERROR_KEY = "portal_quota_errors";

export function trackQuotaError(): void {
  try {
    const raw = localStorage.getItem(QUOTA_ERROR_KEY);
    const errors: number[] = raw ? JSON.parse(raw) : [];
    errors.push(Date.now());
    // 直近24時間分だけ保持
    const recent = errors.filter(t => Date.now() - t < 24 * 60 * 60 * 1000);
    localStorage.setItem(QUOTA_ERROR_KEY, JSON.stringify(recent));
  } catch { /* ignore */ }
}

export function getRecentQuotaErrors(): number[] {
  try {
    const raw = localStorage.getItem(QUOTA_ERROR_KEY);
    if (!raw) return [];
    const errors: number[] = JSON.parse(raw);
    return errors.filter(t => Date.now() - t < 24 * 60 * 60 * 1000);
  } catch {
    return [];
  }
}

export function clearQuotaErrors(): void {
  try { localStorage.removeItem(QUOTA_ERROR_KEY); } catch { /* ignore */ }
}
