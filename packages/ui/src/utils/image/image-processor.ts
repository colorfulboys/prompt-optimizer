/**
 * 🇨🇳 2026-09-04 R51:图片处理工具集(纯 Canvas + pdf-lib)
 *
 * 不依赖 ffmpeg,因为图片用 Canvas API + pdf-lib 即可完成:
 * - 压缩 → toBlob
 * - 裁剪 → drawImage 画到指定区域
 * - 加水印 → 文字/图片二次 drawImage
 * - 转 PDF → pdf-lib
 *
 * AI 类(抠图/老照片)→ 走阿里云 OSS + API,函数式放在 ../lib/aliyun-image.ts 或类似
 */
import { PDFDocument } from 'pdf-lib'

// ---------------------------------------------------------------------------
// R51.2:图片裁剪 + 水印
// ---------------------------------------------------------------------------

export type WatermarkType = 'none' | 'text' | 'image'

export interface CropWatermarkOpts {
  // 裁剪(像素)
  crop?: { x: number; y: number; width: number; height: number }
  // 输出尺寸(可选,等比缩放)
  maxWidth?: number
  maxHeight?: number
  // 输出格式
  format?: 'image/jpeg' | 'image/png' | 'image/webp'
  quality?: number  // 0-1
  // 水印
  watermark?: {
    type: WatermarkType
    text?: string
    image?: File | Blob
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile'
    fontSize?: number
    color?: string
    opacity?: number
  }
}

/**
 * R51.2:图片裁剪 + 水印 一体化
 */
export async function cropAndWatermark(file: File, opts: CropWatermarkOpts = {}): Promise<Blob> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })

  try {
    let srcX = 0
    let srcY = 0
    let srcW = img.naturalWidth
    let srcH = img.naturalHeight

    // 1. 裁剪
    if (opts.crop) {
      srcX = Math.max(0, opts.crop.x)
      srcY = Math.max(0, opts.crop.y)
      srcW = Math.min(opts.crop.width, img.naturalWidth - srcX)
      srcH = Math.min(opts.crop.height, img.naturalHeight - srcY)
    }

    // 2. 等比缩放
    let outW = srcW
    let outH = srcH
    if (opts.maxWidth || opts.maxHeight) {
      const maxW = opts.maxWidth || srcW
      const maxH = opts.maxHeight || srcH
      const ratio = Math.min(maxW / srcW, maxH / srcH, 1)
      outW = Math.round(srcW * ratio)
      outH = Math.round(srcH * ratio)
    }

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 上下文创建失败')

    // 3. 画原图(裁剪后)
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH)

    // 4. 水印
    if (opts.watermark && opts.watermark.type !== 'none') {
      const wm = opts.watermark
      ctx.save()
      ctx.globalAlpha = wm.opacity ?? 0.5

      if (wm.type === 'text' && wm.text) {
        ctx.fillStyle = wm.color || '#ffffff'
        ctx.font = `${wm.fontSize || 32}px sans-serif`
        ctx.textBaseline = 'bottom'

        if (wm.position === 'tile') {
          // 平铺模式:每 200px 一个
          ctx.fillStyle = wm.color || '#ffffff'
          ctx.font = `${wm.fontSize || 24}px sans-serif`
          for (let y = 60; y < outH; y += 120) {
            for (let x = 30; x < outW; x += 200) {
              ctx.fillText(wm.text, x, y)
            }
          }
        } else {
          const { x, y } = getWatermarkPosition(wm.position || 'bottom-right', outW, outH, ctx.measureText(wm.text).width, (wm.fontSize || 32))
          ctx.fillText(wm.text, x, y)
        }
      } else if (wm.type === 'image' && wm.image) {
        const wmImg = new Image()
        const wmUrl = URL.createObjectURL(wm.image)
        await new Promise<void>((resolve, reject) => {
          wmImg.onload = () => resolve()
          wmImg.onerror = () => reject(new Error('水印图加载失败'))
          wmImg.src = wmUrl
        })
        // 水印图尺寸 = 输出 20%
        const wmW = Math.round(outW * 0.2)
        const wmH = Math.round(wmW * (wmImg.naturalHeight / wmImg.naturalWidth))
        const { x, y } = getWatermarkPosition(wm.position || 'bottom-right', outW, outH, wmW, wmH)
        ctx.drawImage(wmImg, x, y, wmW, wmH)
        URL.revokeObjectURL(wmUrl)
      }

      ctx.restore()
    }

    // 5. 输出
    const format = opts.format || 'image/jpeg'
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('编码失败')),
        format,
        format === 'image/png' ? undefined : (opts.quality ?? 0.9)
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function getWatermarkPosition(position: string, w: number, h: number, wmW: number, wmH: number) {
  const margin = 16
  switch (position) {
    case 'top-left':     return { x: margin, y: margin + wmH }
    case 'top-right':    return { x: w - wmW - margin, y: margin + wmH }
    case 'bottom-left':  return { x: margin, y: h - margin }
    case 'bottom-right': return { x: w - wmW - margin, y: h - margin }
    case 'center':       return { x: (w - wmW) / 2, y: (h + wmH) / 2 }
    default:             return { x: w - wmW - margin, y: h - margin }
  }
}

