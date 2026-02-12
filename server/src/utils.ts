import { v4 as uuidv4 } from "uuid";

export function calculateSize(obj: any): { json: string; size: number } {
  const json = JSON.stringify(obj);
  const size = Buffer.byteLength(json, "utf8");
  return { json, size };
}

export function log(...args: any[]) {
  const now = new Date();

  // This automatically calculates the offset for Vietnam (ICT)
  const vietnamTime = now.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false, // Use 24-hour format if preferred
  });

  console.log(`[${vietnamTime}]`, ...args);
}

export function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function uuidShort(): string {
  return uuidv4().substring(0, 8);
}

export function formatUpTime(diff: number) {
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const hoursRemainder = hours % 24;
  const minutesRemainder = minutes % 60;
  const secondsRemainder = seconds % 60;
  return `${days}d ${hoursRemainder}h ${minutesRemainder}m ${secondsRemainder}s`;
}
