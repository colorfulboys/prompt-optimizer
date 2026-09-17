/**
 * 🇨🇳 R52.20:开发模式才输出日志的小 logger
 *  - 生产构建 import.meta.env.DEV === false,Vite 会消除 dlog/dwarn 调用
 *  - derr 永远保留(错误必须看到)
 *  - 改名 dlog/dwarn 避免被 IDE 自动提示替换为 console.log
 *
 * 用法:
 *   import { dlog, dwarn, derr } from '@/utils/logger'
 *   dlog('调试')   // 开发时输出,生产消除
 *   dwarn('警告')  // 同上
 *   derr('错误')   // 永远 console.error
 */
const isDev = (import.meta as any).env?.DEV ?? false
export const dlog = (...args: unknown[]) => {
  if (isDev) console.log(...args)
}
export const dwarn = (...args: unknown[]) => {
  if (isDev) console.warn(...args)
}
export const derr = (...args: unknown[]) => console.error(...args)