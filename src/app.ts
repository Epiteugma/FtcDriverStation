import './frontend/style.css';

import { mount } from 'svelte';

import App from './frontend/App.svelte';
import StackTrace from './frontend/windows/StackTrace.svelte';

let params = new URLSearchParams(window.location.search);

mount(
    params.has('stackTrace') ? StackTrace : App,
    { target: document.getElementById('app')!}
);