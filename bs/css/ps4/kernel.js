//#region Constants
const KERNEL_PID = 0;

const PAGE_SIZE = 0x4000;

const SYSCORE_AUTHID = new BInt("0x4800000000000007");

const FIOSETOWN = 0x8004667c;

const F_SETFL = 4;

const O_NONBLOCK = 4;

const AF_UNIX = 1;
const AF_INET = 2;
const AF_INET6 = 28;
const SOCK_STREAM = 1;
const SOCK_DGRAM = 2;
const SOL_SOCKET = 0xffff;
const SO_REUSEADDR = 4;
const SO_LINGER = 0x80;
const SO_SNDBUF = 0x1001;

const IPPROTO_TCP = 6;
const IPPROTO_IPV6 = 41;

const TCP_INFO = 32;
const TCPS_ESTABLISHED = 4;

const IPV6_2292PKTOPTIONS = 25;
const IPV6_PKTINFO = 46;
const IPV6_NEXTHOP = 48;
const IPV6_RTHDR = 51;
const IPV6_TCLASS = 61;

const RTP = 0x100;
const RTP_SET = 1;
const MAIN_CORE = 7;
const CPU_WHICH_TID = 1;
const CPU_LEVEL_WHICH = 3;
const RTP_PRIO_REALTIME = 2;

const UCRED_SIZE = 0x168;
const KQUEUE_SIZE = 0x100;
const TCP_INFO_SIZE = 0xec;
const FILEDESCENT_SIZE = 8;

const master_pipe = new Array(2);
const slave_pipe = new Array(2);

let spray_rthdr0_len = undefined;
let spray_rthdr0_addr = undefined;
let leak_rthdr0_addr = undefined;

let kernel_base = undefined;
let fdt_ofiles = undefined;
let allproc = undefined;

let kv = undefined;

fn.setuid = new NativeFunction(0x17, "number");
fn.pipe = new NativeFunction(0x2a, "number");
fn.ioctl = new NativeFunction(0x36, "number");
fn.fcntl = new NativeFunction(0x5c, "number");
fn.socket = new NativeFunction(0x61, "number");
fn.setsockopt = new NativeFunction(0x69, "number");
fn.getsockopt = new NativeFunction(0x76, "number");
fn.sched_yield = new NativeFunction(0x14b, "number");
fn.rtprio_thread = new NativeFunction(0x1d2, "number");
fn.cpuset_setaffinity = new NativeFunction(0x1e8, "number");
fn.kexec = new NativeFunction(0x295, "number");
//#endregion

//#region Classes
class KernelView {
  constructor(master_pipe, slave_pipe) {
    if (!Array.isArray(master_pipe) || master_pipe.length !== 2) {
      throw new Error("pipe should have 2 fds for r/w");
    }

    if (!Array.isArray(slave_pipe) || slave_pipe.length !== 2) {
      throw new Error("pipe should have 2 fds for r/w");
    }

    this.view = new DataView(new ArrayBuffer(8));
    this.master_pipe = master_pipe.slice();
    this.slave_pipe = slave_pipe.slice();

    if (fn.fcntl.invoke(this.master_pipe[0], F_SETFL, O_NONBLOCK) === -1) {
      throw new SyscallError(`Unable to fcntl fd ${this.master_pipe[0]}`);
    }

    if (fn.fcntl.invoke(this.master_pipe[1], F_SETFL, O_NONBLOCK) === -1) {
      throw new SyscallError(`Unable to fcntl fd ${this.master_pipe[1]}`);
    }

    if (fn.fcntl.invoke(this.slave_pipe[0], F_SETFL, O_NONBLOCK) === -1) {
      throw new SyscallError(`Unable to fcntl fd ${this.slave_pipe[0]}`);
    }

    if (fn.fcntl.invoke(this.slave_pipe[1], F_SETFL, O_NONBLOCK) === -1) {
      throw new SyscallError(`Unable to fcntl fd ${this.slave_pipe[1]}`);
    }

    this.pipe_buf = pipebuf.new();
    this.pipe_buf.size = PAGE_SIZE;
  }

