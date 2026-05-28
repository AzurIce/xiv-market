---
version: alpha
name: xiv-market-design
description: |
  XIV Market 的设计语言遵循 shadcn/ui 原则 — 白色画布、精致灰度层次、
  中性色为主、语义化强调色。系统强调信息密度适中，数据表格用留白和
  分隔线区分，避免视觉噪音。无障碍优先，所有交互组件具备键盘导航和
  ARIA 属性。

colors:
  # Surfaces
  canvas: "#ffffff"
  canvas-soft: "#fafafa"
  canvas-muted: "#f5f5f5"

  # Brand / Primary
  ink: "#0a0a0a"
  primary: "#171717"
  on-primary: "#fafafa"

  # Text
  body: "#525252"
  muted: "#737373"

  # Borders
  hairline: "#e5e5e5"
  hairline-strong: "#a1a1a1"
  ring: "#a1a1a1"

  # Semantic
  accent: "#f5f5f5"
  accent-foreground: "#171717"
  secondary: "#f5f5f5"
  secondary-foreground: "#171717"
  destructive: "#e7000b"
  destructive-foreground: "#ffffff"

  # Charts
  chart-1: "#f54900"
  chart-2: "#009689"
  chart-3: "#104e64"
  chart-4: "#ffb900"
  chart-5: "#fe9a00"

  # Variant badges
  lite-badge-bg: "#f1f5f9"
  lite-badge-text: "#64748b"
  lite-badge-border: "#e2e8f0"
  pro-badge-bg: "rgba(245,158,11,0.15)"
  pro-badge-text: "#d97706"
  pro-badge-border: "rgba(245,158,11,0.25)"

typography:
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif'
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'

  display-lg:
    fontSize: 24px
    fontWeight: 600
    lineHeight: 32px
    letterSpacing: -0.02em
  display-md:
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: -0.01em
  display-sm:
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
  body:
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  body-strong:
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
  caption:
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
  caption-mono:
    fontSize: 12px
    fontFamily: '{typography.fontMono}'
    fontWeight: 400
    lineHeight: 16px

rounded:
  none: 0px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px

spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px

components:
  navbar:
    backgroundColor: "{colors.canvas}"
    backdropFilter: "blur(8px)"
    backgroundOpacity: "0.95"
    height: 56px
    borderBottom: "1px solid {colors.hairline}"
    padding: "0 {spacing.lg}"
  nav-link:
    textColor: "{colors.muted}"
    hoverTextColor: "{colors.body}"
    activeTextColor: "{colors.ink}"
    typography: "{typography.body-strong}"
  nav-badge:
    lite:
      backgroundColor: "{colors.lite-badge-bg}"
      textColor: "{colors.lite-badge-text}"
      borderColor: "{colors.lite-badge-border}"
    pro:
      backgroundColor: "{colors.pro-badge-bg}"
      textColor: "{colors.pro-badge-text}"
      borderColor: "{colors.pro-badge-border}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.md}"
    height: 36px
    typography: "{typography.body-strong}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.md}"
    height: 36px
    typography: "{typography.body-strong}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    hoverBackgroundColor: "{colors.accent}"
    hoverTextColor: "{colors.accent-foreground}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.md}"
    height: 36px
    typography: "{typography.body-strong}"
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    hoverBackgroundColor: "{colors.accent}"
    hoverTextColor: "{colors.accent-foreground}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.md}"
    height: 32px
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
    shadow: "0 1px 2px rgba(0,0,0,0.05)"
  card-header:
    padding: "0 {spacing.lg}"
    gap: "{spacing.sm}"
  card-title:
    typography: "{typography.display-sm}"
  card-description:
    typography: "{typography.body}"
    textColor: "{colors.muted}"
  card-content:
    padding: "0 {spacing.lg}"
  card-footer:
    padding: "0 {spacing.lg}"
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.sm}"
    height: 20px
    typography: "{typography.caption}"
  badge-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.sm}"
    height: 20px
    typography: "{typography.caption}"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.sm}"
    height: 20px
    typography: "{typography.caption}"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.md}"
    height: 36px
    placeholderColor: "{colors.muted}"
    focusRing: "{colors.ring}"
  select-trigger:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.md}"
    padding: "0 {spacing.sm}"
    height: 32px
    typography: "{typography.body}"
  table:
    headerBackground: "{colors.canvas-muted}"
    headerTypography: "{typography.caption-mono}"
    headerTextColor: "{colors.muted}"
    headerTextTransform: "uppercase"
    bodyTypography: "{typography.body}"
    cellPadding: "{spacing.sm} {spacing.md}"
    rowBorder: "{colors.hairline}"
    hoverRowBackground: "{colors.canvas-soft}"
  skeleton:
    backgroundColor: "{colors.canvas-muted}"
    pulseColor: "{colors.hairline}"
    rounded: "{rounded.md}"
  empty-state:
    iconColor: "{colors.muted}"
    titleTypography: "{typography.display-md}"
    descriptionTypography: "{typography.body}"
    descriptionColor: "{colors.muted}"
  data-table:
    desktop: "标准表格布局，所有列"
    mobile: "卡片列表，每张卡片显示核心字段"

