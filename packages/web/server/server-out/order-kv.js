/**
 * 🇨🇳 R57:订单 KV 数据库
 *
 * 存所有支付订单(订阅 + 充值包)
 *
 * 生产部署:VITE_ORDER_KV_PATH 覆盖为 /var/lib/jianhebox/orders.db
 * 本地 dev:/tmp/jianhebox-kv/orders.db
 */
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
const ORDER_DB_PATH = process.env.VITE_ORDER_KV_PATH || '/tmp/jianhebox-kv/orders.db';
// 确保目录存在
const dir = path.dirname(ORDER_DB_PATH);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}
const db = new Database(ORDER_DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,           -- 'plus' | 'pro' | 'studio' | 'mini' | 'value' | 'bulk'
    plan_type TEXT NOT NULL,         -- 'subscription' | 'topup'
    amount_cents INTEGER NOT NULL,   -- 价格(分)
    minutes INTEGER NOT NULL,        -- 充值/订阅月配额(分钟)
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'paid' | 'refunded' | 'expired'
    created_at INTEGER NOT NULL,
    paid_at INTEGER,
    expires_at INTEGER NOT NULL,     -- 订单过期(30 分钟未支付作废)
    transaction_id TEXT,             -- 微信支付订单号
    wechat_code_url TEXT             -- 微信扫码 URL(下单时存)
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
`);
/** 创建订单 */
export function createOrder(params) {
    const stmt = db.prepare(`
    INSERT INTO orders (order_id, user_id, plan_id, plan_type, amount_cents, minutes, status, created_at, expires_at, wechat_code_url)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `);
    stmt.run(params.orderId, params.userId, params.planId, params.planType, params.amountCents, params.minutes, Date.now(), params.expiresAt, params.wechatCodeUrl || null);
}
/** 根据 orderId 查订单 */
export function getOrder(orderId) {
    const stmt = db.prepare(`SELECT * FROM orders WHERE order_id = ?`);
    return stmt.get(orderId);
}
/** 标记订单已支付(微信回调时用) */
export function markOrderPaid(orderId, transactionId) {
    const stmt = db.prepare(`
    UPDATE orders SET status = 'paid', paid_at = ?, transaction_id = ?
    WHERE order_id = ? AND status = 'pending'
  `);
    const result = stmt.run(Date.now(), transactionId, orderId);
    return result.changes > 0 ? getOrder(orderId) : null;
}
/** 列出用户的订单(分页) */
export function listUserOrders(userId, limit = 20) {
    const stmt = db.prepare(`
    SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
  `);
    return stmt.all(userId, limit);
}
/** 清理过期订单(cron 跑) */
export function expireOrders() {
    const stmt = db.prepare(`
    UPDATE orders SET status = 'expired'
    WHERE status = 'pending' AND expires_at < ?
  `);
    const result = stmt.run(Date.now());
    return result.changes;
}
/** 调试用:列所有订单 */
export function _debugDump() {
    return {
        count: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
        sample: db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all(),
    };
}
