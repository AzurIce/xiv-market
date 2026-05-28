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
        <div class="max-w-7xl mx-auto px-4 py-8">
          <Card class="border-destructive/50">
            <CardHeader>
              <CardTitle class="text-destructive">出现错误</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <p class="text-sm text-muted-foreground">
                {err.message || '页面加载时发生未知错误'}
              </p>
              <Button variant="outline" size="sm" onClick={() => reset()}>
                重试
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    >
      {props.children}
    </SolidErrorBoundary>
  )
}
