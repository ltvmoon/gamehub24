"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSize = calculateSize;
exports.log = log;
exports.formatSize = formatSize;
exports.uuidShort = uuidShort;
exports.formatUpTime = formatUpTime;
const uuid_1 = require("uuid");
function calculateSize(obj) {
    const json = JSON.stringify(obj);
    const size = Buffer.byteLength(json, "utf8");
    return { json, size };
}
function log(...args) {
    const now = new Date();
    // This automatically calculates the offset for Vietnam (ICT)
    const vietnamTime = now.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour12: false, // Use 24-hour format if preferred
    });
    console.log(`[${vietnamTime}]`, ...args);
}
function formatSize(size) {
    if (size < 1024)
        return `${size} B`;
    if (size < 1024 * 1024)
        return `${(size / 1024).toFixed(2)} KB`;
    if (size < 1024 * 1024 * 1024)
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function uuidShort() {
    return (0, uuid_1.v4)().substring(0, 8);
}
function formatUpTime(diff) {
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const hoursRemainder = hours % 24;
    const minutesRemainder = minutes % 60;
    const secondsRemainder = seconds % 60;
    return `${days}d ${hoursRemainder}h ${minutesRemainder}m ${secondsRemainder}s`;
}
