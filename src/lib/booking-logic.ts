export type BookingRange = {
  start: string;
  end: string;
};

export type BookingBlockLabel = "Setup" | "Session" | "Cleanup";

export type BookingBlock = BookingRange & {
  label: BookingBlockLabel;
};

export type RoomTypeRequest = {
  roomTypeId: string;
  quantity: number;
};

export type RoomSelectionMode = "SpecificRooms" | "RoomTypeQuantity";

export type BookingRoomSelection =
  | {
      roomSelectionMode: "SpecificRooms";
      requestedRoomIds: string[];
      roomTypeRequests?: RoomTypeRequest[];
    }
  | {
      roomSelectionMode: "RoomTypeQuantity";
      requestedRoomIds?: string[];
      roomTypeRequests: RoomTypeRequest[];
    };

export type RoomTypeBookingRule = {
  id: string;
  name: string;
  maxBookingDurationMinutes?: number;
  standardSetupMinutes?: number;
  standardCleanupMinutes?: number;
};

export type BookingNoticeViolationMode = "Block" | "Warn";

export type BookingNoticeRules = {
  minimumAdvanceBookingDays?: number;
  maximumAdvanceBookingDays?: number;
  violationMode: BookingNoticeViolationMode;
};

export type BookingNoticeViolationType =
  | "minimum_advance"
  | "maximum_advance";

export type BookingNoticeViolation = {
  type: BookingNoticeViolationType;
  message: string;
  limitDays: number;
  daysFromNow: number;
  requiresAdditionalApproval: boolean;
};

export type BookingNoticeEvaluation = {
  canSubmit: boolean;
  requiresAdditionalApproval: boolean;
  canOverride: boolean;
  overrideRequired: boolean;
  violations: BookingNoticeViolation[];
};

export const DEFAULT_BOOKING_NOTICE_RULES: BookingNoticeRules = {
  violationMode: "Block",
};

export function occupiedBookingWindow(blocks: BookingRange[]): BookingRange[] {
  const starts = blocks.map((block) => Date.parse(block.start));
  const ends = blocks.map((block) => Date.parse(block.end));
  const earliestStart = Math.min(...starts);
  const latestEnd = Math.max(...ends);

  if (!Number.isFinite(earliestStart) || !Number.isFinite(latestEnd)) {
    return blocks;
  }

  return [
    {
      start: new Date(earliestStart).toISOString(),
      end: new Date(latestEnd).toISOString(),
    },
  ];
}

export function sessionBookingRange(blocks: BookingRange[]) {
  return (
    blocks.find(
      (block): block is BookingBlock =>
        "label" in block && block.label === "Session"
    ) ?? blocks[0]
  );
}

export function validateBookingBlocks(blocks: BookingBlock[]) {
  const setup = blocks.find((block) => block.label === "Setup");
  const session = blocks.find((block) => block.label === "Session");
  const cleanup = blocks.find((block) => block.label === "Cleanup");

  if (!setup || !session || !cleanup) {
    return "Setup, session, and cleanup times are required.";
  }

  const ordered = [setup, session, cleanup];

  for (const block of ordered) {
    const start = Date.parse(block.start);
    const end = Date.parse(block.end);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return "Booking times must be valid dates and times.";
    }

    if (start >= end) {
      return `${block.label} start must be before ${block.label.toLowerCase()} end.`;
    }
  }

  if (Date.parse(setup.end) > Date.parse(session.start)) {
    return "Setup must end before the session starts.";
  }

  if (Date.parse(session.end) > Date.parse(cleanup.start)) {
    return "Cleanup cannot start before the session ends.";
  }

  return null;
}

export function sessionBlocksOnly(blocks: BookingRange[]) {
  return blocks.filter(
    (block): block is BookingBlock =>
      "label" in block && block.label === "Session"
  );
}

export function durationMinutesForRange(range: BookingRange) {
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  return Math.ceil((end - start) / 60000);
}

export function occupancyDurationMinutes(blocks: BookingRange[]) {
  return bookingDurationMinutes(occupiedBookingWindow(blocks));
}

export function sessionDurationMinutes(blocks: BookingRange[]) {
  const session = sessionBookingRange(blocks);
  return session ? durationMinutesForRange(session) : null;
}

export function validationDurationMinutes(blocks: BookingRange[]) {
  return sessionDurationMinutes(blocks);
}

