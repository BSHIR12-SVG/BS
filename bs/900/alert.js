/* Copyright (C) 2023-2026 anonymous
   Licensed under the GNU Affero General Public License version 3 or later. */

// تأمين دالة استخراج النصوص والخصائص لضمان عدم حدوث تجميد (Crash) لمتصفح الـ PS4
function getErrorDetails(reason) {
    if (!reason) return { text: "Unknown error reason", trace: "" };
    
    const msg = reason.message || String(reason);
    const url = reason.sourceURL || "unknown_file";
    const line = reason.line || "?";
    const col = reason.column || "?";
    const stack = reason.stack || "No stack trace available";
    
    return {
        text: `${msg}\n📍 في: ${url} (السطر: ${line}، العمود: ${col})`,
        trace: stack
    };
}

// رصد تراجعات الوعود البرمجية غير المعالجة (Unhandled Rejections)
addEventListener('unhandledrejection', event => {
    const errorInfo = getErrorDetails(event.reason);
    
    // محاولة طباعة الخطأ داخل شاشة الملاحظات أو لوحة كونسول الموقع أولاً لضمان جمالية المظهر
    const msgsEl = document.getElementById("msgs");
    if (msgsEl) {
        msgsEl.innerHTML = `❌ خطأ في النظام: ${errorInfo.text}`;
        msgsEl.style.color = "#ff4757"; // تلوين الخط بالأمر النيون الموحد لبشير
    } else {
        // Fallback في حال عدم اكتمال تحميل الواجهة الرسومية بعد
        alert(`🚨 خطأ غير معالج (Rejection):\n${errorInfo.text}\n\n${errorInfo.trace}`);
    }
});

// رصد أخطاء الصياغة والتشغيل العامة (Runtime & Syntax Errors)
addEventListener('error', event => {
    // التحقق من وجود الكائن لمنع حدوث (Cannot read properties of undefined)
    const reason = event.error || event.message || event;
    const errorInfo = getErrorDetails(reason);
    
    const msgsEl = document.getElementById("msgs");
    if (msgsEl) {
        msgsEl.innerHTML = `❌ خطأ تشغيل: ${errorInfo.text}`;
        msgsEl.style.color = "#ff4757";
    } else {
        alert(`🚨 خطأ تشغيل غير معالج:\n${errorInfo.text}\n\n${errorInfo.trace}`);
    }
    
    return true; // منع المتصفح من إظهار أخطائه الافتراضية المشوهة
});

// استدعاء البرنامج ديناميكياً لالتقاط أخطاء الصياغة (Syntax Errors) فور حدوثها
import('./psfree.js').catch(err => {
    const errorInfo = getErrorDetails(err);
    const msgsEl = document.getElementById("msgs");
    if (msgsEl) {
        msgsEl.innerHTML = `❌ خطأ في صياغة المحرك: ${errorInfo.text}`;
        msgsEl.style.color = "#ff4757";
    } else {
        alert(`🚨 فشل استيراد المحرك الرئيسي:\n${errorInfo.text}`);
    }
});
