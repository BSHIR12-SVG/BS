import { int64 } from "./int64.js";

import {
    releaseFakeCell, fakeCellReleased,
    carrierHeaderCopy, carrierHomeVector
} from "./core.js?v=10";

let carrier = null;

function toI64(x) {
    if (x instanceof int64)
        return x;
    if (typeof x === "number") {
        if (!Number.isFinite(x) || Math.floor(x) !== x || x < 0)
            throw new TypeError(`mem: bad numeric address ${x}`);

        const hi = Math.floor(x / 0x100000000);
        return new int64(x - hi * 0x100000000, hi);
    }
    if (x !== null && typeof x === "object" && "low" in x)
        return new int64(x.low, ("hi" in x) ? x.hi : x.high);
    throw new TypeError("mem: bad address");
}

function addrNumber(x) {
    const a = toI64(x);
    if (a.hi > 0xffff)
        throw new RangeError(`mem: non-canonical address 0x${a.toString()}`);
    return a.hi * 0x100000000 + a.low;
}

function aimFor(addrLike, size) {
    const address = addrNumber(addrLike);
    if (size > carrier.windowBytes)
        throw new RangeError(`mem: ${size} exceeds the ${carrier.windowBytes}-byte window`);
    carrier.aim(address);
    return address;
}

function valueLow32(value, who) {
    if (typeof value === "number") {
        if (!Number.isFinite(value) || Math.floor(value) !== value)
            throw new TypeError(`${who}: non-integer value ${value}`);
        return value >>> 0;
    }
    if (value instanceof int64)
        return value.low >>> 0;
    if (value !== null && typeof value === "object" && "low" in value)
        return toI64(value).low >>> 0;
    throw new TypeError(`${who}: value must be a number or an int64`);
}

function read1(addr) {
    aimFor(addr, 1);
    try {
        return carrier.view[0];
    } finally {
        carrier.restore();
    }
}

function read2(addr) {
    aimFor(addr, 2);
    try {
        const v = carrier.view;
        return v[0] | (v[1] << 8);
    } finally {
        carrier.restore();
    }
}

function read4(addr) {
    aimFor(addr, 4);
    try {
        const v = carrier.view;
        return (v[0] | (v[1] << 8) | (v[2] << 16) | (v[3] << 24)) >>> 0;
    } finally {
        carrier.restore();
    }
}

function read8(addr) {
    let lo, hi;
    aimFor(addr, 8);
    try {
        const v = carrier.view;
        lo = (v[0] | (v[1] << 8) | (v[2] << 16) | (v[3] << 24)) >>> 0;
        hi = (v[4] | (v[5] << 8) | (v[6] << 16) | (v[7] << 24)) >>> 0;
    } finally {
        carrier.restore();
    }
    return new int64(lo, hi);
}

function write1(addr, value) {
    const v = valueLow32(value, "mem.write1") & 0xff;
    aimFor(addr, 1);
    try {
        carrier.view[0] = v;
    } finally {
        carrier.restore();
    }
}

function write2(addr, value) {
    const v = valueLow32(value, "mem.write2") & 0xffff;
    aimFor(addr, 2);
    try {
        const view = carrier.view;
        view[0] = v & 0xff;
        view[1] = (v >>> 8) & 0xff;
    } finally {
        carrier.restore();
    }
}

function write4(addr, value) {
    const v = valueLow32(value, "mem.write4");
    aimFor(addr, 4);
    try {
        const view = carrier.view;
        view[0] = v & 0xff;
        view[1] = (v >>> 8) & 0xff;
        view[2] = (v >>> 16) & 0xff;
        view[3] = (v >>> 24) & 0xff;
    } finally {
        carrier.restore();
    }
}

function write8(addr, value) {
    let lo, hi;
    if (value instanceof int64) {
        lo = value.low >>> 0;
        hi = value.hi >>> 0;
    } else if (typeof value === "number") {
        if (!Number.isFinite(value) || Math.floor(value) !== value)
            throw new TypeError(`mem.write8: non-integer value ${value}`);
        if (value < 0) {
            if (value < -0x80000000)
                throw new RangeError(`mem.write8: value ${value} below int32 range`);
            lo = value >>> 0;
            hi = 0xffffffff;
        } else if (value <= 0xffffffff) {
            lo = value >>> 0;
            hi = 0;
        } else {
            throw new RangeError(
                `mem.write8: ${value} exceeds 32 bits -- pass an int64`);
        }
    } else if (value !== null && typeof value === "object" && "low" in value) {
        const n = toI64(value);
        lo = n.low; hi = n.hi;
    } else {
        throw new TypeError("mem.write8: value must be int64 or number");
    }

    aimFor(addr, 8);
    try {
        const view = carrier.view;
        view[0] = lo & 0xff;
        view[1] = (lo >>> 8) & 0xff;
        view[2] = (lo >>> 16) & 0xff;
        view[3] = (lo >>> 24) & 0xff;
        view[4] = hi & 0xff;
        view[5] = (hi >>> 8) & 0xff;
        view[6] = (hi >>> 16) & 0xff;
        view[7] = (hi >>> 24) & 0xff;
    } finally {
        carrier.restore();
    }
}

function leakval(obj) {
    if (obj === null || (typeof obj !== "object" && typeof obj !== "function"))
        throw new TypeError("mem.leakval: not an object");

    carrier.setLeakSlot(obj);
    let lo, hi;
    try {
        aimFor(carrier.leakSlotAddress, 8);
        try {
            const v = carrier.view;
            lo = (v[0] | (v[1] << 8) | (v[2] << 16) | (v[3] << 24)) >>> 0;
            hi = (v[4] | (v[5] << 8) | (v[6] << 16) | (v[7] << 24)) >>> 0;
        } finally {
            carrier.restore();
        }
    } finally {
        carrier.clearLeakSlot();
    }

    if (hi > 0xffff || (lo === 0 && hi === 0) || (lo & 7) !== 0)
        throw new Error(`mem.leakval: implausible cell 0x${
            new int64(lo, hi).toString()}`);
    return new int64(lo, hi);
}

function readInto(dest, addr, count) {
    const base = addrNumber(addr);
    let done = 0;
    while (done > 0;
}

function low48At(bytes, offset) {
    return bytes[offset]
        + bytes[offset + 1] * 0x100
        + bytes[offset + 2] * 0x10000
        + bytes[offset + 3] * 0x1000000
        + bytes[offset + 4] * 0x100000000
        + bytes[offset + 5] * 0x10000000000;
}

function canonical48(bytes, offset) {
    return bytes[offset + 6] === 0 && bytes[offset + 7] === 0;
}

function sameBytes(left, right, count) {
    for (let i = 0; i < count; ++i) {
        if (left[i] !== right[i])
            return false;
    }
    return true;
}

// دالة تثبيت وإدخال كائن الـ Carrier في الذاكرة لتنشيط عمليات الـ Read/Write المباشرة
export function installCarrier(instance) {
    if (!instance || typeof instance.aim !== "function")
        throw new TypeError("mem: invalid carrier instance");
    carrier = instance;
    pairStatus.state = "ready";
}
