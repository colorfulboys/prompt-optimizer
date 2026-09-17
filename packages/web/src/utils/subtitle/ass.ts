// ASS 解析器
// 简盒字幕工坊 v1

import { type SubtitleSegment, type SubtitleFormat } from './types';

function parseAss(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const lines = content.split(/\r?\n/);

  let inEvents = false;
  let index = 0;
  let format: string[] = []; // Format 行的列定义

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith('[')) {
      inEvents = line.toUpperCase().startsWith('[EVENTS]');
      continue;
    }

    if (line.startsWith('Format:')) {
      format = line.substring(7).split(',').map(s => s.trim());
      continue;
    }

    if (!inEvents) continue;
    if (!line.startsWith('Dialogue:')) continue;

    // 解析 Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,文本
    const parts = line.substring(9).split(',');
    if (parts.length < format.length) continue;

    // 按 Format 顺序: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    const startTime = parts[format.indexOf('Start')] || parts[1];
    const endTime = parts[format.indexOf('End')] || parts[2];
    const textRaw = parts.slice(9).join(',');

    const startMs = assTimeToMs(startTime);
    const endMs = assTimeToMs(endTime);

    // 提取 {\b1} 样式标签
    // {\b1}...{\b0} = bold
    // 简化版: 保留原始文本 (前端 UI 解析 {\b1})

    const cleanText = textRaw.replace(/\{[^}]+\}/g, '').replace(/\\N/g, '\n').trim();

    // 提取说话人 (Name 字段)
    const nameIdx = format.indexOf('Name');
    const speaker = nameIdx >= 0 ? parts[nameIdx] : undefined;

    index++;
    segments.push({
      index,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      text: cleanText,
      rawText: textRaw,
      speaker,
    });
  }

  return segments;
}

function assTimeToMs(time: string): number {
  // H:MM:SS.cs (centiseconds)
  const match = time.match(/(\d+):(\d+):(\d+)\.(\d+)/);
  if (!match) return 0;
  const [, h, m, s, cs] = match;
  return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(cs) * 10;
}

function toSrt(segments: SubtitleSegment[]): string {
  return segments.map(seg =>
    `${seg.index}\n${(msToSrtTime(seg.startMs)).replace(',', ',')} --> ${(msToSrtTime(seg.endMs)).replace(',', ',')}\n${seg.rawText || seg.text}\n`
  ).join('\n');
}

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`;
}

function msToVttTime(ms: number): string {
  return msToSrtTime(ms).replace(',', '.');
}

function msToAssTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
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
Title: 简盒 ASS 导出

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,微软雅黑,54,&H00FFFFFF,&H00000000,&H00000000,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${segments.map(seg =>
  `Dialogue: 0,${msToAssTime(seg.startMs)},${msToAssTime(seg.endMs)},Default,,0,0,0,,${seg.rawText || seg.text}`
).join('\n')}`;
}

function toFcpxml(segments: SubtitleSegment[]): string {
  const fcpxmlTime = (ms: number) => `${Math.round(ms/40)}/25s`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.11">
  <resources>
    <format id="r1" name="FFVideoFormat1080p25" frameDuration="100/2500s" width="1920" height="1080"/>
    <effect id="r2" name="Text" uid=".../Titles.localized/Text.moti"/>
  </resources>
  <library>
    <event name="简盒ASS导出"><project name="字幕">
      <sequence format="r1" duration="60000/2500s" tcStart="0s" tcFormat="NDF">
        <spine>
${segments.map(seg => `          <title ref="r2" lane="1" offset="${fcpxmlTime(seg.startMs)}" duration="${fcpxmlTime(seg.durationMs)}" start="0s" text="${seg.text.replace(/"/g, '&quot;')}"/>`).join('\n')}
        </spine>
      </sequence></project>
    </event>
  </library>
</fcpxml>`;
}

export const AssFormat: SubtitleFormat = {
  id: 'ass',
  name: 'ASS/SSA',
  extensions: ['ass', 'ssa'],
  parse: parseAss,
  toSRT: toSrt,
  toVTT: toVtt,
  toTTML: toTtml,
  toASS: toAss,
  toFCPXML: toFcpxml,
};
