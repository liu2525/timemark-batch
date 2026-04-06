# Timemark Batch

批量生成多语言广告图的 Figma 插件。选中主组件后，一键为多个国家/语言生成广告实例，自动翻译标题、副标题、CTA 文案，并保留原始高亮颜色样式。

---

## 功能

- **批量生成**：从一个 Main Component 生成多个国家版本的广告实例
- **自动翻译**：标题、副标题、CTA 文字自动翻译为目标语言（支持 Google / DeepL / Microsoft）
- **高亮保留**：翻译后自动将原始高亮颜色（如黄色关键词）应用到对应译文位置
- **水印生成**：自动填写日期、星期、地址水印，按各地区语言格式输出
- **背景 & 照片替换**：支持本地上传或 AI 生成行业背景图与示例照片
- **多方案保存**：可保存多套配置方案，快速切换

---

## 安装方法

> 需要 **Figma 桌面版**，网页版不支持插件导入。

1. 前往 [Releases 页面](../../releases) 下载最新的 `TimemarBatch-plugin.zip`
2. 解压文件
3. 打开 Figma 桌面版
4. 菜单 → **Plugins → Development → Import plugin from manifest...**
5. 选择解压后文件夹中的 `manifest.json`
6. 完成 ✓ 插件出现在 **Plugins → Development** 列表中

---

## 使用流程

### 1. 选中 Main Component
在画布上选中广告模板的 Main Component（或 Component Set）。

### 2. 配置翻译
- 在底部选择翻译服务（Google / DeepL / Microsoft）
- 勾选需要生成的国家

### 3. 批量翻译
点击 **批量翻译** — 插件会自动：
- 扫描组件内所有文字
- 翻译为各目标语言
- 识别并保留标题中的高亮颜色

### 4. 生成
点击 **生成** — 在画布上批量生成各语言版本的广告实例。

---

## 图层命名规范

插件按图层名称识别各功能区域，请确保 Main Component 内图层命名如下：

| 图层名 | 说明 |
|--------|------|
| `headline` | 主标题文字（支持混色高亮） |
| `subheadline` | 副标题文字 |
| `bg` | 背景图矩形 |
| `mockup/photo` | 示例照片矩形 |
| `watermark` | 水印容器（内含 `date` / `weekday` / `address` 子图层） |

---

## 翻译服务配置

在插件右上角 ⚙️ 设置中填入 API Key：

| 服务 | 免费额度 | 获取地址 |
|------|---------|---------|
| Google Translate | 每月 50 万字符 | [Google Cloud Console](https://console.cloud.google.com) |
| DeepL | 每月 50 万字符 | [deepl.com/pro](https://www.deepl.com/pro) |
| Microsoft Translator | 每月 200 万字符 | [Azure Portal](https://portal.azure.com) |

不填 Key 时默认使用 Google 免费接口（无需配置，有频率限制）。

---

## 支持的语言

🇺🇸 英语 · 🇯🇵 日语 · 🇰🇷 韩语 · 🇩🇪 德语 · 🇫🇷 法语 · 🇧🇷 葡萄牙语(巴西) · 🇲🇽 西班牙语 · 🇮🇩 印尼语 · 🇻🇳 越南语 · 🇹🇭 泰语 · 🇸🇦 阿拉伯语
