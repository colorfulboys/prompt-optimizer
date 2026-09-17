/**
 * 🇨🇳 2026-09-02 M3.9 R44:工具注册表
 *
 * 加新工具只要在这里加一行:
 * - 主页"所有工具"区块自动出现
 * - 顶部导航 / 移动端菜单自动出现
 * - 不用改任何其他文件
 *
 * id 全小写、连字符,用作 key
 * path 用 vue-router 的 hash path
 */

export type ToolCategory = 'media' | 'utility' | 'data'
export type ToolStatus = 'live' | 'beta' | 'planned'

export interface ToolInfo {
  id: string
  name: string
  emoji: string
  desc: string
  path: string
  category: ToolCategory
  featured: boolean
  status: ToolStatus
  /** 标签(可多个): NEW / HOT / BETA / 等 */
  tags?: string[]
  /** 🇨🇳 R47:浏览器免费功能列表(用户不登录就能用) */
  browserFree?: string[]
  /** 🇨🇳 R47:需登录才能用的功能 */
  loginRequired?: string[]
}

export const TOOLS: ToolInfo[] = [
  // === 🇨🇳 R45:主推工具 = 音视频相关(用户原话:"二维码不算主推,音视频放上去")
  //    加新主推:featured: true,会自动出现在主页顶部 featured 区 + nav 的"立即打开"
  //    nav 的"立即打开"默认指向主推工具里的第一个 media 分类 ===
  {
    id: 'subtitle',
    name: '字幕工坊',
    emoji: '🎬',
    desc: '7 种格式互转 · 在线编辑 · 智能检测 · 工作流',
    path: '/tools/subtitle',
    category: 'media',
    featured: true,
    status: 'live',
    tags: ['主推', 'NEW'],
  },
  {
    id: 'fcpxml',
    name: '字幕 ⇄ FCPXML',
    emoji: '🎞️',
    desc: '剪映字幕一键转 FCPXML · 网页改错别字 · 导出 SRT/Word/MD',
    path: '/tools/fcpxml',
    category: 'media',
    featured: false,
    status: 'live',
  },
  {
    id: 'audio',
    name: '音频工具箱',
    emoji: '🎵',
    desc: '转写 · 剪辑 · 格式转换 · 提取音频 · 降噪 · 人声分离',
    path: '/tools/audio',
    category: 'media',
    featured: true,  // 🇨🇳 R45:主推(音视频)
    status: 'live',
    tags: ['主推', 'NEW'],
    // 🇨🇳 R47:音频工具箱特性 — 用于下拉面板说明
    browserFree: ['剪辑', '格式转换', '提取音频', '降噪'],
    loginRequired: ['转写', '人声分离'],
  },
  // 🇨🇳 2026-09-04 R50:视频工具箱 — 5 个功能(纯浏览器 ffmpeg.wasm)
  {
    id: 'video',
    name: '视频工具箱',
    emoji: '🎞️',
    desc: '压缩 · 转 GIF · 去水印 · 合并 · 竖屏转横屏',
    path: '/tools/video',
    category: 'media',
    featured: true,  // 🇨🇳 R50:主推(音视频铁律 — 用户原话)
    status: 'live',
    tags: ['主推', 'NEW'],
    browserFree: ['压缩', '转 GIF', '去水印', '合并', '竖↔横'],
    loginRequired: [],
  },
  // 🇨🇳 2026-09-04 R51:图片工具箱 — 6 个功能(Canvas + 部分接阿里云)
  {
    id: 'image',
    name: '图片工具箱',
    emoji: '🖼️',
    desc: '压缩 · 裁剪加水印 · 转PDF · AI 抠图 · 老照片修复 · 证件照',
    path: '/tools/image',
    category: 'media',
    featured: true,  // 🇨🇳 R52.4:用户原话"nav 总显示 4 个工具箱,排除当前页"
    status: 'beta',
    tags: ['NEW'],
    browserFree: ['压缩', '裁剪加水印', '转PDF', '证件照换底'],
    loginRequired: ['AI 抠图', '老照片修复'],
  },
  {
    id: 'qr',
    name: '一切皆可二维码',
    emoji: '🔳',
    desc: '任意文件转 1 个二维码 · 客户扫码即下载 · 24 小时自动删',
    path: '/tools/qr',
    category: 'utility',
    featured: false,  // 🇨🇳 R45:不主推(用户原话)
    status: 'live',
    tags: ['NEW'],
  },

  // === 工具区(主页所有工具区块) ===

  {
    id: 'pdf',
    name: 'PDF 处理套件',
    emoji: '📄',
    desc: '合并 / 拆分 / 删页 / 去水印 / 转 Word — 10 个功能纯前端',
    path: '/tools/pdf',
    category: 'utility',
    featured: false,
    status: 'live',
  },
  // 🇨🇳 R45:audio 已移到主推区,这里删除
  {
    id: 'articles',
    name: '文章管理',
    emoji: '📚',
    desc: '公众号文章收藏 · 分类 · 检索',
    path: '/articles',
    category: 'data',
    featured: false,
    status: 'live',
  },
  {
    id: 'favorites',
    name: '我的收藏',
    emoji: '❤️',
    desc: '收藏的提示词 / 文章 / 灵感',
    path: '/favorites',
    category: 'data',
    featured: false,
    status: 'live',
  },
]

/** 🇨🇳 R45:nav 顶栏"立即打开"指向的工具
 *  优先级:主推工具 → media 分类 → featured 工具里的第一个
 *  用户原话:"我准备主推还是音视频相关,所以二维码那个不一直放在菜单栏" */
export const PRIMARY_TOOL: ToolInfo =
  TOOLS.find(t => t.featured && t.category === 'media') ||
  TOOLS.find(t => t.featured) ||
  TOOLS[0]

/** 主推工具(主页顶部 featured 区) */
export const FEATURED_TOOLS = TOOLS.filter(t => t.featured)

/** 按分类分组(主页"所有工具"区块展示) */
export const TOOLS_BY_CATEGORY: Record<ToolCategory, ToolInfo[]> = {
  media: [],
  utility: [],
  data: [],
}
for (const tool of TOOLS) {
  TOOLS_BY_CATEGORY[tool.category].push(tool)
}

/** 分类中文名 */
export const CATEGORY_NAME: Record<ToolCategory, string> = {
  media: '🎬 媒体',
  utility: '🛠 工具',
  data: '📊 数据',
}

/** 状态颜色(给 UI 用) */
export const STATUS_LABEL: Record<ToolStatus, string> = {
  live: '已上线',
  beta: '测试中',
  planned: '计划中',
}