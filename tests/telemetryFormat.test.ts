import { mockRc } from './telemetryFormatGlobals';

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { connection, robot, Commands, OpModeState } from '../src/util/robocol.svelte';
import Command from '../src/librobocol/packets/command';
import { TelemetryDisplayFormat as F, parseDisplayFormat, isSystemOpModeName, sanitizeTelemetryHtml as clean, telemetryToHtml } from '../src/util/telemetryFormat';

// Datagram as produced by SDK 12.0: new Command("CMD_SET_TELEM_DISPL_FORMAT", DisplayFormat.MONOSPACE.toString()).toByteArray()
// type 4, payload length, seq, timestamp (long), ack flag, name (u16 length + UTF-8), extra (u16 length + UTF-8, plain enum name)
function sdkSetFormatDatagram(format: string, seq = 7, timestamp = 123456789n) {
    let enc = new TextEncoder();
    let name = enc.encode('CMD_SET_TELEM_DISPL_FORMAT');
    let extra = enc.encode(format);
    let payload = 8 + 1 + 2 + name.length + 2 + extra.length;
    let buf = new Uint8Array(5 + payload);
    let view = new DataView(buf.buffer);
    let o = 0;

    buf[o++] = 4;
    view.setUint16(o, payload); o += 2;
    view.setUint16(o, seq); o += 2;
    view.setBigInt64(o, timestamp); o += 8;
    buf[o++] = 0;
    view.setUint16(o, name.length); o += 2; buf.set(name, o); o += name.length;
    view.setUint16(o, extra.length); o += 2; buf.set(extra, o);

    return buf;
}

describe('CMD_SET_TELEM_DISPL_FORMAT wire format', () => {
    test('command name matches RobotCoreCommandList.CMD_SET_TELEMETRY_DISPLAY_FORMAT', () => {
        assert.equal(Commands.SetTelemetryDisplayFormat, 'CMD_SET_TELEM_DISPL_FORMAT');
    });

    test('librobocol decodes the SDK datagram; extra is the plain enum name (not JSON)', () => {
        for (let f of ['CLASSIC', 'MONOSPACE', 'HTML']) {
            let cmd = new Command().deserialize(sdkSetFormatDatagram(f));
            assert.equal(cmd.name, 'CMD_SET_TELEM_DISPL_FORMAT');
            assert.equal(cmd.extra, f);
            assert.equal(parseDisplayFormat(cmd.extra), f);
        }
    });

    test('parseDisplayFormat behaves like DisplayFormat.valueOf (exact match, else ignored)', () => {
        assert.equal(parseDisplayFormat('MONOSPACE'), F.Monospace);
        for (let bad of ['monospace', ' HTML', 'HTML ', '', 'TEXT', '"HTML"', null, undefined, 1, { a: 1 }, ['HTML']]) {
            assert.equal(parseDisplayFormat(bad), null, String(bad));
        }
    });

    test('isSystemOpModeName follows OpModeMeta.isSystemName', () => {
        assert.ok(isSystemOpModeName('$Stop$Robot$'));
        assert.ok(isSystemOpModeName('$Robot$'));
        assert.ok(!isSystemOpModeName('TeleOp'));
        assert.ok(!isSystemOpModeName('$TeleOp'));
        assert.ok(!isSystemOpModeName(undefined));
    });
});

