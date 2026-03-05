import './frontend/style.css';

import { mount } from 'svelte';

import App from './frontend/App.svelte';
import StackTrace from './frontend/windows/StackTrace.svelte';
import Graphing from './frontend/windows/Graphing.svelte';
import FieldView from './frontend/windows/FieldView.svelte';

let params = new URLSearchParams(window.location.search);

mount(
    params.has('fieldView') ? FieldView :
    params.has('graphing') ? Graphing :
    params.has('stackTrace') ? StackTrace : App,
    
    { target: document.getElementById('app')!}
);