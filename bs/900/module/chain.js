/* Copyright (C) 2023-2026 anonymous
   This file is part of PSFree.
   Licensed under the GNU Affero General Public License version 3 or later. */

import { Int, lohi_from_one } from './int64.js';
import { get_view_vector } from './memtools.js';
import { Addr } from './mem.js';
import * as config from '../config.js';

// خريطة وجداول استدعاءات نظام تشغيل البلايستيشن 4 والـ Kernel المدمج
export const syscall_map = new Map(Object.entries({
    'read' : 3,
    'write' : 4,
    'open' : 5,
    'close' : 6,
    'getpid' : 20,
    'setuid' : 23,
    'getuid' : 24,
    'accept' : 30,
    'pipe' : 42,
    'ioctl' : 54,
    'munmap' : 73,
    'mprotect' : 74,
    'fcntl' : 92,
    'socket' : 97,
    'connect' : 98,
    'bind' : 104,
    'setsockopt' : 105,
    'listen' : 106,
    'getsockopt' : 118,
    'fchmod' : 124,
    'socketpair' : 135,
    'fstat' : 189,
    'getdirentries' : 196,
    '__sysctl' : 202,
    'mlock' : 203,
    'clock_gettime' : 232,
    'nanosleep' : 240,
    'sched_yield' : 331,
    'kqueue' : 362,
    'kevent' : 363,
    'rtprio_thread' : 466,
    'mmap' : 477,
    'ftruncate' : 480,
    'shm_open' : 482,
    'cpuset_getaffinity' : 487,
    'cpuset_setaffinity' : 488,
    'jitshm_create' : 533,
    'jitshm_alias' : 534,
    'evf_create' : 538,
    'evf_delete' : 539,
    'evf_set' : 544,
    'evf_clear' : 545,
    'set_vm_container' : 559,
    'dmem_container' : 586,
    'dynlib_dlsym' : 591,
    'dynlib_get_list' : 592,
    'dynlib_get_info' : 593,
    'dynlib_load_prx' : 594,
    'randomized_path' : 602,
    'budget_get_ptype' : 610,
    'thr_suspend_ucontext' : 632,
    'thr_resume_ucontext' : 633,
    'blockpool_open' : 653,
    'blockpool_map' : 654,
    'blockpool_unmap' : 655,
    'blockpool_batch' : 657,
    'aio_submit' : 661,
    'kexec' : 661,
    'aio_multi_delete' : 662,
    'aio_multi_wait' : 663,
    'aio_multi_poll' : 664,
    'aio_multi_cancel' : 666,
    'aio_submit_cmd' : 669,
    'blockpool_move' : 673,
}));

const argument_pops = [
    'pop rdi; ret',
    'pop rsi; ret',
    'pop rdx; ret',
    'pop rcx; ret',
    'pop r8; ret',
    'pop r9; ret',
];

export class ChainBase {
    constructor(stack_size=0x1000, upper_pad=0x10000) {
        this._is_dirty = false;
        this.position = 0;

        const return_value = new Uint32Array(4);
        this._return_value = return_value;
        this.retval_addr = get_view_vector(return_value);

        const errno = new Uint32Array(1);
        this._errno = errno;
        this.errno_addr = get_view_vector(errno);

        const full_stack_size = upper_pad + stack_size;
        const stack_buffer = new ArrayBuffer(full_stack_size);
        const stack = new DataView(stack_buffer, upper_pad);
        this.stack = stack;
        this.stack_addr = get_view_vector(stack);
        this.stack_size = stack_size;
        this.full_stack_size = full_stack_size;
    }

    empty() {
        this.position = 0;
    }

    get is_dirty() {
        return this._is_dirty;
    }

    clean() {
        this._is_dirty = false;
    }

    dirty() {
        this._is_dirty = true;
    }

    check_allow_run() {
        if (this.position === 0) {
            throw Error('chain is empty');
        }
        if (this.is_dirty) {
            throw Error('chain already ran, clean it first');
        }
    }

    reset() {
        this.empty();
        this.clean();
    }

    get retval_int() {
        return this._return_value[0] | 0;
    }

    get retval() {
        return new Int(this._return_value[0], this._return_value[1]);
    }

    get retval_ptr() {
        return new Addr(this._return_value[0], this._return_value[1]);
    }

    set retval(value) {
        const values = lohi_from_one(value);
        const retval = this._return_value;
        retval[0] = values[0];
        retval[1] = values[1];
    }

    get retval_all() {
        const retval = this._return_value;
        return [new Int(retval[0], retval[1]), new Int(retval[2], retval[3])];
    }

    set retval_all(values) {
        const [a, b] = [lohi_from_one(values[0]), lohi_from_one(values[1])];
        const retval = this._return_value;
        retval[0] = a[0];
        retval[1] = a[1];
        retval[2] = b[0];
        retval[3] = b[1];
    }

    get errno() {
        return this._errno[0];
    }

    set errno(value) {
        this._errno[0] = value;
    }

    push_value(value) {
        const position = this.position;
        if (position >= this.stack_size) {
            throw Error(`no more space on the stack, pushed value: ${value}`);
        }

        const values = lohi_from_one(value);
        const stack = this.stack;
        stack.setUint32(position, values[0], true);
        stack.setUint32(position + 4, values[1], true);

        this.position += 8;
    }

    // استكمال دالة جلب واستخراج الـ Gadget المقطوعة وتمريرها لمصفوفة المكدس
    get_gadget(insn_str) {
        if (typeof gadgets === "undefined" || !gadgets.has(insn_str)) {
            throw Error(`Gadget not found or map uninitialized: ${insn_str}`);
        }
        return gadgets.get(insn_str);
    }

    // دالة دفع وحقن معامل استدعاء نظام فرعي للـ ROP Chain (Push Syscall Helper)
    push_syscall(name, ...args) {
        if (!syscall_map.has(name)) {
            throw Error(`Unknown syscall name requested: ${name}`);
        }
        const sys_num = syscall_map.get(name);
        
        // دفع المعاملات المسجلة بداخل سجلات المعالج بالتسلسل
        for (let i = 0; i < Math.min(args.length, argument_pops.length); i++) {
            this.push_value(this.get_gadget(argument_pops[i]));
            this.push_value(args[i]);
        }
        
        // دفع رقم استدعاء النظام الموحد وتنشيط الـ Syscall Gadget للـ Kernel
        this.push_value(this.get_gadget('pop rax; ret'));
        this.push_value(sys_num);
        this.push_value(this.get_gadget('syscall; ret'));
    }
}

// حاوية تخزين الخرائط الكونية للـ Gadgets المستخرجة
export const gadgets = new Map();

export function init_gadget_map(map_data) {
    gadgets.clear();
    for (const [k, v] of Object.entries(map_data)) {
        gadgets.set(k, v);
    }
}
