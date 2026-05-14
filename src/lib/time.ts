import { differenceInMinutes, parseISO } from "date-fns";
import { rangesOverlap } from "./booking-logic";
import type { BookingBlock } from "./domain";

export const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

export function blockHours(blocks: BookingBlock[]) {
  return blocks.reduce((total, block) => {
    const minutes = differenceInMinutes(parseISO(block.end), parseISO(block.start));
    return total + Math.max(minutes, 0) / 60;
  }, 0);
}

export function withinUploadLimit(bytes: number, maxBytes = UPLOAD_MAX_BYTES) {
  return bytes > 0 && bytes <= maxBytes;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return rangesOverlap({ start: aStart, end: aEnd }, { start: bStart, end: bEnd });
}