describe('DS <-> mock Robot Controller: display format state', () => {
    test('defaults to CLASSIC', () => {
        mockRc.announce();
        assert.equal(connection.remote, '192.168.43.1');
        mockRc.sendCommand('CMD_NOTIFY_OP_MODE_LIST', JSON.stringify([
            { flavor: 'SYSTEM', group: '$$$$$$$', name: '$Stop$Robot$', source: 'BUILTIN' },
            { flavor: 'SYSTEM', group: '$$$$$$$', name: '$Robot$', source: 'BUILTIN' },
            { flavor: 'TELEOP', group: 'Test', name: 'MyTeleOp', source: 'BLOCKLY' },
            { flavor: 'AUTONOMOUS', group: 'Test', name: 'OtherOpMode', source: 'BLOCKLY' },
        ]));
        assert.equal(robot.telemetryDisplayFormat, F.Classic);
    });

    test('MONOSPACE / HTML from the RC are applied and acknowledged', () => {
        mockRc.sendCommand('CMD_NOTIFY_INIT_OP_MODE', 'MyTeleOp');
        assert.equal(robot.opModeState, OpModeState.Init);

        mockRc.sendRaw(sdkSetFormatDatagram('MONOSPACE', 40, 999n));
        assert.equal(robot.telemetryDisplayFormat, F.Monospace);
        assert.ok(mockRc.acks.some(a => a.name === 'CMD_SET_TELEM_DISPL_FORMAT' && a.timestamp === 999n));

        mockRc.sendCommand('CMD_SET_TELEM_DISPL_FORMAT', 'HTML');
        assert.equal(robot.telemetryDisplayFormat, F.Html);
    });

    test('unknown values are ignored and keep the current format', () => {
        mockRc.sendCommand('CMD_SET_TELEM_DISPL_FORMAT', 'BOLD');
        mockRc.sendCommand('CMD_SET_TELEM_DISPL_FORMAT', '');
        assert.equal(robot.telemetryDisplayFormat, F.Html);
    });

    test('init / start of a user OpMode does not reset the format', () => {
        mockRc.sendCommand('CMD_NOTIFY_RUN_OP_MODE', 'MyTeleOp');
        assert.equal(robot.opModeState, OpModeState.Looping);
        assert.equal(robot.telemetryDisplayFormat, F.Html);

        mockRc.sendCommand('CMD_NOTIFY_INIT_OP_MODE', 'OtherOpMode');
        assert.equal(robot.telemetryDisplayFormat, F.Html);
    });

    test('init of a system OpMode (Stop) resets to CLASSIC', () => {
        mockRc.sendCommand('CMD_NOTIFY_INIT_OP_MODE', '$Stop$Robot$');
        assert.equal(robot.telemetryDisplayFormat, F.Classic);
    });

    test('start of a system OpMode resets to CLASSIC', () => {
        mockRc.sendCommand('CMD_SET_TELEM_DISPL_FORMAT', 'MONOSPACE');
        assert.equal(robot.telemetryDisplayFormat, F.Monospace);
        mockRc.sendCommand('CMD_NOTIFY_RUN_OP_MODE', '$Robot$');
        assert.equal(robot.telemetryDisplayFormat, F.Classic);
    });

    test('telemetry keeps flowing in every format', () => {
        for (let f of ['MONOSPACE', 'HTML', 'CLASSIC']) {
            mockRc.sendCommand('CMD_SET_TELEM_DISPL_FORMAT', f);
            mockRc.sendTelemetry({ a: 'Status : ' + f });
            assert.equal(robot.telemetry.dataStrings.get('a'), 'Status : ' + f);
        }
    });
});

