# 画师串功能重构设计规划

> 状态：设计稿 v3（已按“最多 5 张参考图 / 无封面 / 卡片进详情再编辑 / 草稿可清空”调整）
> 范围：前端画师串编辑 / 全局草稿入口 / 工具页格式转换 / 多张参考样图 / 数据导入导出
> 关键词：单一格式、草稿悬浮入口、统一解析器、多图参考、草稿清空、备份 v2

---

## 0. 设计结论摘要

1. **画师串只保存一种格式**：数据模型新增 `format`（`noob` / `nai`）与 `text`（所选格式的字符串），不再同时保存两份。
2. **编辑器只保留一个画师串输入框**：粘贴整串后自动识别 NOOB / NAI 与权重，下方保留 tag 芯片的拖拽排序、单击选中、双击删除、权重 ±0.1。
3. **格式转换从编辑器移除**：编辑器里的格式切换只负责“按目标格式重新渲染”；完整的 NOOB ⇄ NAI 转换作为一个独立工具放进工具页。
4. **草稿全局可达**：草稿有内容时，在任意页面右下角显示悬浮图标（带画师数量角标），点击直接打开画师串编辑弹窗；“一键回顶”改为在该图标上方自动让位。
5. **草稿可清空**：草稿编辑弹窗内提供「清空草稿」按钮，二次确认后同时清除文字草稿与草稿参考图，悬浮图标随之消失。
6. **支持多张参考样图**：每个画师串最多保存 5 张参考图，编辑器内批量上传、预览、删除；**不设封面**，列表卡片保持现有轻量样式（以名称展示为主，不显示图片），删除画师串时同步清理所有文件。
7. **参考图不参与导出导入**：备份中的画师串只包含**名称 / 格式（noob 或 nai）/ 内容**三项；参考图只保存在本机数据目录，导入时不会覆盖或恢复参考图。
8. **卡片 → 详情 → 编辑**：点击卡片先打开详情弹窗，详情中展示参考图与画师串内容；内容点击即复制；只有再点「编辑」才进入编辑模式，避免误触直接修改。
9. **解析逻辑统一**：抽取 `lib/artistString.ts` 作为唯一解析 / 识别 / 生成实现，编辑器与工具页共用，顺带修掉现有“按逗号硬切分导致 NAI 分组权重解析错误”等问题。

---

## 1. 现状与问题

### 1.1 现有链路

- 画师页卡片菜单「添加到画师串」→ 写入 `localStorage.preset_draft` 的 `noobTags` / `naiTags` 两个数组。
- 用户必须自行切换到 `/presets` 页面，点击「创建画师串」，弹窗里才读取草稿。
- 编辑器同时维护 NOOB 与 NAI 两套 tag，保存时两套字符串一起写入 `artist_presets.noob_text` / `nai_text`。
- 编辑器中间有「转换格式」按钮，逻辑是“一套为空时从另一套生成”。
- 设置页导出只包含 `categories` 与 `artists`，**完全不包含画师串**；导入时也不处理画师串。
- 画师串表没有格式字段，也没有参考图能力。
- 右下角「回到顶部」按钮目前只存在于画师页，固定 `bottom-6 right-6 z-20`。

### 1.2 主要痛点

| 痛点 | 说明 |
| --- | --- |
| 入口割裂 | 添加画师后必须切页、再点创建，草稿没有全局可见的继续入口 |
| 双格式冗余 | 两种格式同时保存，编辑时要在两套 tag 间来回切换，数据也容易不同步 |
| 解析不可靠 | `parseNoobStr` / `parseNaiStr` 按逗号直接切分，NAI 的 `1.2::artist:a, artist:b::` 分组权重会被切碎；NOOB 嵌套括号的解析逻辑分散在 keydown 回调里 |
| 转换入口拥挤 | 转换功能与编辑、权重、拖拽挤在一个弹窗里，职责不清 |
| 草稿不可清空 | 现有草稿只能靠保存成功或手工清 localStorage 清掉，缺少显式入口 |
| 备份不完整 | 导出丢画师串；导入后画师串需要手工重建 |
| 缺少参考图 | 画师串只有文字，无法保存构图 / 风格参考样图 |
| 悬浮按钮冲突 | 全局草稿入口与画师页回顶按钮都在右下角，需要统一层级与位置规则 |

### 1.3 现状代码地图

| 文件 | 现状职责 | 本次处理 |
| --- | --- | --- |
| `frontend/src/pages/PresetsPage.tsx` | 列表 + 编辑弹窗 + 双格式解析 + 拖拽（1524 行） | 大幅瘦身：只保留列表展示；编辑弹窗抽成全局组件；解析抽到 lib |
| `frontend/src/pages/ArtistsPage.tsx` | `addToPresetDraft` 同时写两套 tag；回顶按钮 | 改为写统一草稿；回顶按钮与悬浮入口协调位置 |
| `frontend/src/pages/ToolsPage.tsx` | 占位“开发中” | 新增格式转换工具卡片 |
| `frontend/src/pages/SettingsPage.tsx` | 导出 / 导入分类与画师 | 增加画师串；明确提示参考图不参与备份 |
| `frontend/src/components/layout/MainLayout.tsx` | 侧边栏 / 移动端顶栏 | 挂载全局悬浮入口与全局编辑弹窗宿主 |
| `frontend/src/lib/api.ts` | 画师串仅 4 个基础接口 | 扩展 `Preset` 类型、多图接口 |
| `backend/database.py` | `artist_presets` 四列 | 增加 `format` / `text`，新增 `artist_preset_images` 表，写迁移 |
| `backend/app.py` | 画师串 CRUD + 导出导入 | 重构 CRUD，增加多图接口，导出导入 v2 |
| `backend/booru_base.py` | `IMAGES_DIR` / `BACKGROUNDS_DIR` | 新增 `PRESET_IMAGES_DIR` |

---

## 2. 目标与非目标

### 2.1 目标

- 从画师页添加画师后，**无需切换页面**即可通过全局悬浮图标打开编辑器并保存。
- 画师串保存时**只选择并保存一种格式**，编辑器仍支持粘贴、拖拽、权重调整。
- 提供独立的 **NOOB ⇄ NAI 格式转换工具**，支持自动识别、权重保留、复制结果。
- 画师串支持**多张参考样图**（最多 5 张）上传、预览、删除；参考图仅本机保存。
- 点击画师串卡片先进入**详情弹窗**：查看参考图、点击复制画师串内容；再点「编辑」才进入编辑模式。
- 草稿编辑时提供**显式清空入口**，文字与参考图一起清空。
- 导出数据包含画师串的**名称 / 格式 / 内容**；导入可恢复，且兼容旧备份。
- 解析 / 识别 / 生成的逻辑只有一份实现，编辑器与工具页行为一致。

### 2.2 非目标

- **参考图不参与导出导入**：备份文件不内嵌图片，也不恢复图片；这是本期明确的产品边界。
- 不做参考图的云端同步、图床、去重、AI 打标。
- 不引入多用户 / 权限体系。
- 不做画师串版本历史、多人协作。
- 不改变画师管理、分类管理、Danbooru / Gelbooru 抓取逻辑。
- 本次不重做画师图片的备份导出（现状导入会清空画师封面；可作为后续独立优化项）。
- 不新增独立的画师串详情路由页；详情与编辑都使用弹窗，详情内再进入编辑。

---

## 3. 核心设计决策

