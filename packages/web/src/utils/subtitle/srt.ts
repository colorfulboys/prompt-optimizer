// SRT 解析器
// 简盒字幕工坊 v1 - 本地开发版
// 2026-09-17

import { srtTimeToMs, msToSrtTime, msToVttTime, msToAssTime, msToFcpxmlTime, type SubtitleSegment, type SubtitleFormat } from './types';

function parseSrt(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];

  // SRT 格式: \r\n 或 \n 分隔. 字幕块用空行分隔
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n').filter(l => l.trim());
    if (lines.length < 2) continue;

    // 第 1 行: 序号 (可能与时间码同行, 如 "1 00:00:00,000 --> 00:00:01,500")
    let timeLine = '';
    let textStart = 1;

    // 找时间码行
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLine = lines[i];
        textStart = i + 1;
        break;
      }
    }

    if (!timeLine) continue;

    // 解析时间码 "00:00:00,000 --> 00:00:01,500"
    const timeMatch = timeLine.match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/);
    if (!timeMatch) continue;

    const startMs = srtTimeToMs(timeMatch[1]);
    const endMs = srtTimeToMs(timeMatch[2]);

    // 提取文本 (剩余行)
    const text = lines.slice(textStart).join('\n').trim();

    // 清洗 SRT 富文本 (HTML 标签 → ASS 等价)
    // <b>...</b> → {\b1}...{\b0}
    // <i>...</i> → {\i1}...{\i0}
    // <u>...</u> → {\u1}...{\u0}
    // 简单版: 保留 rawText, 清洗为纯文本
    const cleanText = text.replace(/<[^>]+>/g, '');

    // 提取序号 (从第 1 行)
    const indexMatch = lines[0].match(/^\s*(\d+)\s*$/);
    const index = indexMatch ? parseInt(indexMatch[1]) : segments.length + 1;

    segments.push({
      index,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      text: cleanText,
      rawText: text,
    });
  }

  return segments;
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
  <head>
    <styling>
      <style xml:id="default" tts:fontFamily="微软雅黑" tts:fontSize="100%" tts:color="white" tts:backgroundColor="black" tts:textAlign="center"/>
    </styling>
  </head>
  <body>
    <div>
${segments.map(seg =>
  `      <p begin="${msToSrtTime(seg.startMs).replace(',', '.')}" end="${msToSrtTime(seg.endMs).replace(',', '.')}">${seg.text}</p>`
).join('\n')}
    </div>
  </body>
</tt>
`;
}

function toAss(segments: SubtitleSegment[]): string {
  return `[Script Info]
Title: 简盒字幕导出

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,微软雅黑,54,&H00FFFFFF,&H00000000,&H00000000,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${segments.map(seg =>
  `Dialogue: 0,${msToAssTime(seg.startMs)},${msToAssTime(seg.endMs)},Default,,0,0,0,,${seg.text}`
).join('\n')}
`;
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
    <event name="简盒字幕">
      <project name="导出字幕">
        <sequence format="r1" duration="60000/2500s" tcStart="0s" tcFormat="NDF">
          <spine>
${segments.map(seg =>
  `            <title ref="r2" lane="1" offset="${msToFcpxmlTime(seg.startMs)}" duration="${msToFcpxmlTime(seg.durationMs)}" start="0s" text="${seg.text.replace(/"/g, '&quot;')}"/>`
).join('\n')}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}

export const SrtFormat: SubtitleFormat = {
  id: 'srt',
  name: 'SubRip (SRT)',
  extensions: ['srt'],
  parse: parseSrt,
  toSRT: toSrt,
  toVTT: toVtt,
  toTTML: toTtml,
  toASS: toAss,
  toFCPXML: toFcpxml,
};
