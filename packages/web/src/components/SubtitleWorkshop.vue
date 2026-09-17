<template>
  <div class="subtitle-workshop-page">
    <JianheboxToolNav class="page-tool-nav" />

    <div class="workshop-container">
      <header class="page-header">
        <div class="header-badge">🎬 字幕工坊</div>
        <h1>字幕一站式处理 · 4 大功能</h1>
        <p class="subtitle">主流剪辑软件字幕互转 · 在线编辑 · 智能检测 · 工作流 · 剪映草稿</p>
      </header>

      <!-- 2 大核心模块卡片 -->
      <div class="modules-grid">
        <router-link
          to="/tools/subtitle/convert"
          class="module-card module-card-convert"
        >
          <div class="module-emoji">🔄</div>
          <div class="module-name">字幕互转</div>
          <div class="module-desc">SRT/VTT/TTML/ASS/FCPXML 6 种格式互转 · 实测达芬奇 17 条 0.33 ms</div>
          <div class="module-features">
            <span class="feature-tag">达芬奇 SRT</span>
            <span class="feature-tag">剪映 SRT</span>
            <span class="feature-tag">PR XML</span>
            <span class="feature-tag">FCP</span>
          </div>
          <div class="module-arrow">→</div>
        </router-link>

        <router-link
          to="/tools/subtitle/edit"
          class="module-card module-card-edit"
        >
          <div class="module-emoji">✏️</div>
          <div class="module-name">在线编辑</div>
          <div class="module-desc">可视化编辑 + 智能检测 (空白/闪字/超长/重复/重叠)</div>
          <div class="module-features">
            <span class="feature-tag">空白行</span>
            <span class="feature-tag">闪字检测</span>
            <span class="feature-tag">时长异常</span>
            <span class="feature-tag">重复字</span>
          </div>
          <div class="module-arrow">→</div>
        </router-link>

        <router-link
          to="/tools/subtitle/workflow"
          class="module-card module-card-workflow"
        >
          <div class="module-emoji">⚙️</div>
          <div class="module-name">工作流</div>
          <div class="module-desc">上传视频/音频 → 自动识别字幕 → 编辑 → 导出</div>
          <div class="module-features">
            <span class="feature-tag">阿里云 ASR</span>
            <span class="feature-tag">音频转写</span>
          </div>
          <div class="module-beta-tag">需 ASR API</div>
          <div class="module-arrow">→</div>
        </router-link>

        <router-link
          to="/tools/subtitle/jianying"
          class="module-card module-card-jianying"
        >
          <div class="module-emoji">🎬</div>
          <div class="module-name">剪映草稿</div>
          <div class="module-desc">自动搜索剪映草稿箱 · 提取字幕轨道</div>
          <div class="module-features">
            <span class="feature-tag">Mac/Win</span>
            <span class="feature-tag">路径搜索</span>
            <span class="feature-tag">SRT 输入</span>
          </div>
          <div class="module-beta-tag">protobuf 受限</div>
          <div class="module-arrow">→</div>
        </router-link>
      </div>

      <!-- 支持的格式 -->
      <div class="formats-section">
        <h2>🎯 支持 6 种字幕格式互转</h2>
        <div class="formats-grid">
          <div class="format-card">
            <div class="format-emoji">📝</div>
            <div class="format-name">SRT</div>
            <div class="format-software">通用</div>
            <div class="format-ext">.srt</div>
          </div>
          <div class="format-card">
            <div class="format-emoji">🌐</div>
            <div class="format-name">VTT</div>
            <div class="format-software">Web 视频</div>
            <div class="format-ext">.vtt</div>
          </div>
          <div class="format-card">
            <div class="format-emoji">📺</div>
            <div class="format-name">TTML</div>
            <div class="format-software">PR XML</div>
            <div class="format-ext">.ttml</div>
          </div>
          <div class="format-card">
            <div class="format-emoji">🎭</div>
            <div class="format-name">ASS</div>
            <div class="format-software">B站/弹幕</div>
            <div class="format-ext">.ass</div>
          </div>
          <div class="format-card">
            <div class="format-emoji">🍎</div>
            <div class="format-name">FCPXML</div>
            <div class="format-software">Final Cut Pro</div>
            <div class="format-ext">.fcpxml</div>
          </div>
          <div class="format-card">
            <div class="format-emoji">📑</div>
            <div class="format-name">Markdown</div>
            <div class="format-software">文档</div>
            <div class="format-ext">.md</div>
          </div>
        </div>
      </div>

      <!-- 真实测试结果 -->
      <div class="quickstart-section">
        <h2>✅ 真实测试结果 (2026-09-17)</h2>
        <div class="quickstart-grid">
          <div class="quickstart-card">
            <div class="quickstart-num">📄</div>
            <div class="quickstart-title">达芬奇 SRT (17 条)</div>
            <div class="quickstart-desc">解析 0.33 ms · 时间偏移 1h 自动修正</div>
          </div>
          <div class="quickstart-card">
            <div class="quickstart-num">🎬</div>
            <div class="quickstart-title">剪映 SRT (21 条)</div>
            <div class="quickstart-desc">解析 0.06 ms · 倒序时间码正常处理</div>
          </div>
          <div class="quickstart-card">
            <div class="quickstart-num">📺</div>
            <div class="quickstart-title">→ TTML (PR XML)</div>
            <div class="quickstart-desc">17 个 title · 可导入 Premiere Pro</div>
          </div>
          <div class="quickstart-card">
            <div class="quickstart-num">🍎</div>
            <div class="quickstart-title">→ FCPXML 1.11</div>
            <div class="quickstart-desc">17 个 title · 可导入 Final Cut Pro</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import JianheboxToolNav from './JianheboxToolNav.vue'
