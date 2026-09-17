/** 🇨🇳 R47:音频工具共享类型 */

export type AudioFormat = 'mp3' | 'wav' | 'aac' | 'flac' | 'ogg'

export interface QuotaInfo {
  transcribeUsedMin: number  // 本月转写已用
  transcribeLimitMin: number  // 本月转写总配额(免费 30)
  transcribeRenewed: boolean  // 是否已续过一次
  vocalSeparateUsedMin: number
  vocalSeparateLimitMin: number  // 60 分钟/月/用户
}

export type UserPlan = 'free' | 'plus' | 'pro' | 'studio' | 'topup'