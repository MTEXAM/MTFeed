/**
 * Utilities for formatting real timestamps and relative time in Thai.
 */

export function formatRealTime(timestampMs?: number): string {
  if (!timestampMs) {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} น.`;
  }

  const date = new Date(timestampMs);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];

  const now = new Date();
  const isToday = now.getDate() === day && now.getMonth() === date.getMonth() && now.getFullYear() === date.getFullYear();

  if (isToday) {
    return `${hours}:${minutes} น.`;
  }
  return `${day} ${month} ${hours}:${minutes} น.`;
}

export function formatRelativeOrRealTime(timestampMs?: number, fallbackStr?: string): string {
  if (!timestampMs) {
    if (fallbackStr && fallbackStr !== 'เมื่อสักครู่') {
      return fallbackStr;
    }
    return formatRealTime();
  }

  const now = Date.now();
  const diffMs = now - timestampMs;

  if (diffMs < 0 || diffMs < 30_000) {
    return 'เมื่อสักครู่';
  }

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) {
    return `${diffMin} นาทีที่แล้ว`;
  }

  const diffHour = Math.floor(diffMin / 3600_000);
  if (diffHour < 24) {
    return `${diffHour} ชั่วโมงที่แล้ว`;
  }

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) {
    return `${diffDay} วันที่แล้ว`;
  }

  return formatRealTime(timestampMs);
}

export function formatFullDateTime(timestampMs?: number): string {
  const date = timestampMs ? new Date(timestampMs) : new Date();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;

  return `${day} ${month} ${year} เวลา ${hours}:${minutes}:${seconds} น.`;
}