// ---------------------------------------------------------------------------
// R51.3:图片转 PDF(用 pdf-lib,不依赖 ffmpeg)
// ---------------------------------------------------------------------------

/**
 * 把多张图片合成 1 个 PDF,每张图片 1 页,A4 尺寸,自适应
 */
export async function imagesToPdf(files: File[]): Promise<Blob> {
  if (files.length === 0) throw new Error('至少 1 张图片')

  const pdfDoc = await PDFDocument.create()

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let embedded
    if (file.type === 'image/png') {
      embedded = await pdfDoc.embedPng(bytes)
    } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      embedded = await pdfDoc.embedJpg(bytes)
    } else {
      // 其他格式 → 用 canvas 转 jpg
      const url = URL.createObjectURL(file)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error(`图片加载失败: ${file.name}`))
        img.src = url
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      const jpgBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('转 jpg 失败')), 'image/jpeg', 0.92)
      })
      const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer())
      embedded = await pdfDoc.embedJpg(jpgBytes)
      URL.revokeObjectURL(url)
    }

    // A4 = 595 x 842 pt
    const page = pdfDoc.addPage([595, 842])
    const margin = 40
    const maxW = 595 - margin * 2
    const maxH = 842 - margin * 2
    const ratio = Math.min(maxW / embedded.width, maxH / embedded.height)
    const drawW = embedded.width * ratio
    const drawH = embedded.height * ratio
    page.drawImage(embedded, {
      x: (595 - drawW) / 2,
      y: (842 - drawH) / 2,
      width: drawW,
      height: drawH,
    })
  }

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
}

// ---------------------------------------------------------------------------
// R51.4:证件照换底(纯 Canvas)
// ---------------------------------------------------------------------------

/** 1 寸 / 2 寸 / 小 1 寸 / 大 1 寸 等标准尺寸(像素 @300DPI) */
export const ID_PHOTO_SIZES = {
  '1-inch':   { label: '1 寸 (25×35mm)',   w: 295, h: 413, mmW: 25, mmH: 35 },
  '2-inch':   { label: '2 寸 (35×49mm)',   w: 413, h: 579, mmW: 35, mmH: 49 },
  'small-1':  { label: '小 1 寸 (22×32mm)', w: 260, h: 378, mmW: 22, mmH: 32 },
  'big-1':    { label: '大 1 寸 (33×48mm)', w: 390, h: 567, mmW: 33, mmH: 48 },
}

export type IdPhotoSizeKey = keyof typeof ID_PHOTO_SIZES

/** 常见底色 */
export const ID_BG_COLORS = {
  white: '#ffffff',
  blue:  '#3b82f6',
  red:   '#dc2626',
  gray:  '#9ca3af',
}

export type IdBgColorKey = keyof typeof ID_BG_COLORS

/**
 * R51.6:证件照换底
 * - 输入原图 + 目标尺寸 + 目标底色
 * - 注意:**这里假设原图已抠图**(透明背景 PNG 或已抠图 API)
 * - 如果原图是 jpg 不透明,会丢失人像 — 实际生产要配合 B4 AI 抠图
 *
 * 简化:v1 让用户上传 PNG(已透明),直接合成底色
 *   后续 R51.6+:配 B4 抠图 API 自动转透明
 */
export async function makeIdPhoto(
  file: File,
  sizeKey: IdPhotoSizeKey,
  bgColorKey: IdBgColorKey
): Promise<Blob> {
  const size = ID_PHOTO_SIZES[sizeKey]
  const bgColor = ID_BG_COLORS[bgColorKey]

  const url = URL.createObjectURL(file)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })

  try {
    const canvas = document.createElement('canvas')
    canvas.width = size.w
    canvas.height = size.h
    const ctx = canvas.getContext('2d')!
    // 涂底色
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, size.w, size.h)
    // 居中放原图(可能透明 PNG)
    // 适配:contain(完整人像,可能有白边) — 证件照标准做法
    const ratio = Math.min(size.w / img.naturalWidth, size.h / img.naturalHeight)
    const drawW = img.naturalWidth * ratio
    const drawH = img.naturalHeight * ratio
    ctx.drawImage(img, (size.w - drawW) / 2, (size.h - drawH) / 2, drawW, drawH)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('编码失败')), 'image/jpeg', 0.95)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 老照片修复 / AI 抠图 → 后端 API 调用,函数式留到 R51.4/R51.5 实现 */

// ---------------------------------------------------------------------------
// R51 helper
// ---------------------------------------------------------------------------

export function downloadBlobHelper(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