patterns:
  page-container:
    maxWidth: "1280px"
    horizontalPadding: "{spacing.lg}"
    verticalPadding: "{spacing.xl}"
  section-gap:
    value: "{spacing.xl}"
  stat-card:
    layout: "卡片内垂直堆叠：标签(caption) → 数值(display-md) → 变化指示器(caption)"
    labelColor: "{colors.muted}"
    valueColor: "{colors.ink}"
  hq-tag:
    backgroundColor: "#fef3c7"
    textColor: "#92400e"
    borderColor: "#fde68a"
    rounded: "{rounded.sm}"
    typography: "{typography.caption}"
    fontWeight: 600
  nq-tag:
    backgroundColor: "{colors.canvas-muted}"
    textColor: "{colors.muted}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.sm}"
    typography: "{typography.caption}"
    fontWeight: 500

---

## Overview

XIV Market 是一个面向《最终幻想14》玩家的市场价格查询工具。设计遵循 shadcn/ui 原则：

- **Open Code** — 组件代码完全开放，直接编辑
- **Composition** — 组件使用统一的、可组合的接口
- **Beautiful Defaults** — 开箱即用的优雅默认样式
- **No Runtime CSS-in-JS** — 纯 Tailwind CSS 工具类，无运行时样式开销

视觉系统以白色画布为基底，深灰墨水色为正文，辅以精致的灰度层次区分信息层级。色彩克制，仅在数据图表和状态指示中使用语义化彩色。

## Colors

### Surfaces
- **Canvas** (`{colors.canvas}` — `#ffffff`): 纯白卡片、对话框、模态框表面。
- **Canvas Soft** (`{colors.canvas-soft}` — `#fafafa`): 页面背景、表格悬停行。
- **Canvas Muted** (`{colors.canvas-muted}` — `#f5f5f5`): 表头背景、骨架屏、次要表面。
- **Hairline** (`{colors.hairline}` — `#e5e5e5`): 1px 分隔线 — 卡片边框、输入框边框、表格行分隔。
- **Hairline Strong** (`{colors.hairline-strong}` — `#a1a1a1`): 更强的分隔线、焦点环。

### Text
- **Ink** (`{colors.ink}` — `#0a0a0a`): 标题、主要文本。
- **Body** (`{colors.body}` — `#525252`): 次要文本、描述、导航链接非激活状态。
- **Muted** (`{colors.muted}` — `#737373`): 最低优先级文本 — 占位符、时间戳、标签。

### Brand
- **Primary** (`{colors.primary}` — `#171717`): 主按钮背景、品牌标识背景。深墨水色在白色画布上形成强烈对比。
- **On Primary** (`{colors.on-primary}` — `#fafafa`): 主按钮上的文本。

### Semantic
- **Secondary** (`{colors.secondary}` — `#f5f5f5`): 次要按钮、标签背景。
- **Accent** (`{colors.accent}` — `#f5f5f5`): 悬停状态背景、幽灵按钮悬停。
- **Destructive** (`{colors.destructive}` — `#e7000b`): 删除、重置等破坏性操作。
- **Ring** (`{colors.ring}` — `#a1a1a1`): 焦点环、轮廓指示器。

