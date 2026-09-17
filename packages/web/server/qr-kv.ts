/**
 * 🇨🇳 2026-09-02 M3.9 R43c:二维码短链数据层
 *
 * 表:
 *   - qr_short_links  所有上传文件(直链/短链都进表,cron 统一清理)
 *      short_id    TEXT PRIMARY KEY   直链 = 'dir-' + nanoid(8) ;短链 = nanoid(8)
 *      mode        TEXT NOT NULL      'direct' | 'shortlink'
 *      object_key  TEXT NOT NULL      OSS object key
 *      filename    TEXT NOT NULL      原始文件名
 *      mime        TEXT NOT NULL      文件 mime type
 *      size        INTEGER NOT NULL   文件字节数
 *      expires_at  INTEGER NOT NULL   文件过期时间戳(ms)— cron 据此删
 *      created_at  INTEGER NOT NULL
 */

import Database from 'better-sqlite3'

const QR_DB_PATH = process.env.VITE_QR_KV_PATH || '/var/lib/jianhebox/qr.db'
// 🇨🇳 9-3 R49.8:数据库从 /tmp 迁到 /var/lib/jianhebox/(与 kv.ts 保持一致)
console.log('[QR-KV] 数据库路径:', QR_DB_PATH)
const db = new Database(QR_DB_PATH)

db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS qr_short_links (
    short_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'shortlink',
    object_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_qr_expires ON qr_short_links(expires_at);
`)

// 🇨🇳 老库升级:加 mode 列(若已有表没有 mode)
const cols = db.prepare(`PRAGMA table_info(qr_short_links)`).all() as Array<{ name: string }>
if (!cols.find(c => c.name === 'mode')) {
  console.log('[QR-KV] 升级:加 mode 列')
  db.exec(`ALTER TABLE qr_short_links ADD COLUMN mode TEXT NOT NULL DEFAULT 'shortlink'`)
}

export interface QrShortLink {
  short_id: string
  mode: 'direct' | 'shortlink'
  object_key: string
  filename: string
  mime: string
  size: number
  expires_at: number
  created_at: number
}

export const QR_MAX_FILE_SIZE = 100 * 1024 * 1024        // 100 MB
export const QR_TOTAL_QUOTA = 10 * 1024 * 1024 * 1024     // 10 GB
export const QR_TTL_SHORTLINK_DAYS = 3                    // 短链 3 天
export const QR_TTL_DIRECT_HOURS = 24                     // 直链 24 小时
export const QR_LINK_EXPIRY_SEC = 600                     // OSS 链接签名 10 分钟

export function insertShortLink(link: Omit<QrShortLink, 'created_at'>): void {
  db.prepare(
    `INSERT INTO qr_short_links (short_id, mode, object_key, filename, mime, size, expires_at, created_at)
     VALUES (@short_id, @mode, @object_key, @filename, @mime, @size, @expires_at, @created_at)`
  ).run({ ...link, created_at: Date.now() })
}

/** 用 shortId 找记录 — 直链("dir-xxx")和短链("xxx")都能用 */
export function getShortLink(shortId: string): QrShortLink | null {
  const row = db.prepare(`SELECT * FROM qr_short_links WHERE short_id = ?`).get(shortId) as QrShortLink | undefined
  return row || null
}

/** 获取当前总占用字节数(用于配额检查) */
export function getTotalUsedBytes(): number {
  const row = db.prepare(`SELECT COALESCE(SUM(size), 0) as total FROM qr_short_links WHERE expires_at > ?`).get(Date.now()) as { total: number }
  return row.total
}

/** 删除过期记录,返回被删的 object_key 列表(用于 cron 清理 OSS) */
export function deleteExpired(): string[] {
  const expired = db.prepare(`SELECT object_key FROM qr_short_links WHERE expires_at <= ?`).all(Date.now()) as Array<{ object_key: string }>
  if (expired.length === 0) return []
  const stmt = db.prepare(`DELETE FROM qr_short_links WHERE expires_at <= ?`)
  stmt.run(Date.now())
  return expired.map(r => r.object_key)
}

/** 删除单条 */
export function deleteShortLink(shortId: string): string | null {
  const row = db.prepare(`SELECT object_key FROM qr_short_links WHERE short_id = ?`).get(shortId) as { object_key: string } | undefined
  if (!row) return null
  db.prepare(`DELETE FROM qr_short_links WHERE short_id = ?`).run(shortId)
  return row.object_key
}