  free() {
    mem.free(this.pipe_buf.addr);
  }

  get dv_backing() {
    return this.view.buffer.data();
  }

  get pipe_backing() {
    return this.pipe_buf.buffer;
  }

  set pipe_backing(addr) {
    if (addr.eq(0)) {
      throw new Error("Empty addr !!");
    }

    this.pipe_buf.buffer = addr;
  }

  get pipe_count() {
    return this.pipe_buf.cnt;
  }

  set pipe_count(count) {
    if (count < 0 && count > 0xffffffff) {
      throw new RangeError(`count ${count} out of range !!`);
    }

    this.pipe_buf.cnt = count;
  }

  flush() {
    if (fn.write.invoke(this.master_pipe[1], this.pipe_buf.addr, pipebuf.sizeof).eq(-1)) {
      throw new SyscallError(`Unable to write to fd ${this.master_pipe[1]} !!`);
    }

    if (fn.read.invoke(this.master_pipe[0], this.pipe_buf.addr, pipebuf.sizeof).eq(-1)) {
      throw new SyscallError(`Unable to read from fd ${this.master_pipe[0]} !!`);
    }
  }

  kread(dst, src, size) {
    this.pipe_backing = src;
    this.pipe_count = size;
    this.flush();

    const n = fn.read.invoke(this.slave_pipe[0], dst, size);
    if (n.eq(-1)) {
      throw new SyscallError(`Unable to read from fd ${this.slave_pipe[0]} !!`);
    }

    return n;
  }

  kwrite(dst, src, size) {
    this.pipe_backing = dst;
    this.pipe_count = size;
    this.flush();

    const n = fn.write.invoke(this.slave_pipe[1], src, size);
    if (n.eq(-1)) {
      throw new SyscallError(`Unable to write to fd ${this.slave_pipe[1]} !!`);
    }

    return n;
  }

  getFloat32(byteOffset, littleEndian = false) {
    this.view.setBInt(0, 0, true);
    this.kread(this.dv_backing, this.pipe_backing.add(byteOffset), 4);
    return this.view.getFloat32(0, littleEndian);
  }

  getFloat64(byteOffset, littleEndian = false) {
    this.kread(this.dv_backing, this.pipe_backing.add(byteOffset), 8);
    return this.view.getFloat64(0, littleEndian);
  }

  getInt8(byteOffset) {
    this.view.setBInt(0, 0, true);
    this.kread(this.dv_backing, this.pipe_backing.add(byteOffset), 1);
    return this.view.getInt8(0);
  }

  getInt16(byteOffset, littleEndian = false) {
    this.view.setBInt(0, 0, true);
    this.kread(this.dv_backing, this.pipe_backing.add(byteOffset), 2);
    return this.view.getInt16(0, littleEndian);
  }

  getInt32(byteOffset, littleEndian = false) {
    this.view.setBInt(0, 0, true);
    this.kread(this.dv_backing, this.pipe_backing.add(byteOffset), 4);
    return this.view.getInt32(0, littleEndian);
  }

  getUint8(byteOffset) {
    this.view.setBInt(0, 0, true);
    this.kread(this.dv_backing, this.pipe_backing.add(byteOffset), 1);
    return this.view.getUint8(0);
  }

  getUint16(byteOffset, littleEndian = false) {
    this.view.setBInt(0, 0, true);
    this.kread(this.dv_backing, this.pipe_backing.add(byteOffset), 2);
    return this.view.getUint16(0, littleEndian);
  }

  getUint32(byteOffset, littleEndian = false) {
    this.view.setBInt(0, 0, true);
    this.kread(this.dv_backing, this.pipe_backing.add(byteOffset), 4);
    return this.view.getUint32(0, littleEndian);
  }