| 决策点 | 方案 | 理由 |
| --- | --- | --- |
| 画师串格式 | 单字段 `format` + 单字段 `text` | 符合“只能选择一种保存”，消除双份数据不同步 |
| 标签模型 | `ArtistTag { name, weight }`，`name` 存**纯名称**（不含 `artist:`、不含转义） | 转换、去重、显示都简单；格式只在生成时套用 |
| 编辑器输入 | 一个整串 textarea + 下方 tag 芯片区 | 满足粘贴整串自动识别；芯片负责拖拽与权重 |
| 编辑器格式切换 | 切换后立即按新格式重渲染字符串 | 保留便利性，但不是完整“转换工具” |
| 完整格式转换 | 工具页独立卡片，纯前端 | 与编辑职责分离，可独立复制 / 对照 |
| 草稿形态 | 元数据存 `localStorage` v2；草稿参考图 Blob 存 IndexedDB | 多图体积大，放 localStorage 容易超限；元数据同步读取，FAB 不闪烁 |
| 草稿清空 | 编辑器内「清空草稿」+ 二次确认 | 同时清元数据、tag、文字与 IndexedDB 中的草稿图 |
| 参考图数量 | 多张，**上限 5 张/画师串** | 满足“参考样图”需求，同时控制存储与请求规模 |
| 卡片样式 | 保持现有轻量卡片，不显示封面 / 缩略图 | 用户确认现有仅名称的卡片样式更好，图片放在详情弹窗 |
| 卡片交互 | 点击卡片 → 详情弹窗 → 点「编辑」才进入编辑器 | 查看、复制、编辑分离，避免误触 |
| 详情复制 | 画师串内容区域整块可点击复制 | 符合“内容可以点击复制”的操作习惯 |
| 参考图存储 | 后端 `preset_images/` + `artist_preset_images` 表 | 一图一行，便于单张删除与排序；删除画师串时统一清理 |
| 备份内容 | 画师串仅 `name` / `format` / `text` | 按需求不导出参考图，也不导出描述；文件保持轻量 |
| 旧数据迁移 | 优先取 `noob_text`，为空则取 `nai_text` | 大多数旧数据以 NOOB 为主；保留旧列以便回滚 / 旧备份兼容 |
| 格式识别歧义 | 有明确特征才自动切换；纯名称默认 NOOB 并提示 | 避免用户粘贴纯名称时格式乱跳 |

---

## 4. 数据模型

### 4.1 前端统一模型

新增 `frontend/src/lib/artistString.ts`：

```ts
export type ArtistFormat = 'noob' | 'nai'

export interface ArtistTag {
  name: string   // 纯名称，如 "fuzichoco"、"hatsune miku"、"foo (bar)"
  weight: number // 1 表示无权重
}

export type DetectedFormat = ArtistFormat | 'plain' | 'mixed'

export interface ParseResult {
  tags: ArtistTag[]
  detected: DetectedFormat
  hasWeights: boolean
  warnings: string[] // 例如“第 3 段无法识别，已按纯名称处理”
}

export function parseArtistString(text: string, fallbackFormat?: ArtistFormat): ParseResult
export function detectArtistFormat(text: string): DetectedFormat
export function formatArtistString(tags: ArtistTag[], format: ArtistFormat): string
export function normalizeArtistName(name: string): string
export function convertArtistString(text: string, target: ArtistFormat): {
  text: string
  tags: ArtistTag[]
  source: DetectedFormat
}
```

要点：

- `name` 统一为纯名称：去掉 `artist:` 前缀、把 `_` 还原为空格、还原 `\(` / `\)`。
- 生成时：
  - NOOB：`escapeParens(name)`；有权重时 `(name:1.2)`。
  - NAI：`artist:name`；有权重时 `1.2::artist:name::`。
  - NAI 连续同权重标签合并为一组，如 `1.2::artist:a, artist:b::`，更贴近常见写法。
- 权重显示不强制一位小数：`1`、`1.1`、`1.25` 原样保留；调整时按 0.1 步进，范围 0.1–2.0。
- 重复标签按 `name.toLowerCase()` 去重，保留首次出现的位置与权重。

### 4.2 草稿模型与迁移

新增 `frontend/src/lib/presetDraft.ts`，草稿元数据 key 仍使用 `preset_draft`，用 `version` 区分：

```ts
export interface DraftImageRef {
  key: string      // IndexedDB 中的主键
  name: string     // 原始文件名，仅用于展示
  width?: number
  height?: number
}

export interface PresetDraftV2 {
  version: 2
  name: string
  description: string
  format: ArtistFormat
  text: string
  tags: ArtistTag[]
  images: DraftImageRef[]
  updatedAt: string
}
```

旧结构：

```ts
// v1（现状）
{ name, description, noobTags, naiTags }
```

迁移规则：

1. `noobTags` 非空 → `format: 'noob'`，来源取 `noobTags`。
2. 否则 `naiTags` 非空 → `format: 'nai'`，来源取 `naiTags`。
3. 两套都有时优先 `noobTags`。
4. 对每个名称执行 `normalizeArtistName`，合并重复项。
5. `text = formatArtistString(tags, format)`，`images = []`。
6. 迁移后的对象立即写回 `preset_draft`，避免每次读取都迁移。

草稿模块对外 API：

```ts
export function getPresetDraft(): PresetDraftV2 | null
export function updatePresetDraft(
  patch: Partial<PresetDraftV2> | ((d: PresetDraftV2) => PresetDraftV2)
): void
export function clearPresetDraft(): Promise<void> // 同时清理 IndexedDB 图片
export function hasDraftContent(draft: PresetDraftV2 | null): boolean
export function usePresetDraft(): PresetDraftV2 | null
```

实现细节：

- 用模块级缓存 + `useSyncExternalStore`，避免每次渲染都 `JSON.parse` 导致快照不稳定。
- 监听 `window.storage` 事件，支持多标签页同步元数据；图片以 IndexedDB 为准。
- `hasDraftContent` 判定：`tags.length > 0 || name.trim() || description.trim() || images.length > 0`。
- 清空草稿是异步操作：先删元数据，再删 IndexedDB 中的图片 key；即使删图失败，元数据也已清空，孤儿图片由启动时的清理逻辑兜底。

### 4.3 草稿参考图存储

新增 `frontend/src/lib/draftImageStore.ts`，使用原生 IndexedDB（不新增依赖）：

```
DB:        monxia_drafts
Store:     images
Key:       字符串（时间戳 + 随机串）
Value:     { blob: Blob, name: string, width: number, height: number }
```

流程：

1. 选择图片 → 校验格式 / 大小 → Canvas 压缩（最长边 2048、JPEG 0.85）→ 存 Blob 到 IndexedDB。
2. 元数据 `PresetDraftV2.images` 只记录 `{ key, name, width, height }`。
3. 编辑器打开时，按 key 读取 Blob 并 `URL.createObjectURL` 生成预览；卸载时统一 `revokeObjectURL`。
4. 删除某张图 → 从元数据移除 + 删除对应 IndexedDB 记录 + 释放预览 URL。
5. 保存成功 / 清空草稿 → 删除所有草稿图片 key，并清空未被引用的孤儿记录。
6. IndexedDB 不可用（隐私模式 / 老浏览器）→ 退化为内存预览，提示“刷新后草稿图片会丢失”，文字草稿仍可保存。

为什么不用 localStorage 存多图：