describe('HTML telemetry rendering', () => {
    test('newlines become <br> like the official DS', () => {
        assert.equal(telemetryToHtml('a\nb\n'), 'a<br>b<br>');
    });

    test('supported Html.fromHtml tags are kept', () => {
        assert.equal(clean('<b>bold</b> <i>it</i> <u>u</u> <s>s</s> <strike>x</strike> <del>d</del>'), '<b>bold</b> <i>it</i> <u>u</u> <s>s</s> <strike>x</strike> <del>d</del>');
        assert.equal(clean('<big>B</big><small>s</small><sub>1</sub><sup>2</sup><tt>mono</tt>'), '<big>B</big><small>s</small><sub>1</sub><sup>2</sup><tt>mono</tt>');
        assert.equal(clean('<h1>T</h1><p>p</p><div>d</div><blockquote>q</blockquote><ul><li>x</li></ul>'), '<h1>T</h1><p>p</p><div>d</div><blockquote>q</blockquote><ul><li>x</li></ul>');
        assert.equal(clean('<STRONG>x</STRONG><em>y</em>'), '<strong>x</strong><em>y</em>');
        assert.equal(clean('a<br>b<br/>c<BR />'), 'a<br>b<br>c<br>');
    });

    test('<font color/face/size> becomes a styled span', () => {
        assert.equal(clean('<font color="#ff0000">red</font>'), '<span style="color:#ff0000">red</span>');
        assert.equal(clean("<font color='green' face='monospace' size=5>x</font>"), '<span style="color:green;font-family:monospace;font-size:x-large">x</span>');
        assert.equal(clean('<font>x</font>'), '<span>x</span>');
    });

    test('style on span/p/div is filtered to colors, text-decoration and text-align', () => {
        assert.equal(clean('<span style="color: #0f0; background-color: yellow; text-decoration: line-through">x</span>'), '<span style="color:#0f0;background-color:yellow;text-decoration:line-through">x</span>');
        assert.equal(clean('<p style="text-align:center;position:fixed;top:0">x</p>'), '<p style="text-align:center">x</p>');
        assert.equal(clean('<b style="color:red">x</b>'), '<b>x</b>');
    });

    test('text and entities are escaped / kept as text', () => {
        assert.equal(clean('1 < 2 && 3 > 2'), '1 &lt; 2 &amp;&amp; 3 &gt; 2');
        assert.equal(clean('&lt;script&gt; &amp; &nbsp; &#169; &#x1F600;'), '&lt;script&gt; &amp; &nbsp; &#169; &#x1F600;');
        assert.equal(clean('"quoted" \'x\''), '&quot;quoted&quot; &#39;x&#39;');
    });

    test('unbalanced tags are closed and stray closing tags dropped', () => {
        assert.equal(clean('<b>bold <i>both'), '<b>bold <i>both</i></b>');
        assert.equal(clean('</b>x</i>'), 'x');
        assert.equal(clean('<b><i>x</b>y'), '<b><i>x</i></b>y');
    });

    // --- XSS ---
    const XSS: [string, string][] = [
        ['<script>alert(1)</script>ok', 'ok'],
        ['<SCRIPT SRC=//evil/x.js></SCRIPT>ok', 'ok'],
        ['<script>never closed', ''],
        ['<scr<script>ipt>alert(1)</script>', '&lt;scr'],
        ['<img src=x onerror=alert(1)>ok', 'ok'],
        ['<b onclick="alert(1)" onmouseover=alert(1)>x</b>', '<b>x</b>'],
        ['<a href="javascript:alert(1)">link</a>', 'link'],
        ['<a href="https://example.com">link</a>', 'link'],
        ['<iframe src="https://evil"></iframe>ok', 'ok'],
        ['<svg onload=alert(1)><circle/></svg>ok', 'ok'],
        ['<math><mtext><script>alert(1)</script></mtext></math>ok', 'ok'],
        ['<style>*{display:none}</style>ok', 'ok'],
        ['<object data="x"></object><embed src="x">ok', 'ok'],
        ['<form action="x"><input value="y"><button>b</button></form>', 'b'],
        ['<!-- <script>alert(1)</script> -->ok', 'ok'],
        ['<!--><img src=x onerror=alert(1)>-->', ''],
        ['<![CDATA[<script>alert(1)</script>]]>ok', 'alert(1)]]&gt;ok'],
        ['<span style="background:url(javascript:alert(1))">x</span>', '<span>x</span>'],
        ['<span style="color:expression(alert(1))">x</span>', '<span>x</span>'],
        ['<span style="color:red&quot; onmouseover=&quot;alert(1)">x</span>', '<span>x</span>'],
        ['<font color="red&quot;onmouseover=&quot;alert(1)">x</font>', '<span>x</span>'],
        ['<font face="x;background:url(//evil)">x</font>', '<span>x</span>'],
        ['<font color="red" onmouseover="alert(1)">x</font>', '<span style="color:red">x</span>'],
        ['<b title="a>b">x</b>', '<b>x</b>'],
        ['<b title="unterminated>x', '&lt;b title=&quot;unterminated&gt;x'],
        ['<meta http-equiv="refresh" content="0;url=javascript:alert(1)">ok', 'ok'],
        ['<base href="//evil/"><link rel=stylesheet href=//evil>ok', 'ok'],
        ['<details open ontoggle=alert(1)>x</details>', 'x'],
        ['<template><img src=x onerror=alert(1)></template>ok', 'ok'],
        ['<textarea><b>x</b></textarea>ok', 'ok'],
        ['<video><source onerror=alert(1)></video>ok', 'ok'],
    ];

    for (let [input, expected] of XSS) {
        test('XSS: ' + input, () => {
            let out = clean(input);
            assert.equal(out, expected);

            // independent of the exact expectation: nothing executable may survive
            assert.doesNotMatch(out, /<(?!\/?(b|i|u|s|em|strong|cite|dfn|ins|del|strike|big|small|sub|sup|tt|p|div|span|blockquote|ul|li|h[1-6]|br)[\s>])/i);
            assert.doesNotMatch(out, /<[^>]*\son\w+\s*=/i);
            assert.doesNotMatch(out, /<[^>]*(javascript:|url\(|expression\()/i);
        });
    }

    test('output never contains an attribute other than style', () => {
        let out = clean('<span id=x class=y style="color:red" data-x=1>x</span><p hidden>y</p>');
        assert.equal(out, '<span style="color:red">x</span><p>y</p>');
    });

    test('non-string or empty input gives an empty string', () => {
        assert.equal(clean(''), '');
        assert.equal(clean(undefined as any), '');
        assert.equal(clean(null as any), '');
    });
});
