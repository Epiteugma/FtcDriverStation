// Telemetry display formats set by an OpMode with telemetry.setDisplayFormat() (FTC SDK 12.0).
//
// The Robot Controller sends Robocol command CMD_SET_TELEM_DISPL_FORMAT whose extra is the plain enum name
// (Telemetry.DisplayFormat.toString(), not JSON): "CLASSIC", "MONOSPACE" or "HTML".
// The official Driver Station (FtcDriverStationActivity, v12.0):
//   - parses it with DisplayFormat.valueOf(extra) and silently ignores unknown values;
//   - CLASSIC / MONOSPACE: shows the text as-is, only the typeface changes (DEFAULT / MONOSPACE);
//   - HTML: shows Html.fromHtml(text.replace("\n", "<br>"));
//   - resets to CLASSIC whenever the RC reports that a *system* OpMode ($...$, e.g. $Stop$Robot$) is initialized
//     or started, i.e. after Stop. It is not reset on a user OpMode init, nor on disconnect.

export enum TelemetryDisplayFormat {
    Classic = 'CLASSIC',
    Monospace = 'MONOSPACE',
    Html = 'HTML',
}

export const SET_TELEMETRY_DISPLAY_FORMAT = 'CMD_SET_TELEM_DISPL_FORMAT';

/** Like Telemetry.DisplayFormat.valueOf(): exact, case-sensitive match; anything else returns null (ignored). */
export function parseDisplayFormat(extra: unknown): TelemetryDisplayFormat | null {
    if (typeof extra !== 'string') return null;

    switch (extra) {
        case TelemetryDisplayFormat.Classic:
        case TelemetryDisplayFormat.Monospace:
        case TelemetryDisplayFormat.Html:
            return extra as TelemetryDisplayFormat;
    }

    return null;
}

/** Same rule as OpModeMeta.isSystemName() */
export function isSystemOpModeName(name: unknown) {
    return typeof name === 'string' && name.startsWith('$') && name.endsWith('$');
}

/** Telemetry text in HTML mode, like the official DS: newlines become <br>, then the result is (safely) parsed as HTML. */
export function telemetryToHtml(text: string) {
    return sanitizeTelemetryHtml(text.replace(/\n/g, '<br>'));
}

// ---------------------------------------------------------------------------------------------------------------
// Small allowlist HTML sanitizer.
//
// The input is tokenized and the output is *rebuilt* from scratch: only the tags below are emitted, with only
// validated attributes, and every piece of text is escaped. Anything else (scripts, event handlers, links, images,
// iframes, comments, unknown tags) is removed. This roughly matches what Android's Html.fromHtml() can render.

const SIMPLE_TAGS = new Set([
    'b', 'strong', 'i', 'em', 'cite', 'dfn', 'u', 'ins', 's', 'strike', 'del',
    'big', 'small', 'sub', 'sup', 'tt', 'p', 'div', 'span', 'blockquote', 'ul', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);

const VOID_TAGS = new Set(['br']);

/** Tags whose content is dropped completely, not just the tag */
const DROP_CONTENT_TAGS = new Set([
    'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'applet', 'noscript', 'noembed', 'noframes',
    'template', 'textarea', 'title', 'head', 'svg', 'math', 'xmp', 'plaintext', 'select', 'option', 'audio', 'video',
]);

/** Tags that accept a (filtered) style attribute, like Html.fromHtml (span, p, div) */
const STYLE_TAGS = new Set(['span', 'p', 'div']);

const FONT_SIZES: Record<string, string> = {
    '1': 'x-small', '2': 'small', '3': 'medium', '4': 'large', '5': 'x-large', '6': 'xx-large', '7': 'xxx-large',
};

const COLOR_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{4}|#[0-9a-f]{6}|#[0-9a-f]{8}|[a-z]{1,20})$/i;
const FACE_RE = /^[a-z0-9 ,_-]{1,64}$/i;
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/y;
const ATTR_RE = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const ENTITY_RE = /&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6});/y;

function escapeText(text: string) {
    let out = '';

    for (let i = 0; i < text.length; i++) {
        let c = text[i];

        if (c === '&') {
            ENTITY_RE.lastIndex = i;
            let m = ENTITY_RE.exec(text);

            if (m) {
                out += m[0];
                i += m[0].length - 1;
            } else out += '&amp;';
        }
        else if (c === '<') out += '&lt;';
        else if (c === '>') out += '&gt;';
        else if (c === '"') out += '&quot;';
        else if (c === "'") out += '&#39;';
        else out += c;
    }

    return out;
}

