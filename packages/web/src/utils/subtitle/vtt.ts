// VTT 解析器
// 简盒字幕工坊 v1

import { srtTimeToMs, msToSrtTime, msToVttTime, type SubtitleSegment, type SubtitleFormat } from './types';

function parseVtt(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  let i = 0;
  // 跳过 WEBVTT 头
  if (lines[0]?.trim().startsWith('WEBVTT')) i = 1;

  let index = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // 跳过 NOTE / STYLE / REGION 块
    if (line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) {
      while (i < lines.length && lines[i].trim() !== '') i++;
      continue;
    }

    // 跳过空行
    if (!line) { i++; continue; }

    // 找时间码行 (可能前面有 cue identifier)
    let timeLine = line;
    if (!line.includes('-->')) {
      if (i + 1 < lines.length) {
        timeLine = lines[++i].trim();
      } else {
        i++;
        continue;
      }
    }

    // 解析 "00:00:00.000 --> 00:00:02.000" 或带 settings
    const timeMatch = timeLine.match(/(\d+:\d+:\d+\.\d+|\d+:\d+\.\d+)\s*-->\s*(\d+:\d+:\d+\.\d+|\d+:\d+\.\d+)/);
    if (!timeMatch) { i++; continue; }

    const startMs = srtTimeToMs(timeMatch[1].replace('.', ','));
    const endMs = srtTimeToMs(timeMatch[2].replace('.', ','));

    // 收集文本行 (直到空行)
    i++;
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i]);
      i++;
    }

    let text = textLines.join('\n').trim();

    // 提取 <v Speaker> 说话人
    let speaker: string | undefined;
    const vMatch = text.match(/^<v\s+([^>]+)>(.*)/s);
    if (vMatch) {
      speaker = vMatch[1];
      text = vMatch[2].replace(/<\/v>/g, '').trim();
    }

    // 提取位置信息
    const settingsMatch = timeLine.match(/\[([^\]]+)\]/);
    const position = settingsMatch ? settingsMatch[1] : undefined;

    index++;
    segments.push({
      index,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      text: text.replace(/<[^>]+>/g, ''),
      rawText: text,
      speaker,
      position: position ? { x: undefined, y: undefined } : undefined,
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
  return 'WEBVTT\n\n' + segments.map(seg => {
    let line = `${msToVttTime(seg.startMs)} --> ${msToVttTime(seg.endMs)}`;
    if (seg.position) line += ` ${seg.position}`;
    if (seg.speaker) {
      return `${line}\n<v ${seg.speaker}>${seg.rawText || seg.text}</v>\n`;
    }
    return `${line}\n${seg.rawText || seg.text}\n`;
  }).join('\n');
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
  return `[Script Info]\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Alignment\nStyle: Default,微软雅黑,54,&H00FFFFFF,&H0,&H0,0,2\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${segments.map(seg => {
  const h = Math.floor(seg.startMs/3600000);
  const m = Math.floor((seg.startMs%3600000)/60000);
  const s = Math.floor((seg.startMs%60000)/1000);
  const cs = Math.floor((seg.startMs%1000)/10);
  const startTime = `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  const h2 = Math.floor(seg.endMs/3600000);
  const m2 = Math.floor((seg.endMs%3600000)/60000);
  const s2 = Math.floor((seg.endMs%60000)/1000);
  const cs2 = Math.floor((seg.endMs%1000)/10);
  const endTime = `${h2}:${String(m2).padStart(2,'0')}:${String(s2).padStart(2,'0')}.${String(cs2).padStart(2,'0')}`;
  return `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${seg.text}`;
}).join('\n')}`;
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
    <event name="简盒VTT导出"><project name="字幕">
      <sequence format="r1" duration="60000/2500s" tcStart="0s" tcFormat="NDF">
        <spine>
${segments.map(seg => `          <title ref="r2" lane="1" offset="${fcpxmlTime(seg.startMs)}" duration="${fcpxmlTime(seg.durationMs)}" start="0s" text="${seg.text.replace(/"/g, '&quot;')}"/>`).join('\n')}
        </spine>
      </sequence></project>
    </event>
  </library>
</fcpxml>`;
}

export const VttFormat: SubtitleFormat = {
  id: 'vtt',
  name: 'WebVTT',
  extensions: ['vtt'],
  parse: parseVtt,
  toSRT: toSrt,
  toVTT: toVtt,
  toTTML: toTtml,
  toASS: toAss,
  toFCPXML: toFcpxml,
};
