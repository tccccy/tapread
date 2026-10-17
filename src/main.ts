import { mount } from 'svelte'
import '@fontsource/literata/400.css'
import '@fontsource/literata/600.css'
import '@fontsource/noto-serif-tc/400.css'
import '@fontsource/noto-serif-tc/600.css'
import './app.css'
import App from './App.svelte'

export default mount(App, { target: document.getElementById('app')! })