- localStorage 通常只有 5MB，多张 base64 图片很快超限；
- 多图 debounce 写入会频繁序列化大字符串，影响输入流畅度；
- IndexedDB 可直接存 Blob，容量与性能都更合适。

### 4.4 数据库结构

`artist_presets` 迁移后逻辑结构：

```sql
CREATE TABLE artist_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    format TEXT NOT NULL DEFAULT 'noob', -- 'noob' | 'nai'
    text TEXT DEFAULT '',                -- 所选格式的完整字符串
    noob_text TEXT DEFAULT '',           -- 旧列，保留但不再作为主数据
    nai_text TEXT DEFAULT '',            -- 旧列，保留但不再作为主数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

新增多图表：

```sql
CREATE TABLE IF NOT EXISTS artist_preset_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (preset_id) REFERENCES artist_presets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_preset_images_preset
    ON artist_preset_images(preset_id, display_order);
```

> SQLite 连接当前没有开启 `PRAGMA foreign_keys=ON`，因此级联删除不能依赖数据库，需要在应用层显式删除图片记录与文件。

迁移在 `init_db()` 中幂等执行：

```python
cols = {row['name'] for row in cursor.execute("PRAGMA table_info(artist_presets)")}
if 'format' not in cols:
    cursor.execute("ALTER TABLE artist_presets ADD COLUMN format TEXT NOT NULL DEFAULT 'noob'")
if 'text' not in cols:
    cursor.execute("ALTER TABLE artist_presets ADD COLUMN text TEXT DEFAULT ''")
```

回填：

```sql
UPDATE artist_presets
SET text = CASE
        WHEN TRIM(COALESCE(noob_text, '')) <> '' THEN noob_text
        ELSE COALESCE(nai_text, '')
    END,
    format = CASE
        WHEN TRIM(COALESCE(noob_text, '')) <> '' THEN 'noob'
        ELSE 'nai'
    END
WHERE TRIM(COALESCE(text, '')) = '';
```

- 旧列保留一轮版本，避免迁移后旧版本程序或旧备份脚本直接报错；新 API 不再读写这两列。
- 如需双写兼容，可在保存时把 `text` 同步写进对应旧列、另一列置空（推荐做，成本很低）。
- 图片文件目录：`PRESET_IMAGES_DIR = DATA_DIR / 'preset_images'`，启动时创建。
- 图片文件名：`<preset_id>_<uuid4_hex>.jpg`，避免浏览器缓存旧图。

### 4.5 API 设计

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/presets` | 返回预设列表，每条带 `images: PresetImage[]`，按 `updated_at DESC` |
| POST | `/api/presets` | body：`{ name, description, format, text }`；返回 `{ id }` |
| PUT | `/api/presets/<id>` | 同上；校验名称唯一，冲突返回 409 中文提示 |
| DELETE | `/api/presets/<id>` | 删除记录、图片记录与所有图片文件 |
| POST | `/api/presets/<id>/images` | multipart，字段 `files` 可重复；单次可传多张，返回新建的图片记录 |
| DELETE | `/api/presets/<id>/images/<image_id>` | 删除单张参考图与文件 |
| GET | `/preset-images/<filename>` | 静态图片访问（与 `/images` 一致，不加登录校验） |
| GET | `/api/export/json` | 导出 v2，画师串仅含 `name` / `format` / `text` |
| POST | `/api/import/json-stream` | 兼容 v1 / v2，新增 `presets` 阶段 |

后端校验：

- `name`：去空格后 1–100 字符，唯一。
- `description`：≤ 500 字符。
- `text`：≤ 20000 字符。
- `format`：仅接受 `noob` / `nai`。
- 图片：仅 JPG / PNG / WebP / GIF，单张 ≤ 15MB；Pillow 打开校验，等比缩到最长边 2048，JPEG q82 保存。
- 每个画师串最多 5 张参考图；超限返回 400 中文提示，整批不写入。
- 上传多张时逐张处理，返回成功与失败明细；失败不阻断其他图片。

前端 `api.ts` 类型调整：

```ts
export type PresetFormat = 'noob' | 'nai'

export interface PresetImage {
  id: number
  filename: string
  display_order: number
}

export interface Preset {
  id: number
  name: string
  description: string
  format: PresetFormat
  text: string
  images: PresetImage[]
  created_at: string
  updated_at: string
}

presetApi.create(data: { name; description; format; text })
presetApi.update(id, data)
presetApi.uploadImages(id, files: File[])
presetApi.deleteImage(id, imageId)
```

---

## 5. 交互与界面设计

### 5.1 全局草稿入口与右下角按钮

#### 形态

- 新增 `PresetDraftFab`（全局，挂在受保护路由内）。
- 仅当 `hasDraftContent(draft)` 为真时显示，`AnimatePresence` 淡入缩放。
- 按钮：48×48 圆形，主色渐变，图标 `Layers` / `ListPlus`。
- 右上角数量角标：`tags.length`；只有名称 / 描述 / 图片时显示小圆点。
- Tooltip：`继续编辑画师串（N 位画师）`。
- 点击：直接打开全局 `PresetEditorDialog` 的创建模式，并载入草稿，不跳转页面。
- 编辑弹窗打开时隐藏 FAB，避免与遮罩层级打架。

#### 与「回到顶部」的协调

采用“主 FAB 固定、回顶让位”的规则：

```
        ┌──────────┐
        │  ↑ 回顶   │  ← 仅画师页、滚动 > 300 时出现
        └──────────┘
            12px
        ┌──────────┐
        │ ▣ 草稿 ③ │  ← 全局，草稿有内容时出现
        └──────────┘
            20px
        视口右下角
```

- 草稿 FAB：`fixed right-5 bottom-5 z-40`（移动端 `right-4 bottom-4`，加 `env(safe-area-inset-bottom)`）。
- 回顶按钮：草稿 FAB 可见时 `bottom-20`（约 80px），否则维持 `bottom-6`；加 `transition-[bottom]` 或 framer `layout` 平滑过渡。
- 回顶按钮只在画师页出现，其他页面草稿 FAB 独占右下角，不需要预留空位。
- 层级：侧边栏 < 回顶 `z-30` < 草稿 FAB `z-40` < Dialog `z-50` < Toast `z-[100]`。
- 移动端底部安全区、软键盘弹出时 fixed 元素可能上移，属于可接受表现；确保不与底部 Toast 重叠（Toast 居中）。

备选方案（若希望未来更多页面挂 FAB）：在 `MainLayout` 做一个 `FloatingDock` + 轻量 context，页面通过 `useFloatingAction` 注册回顶等次级按钮。本期只有两个按钮，先用固定偏移更稳，后续再抽象。

#### 草稿产生

- 画师页「添加到画师串」改为：

```ts
const name = normalizeArtistName(artist.name_noob || artist.name_nai)
const draft = getPresetDraft() ?? emptyDraft()
// 统一写入 tags，不再分别写 noob / nai
if (!draft.tags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
  updatePresetDraft({ tags: [...draft.tags, { name, weight: 1 }], text: ... })
}
showToast(`已将 ${name} 添加到画师串草稿，点击右下角图标继续编辑`)
```

- 重复添加时提示「该画师已在草稿中」。
- 添加后 FAB 立即出现（同一页面即可看到），无需切页。

### 5.2 画师串编辑器

#### 组件拆分

