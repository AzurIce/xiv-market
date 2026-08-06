import { HashRouter, Route, useLocation } from '@solidjs/router'
import { lazy, Show } from 'solid-js'
// 从 subpath 导入而非总入口：总入口静态导出全部页面，
// 从它导入会把所有页面拉进首屏依赖图，使下方 lazy 路由分包失效
import { AppToastRegion } from '@xiv-market/ui/toast'
import { ErrorBoundary } from '@xiv-market/ui/error-boundary'
// Navbar 静态导入：体积小，且 lazy 化时其 chunk 失败不在任何边界内（未处理渲染错误）
import { Navbar } from '@xiv-market/ui/navbar'

const HomePage = lazy(() => import('@xiv-market/ui/pages/home'))
const MateriaPage = lazy(() => import('@xiv-market/ui/pages/materia'))
const ItemDetailPage = lazy(() => import('@xiv-market/ui/pages/item-detail'))
const SettingsPage = lazy(() => import('@xiv-market/ui/pages/settings'))

function Layout(props: { children?: any }) {
  const location = useLocation()
  return (
    <div class="min-h-screen bg-background text-foreground">
      {/* 内部 region-select 仍 lazy，其 chunk 失败由这个边界兜底（含"刷新页面"恢复） */}
      <ErrorBoundary>
        <Navbar
          githubUrl="https://github.com/AzurIce/xiv-market"
          navItems={[
            { href: '/', label: '市场', end: true },
            { href: '/materia', label: '魔晶石' },
          ]}
        />
      </ErrorBoundary>
      <main class="flex-1">
        {/* 兜非预期错误（渲染异常、lazy chunk 加载失败）；可预期的网络错误由各页面状态处理。
            keyed 按路径重建边界：单一路径的错误不会把导航也锁死在错误屏；
            chunk 失败由边界内"刷新页面"恢复（rejected import 无法靠 reset 重试）。
            注意：这里不能包 Suspense——createResource 被读取时会注册到最近的 Suspense 边界，
            App 级边界会把整页（含标题/搜索/刷新）回退成骨架直到数据就绪。
            页面的加载/错误/空态由各自的 Show 矩阵显式渲染，不依赖 Suspense */}
        <Show when={location.pathname} keyed>
          <ErrorBoundary>{props.children}</ErrorBoundary>
        </Show>
      </main>
      <AppToastRegion />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter root={Layout}>
      <Route path="/" component={HomePage} />
      <Route path="/materia" component={MateriaPage} />
      <Route path="/item/:id" component={ItemDetailPage} />
      <Route path="/settings" component={SettingsPage} />
    </HashRouter>
  )
}