function decodeAttr(value: string) {
    // only what we need to validate values; anything left with & or other odd characters fails validation
    return value
        .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&')
        .trim();
}

function parseAttrs(raw: string) {
    let attrs = new Map<string, string>();

    for (let m of raw.matchAll(ATTR_RE)) {
        let name = m[1].toLowerCase();
        if (!attrs.has(name)) attrs.set(name, decodeAttr(m[2] ?? m[3] ?? m[4] ?? ''));
    }

    return attrs;
}

function filterStyle(style: string) {
    let out: string[] = [];

    for (let decl of style.split(';')) {
        let idx = decl.indexOf(':');
        if (idx < 0) continue;

        let prop = decl.slice(0, idx).trim().toLowerCase();
        let value = decl.slice(idx + 1).trim().toLowerCase();

        if ((prop === 'color' || prop === 'background-color') && COLOR_RE.test(value)) out.push(prop + ':' + value);
        else if (prop === 'text-decoration' && /^(underline|line-through|none)$/.test(value)) out.push(prop + ':' + value);
        else if (prop === 'text-align' && /^(left|right|center|start|end)$/.test(value)) out.push(prop + ':' + value);
    }

    return out.join(';');
}

/** Builds a safe opening tag, or null if the tag is not allowed. <font> is turned into a styled <span>. */
function openTag(name: string, rawAttrs: string): { html: string; name: string } | null {
    if (VOID_TAGS.has(name)) return { html: '<' + name + '>', name };

    let attrs = parseAttrs(rawAttrs);

    if (name === 'font') {
        let style: string[] = [];

        let color = attrs.get('color');
        if (color && COLOR_RE.test(color)) style.push('color:' + color.toLowerCase());

        let face = attrs.get('face');
        if (face && FACE_RE.test(face)) style.push('font-family:' + face);

        let size = attrs.get('size');
        if (size && FONT_SIZES[size]) style.push('font-size:' + FONT_SIZES[size]);

        return { html: style.length ? '<span style="' + escapeText(style.join(';')) + '">' : '<span>', name: 'span' };
    }

    if (!SIMPLE_TAGS.has(name)) return null;

    let style = STYLE_TAGS.has(name) && attrs.has('style') ? filterStyle(attrs.get('style')!) : '';
    return { html: '<' + name + (style ? ' style="' + escapeText(style) + '"' : '') + '>', name };
}

export function sanitizeTelemetryHtml(input: string): string {
    if (typeof input !== 'string' || !input) return '';

    let out = '';
    let text = '';
    let stack: { source: string; name: string }[] = [];
    let i = 0;

    const flushText = () => {
        out += escapeText(text);
        text = '';
    };

    while (i < input.length) {
        let lt = input.indexOf('<', i);

        if (lt < 0) {
            text += input.slice(i);
            break;
        }

        text += input.slice(i, lt);
        i = lt;

        // comments, doctype, CDATA, processing instructions: drop
        if (input.startsWith('<!--', i)) {
            let end = input.indexOf('-->', i + 4);
            i = end < 0 ? input.length : end + 3;
            continue;
        }

        if (input[i + 1] === '!' || input[i + 1] === '?') {
            let end = input.indexOf('>', i);
            i = end < 0 ? input.length : end + 1;
            continue;
        }

        TAG_RE.lastIndex = i;
        let m = TAG_RE.exec(input);

        if (!m) { // a lone '<' is text
            text += '<';
            i++;
            continue;
        }

        i += m[0].length;

        let closing = m[1] === '/';
        let name = m[2].toLowerCase();

        if (DROP_CONTENT_TAGS.has(name)) {
            if (closing) continue;

            let close = new RegExp('</' + name + '\\s*>', 'ig');
            close.lastIndex = i;
            let end = close.exec(input);
            i = end ? end.index + end[0].length : input.length;
            continue;
        }

        flushText();

        if (closing) {
            let idx = stack.map(s => s.source).lastIndexOf(name);
            if (idx < 0) continue;

            while (stack.length > idx) out += '</' + stack.pop()!.name + '>';
            continue;
        }

        let tag = openTag(name, m[3]);
        if (!tag) continue;

        out += tag.html;
        if (!VOID_TAGS.has(name)) stack.push({ source: name, name: tag.name });
    }

    flushText();
    while (stack.length) out += '</' + stack.pop()!.name + '>';

    return out;
}
