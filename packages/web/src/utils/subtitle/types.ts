// packages/ui/src/utils/subtitle-formats/types.ts
// 统一字幕接口 - 简盒字幕工坊 v1
// 2026-09-17 本地开发版

export interface SubtitleSegment {
  index: number;          // 1-based
  startMs: number;         // 统一毫秒
  endMs: number;           // 统一毫秒
  durationMs: number;      // 自动 = endMs - startMs
  text: string;            // 清洗后纯文本
  speaker?: string;        // 说话人 (FCPXML role / VTT <v>)
  styleId?: string;        // 样式引用 (TTML style id)
  rawText?: string;        // 原始带格式的文本 (含 <b>, \b1, etc.)
  position?: {             // 位置 (FCPXML lane / TTML region)
    x?: number;
    y?: number;
  };
}

export interface SubtitleFormat {
  id: string;
  name: string;
  extensions: string[];
  parse(content: string): SubtitleSegment[];
  toSRT(segments: SubtitleSegment[]): string;
  toVTT(segments: SubtitleSegment[]): string;
  toTTML(segments: SubtitleSegment[]): string;
  toASS(segments: SubtitleSegment[]): string;
  toFCPXML(segments: SubtitleSegment[]): string;
}

// 工具函数: SRT 时间码 → 毫秒
export function srtTimeToMs(time: string): number {
  // 00:00:23,933 or 00:00:23.933
  const match = time.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(ms);
}

// 毫秒 → SRT 时间码
export function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`;
}

// 毫秒 → VTT 时间码 (用 . 不是 ,)
export function msToVttTime(ms: number): string {
  return msToSrtTime(ms).replace(',', '.');
}

// 毫秒 → ASS 时间码 (H:MM:SS.cs - centiseconds)
export function msToAssTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// 毫秒 → FCPXML rational time (1/24000s = 23.976fps frame)
export function msToFcpxmlTime(ms: number, fps = 25): string {
  const frameDuration = 1 / fps;
  const frames = Math.round(ms / 1000 / frameDuration);
  return `${frames}/${Math.round(1/frameDuration)}s`;
}
