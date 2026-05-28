# 前端设计体系

本文档定义 XIV Market 前端的设计原则、组件架构和编码规范。适用于所有 `frontend/` 下的包。

---

## 1. 设计哲学

### 1.1 shadcn/ui 原则

我们遵循 [shadcn/ui](https://ui.shadcn.com/) 的设计理念：

- **Open Code** — 组件代码完全开放，直接编辑，不使用封装后的 npm 包
- **Composition** — 组件使用统一的、可组合的接口
- **Beautiful Defaults** — 开箱即用的优雅默认样式，组件间自然协调
- **No Runtime CSS-in-JS** — 纯 Tailwind CSS 工具类，无运行时样式开销

### 1.2 简洁清晰

- 优先删除而非添加：如果功能可以去掉而不影响核心体验，就删除
- 信息密度适中：数据表格用留白和分隔线区分，避免视觉噪音
- 一致的间距：使用 Tailwind 的 spacing scale（4px 基座）

### 1.3 无障碍优先

所有交互组件必须具备：
- 键盘导航（Tab 顺序、Enter/Space 激活、Escape 关闭）
- ARIA 属性（role、aria-label、aria-expanded 等）
- 焦点管理（焦点捕获、焦点恢复）
- 屏幕阅读器兼容

---

## 2. 组件架构

### 2.1 技术栈

| 层级 | 库/工具 | 用途 |
|------|---------|------|
| UI 框架 | Solid.js 1.9 | 响应式 UI |
| 路由 | @solidjs/router | 客户端路由 |
| 样式 | Tailwind CSS v4 | 原子化 CSS |
| 颜色系统 | shadcn CSS variables | 主题 token |
| 无障碍基座 | Kobalte Core | ARIA 原语组件 |
| Variants | class-variance-authority (cva) | 组件变体管理 |
| 类名合并 | clsx + tailwind-merge | `cn()` 工具函数 |
| 图表 | Chart.js | 价格走势 |

### 2.2 组件分层

```
@xiv-market/ui
├── primitives/          # Kobalte 包装组件（交互层）
│   ├── button.tsx       # @kobalte/core/button → Button
│   ├── select.tsx       # @kobalte/core/select → Select 系列
│   ├── tabs.tsx         # @kobalte/core/tabs → Tabs 系列
│   ├── tooltip.tsx      # @kobalte/core/tooltip
│   ├── pagination.tsx   # @kobalte/core/pagination
│   └── ...
│
├── base/                # 纯 CSS 组件（表现层）
│   ├── card.tsx
│   ├── badge.tsx        # 用 cva 管理 variants
│   ├── table.tsx
│   ├── input.tsx
│   ├── skeleton.tsx
│   ├── separator.tsx
│   └── label.tsx
│
├── layout/              # 布局组件
│   └── navbar.tsx       # 共享导航栏（可配置 navItems）
│
├── patterns/            # 模式组件
│   ├── empty-state.tsx
│   ├── error-boundary.tsx
│   ├── stat-card.tsx
│   ├── page-header.tsx
│   └── data-table.tsx   # 响应式数据表格
│
└── pages/               # 共享页面
    ├── home.tsx
    ├── item-detail.tsx
    └── settings.tsx
```

### 2.3 组件编写规则

**规则 1：优先使用 Kobalte 原语**

需要交互的组件（按钮、下拉菜单、标签页、对话框等）必须使用 `@kobalte/core` 的原语包装，而非手写 DOM 事件。

❌ **错误**：手写 `<button onClick>` + 手动管理 `aria-expanded`
```tsx
// 不要这样写
function MyDropdown() {
  const [open, setOpen] = createSignal(false)
  return (
    <div>
      <button onClick={() => setOpen(!open())}>打开</button>
      {open() && <div>...</div>}
    </div>
  )
}
```

✅ **正确**：使用 Kobalte 原语
```tsx
import { DropdownMenu } from "@kobalte/core/dropdown-menu"

function MyDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>打开</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content>...</DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}
```

**规则 2：Variants 使用 cva**

所有有变体的组件必须使用 `class-variance-authority` 管理：

```tsx
import { cva } from "@xiv-market/shared"

export const buttonVariants = cva(
  "inline-flex items-center ...",  // base classes
  {
    variants: {
      variant: { default: "...", destructive: "...", ... },
      size: { default: "...", sm: "...", lg: "..." },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

**规则 3：Props 使用 `splitProps` 分离**

```tsx
export function Card(props: CardProps) {
  const [, rest] = splitProps(props, ["class"])
  return <div class={cn("...", props.class)} {...rest} />
}
```

**规则 4：不要使用 `className`，使用 `class`**

Solid.js JSX 使用 `class` 而非 `className`。我们的组件也只接受 `class` prop。

---

## 3. 样式规范

### 3.1 Tailwind v4 + shadcn 主题变量

主题定义在 `index.css`：

```css
@theme inline {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0 0);
  --color-primary-foreground: oklch(0.985 0 0);
  --color-muted: oklch(0.97 0 0);
  --color-muted-foreground: oklch(0.556 0 0);
  --color-border: oklch(0.922 0 0);
  --color-input: oklch(0.922 0 0);
  --color-ring: oklch(0.708 0 0);
  --radius: 0.625rem;
  /* ... */
}
```

**必须使用语义化颜色变量**，不要硬编码色值：

✅ `bg-primary text-primary-foreground`
❌ `bg-black text-white`

### 3.2 间距与尺寸

- 使用 Tailwind 默认 spacing scale（0.25rem = 1 unit）
- 页面容器最大宽度：`max-w-7xl mx-auto`
- 页面水平内边距：`px-4 sm:px-6 lg:px-8`
- 垂直 section 间距：`py-8`
- 卡片内部 padding：`p-4` 或 `p-6`

### 3.3 圆角

- 卡片：`rounded-xl`
- 按钮/输入框：`rounded-md`
- 小标签/徽章：`rounded-sm` 或 `rounded-md`

---

## 4. 响应式设计

### 4.1 断点

| 断点 | Tailwind | 行为 |
|------|----------|------|
| Mobile | 默认 | 卡片布局，简化信息 |
| Tablet | `md:` (768px) | 表格可见，部分列隐藏 |
| Desktop | `lg:` (1024px) | 完整表格，所有列 |

### 4.2 表格响应式模式

数据表格必须实现双模式：

- **Desktop**：标准 `<table>` 布局，所有列
- **Mobile**：卡片列表，每张卡片显示核心字段

使用 `ResponsiveView` 组件或手动用 `hidden md:block` / `md:hidden` 切换。

---

## 5. 状态与反馈

### 5.1 加载状态

使用 `Skeleton` 组件，不要显示 raw spinner：

```tsx
<Suspense fallback={<Skeleton class="h-[300px]" />}>
  <DataTable data={data()} />
