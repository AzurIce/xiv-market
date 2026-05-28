import { Router, Route } from '@solidjs/router'
import { lazy } from 'solid-js'
import { loadItems } from '@xiv-market/shared'

const Navbar = lazy(() => import('@xiv-market/ui').then(m => ({ default: m.Navbar })))
const HomePage = lazy(() => import('@xiv-market/ui').then(m => ({ default: m.HomePage })))
const ItemDetailPage = lazy(() => import('@xiv-market/ui').then(m => ({ default: m.ItemDetailPage })))
const SettingsPage = lazy(() => import('@xiv-market/ui').then(m => ({ default: m.SettingsPage })))

loadItems()

function Layout(props: { children?: any }) {
  return (
    <div class="min-h-screen bg-background text-foreground">
      <Navbar
        variant="lite"
        githubUrl="https://github.com/AzurIce/xiv-market-lite"
        navItems={[{ href: '/', label: '市场', end: true }]}
      />
      <main class="flex-1">{props.children}</main>
    </div>
  )
}

export default function App() {
  return (
    <Router base={import.meta.env.BASE_URL} root={Layout}>
      <Route path="/" component={HomePage} />
      <Route path="/item/:id" component={ItemDetailPage} />
      <Route path="/settings" component={SettingsPage} />
    </Router>
  )
}
