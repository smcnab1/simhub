export type Role = "Admin" | "Staff" | "Requester";
export type RequestStatus = "Pending" | "Approved" | "Completed" | "Declined" | "Cancelled";

export type RoomType = {
  id: string;
  name: string;
  campus: string;
  maxDurationHours: number;
  capacity: number;
  quantity: number;
  isSpecial: boolean;
};

export type BookingBlock = {
  label: "Setup" | "Session" | "Cleanup";
  start: string;
  end: string;
};

export type BookingRequest = {
  id: string;
  sessionName: string;
  requesterName: string;
  requesterEmail: string;
  status: RequestStatus;
  date: string;
  timezone: string;
  rooms: string[];
  blocks: BookingBlock[];
  attendees: number;
  totalHours: number;
  files: string[];
};

export type FormFieldType =
  | "text"
  | "number"
  | "textarea"
  | "radio"
  | "select"
  | "divider"
  | "note"
  | "checkboxGroup";

export type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  helpText?: string;
  options?: string[];
};
