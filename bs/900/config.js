/* Copyright (C) 2023-2026 anonymous
   Licensed under the GNU Affero General Public License version 3 or later. */

// فحص للتأكد من صياغة النظام المشفرة BCD
function check_bcd(value) {
  for (let i = 0; i <= 12; i += 4) {
    const nibble = (value >>> i) & 0xf;

    if (nibble > 9) {
      return false;
    }
  }
  return true;
}

export function set_target(value) {
  // تحصين الدالة لضمان عدم تمرير قيم فارغة في حال تصفح الموقع من خارج الـ PS4
  if (value === undefined || value === null) {
    return false;
  }

  if (!Number.isInteger(value)) {
    throw TypeError(`value not an integer: ${value}`);
  }

  if (value >= 0x20000 || value < 0) {
    throw RangeError(`value >= 0x20000 or value < 0: ${value}`);
  }

  const version = value & 0xffff;
  if (!check_bcd(version)) {
    throw RangeError(`value & 0xffff not in BCD format ${version}`);
  }

  target = value;
  return true;
}

function get_target_from_ua(useragent) {
  // التعابير النمطية الحساسة لقراءة متصفح أجهزة سوني 4 و 5
  const pattern = /^Mozilla\/5\.0 \(?(?:PlayStation; )?PlayStation (4|5)[ \/]([0-9]{1,2}\.[0-9]{2})\)? AppleWebKit\/[0-9.]+ \(KHTML, like Gecko\)(?: Version\/[0-9.]+ Safari\/[0-9.]+)?$/;
  const match = pattern.exec(useragent);
  if (!match) {
    return null; // إرجاع null بشكل محمي بدلاً من التجميد الصامت
  }

  if (match[1] == "4") {
    return parseInt(`0x0${match[2].replace(".", "").padStart(4, "0")}`);
  } else if (match[1] == "5") {
    return parseInt(`0x1${match[2].replace(".", "").padStart(4, "0")}`);
  }
}

export let target = null;

// تشغيل الفحص الآمن؛ إذا كان الجهاز بلايستيشن يتم تعيينه، وإذا كان جهازاً آخر يستمر الموقع بالعمل دون كراش
const detectedTarget = get_target_from_ua(navigator.userAgent);
if (detectedTarget !== null) {
    set_target(detectedTarget);
} else {
    // توجيه افتراضي آمن أو تسجيل ملحوظة داخل لوحة التحكم بدون تجميد
    target = null; 
}