### Variant Badges
- **Lite** (`{colors.lite-badge-bg}` — `#f1f5f9`): 灰色低调标签，用于 lite 版本标识。
- **Pro** (`{colors.pro-badge-bg}` — `rgba(245,158,11,0.15)`): 琥珀色强调标签，用于 pro 版本标识。

### Charts
价格走势图表使用 5 色顺序调色板：
- **Chart 1** (`{colors.chart-1}` — `#f54900`): 主要数据线
- **Chart 2** (`{colors.chart-2}` — `#009689`): 次要数据线
- **Chart 3** (`{colors.chart-3}` — `#104e64`): 第三数据线
- **Chart 4** (`{colors.chart-4}` — `#ffb900`): 高亮/注释
- **Chart 5** (`{colors.chart-5}` — `#fe9a00`): 对比线

## Typography

### Font Family
系统使用单一无衬线字体族：
- **Inter** (400 / 500 / 600) — 所有显示、正文、按钮、标签。无自定义展示字体，保持工具类产品的简洁。
- **系统等宽字体** — 仅用于表格表头的字母间距标签（如 "HQ"、"NQ" 列头）。

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-lg}` | 24px | 600 | 32px | -0.02em | 页面标题（"市场数据"） |
| `{typography.display-md}` | 20px | 600 | 28px | -0.01em | 卡片标题、统计数值 |
| `{typography.display-sm}` | 16px | 600 | 24px | 0 | 小节标题、表格列头 |
| `{typography.body}` | 14px | 400 | 20px | 0 | 默认正文、表格内容 |
| `{typography.body-strong}` | 14px | 500 | 20px | 0 | 加粗正文、导航链接、按钮标签 |
| `{typography.caption}` | 12px | 400 | 16px | 0 | 标签、时间戳、徽章、脚注 |
| `{typography.caption-mono}` | 12px | 400 | 16px | 0 | 表头缩写、技术标签 |

### Principles
- **负字间距用于大标题。** display-lg 使用 `-0.02em` 字间距，使标题更紧凑有力。
- **Sentence-case 标题。** 标题使用句子大小写（"市场数据"），不大写每个单词。
- **500 是正文天花板。** Inter 在系统中仅使用 400 / 500 / 600 三级字重，从不使用 700 及以上。
- **字号克制。** 系统仅使用 12 / 14 / 16 / 20 / 24px 五级字号，不引入更小的 10px 或更大的 32px+。

## Layout

### Spacing System
- **Base unit**: 4px。所有间距值都是 4px 的倍数。
- **Tokens**: `{spacing.xs}` 4px · `{spacing.sm}` 8px · `{spacing.md}` 12px · `{spacing.lg}` 16px · `{spacing.xl}` 24px · `{spacing.2xl}` 32px · `{spacing.3xl}` 48px。
- **页面内边距**: `{spacing.lg}` 水平方向，`{spacing.xl}` 垂直方向。
- **卡片内部 padding**: `{spacing.lg}` 标准卡片，`{spacing.md}` 紧凑卡片。
- **行内间隙**: 按钮行、导航行使用 `{spacing.sm}` 到 `{spacing.md}`。

### Grid & Container
- **Max width**: 1280px (`max-w-7xl`)
- **水平内边距**: `{spacing.lg}` 桌面端，`{spacing.md}` 移动端
- **内容居中**: 所有页面内容在容器中水平居中

### Page Rhythm
页面由以下区块组成，区块间使用 `{spacing.xl}` 分隔：
1. **Navbar** — 固定顶部，毛玻璃背景
2. **Page Header** — 标题 + 描述 + 操作区
3. **Content Area** — 数据表格、卡片网格
4. **（可选）Footer** — 版权、链接

## Components

### Button

系统提供四种按钮变体：

**`button-primary`** — 黑色实心按钮，主要操作。
- Background `{colors.primary}`, text `{colors.on-primary}`, rounded `{rounded.md}` (6px), padding `0 {spacing.md}` 12px, height 36px, typography `{typography.body-strong}`.

**`button-secondary`** — 灰色实心按钮，次要操作。
- Background `{colors.secondary}`, text `{colors.secondary-foreground}`, 其余同 primary.

**`button-ghost`** — 透明背景，悬停时显示灰色背景。
- Background transparent, text `{colors.ink}`, hover background `{colors.accent}`, hover text `{colors.accent-foreground}`.

**`button-outline`** — 边框按钮，用于图标按钮和次要操作。
- Background `{colors.canvas}`, text `{colors.ink}`, border `{colors.hairline}`, hover background `{colors.accent}`, height 32px.

### Card

**`card`** — 标准内容容器。
- Background `{colors.canvas}`, text `{colors.ink}`, border 1px `{colors.hairline}`, rounded `{rounded.xl}` (12px), padding `{spacing.lg}` 16px, shadow `0 1px 2px rgba(0,0,0,0.05)`.

卡片内部结构：
- **header**: padding `0 {spacing.lg}`, gap `{spacing.sm}`
- **title**: typography `{typography.display-sm}`, font-weight 600
- **description**: typography `{typography.body}`, color `{colors.muted}`
- **content**: padding `0 {spacing.lg}`
- **footer**: padding `0 {spacing.lg}`, 可包含分隔线

### Navbar

**`navbar`** — 固定顶部导航栏。
- Background `{colors.canvas}` with 95% opacity + backdrop blur, border-bottom 1px `{colors.hairline}`, height 56px, padding `0 {spacing.lg}`.

**`nav-link`** — 导航链接。
- Default color `{colors.muted}`, hover `{colors.body}`, active `{colors.ink}`, typography `{typography.body-strong}`.

**`nav-badge`** — 版本标识标签。
- **Lite**: background `{colors.lite-badge-bg}`, text `{colors.lite-badge-text}`, border `{colors.lite-badge-border}`. 灰色低调，暗示公开/基础版本。
- **Pro**: background `{colors.pro-badge-bg}`, text `{colors.pro-badge-text}`, border `{colors.pro-badge-border}`. 琥珀色强调，暗示增强/专业版本。

### Table

**`table`** — 数据展示的核心组件。
- Header: background `{colors.canvas-muted}`, typography `{typography.caption-mono}`, text `{colors.muted}`, uppercase, cell padding `{spacing.sm} {spacing.md}`.
- Body: typography `{typography.body}`, cell padding `{spacing.sm} {spacing.md}`.
- Row border: 1px `{colors.hairline}` bottom.
- Hover row: background `{colors.canvas-soft}`.

### Input

**`input`** — 文本输入框。
- Background `{colors.canvas}`, text `{colors.ink}`, border 1px `{colors.hairline}`, rounded `{rounded.md}`, height 36px, padding `0 {spacing.md}`.
- Placeholder: color `{colors.muted}`.
- Focus: ring 3px `{colors.ring}` at 50% opacity.

### Select

**`select-trigger`** — 下拉选择触发器。
- Background `{colors.canvas}`, text `{colors.ink}`, border 1px `{colors.hairline}`, rounded `{rounded.md}`, height 32px, padding `0 {spacing.sm}`.

### Badge

**`badge-default`** — 主标签。
- Background `{colors.primary}`, text `{colors.on-primary}`, rounded `{rounded.md}`, padding `0 {spacing.sm}`, height 20px, typography `{typography.caption}`.

**`badge-secondary`** — 次标签。
- Background `{colors.secondary}`, text `{colors.secondary-foreground}`.

**`badge-outline`** — 边框标签。
- Background transparent, text `{colors.ink}`, border `{colors.hairline}`.

### Skeleton

**`skeleton`** — 加载占位符。
- Background `{colors.canvas-muted}`, rounded `{rounded.md}`, 脉冲动画在 `{colors.hairline}` 和 `{colors.canvas-muted}` 之间过渡。

## Patterns

### Page Container
所有页面内容包裹在统一容器中：
- max-width: 1280px
- 水平内边距: `{spacing.lg}` 桌面端 / `{spacing.md}` 移动端
- 垂直内边距: `{spacing.xl}`

### Data Table
数据表格是系统的核心展示模式：

**Desktop** (≥768px):
- 标准 `<table>` 布局
- 所有列可见
- 表头使用 `{typography.caption-mono}` 大写
- 行高 44px，确保点击区域充足
- 悬停行背景 `{colors.canvas-soft}`

**Mobile** (<768px):
- 卡片列表布局
- 每张卡片显示核心字段：物品名、价格、时间
- 次要字段折叠或隐藏
- 卡片间使用 `{spacing.md}` 间距

### Stat Card
统计卡片用于展示聚合数据：
- 卡片内垂直堆叠：标签 → 数值 → 变化指示器
- 标签: `{typography.caption}`, color `{colors.muted}`
- 数值: `{typography.display-md}`, color `{colors.ink}`, font-weight 600
- 变化指示器: `{typography.caption}`, 正数为绿色，负数为红色

### HQ / NQ Tags
品质标签用于区分 HQ（高品质）和 NQ（普通品质）物品：

**HQ Tag**:
- Background `#fef3c7` (amber-100), text `#92400e` (amber-800), border `#fde68a` (amber-200)
- Rounded `{rounded.sm}`, typography `{typography.caption}`, font-weight 600