export function roomTypeBufferMinutes(
  roomTypeRequests: RoomTypeRequest[],
  roomTypes: RoomTypeBookingRule[]
) {
  const selectedTypeIds = new Set(
    roomTypeRequests
      .filter((request) => request.quantity > 0)
      .map((request) => request.roomTypeId)
  );
  const selectedRoomTypes = roomTypes.filter((roomType) =>
    selectedTypeIds.has(roomType.id)
  );

  return {
    setupMinutes: Math.max(
      30,
      ...selectedRoomTypes.map((roomType) => roomType.standardSetupMinutes ?? 30)
    ),
    cleanupMinutes: Math.max(
      30,
      ...selectedRoomTypes.map((roomType) => roomType.standardCleanupMinutes ?? 30)
    ),
  };
}

export function bookingBlocksFromSessionWindow(
  sessionStart: string,
  sessionEnd: string,
  buffers: { setupMinutes: number; cleanupMinutes: number }
): BookingBlock[] {
  const sessionStartMs = Date.parse(sessionStart);
  const sessionEndMs = Date.parse(sessionEnd);

  return [
    {
      label: "Setup",
      start: Number.isFinite(sessionStartMs)
        ? new Date(sessionStartMs - buffers.setupMinutes * 60000).toISOString()
        : sessionStart,
      end: sessionStart,
    },
    {
      label: "Session",
      start: sessionStart,
      end: sessionEnd,
    },
    {
      label: "Cleanup",
      start: sessionEnd,
      end: Number.isFinite(sessionEndMs)
        ? new Date(sessionEndMs + buffers.cleanupMinutes * 60000).toISOString()
        : sessionEnd,
    },
  ];
}

function dayNameForDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: timezone,
  }).format(date);
}

function timeMinutesForDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  return hour * 60 + minute;
}

function parseHoursOfOperation(hoursOfOperation: string) {
  const hoursByDay = new Map<string, {
    publicOpen: number;
    publicClose: number;
    staffOpen: number;
    staffClose: number;
    closed: boolean;
  }>();
  const dayAliases: Record<string, string[]> = {
    "Mon-Fri": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  };

  for (const line of hoursOfOperation.split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    const rangeMatch = line.match(/^(Mon-Fri):\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);

    if (rangeMatch) {
      const [, range, openHour, openMinute, closeHour, closeMinute] = rangeMatch;
      for (const day of dayAliases[range] ?? []) {
        const publicOpen = Number(openHour) * 60 + Number(openMinute);
        const publicClose = Number(closeHour) * 60 + Number(closeMinute);
        hoursByDay.set(day, {
          publicOpen,
          publicClose,
          staffOpen: Math.max(0, publicOpen - 30),
          staffClose: publicClose + 30,
          closed: false,
        });
      }
      continue;
    }

    if (!match) continue;

    const [, day, value] = match;

    if (value.trim().toLowerCase() === "closed") {
      hoursByDay.set(day, {
        publicOpen: 0,
        publicClose: 0,
        staffOpen: 0,
        staffClose: 0,
        closed: true,
      });
      continue;
    }

    const splitMatch = value.match(
      /Public\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2});\s*Staff\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/i
    );

    if (splitMatch) {
      const [
        ,
        publicOpenHour,
        publicOpenMinute,
        publicCloseHour,
        publicCloseMinute,
        staffOpenHour,
        staffOpenMinute,
        staffCloseHour,
        staffCloseMinute,
      ] = splitMatch;

      hoursByDay.set(day, {
        publicOpen: Number(publicOpenHour) * 60 + Number(publicOpenMinute),
        publicClose: Number(publicCloseHour) * 60 + Number(publicCloseMinute),
        staffOpen: Number(staffOpenHour) * 60 + Number(staffOpenMinute),
        staffClose: Number(staffCloseHour) * 60 + Number(staffCloseMinute),
        closed: false,
      });
      continue;
    }

    const timeMatch = value.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!timeMatch) continue;

    const [, openHour, openMinute, closeHour, closeMinute] = timeMatch;
    const publicOpen = Number(openHour) * 60 + Number(openMinute);
    const publicClose = Number(closeHour) * 60 + Number(closeMinute);

    hoursByDay.set(day, {
      publicOpen,
      publicClose,
      staffOpen: Math.max(0, publicOpen - 30),
      staffClose: publicClose + 30,
      closed: false,
    });
  }

  return hoursByDay;
}