- `components/presets/PresetEditorDialog.tsx`：表单、保存、校验、清空草稿。
- `components/presets/TagChipEditor.tsx`：单列表 tag 的拖拽 / 触摸拖拽 / 选中 / 权重按钮。
- `components/presets/PresetImageGallery.tsx`：多图上传、预览、删除；详情弹窗复用只读模式。
- `components/presets/PresetDetailDialog.tsx`：查看名称 / 格式 / 描述 / 内容 / 参考图，点击复制，进入编辑。
- `contexts/PresetEditorContext.tsx`：全局打开 / 关闭、编辑对象、保存后 revision。
- `components/presets/PresetEditorHost.tsx`：挂载 Dialog + 轻提示。

#### 布局（桌面）

```
┌─ 编辑画师串 ─────────────────────────────────────────────┐
│ 名称 [__________________________]   格式 [ NOOB | NAI ]  │
│ 描述 [__________________________]                        │
│                                                          │
│ 画师串                                      [复制]       │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ artist:foo, 1.2::artist:bar, artist:baz::            │ │
│ └──────────────────────────────────────────────────────┘ │
│ 已识别：NAI · 3 位画师 · 1 个带权重        [重新识别]    │
│                                                          │
│ 标签（拖拽排序 / 单击选中 / 双击删除）                   │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ [foo] [bar :1.2] [baz]                               │ │
│ └──────────────────────────────────────────────────────┘ │
│ 选中：bar  权重 [−] 1.2 [+]  [重置]                      │
│                                                          │
│ 参考样图（3/5）                               [添加图片] │
│ ┌────────┐ ┌────────┐ ┌────────┐                        │
│ │  图1   │ │  图2   │ │  图3   │                        │
│ │  ×     │ │  ×     │ │  ×     │                        │
│ └────────┘ └────────┘ └────────┘                        │
│ 不设封面；参考图仅保存在本机，不参与导出                 │
│                                                          │
│ [删除画师串]                    [清空草稿] [取消] [保存] │
└──────────────────────────────────────────────────────────┘
```

移动端：Dialog 接近全屏（`max-h-[92dvh]`），内容区滚动，底部操作按钮吸底；图片网格 2 列，标签区最大高度约 40vh，内部滚动。

#### 单一输入框与自动识别

- textarea 是整串输入；粘贴时读取完整文本（`onPaste` + `setTimeout` 读取新值），执行 `parseArtistString`。
- 识别规则（详见第 6 节）：
  - 出现 `artist:` 或 `数字::...::` → NAI。
  - 出现 `\(` `\)` 或 `(name:1.2)` → NOOB。
  - 两者都有 → 混合，按命中数占优的一方，并提示“检测到混合格式，已统一为 X”。
  - 都没有 → `plain`，保持当前格式；若当前无格式则默认 NOOB，并提示“未检测到格式特征，按 NOOB 处理”。
- 识别成功后：
  1. 选中对应格式；
  2. 解析为 tags；
  3. 将 textarea 规范化为目标格式的字符串（下一帧执行，避免光标跳动）。
- 手动输入时不实时重排字符串：仅 debounce 300ms 更新 tags，避免打字过程中光标被重置；失焦时再做一次规范化。
- 「重新识别」按钮：对当前 textarea 内容重新跑一次识别与解析。
- 格式切换：先解析当前 text，再按新格式重渲染 tags 与 text；这是编辑动作，不是独立的转换功能。

#### 标签区

- 单列表，不再区分 NOOB / NAI 两套。
- 交互延续现有习惯：
  - 单击选中 / 取消；
  - 双击删除；
  - 桌面 HTML5 拖拽排序；
  - 触摸拖拽（阈值 10px，非 passive touchmove）；
  - 选中后 `−` / `+` 调整权重，步进 0.1，范围 0.1–2.0；
  - 「重置」权重为 1。
- 拖拽幽灵元素复用现有实现，但只保留一份逻辑（现在 NOOB / NAI 各写一遍，约 300 行重复）。
- 标签显示：权重非 1 时显示 `:1.2` 小字；纯名称显示不转义、不带 `artist:`。
- 去重：新增时按小写名称判断；重复给出轻提示，不打断。

#### 保存行为

- 必填：名称、至少一个有效 tag（或 text 解析后非空）。
- 保存请求只带当前所选格式：

```json
{
  "name": "某某组合",
  "description": "...",
  "format": "noob",
  "text": "(foo:1.2), bar"
}
```

- 创建模式：
  1. `POST /api/presets` 得到 `id`；
  2. 若有待上传参考图，`POST /api/presets/<id>/images` 批量上传；
  3. 成功后清空草稿（元数据 + IndexedDB 图片）、关闭弹窗、`revision++` 通知列表刷新。
- 编辑模式：`PUT` 更新；新增图片上传，标记删除的图片调用删除接口。
- 图片上传失败：保留弹窗打开，提示“画师串已保存，部分参考图上传失败，可重试”；已成功的图片从待上传队列移除，避免重复。
- 创建模式自动保存草稿：名称 / 描述 / 格式 / text / tags / 图片变化后 debounce 400ms 写入；编辑现有画师串**不写草稿**，避免覆盖未完成草稿。
- 关闭弹窗：创建模式保留草稿；编辑模式如有未保存修改，二次确认后再关闭（可选增强）。
- 快捷键：`Ctrl/Cmd + Enter` 保存，`Esc` 关闭。

#### 清空草稿

- 仅创建模式显示；当 `hasDraftContent(draft)` 为真时可用，否则禁用。
- 点击后弹出 `AlertDialog` 确认：
  - 标题：确认清空草稿
  - 内容：将清除名称、描述、画师串、格式与全部参考图，且不可恢复。
- 确认后：
  1. 调用 `clearPresetDraft()`（删除 localStorage 元数据 + IndexedDB 图片）；
  2. 重置编辑器表单与图片预览；
  3. 释放所有 object URL；
  4. 保持弹窗打开为空白创建模式（用户可继续新建，也可直接关闭）；
  5. FAB 因草稿为空而消失；
  6. Toast「草稿已清空」。
- 保存成功后也走同一套清理逻辑，但不需要确认框。
- 清空不会影响已保存的画师串；编辑模式没有此按钮，只有「删除画师串」。

#### 多张参考样图

- 每个画师串最多 **5 张**，批量选择（`input multiple`）或拖拽上传。
- 前端压缩：最长边 2048、JPEG 0.85，生成 Blob 存入 IndexedDB；同时生成预览 URL。
- 图片网格：
  - 每张显示缩略图与删除按钮；
  - **不设封面**，按上传顺序排列（`display_order`）；
  - 点击图片打开大图预览（可选增强，支持左右切换）。
- 已保存画师串：打开时加载后端 `images`；新增 / 删除均先暂存，保存时统一提交。
- 删除图片：现有图标记 `removedImageIds`，保存时调用删除接口；新图直接从 IndexedDB 删除。
- 超过 5 张：禁止继续添加并提示；后端同样校验，整批不写入。
- 参考图仅本机保存，编辑器中明确提示“不参与导出”。

### 5.3 画师串列表页与详情弹窗

#### 列表卡片

保持现有轻量卡片风格，**不显示封面图或图片缩略图**：

```
┌──────────────────────────────┐
│ [icon] 常用组合       [NOOB] │
│ 一段可选描述……                │
└──────────────────────────────┘
```