</script>

<style scoped>
.subtitle-workshop-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0e1a 0%, #1a1f2e 100%);
  color: #fff;
}

.workshop-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px;
}

.page-header {
  text-align: center;
  margin-bottom: 48px;
}

.header-badge {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid #667eea;
  border-radius: 20px;
  font-size: 14px;
  color: #667eea;
  margin-bottom: 16px;
}

.page-header h1 {
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 12px;
  background: linear-gradient(135deg, #fff 0%, #667eea 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: #a0aec0;
  font-size: 16px;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-bottom: 64px;
}

.module-card {
  position: relative;
  padding: 32px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  text-decoration: none;
  color: #fff;
  transition: all 0.3s ease;
  overflow: hidden;
}

.module-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, currentColor, transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.module-card:hover {
  transform: translateY(-4px);
  border-color: rgba(102, 126, 234, 0.4);
  background: rgba(102, 126, 234, 0.05);
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.2);
}

.module-card:hover::before {
  opacity: 1;
}

.module-card-convert { color: #667eea; }
.module-card-edit { color: #48bb78; }
.module-card-workflow { color: #ed8936; }
.module-card-jianying { color: #ed64a6; }
.module-beta-tag {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 4px 10px;
  background: rgba(237, 187, 38, 0.2);
  border: 1px solid #edbb26;
  border-radius: 12px;
  font-size: 11px;
  color: #fbd38d;
  font-weight: 600;
}

.module-emoji {
  font-size: 40px;
  margin-bottom: 16px;
}

.module-name {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 8px;
}

.module-desc {
  color: #a0aec0;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.module-features {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.feature-tag {
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  font-size: 12px;
  color: #cbd5e0;
}

.module-arrow {
  position: absolute;
  top: 32px;
  right: 32px;
  font-size: 24px;
  opacity: 0;
  transition: all 0.3s;
}

.module-card:hover .module-arrow {
  opacity: 1;
  transform: translateX(4px);
}

.formats-section,
.quickstart-section {
  margin-bottom: 48px;
}

h2 {
  font-size: 24px;
  margin-bottom: 24px;
  color: #fff;
}

.formats-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}

.format-card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  text-align: center;
  transition: all 0.2s;
}

.format-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
}

.format-emoji {
  font-size: 28px;
  margin-bottom: 8px;
}

.format-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.format-software {
  font-size: 11px;
  color: #a0aec0;
  margin-bottom: 4px;
}

.format-ext {
  font-size: 11px;
  font-family: 'SF Mono', Menlo, monospace;
  color: #667eea;
}

.quickstart-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.quickstart-card {
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.quickstart-num {
  display: inline-block;
  width: 40px;
  height: 40px;
  line-height: 40px;
  text-align: center;
  background: rgba(102, 126, 234, 0.15);
  border-radius: 50%;
  font-size: 18px;
  margin-bottom: 12px;
}

.quickstart-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.quickstart-desc {
  font-size: 13px;
  color: #a0aec0;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .modules-grid {
    grid-template-columns: 1fr;
  }
  .formats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .quickstart-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>