export function validateSessionWithinOpeningHours(
  sessionBlock: BookingRange,
  hoursOfOperation: string,
  timezone: string
) {
  const start = new Date(sessionBlock.start);
  const end = new Date(sessionBlock.end);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return "Session start and finish must be valid dates and times.";
  }

  const startDay = dayNameForDate(start, timezone);
  const endDay = dayNameForDate(end, timezone);

  if (startDay !== endDay) {
    return "Session start and finish must be on the same opening day.";
  }

  const dayHours = parseHoursOfOperation(hoursOfOperation).get(startDay);

  if (!dayHours) {
    return null;
  }

  if (dayHours.closed) {
    return `${startDay} is closed for bookings.`;
  }

  const startMinutes = timeMinutesForDate(start, timezone);
  const endMinutes = timeMinutesForDate(end, timezone);

  if (startMinutes < dayHours.publicOpen || endMinutes > dayHours.publicClose) {
    return `Session time must be within ${startDay} opening hours.`;
  }

  return null;
}

export function validateBookingWithinStaffHours(
  bookingWindow: BookingRange,
  hoursOfOperation: string,
  timezone: string
) {
  const start = new Date(bookingWindow.start);
  const end = new Date(bookingWindow.end);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return "Booking window must be a valid date and time.";
  }

  const startDay = dayNameForDate(start, timezone);
  const endDay = dayNameForDate(end, timezone);

  if (startDay !== endDay) {
    return "Setup, session, and cleanup must fit within one staff opening day.";
  }

  const dayHours = parseHoursOfOperation(hoursOfOperation).get(startDay);

  if (!dayHours) return null;

  if (dayHours.closed) {
    return `${startDay} is closed for bookings.`;
  }

  const startMinutes = timeMinutesForDate(start, timezone);
  const endMinutes = timeMinutesForDate(end, timezone);

  if (startMinutes < dayHours.staffOpen || endMinutes > dayHours.staffClose) {
    return `Setup and cleanup must fit within ${startDay} staff opening hours.`;
  }

  return null;
}

export function validateRoomSelectionState(selection: BookingRoomSelection) {
  const requestedRoomIds = selection.requestedRoomIds ?? [];
  const roomTypeRequests = selection.roomTypeRequests ?? [];

  if (selection.roomSelectionMode === "SpecificRooms") {
    if (requestedRoomIds.length === 0) {
      return "Select at least one room.";
    }

    if (new Set(requestedRoomIds).size !== requestedRoomIds.length) {
      return "The same room cannot be requested more than once.";
    }

    if (roomTypeRequests.some((request) => request.quantity > 0)) {
      return "Specific room requests cannot also include room type quantities.";
    }

    return null;
  }

  if (requestedRoomIds.length > 0) {
    return "Room type quantity requests cannot also include specific rooms.";
  }

  const selectedRoomTypeRequests = roomTypeRequests.filter(
    (request) => request.quantity > 0
  );

  if (selectedRoomTypeRequests.length === 0) {
    return "Select at least one room type.";
  }

  if (selectedRoomTypeRequests.length !== roomTypeRequests.length) {
    return "Room quantities must be whole numbers greater than zero.";
  }

  if (
    selectedRoomTypeRequests.some(
      (request) => !Number.isInteger(request.quantity) || request.quantity <= 0
    )
  ) {
    return "Room quantities must be whole numbers greater than zero.";
  }

  if (
    new Set(selectedRoomTypeRequests.map((request) => request.roomTypeId)).size !==
    selectedRoomTypeRequests.length
  ) {
    return "The same room type cannot be requested more than once.";
  }

  return null;
}

export function bookingDurationMinutes(blocks: BookingRange[]) {
  const starts = blocks.map((block) => Date.parse(block.start));
  const ends = blocks.map((block) => Date.parse(block.end));
  const earliestStart = Math.min(...starts);
  const latestEnd = Math.max(...ends);

  if (!Number.isFinite(earliestStart) || !Number.isFinite(latestEnd) || latestEnd <= earliestStart) {
    return null;
  }

  return Math.ceil((latestEnd - earliestStart) / 60000);
}

function localDateParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(value);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function localDayIndex(value: Date, timezone: string) {
  const parts = localDateParts(value, timezone);
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

function normalizeNoticeRules(
  rules?: Partial<BookingNoticeRules>
): BookingNoticeRules {
  return {
    minimumAdvanceBookingDays:
      rules?.minimumAdvanceBookingDays !== undefined
        ? Math.max(0, Math.floor(rules.minimumAdvanceBookingDays))
        : undefined,
    maximumAdvanceBookingDays:
      rules?.maximumAdvanceBookingDays !== undefined
        ? Math.max(0, Math.floor(rules.maximumAdvanceBookingDays))
        : undefined,
    violationMode: rules?.violationMode ?? DEFAULT_BOOKING_NOTICE_RULES.violationMode,
  };
}

export function evaluateBookingNoticeWindow(args: {
  sessionStart: string;
  rules?: Partial<BookingNoticeRules>;
  timezone: string;
  now?: Date;
  canOverride?: boolean;
  overrideAcknowledged?: boolean;
}): BookingNoticeEvaluation {
  const rules = normalizeNoticeRules(args.rules);
  const sessionStart = new Date(args.sessionStart);

  if (!Number.isFinite(sessionStart.getTime())) {
    return {
      canSubmit: false,
      requiresAdditionalApproval: false,
      canOverride: args.canOverride ?? false,
      overrideRequired: false,
      violations: [
        {
          type: "minimum_advance",
          message: "Session start must be a valid date and time.",
          limitDays: 0,
          daysFromNow: 0,
          requiresAdditionalApproval: false,
        },
      ],
    };
  }

  const todayIndex = localDayIndex(args.now ?? new Date(), args.timezone);
  const sessionIndex = localDayIndex(sessionStart, args.timezone);
  const daysFromNow = sessionIndex - todayIndex;
  const violations: BookingNoticeViolation[] = [];

  if (
    rules.minimumAdvanceBookingDays !== undefined &&
    daysFromNow < rules.minimumAdvanceBookingDays
  ) {
    violations.push({
      type: "minimum_advance",
      message: `Bookings require at least ${rules.minimumAdvanceBookingDays} days notice.`,
      limitDays: rules.minimumAdvanceBookingDays,
      daysFromNow,
      requiresAdditionalApproval: rules.violationMode === "Warn",
    });
  }

  if (
    rules.maximumAdvanceBookingDays !== undefined &&
    daysFromNow > rules.maximumAdvanceBookingDays
  ) {
    violations.push({
      type: "maximum_advance",
      message: `Bookings cannot be made more than ${rules.maximumAdvanceBookingDays} days in advance.`,
      limitDays: rules.maximumAdvanceBookingDays,
      daysFromNow,
      requiresAdditionalApproval: rules.violationMode === "Warn",
    });
  }

  const hasViolations = violations.length > 0;
  const canOverride = args.canOverride ?? false;
  const blocksSubmission = hasViolations && rules.violationMode === "Block";
  const overrideRequired = blocksSubmission && canOverride;
  const overrideAccepted = overrideRequired && args.overrideAcknowledged === true;
  const canSubmit = !blocksSubmission || overrideAccepted || !hasViolations;

  return {
    canSubmit,
    requiresAdditionalApproval: hasViolations,
    canOverride,
    overrideRequired,
    violations: violations.map((violation) => ({
      ...violation,
      requiresAdditionalApproval: true,
    })),
  };
}

export function formatBookingDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hourLabel = `${hours} hr${hours === 1 ? "" : "s"}`;

  if (remainingMinutes === 0) {
    return hourLabel;
  }

  return `${hourLabel} ${remainingMinutes} min`;
}

export function validateMaxBookingDuration(
  blocks: BookingRange[],
  roomTypeRequests: RoomTypeRequest[],
  roomTypes: RoomTypeBookingRule[]
) {
  const durationMinutes = validationDurationMinutes(blocks);

  if (durationMinutes === null) {
    return "Booking start and end times are invalid.";
  }

  const requestedTypeIds = new Set(
    roomTypeRequests
      .filter((request) => request.quantity > 0)
      .map((request) => request.roomTypeId)
  );

  const breachedRule = roomTypes.find(
    (roomType) =>
      requestedTypeIds.has(roomType.id) &&
      roomType.maxBookingDurationMinutes !== undefined &&
      durationMinutes > roomType.maxBookingDurationMinutes
  );

  if (!breachedRule) {
    return null;
  }

  const maxBookingDurationMinutes = breachedRule.maxBookingDurationMinutes;

  if (maxBookingDurationMinutes === undefined) {
    return null;
  }

  return `${breachedRule.name} bookings cannot exceed ${formatBookingDuration(maxBookingDurationMinutes)}.`;
}
