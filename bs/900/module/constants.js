/* Copyright (C) 2023-2026 anonymous
   This file is part of PSFree.
   Licensed under the GNU Affero General Public License version 3 or later. */

// الثوابت الحسابية الأساسية لأحجام الحزم الرقمية (64-bit Memory Standards)
export const KB = 1024;
export const MB = KB * KB;
export const GB = KB * KB * KB;

// الإضافات الفنية الذهبية اللازمة لتأمين التوافقية مع محركات النواة والـ Payloads
export const page_size = 0x4000;      // 16384 بايت - الحجم الثابت للـ PAGE_SIZE في معالجات PS4
export const context_size = 0x2000;   // الحجم الافتراضي لتخصيص سياق الـ Kernel Thread
export const size_strimpl = 0x18;     // الحجم البنيوي لكائن الـ StringImpl بداخل الـ fastMalloc

// حجم كتل العناوين المخصصة لجداول الـ ROP الـ Native لمنع التعليق اللحظي
export const rop_stack_alignment = 8; 