- 卡片信息：图标 + 名称 + 格式 Badge；描述有则显示（最多一行 / 两行）；不显示参考图。
- 整张卡片可点击、可键盘聚焦（Enter / Space），点击进入**详情弹窗**。
- 不再在卡片上放「编辑」悬浮按钮，避免误触直接进入编辑。
- 顶部：标题 + 说明 + 「创建画师串」。
  - 有草稿时按钮文案可为「继续编辑草稿」，旁边加一个小角标；点击载入草稿。
  - 另提供「新建空白」次按钮（可选），避免被草稿“绑架”。
- 列表刷新：订阅编辑器 context 的 `revision`，保存 / 删除后自动重新拉取。
- 搜索 / 排序本期不做；后端仍按 `updated_at DESC`。

#### 详情弹窗

```
┌─ 画师串详情 ─────────────────────────────────────────────┐
│ 常用组合                                      [NOOB]     │
│ 一段可选描述……                                           │
│                                                          │
│ 画师串内容（点击复制）                       [复制图标]   │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ (foo:1.2), bar                                       │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ 参考样图（3/5）                                          │
│ ┌────────┐ ┌────────┐ ┌────────┐                        │
│ │  图1   │ │  图2   │ │  图3   │  ← 点击查看大图         │
│ └────────┘ └────────┘ └────────┘                        │
│                                                          │
│                                        [关闭]  [编辑]    │
└──────────────────────────────────────────────────────────┘
```

- 内容区域：
  - 展示存储的所选格式字符串，`font-mono` 换行显示，限制最大高度并滚动；
  - 整块可点击复制，右侧同时提供复制图标按钮（键盘 / 读屏友好）；
  - 点击后 Toast「已复制到剪贴板」；
  - 与“选中文本”冲突时，以点击复制为准；需要手动选择时可用键盘或按钮。
- 参考图：
  - 只读缩略图网格，显示 `N/5`；
  - 点击缩略图打开大图预览（可用嵌套 Dialog / Lightbox）；
  - 无图时显示“暂无参考图”的占位文案，不显示空图框。
- 操作：
  - 「关闭」关闭详情；
  - 「编辑」关闭详情并调用全局 `openEdit(preset)` 进入编辑弹窗；
  - 删除不放在详情里，仍在编辑弹窗中执行（需要先点「编辑」），降低误删风险。
- 数据来源：列表接口已返回每条预设的 `images`（仅文件名与排序），详情直接使用；不额外请求图片列表。
- 参考图文件加载失败时显示占位图，不影响其他内容与复制。

### 5.4 工具页格式转换

`ToolsPage` 从占位页改为工具卡片列表，首期只放一个「画师串格式转换」。

```
┌─ 画师串格式转换 ─────────────────────────────────────────┐
│ 源文本                                    识别：NAI      │
│ ┌───────────────────────────┐  ┌──────────────────────┐ │
│ │ 1.2::artist:a, artist:b:: │→ │ 目标格式 [NOOB|NAI]  │ │
│ │                           │  │                      │ │
│ └───────────────────────────┘  └──────────────────────┘ │
│ 3 位画师 · 2 个带权重                                    │
│ 转换结果                                      [复制]     │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ (a:1.2), (b:1.2), c                                  │ │
│ └──────────────────────────────────────────────────────┘ │
│ [交换] [载入示例] [清空]                                 │
└──────────────────────────────────────────────────────────┘
```

- 纯前端实现，复用 `lib/artistString.ts`，不新增接口。
- 源格式实时识别并显示；目标格式默认取“源格式的反面”，用户可手动改。
- 输入变化即转换（`useMemo`，无需按钮），输出只读。
- 「交换」把输出放回输入，并翻转目标格式。
- 混合格式：全部转成目标格式，并提示原始命中情况。
- 无法识别：按纯名称处理，`artist:` 会按目标格式补全。
- 统计：标签数、带权重数；空输入给示例占位。
- 保留「更多工具开发中」的占位卡片，保持页面完整。

### 5.5 设置页导入导出

- 「导出数据」卡片：
  - 描述改为「备份分类、画师与画师串（名称 / 格式 / 内容）」；
  - 明确提示：**参考图不会导出**；
  - 调 `exportJson()`；
  - 成功提示附带大小，如「JSON 导出成功（约 180 KB，含 12 个画师串）」。
- 「导入数据」卡片：
  - 文案改为「从备份文件恢复分类、画师与画师串」；
  - 进度阶段增加「处理画师串…」；
  - 完成后展示 `新增 / 更新` 的画师串数量；
  - 明确提示：导入**不会恢复参考图**；已存在的画师串会保留其现有参考图与描述。
- 兼容：
  - v1 备份（只有 `categories` / `artists`）正常导入，画师串阶段跳过；
  - v2 备份包含 `presets`；
  - 未知高版本字段忽略，不阻断导入。
- 导入策略：合并，不删除备份中不存在的现有数据。
- 文件名保持 `monxia_backup_<timestamp>.json`。

---

## 6. 核心算法

### 6.1 名称规范化

```ts
function normalizeArtistName(raw: string): string {
  return raw
    .trim()
    .replace(/_/g, ' ')          // 与现有行为一致
    .replace(/\\([()])/g, '$1')  // 还原 NOOB 转义
    .replace(/^artist:\s*/i, '') // 去掉 NAI 前缀
    .trim()
}
```

- 生成 NOOB 时再对 `(` / `)` 加反斜杠；生成 NAI 时再补 `artist:`。
- 去重按 `toLowerCase()`，保留首次出现的写法。
- 名称中合法存在的括号保留（如 `foo (bar)`），只在 NOOB 输出时转义。

### 6.2 解析器

现有实现的问题：

- `parseNoobStr` / `parseNaiStr` 直接按 `[,，\n]` 切分，NAI 分组权重 `1.2::artist:a, artist:b::` 被切碎；
- NOOB 嵌套与转义解析只存在于新增输入的 keydown 回调里，打开已有画师串时走的却是简单 parser；
- NOOB / NAI 两套解析逻辑重复且行为不完全一致。

新解析器采用“扫描 + 顶层分割”：

