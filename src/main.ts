import { mount } from 'svelte'
import '@fontsource/literata/400.css'
import '@fontsource/literata/600.css'
import '@fontsource/noto-serif-tc/400.css'
import '@fontsource/noto-serif-tc/600.css'
import './app.css'
import App from './App.svelte'
import { applyAppearance, loadAppearance } from './lib/appearance'

// 在畫面出現前套用手動選的深淺色，避免先閃一下另一種顏色
applyAppearance(loadAppearance(localStorage))

export default mount(App, { target: document.getElementById('app')! })
