# 前端开发指南

前端设计规范见 [`DESIGN.md`](./DESIGN.md)。本文档专注开发环境、命令和数据说明。

> **注意**: 本文档路径已更新，原 `frontend/` 目录已拆分为 `packages/` 和 `app/`。

## 技术栈

- **框架**: Solid.js 1.9 + @solidjs/router
- **构建**: Vite + vite-plugin-solid
- **样式**: Tailwind CSS v4（shadcn 主题变量）
- **组件**: Kobalte Core（无障碍原语）+ cva（变体管理）
- **包管理**: bun
- **Monorepo**: 共享包在 `packages/shared/` 和 `packages/ui/`，应用入口在 `app/`

## 常用命令

```bash
# 启动开发服务器
bun run dev

# 构建生产版本（默认 base 为 /）
bun run build

# 构建生产版本（指定 base 路径，如 GitHub Pages 子目录）
BASE_URL=/xiv-market-lite/ bun run build

# 更新物品数据（CI/CD 使用）
bun run update-items
```

## 项目结构

```
packages/
├── shared/              # @xiv-market/shared — 类型、API、工具
│   ├── src/types.ts     # TypeScript 接口
│   ├── src/api.ts       # Universalis API 客户端
│   ├── src/items.ts     # 物品数据加载/查询
│   ├── src/region.ts    # 区域/服务器全局状态
│   ├── src/utils.ts     # cn() = clsx + tailwind-merge
│   ├── src/cva.ts       # class-variance-authority 配置
│   └── src/index.ts     # 统一导出
│
└── ui/                  # @xiv-market/ui — UI 组件 + 页面
    ├── src/primitives/  # Kobalte 包装组件
    ├── src/base/        # 纯 CSS 组件
    ├── src/layout/      # 布局组件（Navbar）
    ├── src/patterns/    # 模式组件（EmptyState、ErrorBoundary）
    ├── src/pages/       # 共享页面（Home、ItemDetail、Settings）
    └── src/index.ts     # 统一导出

app/                     # xiv-market-lite 应用（GitHub Pages 部署）
├── src/App.tsx          # 路由外壳
├── vite.config.ts       # Vite 配置（base 通过环境变量控制）
└── public/              # 静态资源（items.json）

scripts/                 # 构建脚本
└── update-items.ts

data/                    # 数据源
└── Item.csv
```

## Monorepo 说明

本项目使用 bun workspaces 管理 monorepo：

```json
// package.json
"workspaces": ["packages/*", "app"]
```

### 包依赖关系

```
app/
├── @xiv-market/shared (workspace)
└── @xiv-market/ui (workspace)
    └── @xiv-market/shared (workspace)
```

- `packages/shared/` — **纯逻辑包**，不含框架依赖（除 Solid.js signal 外），可被任何项目复用
  - Universalis API 客户端
  - 物品数据加载与查询
  - 区域/服务器状态管理
  - 工具函数（cn、class-variance-authority）

- `packages/ui/` — **UI 组件包**，依赖 `shared`，包含
  - Kobalte 基础组件封装
  - 页面组件（Home、ItemDetail、Settings）
  - 布局组件（Navbar）

- `app/` — **应用入口**，仅包含路由配置和构建配置，不存放业务逻辑

### 复用方式

其他项目可通过以下方式复用本仓库的包：

1. **Git Submodule**（推荐）
   ```bash
   git submodule add https://github.com/AzurIce/xiv-market-lite.git external/xiv-market-lite
   ```
   然后在 `package.json` 中使用 `file:` 或 `workspace:*` 引用。

2. **直接复制**（适用于不追踪更新的场景）

> ⚠️ 本项目不发布到 npm registry，如需版本锁定请通过 submodule commit hash 控制。

## 物品数据

- 物品中文名/图标映射来自 [thewakingsands/ffxiv-datamining-cn](https://github.com/thewakingsands/ffxiv-datamining-cn) 的 `Item.csv`
- 图标 URL 格式：`https://xivapi.com/i/{folder:06d}/{icon_id:06d}.png`（其中 `folder = icon_id / 1000 * 1000`）
- 物品数据随构建产物部署（`public/items.json`），运行时通过 `fetch('/items.json')` 加载
- commit hash 在构建时注入 JS bundle（`vite.config.ts` → `define`）
- 物品名/图标查询：`@xiv-market/shared` — `getItemName(id)` / `getItemIconUrl(id)` / `getIconUrl(iconId)`

## 组件开发规范

### 优先使用 Kobalte 原语

需要交互的组件（按钮、下拉菜单、标签页、对话框等）必须使用 `@kobalte/core` 的原语包装，而非手写 DOM 事件。

❌ **错误**：手写 `<button onClick>` + 手动管理 `aria-expanded`

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

### Variants 使用 cva

所有有变体的组件必须使用 `class-variance-authority` 管理：

```tsx
import { cva } from "@xiv-market/shared"

export const buttonVariants = cva(
  "inline-flex items-center ...",
  {
    variants: {
      variant: { default: "...", destructive: "..." },
      size: { default: "...", sm: "...", lg: "..." },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

### Props 使用 splitProps 分离

```tsx
export function Card(props: CardProps) {
  const [, rest] = splitProps(props, ["class"])
  return <div class={cn("...", props.class)} {...rest} />
}
```

### 使用 class 而非 className

Solid.js JSX 使用 `class` 而非 `className`。组件只接受 `class` prop。

## 代码组织

### 页面文件结构

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

### 应用层（app/）

应用层应该是**纯路由外壳**，只包含：
- `App.tsx` — 路由配置 + Layout（引用共享 Navbar + pages）
- `index.tsx` — 入口（loadItems → render）
- `index.css` — 主题变量
- 独有页面（如 enhanced-app 的 `EnhancedDashboard.tsx`）

不要在应用层写业务逻辑或 UI 组件。

## 图标规范

项目不使用图标库（如 lucide-react）。内联 SVG 足够满足需求。

- 使用 24×24 viewBox 的 SVG
- stroke-width="2"，stroke-linecap="round"，stroke-linejoin="round"
- 尺寸通过外层容器的 `size-4` / `size-3.5` 控制
- 颜色通过 `currentColor` + text-color class 控制

## 检查清单

新增组件/页面时，确保：

- [ ] 交互组件基于 Kobalte 原语（而非手写 DOM）
- [ ] 有 variants 的组件使用 cva 管理
- [ ] 使用 shadcn 语义化颜色变量（`bg-primary`、`text-muted-foreground` 等）
- [ ] 移动端有响应式适配（或明确标注为 desktop-only）
- [ ] 有加载状态（Skeleton）
- [ ] 有空状态（EmptyState）
- [ ] 有错误边界（ErrorBoundary）
- [ ] `bun run build` 通过无 TypeScript 错误

## 外部资源

- [Universalis API 文档](https://docs.universalis.app/)
- [shadcn-solid](https://github.com/hngngn/shadcn-solid) — Solid.js 版 shadcn/ui
- [Kobalte Docs](https://kobalte.dev/docs/core/overview/introduction) — 无障碍组件原语
