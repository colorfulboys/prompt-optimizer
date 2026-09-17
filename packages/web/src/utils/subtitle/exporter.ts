/**
 * 简盒字幕工坊 - 5 种格式导出器
 * 🇨🇳 V2 2026-09-17:从 Python subtitle_converter.py 1:1 翻译,真实测试通过
 *  - SRT (通用) / VTT (Web) / TTML (PR) / ASS (B站) / FCPXML (FCP)
 */
import type { SubtitleSegment } from './types'
import { msToSrt, msToVtt, msToTtml, msToAss, msToFcpxml } from './parser'

export function toSrt(segments: SubtitleSegment[]): string {
  return segments.map(s =>
    `${s.index}\n${msToSrt(s.startMs)} --> ${msToSrt(s.endMs)}\n${s.text}`
  ).join('\n\n') + '\n'
}

export function toVtt(segments: SubtitleSegment[]): string {
  let out = 'WEBVTT\n\n'
  for (const s of segments) {
    out += `${msToVtt(s.startMs)} --> ${msToVtt(s.endMs)}\n${s.text}\n\n`
  }
  return out
}

export function toTtml(segments: SubtitleSegment[]): string {
  let out = '<?xml version="1.0" encoding="UTF-8"?>\n'
  out += '<tt xmlns="http://www.w3.org/ns/tt">\n'
  out += '  <head><styling><style xml:id="s1" tts:textAlign="center"/></styling></head>\n'
  out += '  <body><div>\n'
  for (const s of segments) {
    const text = s.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    out += `    <p begin="${msToTtml(s.startMs)}" end="${msToTtml(s.endMs)}">${text}</p>\n`
  }
  out += '  </div></body></tt>'
  return out
}

export function toAss(segments: SubtitleSegment[]): string {
  let out = '[Script Info]\nTitle: 简盒字幕工坊\nScriptType: v4.00+\n\n'
  out += '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour\n'
  out += 'Style: Default,PingFang SC,40,&H00FFFFFF\n\n'
  out += '[Events]\nFormat: Layer, Start, End, Style, Text\n'
  for (const s of segments) {
    const text = s.text.replace(/\n/g, '\\N')
    out += `Dialogue: 0,${msToAss(s.startMs)},${msToAss(s.endMs)},Default,${text}\n`
  }
  return out
}

export function toFcpxml(segments: SubtitleSegment[]): string {
  let out = '<?xml version="1.0" encoding="UTF-8"?>\n'
  out += '<!DOCTYPE fcpxml>\n'
  out += '<fcpxml version="1.11">\n'
  out += '  <resources>\n'
  out += '    <format id="r1" name="FFVideoFormat1080p25" frameDuration="1/25s" width="1920" height="1080"/>\n'
  out += '    <effect id="r2" name="Basic Title"/>\n'
  out += '  </resources>\n'
  out += '  <library>\n'
  out += '    <event name="Subtitles">\n'
  for (const s of segments) {
    const text = s.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    out += `      <title name="字幕 ${s.index}" lane="1" offset="0s" ref="r2" start="${msToFcpxml(s.startMs)}" duration="${msToFcpxml(s.endMs - s.startMs)}">\n`
    out += `        <text><text-style>${text}</text-style></text>\n`
    out += `      </title>\n`
  }
  out += '    </event>\n  </library>\n</fcpxml>'
  return out
}

export function toMarkdown(segments: SubtitleSegment[]): string {
  return segments.map(s => `## ${msToSrt(s.startMs)}

${s.text}
`).join('\n---\n\n')
}

export function exportAs(segments: SubtitleSegment[], format: 'srt' | 'vtt' | 'ttml' | 'ass' | 'fcpxml' | 'md'): string {
  switch (format) {
    case 'srt': return toSrt(segments)
    case 'vtt': return toVtt(segments)
    case 'ttml': return toTtml(segments)
    case 'ass': return toAss(segments)
    case 'fcpxml': return toFcpxml(segments)
    case 'md': return toMarkdown(segments)
  }
}
