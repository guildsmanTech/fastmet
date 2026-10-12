export const isDateString = (value: string): boolean => {
  const date = new Date(value);
  return !isNaN(date.getTime());
};

/** True if `date` is within the last `days` (inclusive of the window). */
export function isWithinReportWindow(
  date: string | Date | null | undefined,
  days: number,
): boolean {
  if (!date || days <= 0) return false;
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then <= days * 24 * 60 * 60 * 1000;
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);

  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  const formattedDate = date
    .toLocaleDateString("en-US", dateOptions)
    .replace(",", "")
    .replace(/(\b[A-Za-z]{3})/, "$1."); // add dot after month

  const formattedTime = date.toLocaleTimeString("en-US", timeOptions);

  return `${formattedDate}, ${formattedTime}`;
}

// // ex output "Nov 13, 1:59 PM"
// export function formatDateOnly(dateString: string) {
//   const date = new Date(dateString);
//   return date.toLocaleString("en-US", {
//   month: "short", // "Nov"
//   day: "numeric", // "13"
//   hour: "numeric", // "1"
//   minute: "2-digit",
//   hour12: true,
// });

// }

/**
 * Format date like Messenger:
 * - "Just now" (< 1 min)
 * - "5m" (< 1 hour)
 * - "2h" (< 24 hours)
 * - "Yesterday" (yesterday)
 * - "Mon" (this week)
 * - "Dec 8" (this year)
 * - "12/8/24" (older)
 */
export const formatLastMessageTime = (date: Date | string | number): string => {
  const now = new Date();
  const messageDate = new Date(date);

  // Calculate difference in milliseconds
  const diffMs = now.getTime() - messageDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Just now (< 1 minute)
  if (diffMins < 1) {
    return "Just now";
  }

  // Minutes ago (< 1 hour)
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  // Hours ago (< 24 hours)
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    messageDate.getDate() === yesterday.getDate() &&
    messageDate.getMonth() === yesterday.getMonth() &&
    messageDate.getFullYear() === yesterday.getFullYear()
  ) {
    return "Yesterday";
  }

  // This week (show day name)
  if (diffDays < 7) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[messageDate.getDay()];
  }

  // This year (show month and day)
  if (messageDate.getFullYear() === now.getFullYear()) {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[messageDate.getMonth()]} ${messageDate.getDate()}`;
  }

  // Older than this year (show short date)
  const month = messageDate.getMonth() + 1;
  const day = messageDate.getDate();
  const year = messageDate.getFullYear().toString().slice(-2);
  return `${month}/${day}/${year}`;
};

// Format duration: convert to hours if >= 60 minutes
export const formatDuration = (minutes: number) => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${Math.round(minutes)} min`;
};