1. **顶层切分**：按 `,` / `，` / 换行切分，但：
   - 遇到 `\` 转义跳过下一个字符；
   - 括号深度 > 0 时不切分；
   - 遇到 `数字::` 时进入 NAI 权重组，直到匹配的 `::` 结束，组内逗号不切分。
2. **逐段解析**：
   - NAI 组 `w::content::`：把 `content` 再按逗号 / 换行拆分（组内允许 `artist:a, artist:b`），每个名称权重为 `w`；
   - NOOB 组 `(...:w)`：取最外层右括号前的 `:w`，内容递归解析，默认权重 `w`；
   - 普通名称：按纯名称处理，权重 1；
   - `artist:foo`：识别为 NAI 名称，规范化去掉前缀。
3. **容错**：未闭合括号 / 未闭合 `::` 不抛错，尽可能按纯文本处理，并写入 `warnings`。
4. **输出**：`ParseResult { tags, detected, hasWeights, warnings }`。

支持示例：

| 输入 | 解析结果 |
| --- | --- |
| `artist:foo, artist:bar` | foo/1, bar/1，NAI |
| `1.2::artist:a, artist:b::, artist:c` | a/1.2, b/1.2, c/1，NAI |
| `(foo:1.2), bar` | foo/1.2, bar/1，NOOB |
| `((foo:1.2), bar:1.1)` | foo/1.2, bar/1.1（递归，权重覆盖） |
| `foo \(bar\)` | foo (bar)/1，NOOB |
| `foo, bar` | foo/1, bar/1，plain |

### 6.3 格式识别

```ts
function detectArtistFormat(text: string): DetectedFormat {
  const naiHits =
    count(/artist:/gi) +
    count(/\d+(?:\.\d+)?::/g)
  const noobHits =
    count(/\\[()]/g) +
    count(/\([^()]*:\d+(?:\.\d+)?\)/g)

  if (naiHits && !noobHits) return 'nai'
  if (noobHits && !naiHits) return 'noob'
  if (naiHits && noobHits) return 'mixed'
  return 'plain'
}
```

- `mixed` 时按命中数多的一方作为建议格式，UI 提示已统一。
- `plain` 时默认 NOOB（或保持当前格式），只在 UI 提示，不强行改用户选择。
- 自动识别只在**粘贴**、**失焦**、**点击重新识别**时执行，不在每次 keystroke 时切换格式，避免输入过程抖动。

### 6.4 生成

```ts
function formatTag(tag: ArtistTag, format: ArtistFormat): string {
  const name = format === 'noob'
    ? escapeParens(tag.name)
    : `artist:${tag.name}`
  if (tag.weight === 1) return name
  return format === 'noob'
    ? `(${name}:${fmtWeight(tag.weight)})`
    : `${fmtWeight(tag.weight)}::${name}::`
}
```

- NAI 连续同权重合并：`1.2::artist:a, artist:b::`，权重 1 不合并。
- 标签之间用 `, ` 连接；不输出换行，保证复制粘贴可直接用。
- `fmtWeight` 去掉多余 0：`1.20 → 1.2`，`1.00 → 1`；最多保留 2 位小数。
- 生成后再解析应得到等价 tags（幂等性验收项）。

### 6.5 边界情况

| 场景 | 处理 |
| --- | --- |
| 粘贴内容以逗号结尾 | 先去掉尾部逗号再解析 |
| 空文本 | tags 为空，保存时提示至少一个画师 |
| 同一画师重复 | 去重，保留首次权重 |
| 名称本身含括号 | 纯名称保留，NOOB 输出时转义 |
| 名称含 `artist:` 前缀 | 规范化时去掉，避免重复添加 |
| 权重为 0 或负数 | 解析保留但 UI 调整时夹到 0.1；保存前可提示 |
| 权重 > 2.0 | 解析保留原值；UI ± 调整时夹到 2.0 |
| NAI 未分组的多标签 | 逐个生成，必要时可自动合并同权重 |
| 混合格式 | 统一成目标格式，并提示 |
| 超长文本 | 前端提示 ≤ 20000 字符，后端同样限制 |

---

## 7. 导入导出方案

### 7.1 备份 JSON v2

```json
{
  "version": 2,
  "exported_at": "2026-11-12T13:40:00Z",
  "categories": [],
  "artists": [],
  "presets": [
    {
      "name": "常用组合",
      "format": "noob",
      "text": "(foo:1.2), bar"
    }
  ]
}
```

- 画师串部分**只包含名称 / 格式 / 内容**，不包含 `id`、`description`、参考图。
- 不输出旧 `noob_text` / `nai_text`，避免消费者误用。
- 导出不读取 `preset_images/`，接口与实现都不涉及图片，备份体积保持轻量。
- 前端展示文件大小：`new Blob([json]).size`。

### 7.2 导入流程

在现有 SSE 阶段后追加：

```
start (total_categories, total_artists, total_presets)
→ categories
→ dedup_load
→ process
→ database
→ presets            ← 新增
   ├─ 按 name 查找已有画师串
   ├─ 存在：更新 format / text，保留 description 与参考图
   └─ 不存在：创建，description 为空、无参考图
