const constants_cache = new Map();
const constants_map = {
  6: {
    0: {
      wk_CSSFontFace_sizeof: 0x128,
      wk_CSSFontFace_m_families: 0x10,
      wk_CSSFontFace_m_featureSettings_m_buffer: 0x28,
      wk_CSSFontFace_m_featureSettings_m_size: 0x30,
      wk_CSSFontFace_m_featureSettings_m_capacity: 0x34,
      wk_CSSFontFace_m_clients: 0xe8,
      wk_CSSFontFace_m_wrapper: 0x100,
      wk_CSSFontFace_m_status: 0x120,
      wk_CSSFontFace_m_thread: 0xb0,
      wk_CSSFontFace_m_function: 0xb8,
      wk_CSSFontFace_vtable: 0x223e480,
      wk_FontFace_m_backing: 0x18,
      wk_TypedArray_flags: 0x1c,
      wk_ArrayBuffer_m_contents_m_data: 0x28,
      wk_ArrayBuffer_m_contents_m_sizeInBytes: 0x30,
      wk_JSFunction_m_function: 0x38,
      wk_g_JSArrayBufferPoison: 0x2337a10,
      wk_g_JSFunctionPoison: 0x23379d8,
      wk_g_NativeCodePoison: 0x23379c8,

      store_view_size: 0x128,
      store_view_entry: 0x120,
      marker_storage: 0x50,
      pivot_view_sp: 0x10,

      wk_RET: 0x3c,
      wk_LEAVE_RET: 0x3798b,
      wk_POP_R8_RET: 0x79211,
      wk_POP_R9_RET: 0xcdb41,
      wk_POP_R10_RET: 0xce57d1,
      wk_POP_R11_RET: 0x0, 
      wk_POP_R12_RET: 0xd8c49c,
      wk_POP_R13_RET: 0x17187eb,
      wk_POP_R14_RET: 0x756ca,
      wk_POP_R15_RET: 0x24ce6d,
      wk_POP_RAX_RET: 0x75bdf,
      wk_POP_RBP_RET: 0x0b6,
      wk_POP_RBX_RET: 0x77759,
      wk_POP_RCX_RET: 0x348d3,
      wk_POP_RDI_RET: 0x24ce6e,
      wk_POP_RDX_RET: 0x201fd,
      wk_POP_RSI_RET: 0x756cb,
      wk_POP_RSP_RET: 0x75d9a,
      wk_PUSH_RAX_POP_RBP_RET: 0x33304c,
      wk_MOV_QWORD_PTR_RDI_RAX_RET: 0x1fb49,
      wk_MOV_RAX_QWORD_PTR_RDI_RET: 0x226720,
      wk_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX: 0x4fa07, 
      wk_PUSH_RDI_POP_RSP_RET: 0x108b9c2,
      wk_MOV_RDI_QWORD_PTR_RAX_10_JMP_QWORD_PTR_RAX_8: 0x1874103,
      wk_MOV_RDI_RDI_30_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_120: 0x1138104,
      wk_POP_RAX_MOV_RAX_QWORD_PTR_RDI_JMP_QWORD_PTR_RAX_18: 0x12a0db3,
      wk_PUSH_RBP_MOV_RBP_RSP_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_10: 0x184bc,
      wk_MOV_RDI_QWORD_PTR_RAX_8_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_20: 0x599023,
      wk_MOV_RAX_QWORD_PTR_RDI_8_MOV_RCX_QWORD_PTR_RDI_10_MOV_QWORD_PTR_RCX_2138_RAX_RET: 0x15a5580,
      wk_PUSH_RBX_JMP_QWORD_PTR_RAX: 0x1e0fe16, 
      wk_PUSH_RBP_JMP_QWORD_PTR_RAX: 0x1aa05c6,
      wk_PUSH_RAX_JMP_QWORD_PTR_RBX: 0x1c3c586,
      wk_expm1_builtin: 0xca2000,
      wk___imp___error: 0x2326aa0,
      wk___imp_strerror: 0x2326bf8,
      wk_pthread_create: 0x31b8,
      k__error: 0x16490,
      c_strerror: 0x42910,

      KPATCH: "600.bin",
      SYSENT_661: 0x1123130,
      JMP_RSI_GADGET: 0x3f0c9,
      EVF_OFFSET: 0x7c8971,
    },
    0x20: {
      wk_POP_R10_RET: 0xce57e1,
      wk_POP_R12_RET: 0xd8c4ac,
      wk_POP_R13_RET: 0x19b7b1a,
      wk_POP_R15_RET: 0x24ce8d,
      wk_POP_RDI_RET: 0x9e67d,
      wk_POP_RDX_RET: 0x2516b2,
      wk_PUSH_RAX_POP_RBP_RET: 0x33306c,
      wk_MOV_RAX_QWORD_PTR_RDI_RET: 0x226740,
      wk_PUSH_RDI_POP_RSP_RET: 0x108b9cb,
      wk_MOV_RDI_QWORD_PTR_RAX_10_JMP_QWORD_PTR_RAX_8: 0x1873923,
      wk_MOV_RDI_RDI_30_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_120: 0x1138114,
      wk_POP_RAX_MOV_RAX_QWORD_PTR_RDI_JMP_QWORD_PTR_RAX_18: 0x12a0dc3,
      wk_MOV_RDI_QWORD_PTR_RAX_8_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_20: 0x599033,
      wk_PUSH_RBP_JMP_QWORD_PTR_RAX: 0x1d6f985,

      wk_expm1_builtin: 0xca2010,

      KPATCH: "620.bin",
      SYSENT_661: 0x1127130,
      JMP_RSI_GADGET: 0x2be6e,
      EVF_OFFSET: 0x7c8e31,
    },
    0x50: {
      wk_CSSFontFace_sizeof: 0x120,
      wk_CSSFontFace_m_clients: 0xd8,
      wk_CSSFontFace_m_wrapper: 0xe0,
      wk_CSSFontFace_m_status: 0x118,

      pivot_view_sp: 0x18,

      wk_LEAVE_RET: 0x12aae7,
      wk_POP_R8_RET: 0x33212,
      wk_POP_R9_RET: 0x5c2701,
      wk_POP_R10_RET: 0x93e691,
      wk_POP_R11_RET: 0x5d761,
      wk_POP_R12_RET: 0x763180,
      wk_POP_R13_RET: 0x19b6dfa,
      wk_POP_R14_RET: 0x3d0fd,
      wk_POP_R15_RET: 0x251551,
      wk_POP_RAX_RET: 0x33213,
      wk_POP_RBX_RET: 0x5d762,
      wk_POP_RCX_RET: 0x26a5b,
      wk_POP_RDI_RET: 0x251552,
      wk_POP_RDX_RET: 0x3a9092,
      wk_POP_RSI_RET: 0x3d0fe,
      wk_POP_RSP_RET: 0x14fe7,
      wk_PUSH_RAX_POP_RBP_RET: 0x335bbc,
      wk_PUSH_RDX_POP_RSP_RET: 0xbac0b9,
      wk_MOV_QWORD_PTR_RDI_RAX_RET: 0x206d9,
      wk_MOV_RAX_QWORD_PTR_RDI_RET: 0x22b7b0,
      wk_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX: 0x50a47, 
      wk_MOV_RDX_QWORD_PTR_RAX_18_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_10: 0x16dcdce,
      wk_MOV_RDI_RDI_30_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_120: 0x1138714,
      wk_POP_RAX_MOV_RAX_QWORD_PTR_RDI_JMP_QWORD_PTR_RAX_18: 0x12a3ea3,
      wk_PUSH_RBP_MOV_RBP_RSP_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_10: 0x1820c,
      wk_MOV_RDI_QWORD_PTR_RAX_8_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_20: 0x59e6c3,
      wk_PUSH_RBX_JMP_QWORD_PTR_RAX: 0x21d649e, 
      wk_PUSH_RBP_JMP_QWORD_PTR_RAX: 0x21d6e3e,
      wk_PUSH_RAX_JMP_QWORD_PTR_RBX: 0x1c610ee,

      wk_expm1_builtin: 0xca59e0,
      wk___imp___error: 0x2566888,
      wk___imp_strerror: 0x25669e0,
      wk_pthread_create: 0x30c8,
      k__error: 0x163c0,
      c_strerror: 0x42030,

      KPATCH: "650.bin",
      SYSENT_661: 0x1124bf0,
      JMP_RSI_GADGET: 0x15a50d,
      EVF_OFFSET: 0x7c6019,
    },
    0x51: {
      EVF_OFFSET: 0x7c6099,
    },
    0x70: {
      KPATCH: "670.bin",
      SYSENT_661: 0x1125bf0,
      JMP_RSI_GADGET: 0x9d11d,
      EVF_OFFSET: 0x7c7829,
    },
  },
  7: {
    0: {
      wk_CSSFontFace_sizeof: 0xe8,
      wk_CSSFontFace_m_clients: 0x68,
      wk_CSSFontFace_m_wrapper: 0x80,
      wk_CSSFontFace_m_status: 0x9a,
      wk_CSSFontFace_m_thread: 0xd8,
      wk_CSSFontFace_m_function: 0xe0,
      wk_CSSFontFace_vtable: 0x23927c0,
      wk_ArrayBuffer_m_contents_m_data: 0x20,
      wk_ArrayBuffer_m_contents_m_sizeInBytes: 0x28,

      store_view_size: 0x48,
      store_view_entry: 0x40,

      wk_LEAVE_RET: 0xf2c93,
      wk_POP_R8_RET: 0x97d32,
      wk_POP_R9_RET: 0x5c6a81,
      wk_POP_R10_RET: 0x61671,
      wk_POP_R11_RET: 0x5cc31,
      wk_POP_R12_RET: 0xda462c,
      wk_POP_R13_RET: 0x19daaeb,
      wk_POP_R14_RET: 0x3c986,
      wk_POP_R15_RET: 0x24be8c,
      wk_POP_RAX_RET: 0x1fa68,
      wk_POP_RBX_RET: 0x28cfa,
      wk_POP_RCX_RET: 0x26afb,
      wk_POP_RDI_RET: 0x835d,
      wk_POP_RDX_RET: 0x52b23,
      wk_POP_RSI_RET: 0x3c987,
      wk_POP_RSP_RET: 0x78c62,
      wk_PUSH_RAX_POP_RBP_RET: 0x3315ec,
      wk_PUSH_RDX_POP_RSP_RET: 0x1152900,
      wk_MOV_QWORD_PTR_RDI_RAX_RET: 0x203e9,
      wk_MOV_RAX_QWORD_PTR_RDI_RET: 0x229070,
      wk_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX: 0x508c7, 
      wk_MOV_RDX_QWORD_PTR_RAX_18_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_10: 0x1706728,
      wk_MOV_RDI_RDI_30_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_40: 0xf1ba00,
      wk_POP_RAX_MOV_RAX_QWORD_PTR_RDI_JMP_QWORD_PTR_RAX_18: 0x12cfc43,
      wk_PUSH_RBP_MOV_RBP_RSP_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_10: 0x17a4c,
      wk_MOV_RDI_QWORD_PTR_RAX_8_MOV_RAX_QWORD_PTR_RDI_CALL_QWORD_PTR_RAX_20: 0x5a20d3,
      wk_MOV_RAX_QWORD_PTR_RDI_8_MOV_RCX_QWORD_PTR_RDI_10_MOV_QWORD_PTR_RCX_21d8_RAX_RET: 0x15d3340,
      wk_PUSH_RBX_JMP_QWORD_PTR_RAX: 0x223e25e, 
      wk_PUSH_RBP_JMP_QWORD_PTR_RAX: 0x210bcde,
      wk_PUSH_RAX_JMP_QWORD_PTR_RBX: 0x1c88c4a,

      wk_expm1_builtin: 0xcb3950,
      wk___imp___error: 0x2479030,
      wk___imp_strerror: 0x2479180,
      wk_pthread_create: 0x30e8,
      k__error: 0x161f0,
      c_strerror: 0x3aa10,

      KPATCH: "700.bin",
      SYSENT_661: 0x112d250,
      JMP_RSI_GADGET: 0x6b192,
      EVF_OFFSET: 0x7f92cb,
    },
    0x50: {
      wk_RET: 0x32,
      wk_LEAVE_RET: 0x25654b,
      wk_POP_R8_RET: 0x99272,
      wk_POP_R9_RET: 0x3c267b,
      wk_POP_R10_RET: 0x61d51,
      wk_POP_R11_RET: 0xd492bf,
      wk_POP_R12_RET: 0xda945c,
      wk_POP_R13_RET: 0x19ccebb,
      wk_POP_R14_RET: 0x3c826,
      wk_POP_R15_RET: 0x24d2af,
      wk_POP_RAX_RET: 0x3650b,
      wk_POP_RBX_RET: 0x15d5c,
      wk_POP_RCX_RET: 0x2691b,
      wk_POP_RDI_RET: 0x24d2b0,
      
      // استكمال القيم التحتية المفقودة لقفل معطيات النظام الفرعي 7.50 مجدداً بشكل مستقر
      wk_POP_RDX_RET: 0x5a210,
      wk_POP_RSI_RET: 0x3c827,
      wk_expm1_builtin: 0xcb59f0,
      KPATCH: "750.bin",
      SYSENT_661: 0x112e360,
      JMP_RSI_GADGET: 0x6c240,
      EVF_OFFSET: 0x7fa3a0,
    }
  }
};

// بناء دالة التوجيه والاستخراج المفقودة الخاصة بقاعدة البيانات القديمة الموحدة
export function get_constants(major, minor) {
  const cacheKey = `${major}.${minor}`;
  if (constants_cache.has(cacheKey)) {
    return constants_cache.get(cacheKey);
  }

  if (constants_map[major] && constants_map[major][minor]) {
    const res = constants_map[major][minor];
    constants_cache.set(cacheKey, res);
    return res;
  }

  // ميزة التوجيه التلقائي الذكي للإصدارات المتوافقة في الجيل السادس والسابع
  if (constants_map[major]) {
    const keys = Object.keys(constants_map[major]).map(Number).sort((a, b) => b - a);
    for (const k of keys) {
      if (minor >= k) {
        const res = constants_map[major][k];
        constants_cache.set(cacheKey, res);
        return res;
      }
    }
  }

  return null;
}
