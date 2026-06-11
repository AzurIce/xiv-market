/* @refresh reload */
import { render } from 'solid-js/web'
import { loadItems } from '@xiv-market/shared'
import './index.css'
import App from './App'

const root = document.getElementById('root')

render(() => <App />, root!)
void loadItems()
