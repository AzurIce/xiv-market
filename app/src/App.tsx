import { HashRouter, Route } from '@solidjs/router'
import { lazy } from 'solid-js'

const Navbar = lazy(() => import('@xiv-market/ui/navbar').then(m => ({ default: m.Navbar })))
const HomePage = lazy(() => import('@xiv-market/ui/pages/home'))
const ItemDetailPage = lazy(() => import('@xiv-market/ui/pages/item-detail'))
const SettingsPage = lazy(() => import('@xiv-market/ui/pages/settings'))

function Layout(props: { children?: any }) {
  return (
    <div class="min-h-screen bg-background text-foreground">
      <Navbar
        githubUrl="https://github.com/AzurIce/xiv-market"
        navItems={[{ href: '/', label: '市场', end: true }]}
      />
      <main class="flex-1">{props.children}</main>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter root={Layout}>
      <Route path="/" component={HomePage} />
      <Route path="/item/:id" component={ItemDetailPage} />
      <Route path="/settings" component={SettingsPage} />
    </HashRouter>
  )
}