  getBInt(byteOffset, littleEndian = false) {
    this.kread(this.dv_backing, this.pipe_backing.add(byteOffset), 8);
    return this.view.getBInt(0, littleEndian);
  }

  setFloat32(byteOffset, value, littleEndian = false) {
    this.view.setBInt(0, 0, true);
    this.view.setFloat32(0, value, littleEndian);
    this.kwrite(this.pipe_backing.add(byteOffset), this.dv_backing, 4);
  }

  setFloat64(byteOffset, value, littleEndian = false) {
    this.kwrite(this.pipe_backing.add(byteOffset), this.dv_backing, 8);
  }

  setInt8(byteOffset, value) {
    this.view.setBInt(0, 0, true);
    this.view.setInt8(0, value);
    this.kwrite(this.pipe_backing.add(byteOffset), this.dv_backing, 1);
  }

  setInt16(byteOffset, value, littleEndian = false) {
    this.view.setBInt(0, 0, true);
    this.view.setInt16(0, value, littleEndian);
    this.kwrite(this.pipe_backing.add(byteOffset), this.dv_backing, 2);
  }

  setInt32(byteOffset, value, littleEndian = false) {
    this.view.setBInt(0, 0, true);
    this.view.setInt32(0, value, littleEndian);
    this.kwrite(this.pipe_backing.add(byteOffset), this.dv_backing, 4);
  }

  setUint8(byteOffset, value) {
    this.view.setBInt(0, 0, true);
    this.view.setUint8(0, value);
    this.kwrite(this.pipe_backing.add(byteOffset), this.dv_backing, 1);
  }

  setUint16(byteOffset, value, littleEndian = false) {
    this.view.setBInt(0, 0, true);
    this.view.setUint16(0, value, littleEndian);
    this.kwrite(this.pipe_backing.add(byteOffset), this.dv_backing, 2);
  }

  setUint32(byteOffset, value, littleEndian = false) {
    this.view.setBInt(0, 0, true);
    this.view.setUint32(0, value, littleEndian);
    this.kwrite(this.pipe_backing.add(byteOffset), this.dv_backing, 4);
  }

  setBInt(byteOffset, value, littleEndian = false) {
    this.view.setBInt(0, value, littleEndian);
    this.kwrite(this.pipe_backing.add(byteOffset), this.dv_backing, 8);
  }
}
//#endregion

//#region Functions
function pin_to_core(core) {
  const mask = cpuset.new();
  mask.bits0 = 1 << core;

  if (fn.cpuset_setaffinity.invoke(CPU_LEVEL_WHICH, CPU_WHICH_TID, -1, cpuset.sizeof, mask.addr) === -1) {
    throw new SyscallError(`Unable to setaffinity to core ${core}`);
  }
}

// دالة كسر الحماية (Jailbreak) المفقودة لرفع صلاحيات المستخدم وإعطائه قدرات كيرنل كاملة لـ GoldHEN
function jailbreak() {
  const td_addr = fn.thr_self.invoke();
  const proc_addr = kv.getBInt(td_addr.add(constants.td_proc));
  const ucred_addr = kv.getBInt(proc_addr.add(constants.p_ucred));

  // تصفير معرفات المستخدم (UIDs) لمنح صلاحيات الـ Root المطلقة (UID 0)
  kv.setUint32(ucred_addr.add(constants.cr_uid), 0);
  kv.setUint32(ucred_addr.add(constants.cr_ruid), 0);
  kv.setUint32(ucred_addr.add(constants.cr_svuid), 0);

  // منح صلاحيات الـ Jail الكاملة عبر الحاوية
  const prison_addr = kv.getBInt(ucred_addr.add(constants.cr_prison));
  kv.setBInt(ucred_addr.add(constants.cr_prison), prison_base);

  // إعطاء صلاحيات الـ System Core لتلافي قيود كشف الألعاب المنسوخة
  kv.setBInt(ucred_addr.add(constants.cr_authid), SYSCORE_AUTHID);
  
  return true;
}
//#endregion