</Suspense>
```

### 5.2 空状态

使用 `EmptyState` 组件，包含：
- 图标（可选）
- 标题（清晰说明状态）
- 描述（解释原因或操作建议）
- 操作按钮（可选，如"清除搜索"）

### 5.3 错误状态

使用 `ErrorBoundary` 捕获异常，提供：
- 错误信息
- "重试"按钮

---

## 6. 代码组织

### 6.1 页面文件结构

```tsx
// 1. 导入（按顺序：框架 → 库 → 共享包 → UI 组件）
import { createSignal } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { fetchData } from '@xiv-market/shared'
import { Card, Button } from '@xiv-market/ui'

// 2. 工具函数
function formatPrice(v: number): string { ... }

// 3. 子组件（页面内使用的小型组件）
function ItemRow(props: { item: Item }) { ... }

// 4. 主页面组件
export default function MyPage() {
  // ...
}
```

### 6.2 应用层（lite-app / enhanced-app）

应用层应该是**纯路由外壳**，只包含：
- `App.tsx` — 路由配置 + Layout（引用共享 Navbar + pages）
- `index.tsx` — 入口（loadItems → render）
- `index.css` — 主题变量
- 独有页面（如 enhanced-app 的 `EnhancedDashboard.tsx`）

不要在应用层写业务逻辑或 UI 组件。

---

## 7. 图标

项目不使用图标库（如 lucide-react）。内联 SVG 足够满足需求。

- 使用 24×24 viewBox 的 SVG
- stroke-width="2"，stroke-linecap="round"，stroke-linejoin="round"
- 尺寸通过外层容器的 `size-4` / `size-3.5` 控制
- 颜色通过 `currentColor` + text-color class 控制

---

## 8. 检查清单

新增组件/页面时，确保：

- [ ] 交互组件基于 Kobalte 原语（而非手写 DOM）
- [ ] 有 variants 的组件使用 cva 管理
- [ ] 使用 shadcn 语义化颜色变量（`bg-primary`、`text-muted-foreground` 等）
- [ ] 移动端有响应式适配（或明确标注为 desktop-only）
- [ ] 有加载状态（Skeleton）
- [ ] 有空状态（EmptyState）
- [ ] 有错误边界（ErrorBoundary）
- [ ] `bun run build` 通过无 TypeScript 错误
