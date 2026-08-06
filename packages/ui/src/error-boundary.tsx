import { ErrorBoundary as SolidErrorBoundary } from 'solid-js'
import type { JSX } from 'solid-js'

import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Button } from './button'

export function ErrorBoundary(props: {
  children: JSX.Element
  class?: string
}) {
  return (
    <SolidErrorBoundary
      fallback={(err, reset) => (
        <div class="max-w-7xl mx-auto px-4 py-8" role="alert">
          <Card class="border-destructive/50">
            <CardHeader>
              <CardTitle class="text-destructive">出现错误</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <p class="text-sm text-muted-foreground">
                {err.message || '页面加载时发生未知错误'}
              </p>
              <div class="flex gap-2">
                {/* lazy chunk 加载失败时 Solid lazy 会缓存 rejected 的 import promise，
                    reset() 重渲染仍抛出同一错误，只能刷新页面获取新 chunk
                    （常见于重新部署后旧页面引用旧 chunk） */}
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  刷新页面
                </Button>
                <Button variant="ghost" size="sm" onClick={() => reset()}>
                  重试
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    >
      {props.children}
    </SolidErrorBoundary>
  )
}