→ complete（统计 categories / artists / presets）
```

- `phase` 类型扩展为 `'presets'`。
- v1 备份没有 `presets`，跳过该阶段，`total_presets = 0`。
- 每处理 20 个画师串发送一次进度。
- 名称冲突：按 `name` 匹配；找到则更新，找不到则创建。`artist_presets.name` 本身有 UNIQUE 约束，天然去重。
- **参考图处理**：
  - 导入不读取、不写入、不删除任何参考图；
  - 已存在画师串的参考图保持不变；
  - 新建画师串没有参考图，后续由用户本机上传。
- **描述处理**：
  - 备份不含描述，导入更新时**保留现有描述**；
  - 新建时描述为空。
- 导入时给缺失 `format` 的旧格式预设做兜底：按 `text` 内容识别，识别不出默认 `noob`。
- 不删除备份中不存在的现有画师串（合并语义）。

### 7.3 兼容与限制

- **v1 → v2**：旧备份不含 `presets`，导入仍成功。
- **旧数据库 → 新数据库**：启动时自动迁移；两条旧格式列保留。
- **参考图不备份**：这是本期确定的产品边界。设置页与画师串编辑器都要有明确提示，避免用户误以为换机后参考图还在。
- **画师封面**：现状导出不含画师图片，导入时会清空新画师的 `image_example`；本次不改变该行为，文档与 UI 不额外承诺。
- **备份体积**：不含图片后通常很小；如未来需要完整备份，再单独设计图片打包方案。

---

## 8. 文件改动清单

### 8.1 前端新增

| 文件 | 内容 |
| --- | --- |
| `frontend/src/lib/artistString.ts` | 统一解析 / 识别 / 生成 / 转换 |
| `frontend/src/lib/presetDraft.ts` | 草稿 v2、迁移、订阅、清空、跨标签页同步 |
| `frontend/src/lib/draftImageStore.ts` | IndexedDB 草稿图片存取、清理 |
| `frontend/src/lib/image.ts` | 客户端图片压缩、方向处理、Blob / URL 工具 |
| `frontend/src/contexts/PresetEditorContext.tsx` | 全局编辑器状态、revision |
| `frontend/src/components/presets/PresetEditorDialog.tsx` | 编辑器弹窗、保存、清空草稿 |
| `frontend/src/components/presets/TagChipEditor.tsx` | 单列表 tag 拖拽 / 选中 / 权重 |
| `frontend/src/components/presets/PresetImageGallery.tsx` | 多图上传、预览、删除；支持只读模式供详情弹窗复用 |
| `frontend/src/components/presets/PresetCard.tsx` | 轻量卡片（名称 / 格式 / 可选描述），点击进入详情 |
| `frontend/src/components/presets/PresetDetailDialog.tsx` | 详情弹窗：内容点击复制、参考图预览、进入编辑 |
| `frontend/src/components/presets/PresetDraftFab.tsx` | 全局草稿悬浮入口 |
| `frontend/src/components/presets/PresetEditorHost.tsx` | Dialog + 轻提示宿主 |
| `frontend/src/components/tools/ArtistFormatConverter.tsx` | 工具页转换器 |

### 8.2 前端修改

| 文件 | 改动 |
| --- | --- |
| `frontend/src/pages/PresetsPage.tsx` | 删除内嵌编辑器 / 双格式解析 / 转换按钮，改为列表 + 全局编辑器调用；预计从 1500+ 行降到 300 行左右 |
| `frontend/src/pages/ArtistsPage.tsx` | `addToPresetDraft` 改用草稿模块；回顶按钮按草稿 FAB 可见性调整位置 |
| `frontend/src/pages/ToolsPage.tsx` | 工具卡片布局 + 转换器 |
| `frontend/src/pages/SettingsPage.tsx` | 文案 / 进度阶段 / 统计；明确参考图不参与备份 |
| `frontend/src/lib/api.ts` | `Preset` / `PresetImage` 类型、CRUD 签名、多图接口 |
| `frontend/src/components/layout/MainLayout.tsx` | 挂载 `PresetDraftFab` / `PresetEditorHost`，或在 `ProtectedRoute` 挂载 |
| `frontend/src/App.tsx` | 引入 `PresetEditorProvider` / Toast Provider |
| `frontend/src/index.css` | 如有需要，补充悬浮按钮安全区 / 动画样式 |

### 8.3 后端修改

| 文件 | 改动 |
| --- | --- |
| `backend/database.py` | 表结构迁移、`artist_preset_images` 表、预设与图片 CRUD helper、查询显式列 |
| `backend/app.py` | 预设 API 重构、多图上传 / 删除 / 静态路由、删除清理、导出 v2、导入 presets 阶段 |
| `backend/booru_base.py` | `PRESET_IMAGES_DIR` 定义与创建 |
| `AGENTS.md` | 可选：目录结构补充 `preset_images/`、`artist_preset_images` 与 v2 备份说明 |

### 8.4 文档 / 测试

| 文件 | 内容 |
| --- | --- |
| `docs/preset-refactor-design.md` | 本设计稿 |
| （可选）`frontend/src/lib/artistString.test.ts` | 解析 / 生成 / 识别单测；需评估是否引入 vitest |

---

## 9. 实施阶段

### 阶段 0：确认设计

- 确认第 11 节的待定项。
- 确认参考图上限 5 张、草稿图片存 IndexedDB、备份不含描述、卡片先进详情再编辑。

### 阶段 1：解析与草稿基础

- 新增 `artistString.ts`、`presetDraft.ts`、`draftImageStore.ts`、`image.ts`。
- 用现有画师串与手工样例验证解析 / 生成幂等。
- 改造画师页 `addToPresetDraft` 与全局 FAB。

### 阶段 2：全局编辑器与列表页

- 抽取 `TagChipEditor`（复用现有拖拽 / 触摸逻辑，去掉双份重复）。
- 新建 `PresetEditorDialog`，接入自动识别、单格式保存、草稿自动保存、清空草稿。
- 重写 `PresetsPage` 为列表 + 全局编辑器。
- 挂载 FAB / Host，处理与回顶按钮的位置关系。

### 阶段 3：后端数据与多图

- 数据库迁移、CRUD 重构、`artist_preset_images` 表。
- 多图上传 / 删除 / 静态访问 / 删除画师串清理所有文件。
- 前端多图上传、网格、详情弹窗图片预览；卡片保持轻量，不显示图片。
- 草稿图 IndexedDB 与保存后上传。

### 阶段 4：工具页转换器

- 复用解析库实现 `ArtistFormatConverter`。
- 工具页布局改造。

### 阶段 5：导出导入 v2

- 导出增加 presets（仅名称 / 格式 / 内容）。
- 导入增加 presets 阶段；保留已有描述与参考图。
- 设置页文案、进度、统计、兼容 v1。

### 阶段 6：回归与验收

- `cd frontend && npm run build`（含 tsc）
- `cd frontend && npm run lint`
- 后端 venv 启动 / 接口冒烟
- 按第 10 节逐项验收
- 移动端与桌面端各过一遍关键路径

---

## 10. 验收清单

### 10.1 全局草稿入口

- [ ] 画师页添加画师后，不切换页面即可在右下角看到草稿 FAB，角标数量正确。
- [ ] 在画师、分类、画师串、工具、设置页都能看到 FAB 并打开同一份草稿。
- [ ] 画师页滚动超过 300px 时，回顶按钮出现在草稿 FAB 上方，二者不重叠；草稿清空后回顶按钮回到底部。
- [ ] 移动端 FAB 不被安全区 / 底部栏遮挡，点击区域 ≥ 44px。
- [ ] 草稿跨刷新、跨标签页仍存在；旧版 `preset_draft` 能自动迁移。
- [ ] 保存或清空草稿后 FAB 消失，列表刷新。

### 10.2 编辑器

- [ ] 粘贴 NAI 字符串自动选中 NAI，权重正确；粘贴 NOOB 字符串自动选中 NOOB。
- [ ] 粘贴 `1.2::artist:a, artist:b::` 解析为两个 1.2 权重标签，不再被逗号切碎。
- [ ] 粘贴嵌套 NOOB `((a:1.2), b:1.1)` 权重正确。
- [ ] 纯名称粘贴不强行切换格式，并给出提示；默认 NOOB。
- [ ] 标签拖拽、触摸拖拽、单击选中、双击删除、权重 ±0.1 均正常。
- [ ] 格式切换后字符串按新格式重渲染；保存时只写入所选格式。
- [ ] 保存后重新打开，文本 / 格式 / 权重与保存前一致。
- [ ] 名称重复时给出明确中文错误，不是 500。
- [ ] `Ctrl/Cmd + Enter` 保存；空名称 / 空标签有校验提示。

### 10.3 清空草稿

- [ ] 创建模式且有草稿时，「清空草稿」按钮可见且可用；无草稿时禁用。
- [ ] 点击后出现二次确认，取消不会清除任何内容。
- [ ] 确认后名称、描述、画师串、格式、tag、参考图全部清空。
- [ ] `localStorage.preset_draft` 被删除，IndexedDB 中对应的草稿图片被删除。
- [ ] 清空后 FAB 消失；弹窗保持空白可继续新建。
- [ ] 清空不会影响已保存的画师串。

### 10.4 卡片与详情弹窗

- [ ] 卡片保持轻量，不显示封面 / 图片缩略图，信息以名称、格式、可选描述为主。
- [ ] 点击卡片（含键盘 Enter / Space）打开详情弹窗，不会直接进入编辑。
- [ ] 详情展示名称、格式、描述、画师串内容与全部参考图。
- [ ] 点击画师串内容区域或复制按钮，完整复制存储的字符串，并出现 Toast。
- [ ] 点击详情中的「编辑」才进入编辑弹窗；关闭详情后状态正确。
- [ ] 详情中的参考图可点击查看大图；无图时显示空状态。
- [ ] 详情中不提供删除，删除需进入编辑弹窗后操作。

### 10.5 参考图

- [ ] 一次可选择多张 JPG / PNG / WebP，上传后网格显示全部图片。
- [ ] 单张删除生效；详情弹窗显示全部图片与 `N/5` 计数。
- [ ] 卡片不显示封面或图片缩略图，仅保留名称 / 格式 / 可选描述。
- [ ] 超过 5 张时禁止继续添加并提示，后端同样拒绝。
- [ ] 删除画师串后，所有关联图片文件被清理。
- [ ] 草稿中选多张图后刷新页面，预览仍在（IndexedDB）；清空草稿后记录被删除。
- [ ] 超大文件 / 非图片给出错误提示，其他图片不受影响。
- [ ] 图片更新后浏览器不显示旧缓存图。

### 10.6 工具页

- [ ] NOOB → NAI、NAI → NOOB 双向转换结果正确，权重保留。
- [ ] 自动识别源格式，混合格式有提示。
- [ ] 复制、交换、清空、载入示例可用。
- [ ] 转换结果再粘回源输入，结果稳定（幂等）。

### 10.7 导出导入

- [ ] 设置页导出 JSON 包含 `presets`，且每条只有 `name` / `format` / `text`。
- [ ] 导出文件不包含任何参考图数据或图片路径。
- [ ] 在空数据库导入 v2 备份，画师串名称 / 格式 / 内容完整恢复。
- [ ] 导入后新建画师串没有参考图；已存在画师串的参考图与描述保持不变。
- [ ] 导入 v1 旧备份不报错，画师 / 分类正常，画师串阶段安全跳过。
- [ ] 重复导入同一份 v2 备份不会产生重复画师串（按名称更新）。
- [ ] 导入进度显示画师串阶段，完成消息统计正确。
- [ ] 旧数据库启动后，原有画师串格式 / 文本正确迁移，可正常编辑保存。
- [ ] 设置页明确提示“参考图不会导出 / 恢复”。

### 10.8 质量门禁

- [ ] `npm run build` 通过（tsc 无错误）。
- [ ] `npm run lint` 通过。
- [ ] 后端使用 `backend/venv` 启动无迁移报错。
- [ ] 主要接口返回统一 `{ success, data/error }`。
- [ ] 未引入未使用依赖；新增文件命名 / 文案符合现有中文风格。

---

## 11. 待确认项与推荐默认值

| # | 问题 | 推荐方案 | 备选 |
| --- | --- | --- | --- |
| 1 | 参考图数量上限 | **已确认：5 张/画师串** | — |
| 2 | 草稿图片存储 | **IndexedDB 存 Blob** | localStorage 压缩 data URL（多图易超限） |
| 3 | 卡片 / 详情交互 | **已确认：卡片 → 详情 → 编辑** | 卡片直接进编辑 |
| 4 | 封面图 | **已确认：不做封面** | 首图 / 手动设为封面 |
| 5 | 清空草稿后的弹窗 | **已确认：保持打开为空白创建模式** | 清空后直接关闭弹窗 |
| 6 | 备份是否包含描述 | **已确认：不包含**，只存名称 / 格式 / 内容 | 一并导出描述 |
| 7 | 纯名称粘贴的默认格式 | **NOOB** + 提示 | 保持当前格式 / 弹窗询问 |
| 8 | 画师串列表是否需要搜索 / 排序 | **本期不做** | 增加搜索框与排序菜单 |
| 9 | 是否需要“仅导出画师串” | **本期不做**，统一导出 | 画师串页单独导出按钮 |

---

## 12. 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 解析器行为变化导致旧画师串重新打开后文本被规范化 | 用户可能觉得“格式被改了” | 打开时先展示存储原文；仅在编辑标签 / 切换格式 / 重新识别时才重渲染；文档说明 |
| NAI / NOOB 识别歧义 | 自动选错格式 | 只在高置信时自动切换；歧义保持当前格式并提示；可手动切换 |
| IndexedDB 不可用 | 草稿图无法持久化 | 退化为内存预览并提示；文字草稿仍走 localStorage；不阻断保存 |
| 草稿图片与元数据不一致 | 孤儿图片 / 预览丢失 | 保存 / 清空时统一清理；启动时按元数据 key 清理孤儿记录；删除图片时同步删 IDB |
| 多图上传部分失败 | 重复图片 / 用户困惑 | 逐张上传并返回明细；成功后从待上传队列移除；失败项保留重试 |
| 参考图不参与备份被误解 | 换机后参考图丢失 | 设置页、编辑器、README 三处明确提示；必要时后续提供“图片单独打包导出” |
| 旧数据迁移不可逆 | 数据风险 | 迁移幂等；保留旧列；先备份数据库；只回填空 `text` |
| 全局 FAB 与回顶 / Toast / Dialog 层级冲突 | 点击遮挡 | 统一 z-index 规范；FAB 打开弹窗时隐藏；回顶偏移 |
| 删除画师串后图片成为孤儿 / 图片替换缓存 | 磁盘膨胀 / 显示旧图 | 应用层删除图片记录与文件；文件名带随机短串；替换时删旧文件 |
| 图片上传成功但保存失败 | 数据不一致 | 先保存预设再上传图片；失败可重试；新建时预设已落库 |
| 旧前端缓存访问新 API | 字段不兼容 | 不保留旧双格式字段的响应，强制刷新；部署时提示清缓存 |

---

## 13. 关键交互流程（端到端）

### 13.1 从画师页到保存

```
画师页 → 卡片菜单「添加到画师串」
  → normalizeArtistName
  → 读取/创建草稿 v2，去重后写入 tags，重算 text
  → Toast「已添加，点击右下角图标继续编辑」
  → 右下角 FAB 出现（角标 +1）
  → 点击 FAB
  → 全局 PresetEditorDialog（创建模式，载入草稿）
  → 粘贴/调整 tag/选图/选格式
  → 保存
      → POST /api/presets（单格式）
      → POST /api/presets/<id>/images（多图）
      → 清空草稿（localStorage + IndexedDB）
      → FAB 消失，revision++
      → 若当前在画师串页，列表自动刷新