**NQ Tag**:
- Background `{colors.canvas-muted}`, text `{colors.muted}`, border `{colors.hairline}`
- Rounded `{rounded.sm}`, typography `{typography.caption}`, font-weight 500

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.sm}` | 4px | 小标签、徽章内边距 |
| `{rounded.md}` | 6px | 按钮、输入框、下拉菜单 |
| `{rounded.lg}` | 8px | 中等卡片 |
| `{rounded.xl}` | 12px | 标准卡片、大卡片 |
| `{rounded.full}` | 9999px | 圆形图标按钮 |

### Elevation
系统使用极 subtle 的阴影层级：

| Level | Treatment | Use |
|---|---|---|
| Level 0 — Flat | 无阴影 | 页面背景、扁平内容区 |
| Level 1 — Card | `0 1px 2px rgba(0,0,0,0.05)` + 1px border | 标准卡片 |
| Level 2 — Elevated | `0 4px 6px -1px rgba(0,0,0,0.05)` | 下拉菜单、弹出框 |

从不使用大模糊半径的 drop-shadow。卡片通过边框 + 极 subtle 的阴影"坐在"页面上。

## Responsive Strategy

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 640px | 表格切换为卡片列表；导航栏保持水平但隐藏部分元素 |
| Tablet | 640–1023px | 表格可见，部分列隐藏；2列卡片网格 |
| Desktop | ≥1024px | 完整表格，所有列；3列+卡片网格 |

### Touch Targets
- 按钮最小高度: 32px (outline), 36px (primary/secondary/ghost)
- 表格行最小高度: 44px
- 图标按钮: 32×32px 点击区域
- 导航链接: 44×44px 点击区域

## Accessibility

所有交互组件必须具备：

- **键盘导航**: Tab 顺序合理，Enter/Space 激活，Escape 关闭
- **ARIA 属性**: role、aria-label、aria-expanded、aria-selected 等
- **焦点管理**: 焦点捕获（模态框）、焦点恢复（关闭后）
- **屏幕阅读器**: 所有图标按钮有 aria-label，表格有 scope="col"
- **颜色对比**: 正文文本对比度 ≥ 4.5:1，大文本 ≥ 3:1
- **运动偏好**: 尊重 `prefers-reduced-motion`，禁用非必要动画

## Principles

1. **优先删除而非添加。** 如果功能可以去掉而不影响核心体验，就删除。
2. **信息密度适中。** 数据表格用留白和分隔线区分，避免视觉噪音。
3. **一致的间距。** 使用 4px 基座的 spacing scale，不引入任意值。
4. **语义化颜色。** 始终使用 CSS 变量（`bg-primary`、`text-muted-foreground`），不硬编码色值。
5. **移动端优先。** 表格必须有卡片列表回退，触摸目标 ≥ 44px。
6. **加载状态优先。** 所有异步内容区域必须有 Skeleton 占位，不显示 raw spinner。
7. **空状态必须友好。** 使用 EmptyState 组件，包含图标、标题、描述和可选操作按钮。
8. **错误边界必须存在。** 使用 ErrorBoundary 捕获异常，提供错误信息和重试按钮。
