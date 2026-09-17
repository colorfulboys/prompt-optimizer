// FCPXML 解析器
// 简盒字幕工坊 v1
// FCPXML 1.11 字幕提取

import { srtTimeToMs, msToSrtTime, msToVttTime, msToAssTime, type SubtitleSegment, type SubtitleFormat } from './types';

function parseFcpxml(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];

  // 提取所有 <title> 节点
  // <title ref="r2" name="..." offset="100/2500s" duration="60000/2500s" start="0s" text="..." role="dialogue"/>
  const titleRegex = /<title\s+([^>]*?)\/?>(?:[\s\S]*?<\/title>)?/g;
  let match;
  let index = 0;

  while ((match = titleRegex.exec(content)) !== null) {
    const attrs = match[1];

    // 提取属性
    const offsetMatch = attrs.match(/offset=["']([^"']+)["']/);
    const durationMatch = attrs.match(/duration=["']([^"']+)["']/);
    const startMatch = attrs.match(/start=["']([^"']+)["']/);
    const textMatch = attrs.match(/text=["']([^"']*)["']/);
    const roleMatch = attrs.match(/role=["']([^"']+)["']/);
    const nameMatch = attrs.match(/name=["']([^"']+)["']/);
    const laneMatch = attrs.match(/lane=["']([^"']+)["']/);

    if (!offsetMatch || !durationMatch) continue;

    // 转换 rational time → ms
    // 100/2500s = 0.04 seconds = 40ms
    const offsetMs = rationalTimeToMs(offsetMatch[1]);
    const durationMs = rationalTimeToMs(durationMatch[1]);
    // start 偏移 (在 source media 内, 我们先用 0)
    const startMs = startMatch ? rationalTimeToMs(startMatch[1]) : 0;
    const endMs = offsetMs + durationMs;

    if (!textMatch) continue; // 必须有文本

    index++;
    segments.push({
      index,
      startMs: offsetMs,
      endMs,
      durationMs,
      text: textMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
      rawText: textMatch[1],
      speaker: roleMatch?.[1] || nameMatch?.[1],
      position: laneMatch ? { x: undefined, y: undefined } : undefined,
    });
  }

  return segments;
}

function rationalTimeToMs(time: string): number {
  // "100/2500s" 或 "60s" 或 "1.5s"
  if (time.endsWith('s')) {
    const expr = time.slice(0, -1);
    if (expr.includes('/')) {
      const [num, den] = expr.split('/').map(Number);
      return Math.round((num / den) * 1000);
    }
    return Math.round(parseFloat(expr) * 1000);
  }
  return 0;
}

function msToFcpxmlRational(ms: number, fps = 25): string {
  const frameMs = 1000 / fps;
  const frames = Math.round(ms / frameMs);
  const totalFrames = Math.round(1 / frameMs);
  return `${frames}/${totalFrames}s`;
}

function toSrt(segments: SubtitleSegment[]): string {
  return segments.map(seg =>
    `${seg.index}\n${msToSrtTime(seg.startMs)} --> ${msToSrtTime(seg.endMs)}\n${seg.rawText || seg.text}\n`
  ).join('\n');
}

function toVtt(segments: SubtitleSegment[]): string {
  return 'WEBVTT\n\n' + segments.map(seg =>
    `${msToVttTime(seg.startMs)} --> ${msToVttTime(seg.endMs)}\n${seg.rawText || seg.text}\n`
  ).join('\n');
}

function toTtml(segments: SubtitleSegment[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xml:lang="zh-CN">
  <head><styling><style xml:id="default" tts:color="white" tts:backgroundColor="black"/></styling></head>
  <body><div>
${segments.map(seg =>
  `    <p begin="${msToVttTime(seg.startMs)}" end="${msToVttTime(seg.endMs)}">${seg.text}</p>`
).join('\n')}
  </div></body>
</tt>`;
}

function toAss(segments: SubtitleSegment[]): string {
  return `[Script Info]
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Alignment
Style: Default,微软雅黑,54,&H00FFFFFF,&H0,&H0,0,2
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${segments.map(seg =>
  `Dialogue: 0,${msToAssTime(seg.startMs)},${msToAssTime(seg.endMs)},Default,,0,0,0,,${seg.text}`
).join('\n')}`;
}

function toFcpxml(segments: SubtitleSegment[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.11">
  <resources>
    <format id="r1" name="FFVideoFormat1080p25" frameDuration="100/2500s" width="1920" height="1080"/>
    <effect id="r2" name="Text" uid=".../Titles.localized/Text.moti"/>
  </resources>
  <library>
    <event name="简盒FCPXML导出"><project name="字幕">
      <sequence format="r1" duration="${msToFcpxmlRational(60000)}" tcStart="0s" tcFormat="NDF">
        <spine>
${segments.map(seg => `          <title ref="r2" lane="1" offset="${msToFcpxmlRational(seg.startMs)}" duration="${msToFcpxmlRational(seg.durationMs)}" start="0s" text="${seg.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}"/>`).join('\n')}
        </spine>
      </sequence></project>
    </event>
  </library>
</fcpxml>`;
}

export const FcpxmlFormat: SubtitleFormat = {
  id: 'fcpxml',
  name: 'Final Cut Pro XML',
  extensions: ['fcpxml', 'fcpxmld'],
  parse: parseFcpxml,
  toSRT: toSrt,
  toVTT: toVtt,
  toTTML: toTtml,
  toASS: toAss,
  toFCPXML: toFcpxml,
};