```

### 13.2 在画师串页查看详情 / 编辑

```
/presets → 点击卡片
  → PresetDetailDialog（详情模式）
      → 画师串内容点击复制
      → 参考图点击预览
      → 点击「编辑」
          → 关闭详情
          → openEdit(preset)
          → 解析 preset.text（信任 preset.format）
          → 加载 preset.images
          → 修改 → PUT
          → 新增图片 → 批量上传
          → 删除图片 → 逐张删除
          → revision++ → 列表刷新
          → 已保存草稿不受影响
```

### 13.3 清空草稿

```
草稿编辑器 → 点击「清空草稿」
  → AlertDialog 确认
  → clearPresetDraft()
      → 删除 localStorage.preset_draft
      → 删除 IndexedDB 中 images[].key
      → 释放预览 object URL
  → 重置表单 / 图片网格
  → FAB 消失
  → Toast「草稿已清空」
  → 弹窗保持空白创建模式
```

### 13.4 工具页转换

```
/tools → 粘贴源字符串
  → detectArtistFormat
  → parseArtistString
  → formatArtistString(target)
  → 输出 / 复制
  → 可交换回源输入继续编辑
```

### 13.5 备份恢复

```
设置 → 导出 JSON（presets 仅名称/格式/内容）
  → 下载 monxia_backup_*.json
设置 → 导入 JSON
  → SSE: categories → artists → presets
  → 按 name upsert（更新 format/text，保留 description/images）
  → 完成统计
```

---

## 14. 设计自检

- **需求 1**：草稿 FAB 全局可见、点击直接编辑；与回顶按钮的位置冲突已给出规则。✅
- **需求 2**：导出包含画师串，导入可恢复；备份仅名称 / 格式 / 内容，参考图明确不参与。✅
- **需求 3**：编辑器移除转换按钮；单格式保存；单输入框；粘贴自动识别；保留拖拽与权重。✅
- **需求 4**：NOOB / NAI 转换作为独立工具进入工具页，复用同一解析库。✅
- **需求 5**：每个画师串支持多张参考图（上限 5），可上传、预览、删除、随画师串删除；不参与备份；卡片不显示图片，详情弹窗查看。✅
- **需求 6**：草稿编辑提供清空入口，二次确认后清文字 + 清图 + 清草稿元数据，并保持空白弹窗打开。✅
- **需求 7**：卡片点击先进详情；详情内容点击复制；详情内点「编辑」才进入编辑模式。✅
- **额外收益**：解析逻辑统一，修掉 NAI 分组权重被逗号切碎的问题；编辑器代码量大幅下降，后续可维护性更好。
