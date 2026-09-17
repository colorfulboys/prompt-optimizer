// TTML 解析器
// 简盒字幕工坊 v1

import { srtTimeToMs, msToSrtTime, msToVttTime, type SubtitleSegment, type SubtitleFormat } from './types';

function parseTtml(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];

  // 简单 XML 解析 - 找 <p> 节点
  const paragraphRegex = /<p\s+([^>]*?)>([\s\S]*?)<\/p>/g;
  let match;
  let index = 0;

  while ((match = paragraphRegex.exec(content)) !== null) {
    const attrs = match[1];
    let innerText = match[2].trim();

    // 提取 begin / end 时间 (HH:MM:SS.mmm 或 seconds)
    const beginMatch = attrs.match(/begin=["']([^"']+)["']/);
    const endMatch = attrs.match(/end=["']([^"']+)["']/);
    const styleMatch = attrs.match(/style=["']([^"']+)["']/);
    const regionMatch = attrs.match(/region=["']([^"']+)["']/);

    if (!beginMatch || !endMatch) continue;

    const startMs = parseTtmlTime(beginMatch[1]);
    const endMs = parseTtmlTime(endMatch[1]);

    // 清洗内部 XML 标签
    const cleanText = innerText.replace(/<[^>]+>/g, '').trim();

    index++;
    segments.push({
      index,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      text: cleanText,
      rawText: innerText,
      styleId: styleMatch?.[1],
      position: regionMatch ? { x: undefined, y: undefined } : undefined,
    });
  }

  return segments;
}

function parseTtmlTime(time: string): number {
  // HH:MM:SS.mmm 或 1.5s (秒)
  if (time.endsWith('s')) {
    return Math.round(parseFloat(time) * 1000);
  }
  return srtTimeToMs(time.replace('.', ','));
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
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xml:lang="zh-CN">
  <head>
    <styling>
      <style xml:id="default" tts:fontFamily="微软雅黑" tts:fontSize="100%" tts:color="white" tts:backgroundColor="black" tts:textAlign="center"/>
    </styling>
  </head>
  <body>
    <div>
${segments.map(seg => `      <p begin="${msToVttTime(seg.startMs)}" end="${msToVttTime(seg.endMs)}">${seg.text}</p>`).join('\n')}
    </div>
  </body>
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
    <event name="简盒TTML导出"><project name="字幕">
      <sequence format="r1" duration="60000/2500s" tcStart="0s" tcFormat="NDF">
        <spine>
${segments.map(seg => `          <title ref="r2" lane="1" offset="${fcpxmlTime(seg.startMs)}" duration="${fcpxmlTime(seg.durationMs)}" start="0s" text="${seg.text.replace(/"/g, '&quot;')}"/>`).join('\n')}
        </spine>
      </sequence></project>
    </event>
  </library>
</fcpxml>`;
}

export const TtmlFormat: SubtitleFormat = {
  id: 'ttml',
  name: 'TTML / PR XML / DFXP',
  extensions: ['ttml', 'xml', 'dfxp'],
  parse: parseTtml,
  toSRT: toSrt,
  toVTT: toVtt,
  toTTML: toTtml,
  toASS: toAss,
  toFCPXML: toFcpxml,
};
