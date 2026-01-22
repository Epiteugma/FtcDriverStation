import './frontend/style.css';

import { mount } from 'svelte';
import App from './frontend/App.svelte';

mount(App, { target: document.getElementById('app')! });