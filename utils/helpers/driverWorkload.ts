import type {DriverQueue, RequestedDriver} from "@/types/book";

/** free: no other deliveries. busy: other deliveries. priority: a priority delivery comes first. */
export type WorkloadTone = "free" | "busy" | "priority";

export type WorkloadLabel = {
  tone: WorkloadTone;
  title: string;
  detail: string;
};

const otherDeliveries = (count: number) =>
  `${count} other ${count === 1 ? "delivery" : "deliveries"}`;

/** What an offering driver is already handling (ASAP offer list / driver details). */
export function describeOfferWorkload(
  driver: Pick<RequestedDriver, "activeBookingCount" | "hasPriority">,
): WorkloadLabel {
  const count = Math.max(0, driver.activeBookingCount ?? 0);

  if (driver.hasPriority) {
    return {
      tone: "priority",
      title: "Finishing a priority delivery first",
      detail:
        count > 1
          ? `Also handling ${otherDeliveries(count - 1)}. They'll come to you after the priority delivery.`
          : "They'll come to you after their priority delivery.",
    };
  }

  if (count > 0) {
    return {
      tone: "busy",
      title: `Handling ${otherDeliveries(count)}`,
      detail: "They may make other stops, so pickup can take a little longer.",
    };
  }

  return {
    tone: "free",
    title: "Available now",
    detail: "This driver has no other deliveries.",
  };
}

/** Where an in-progress booking stands in its driver's work, or null when there is nothing to tell. */
export function describeDriverQueue(
  queue: DriverQueue | null | undefined,
): WorkloadLabel | null {
  if (!queue) return null;

  if (queue.waitingForPriority) {
    return {
      tone: "priority",
      title: "Your driver is finishing a priority delivery first",
      detail: "They'll head to you right after. Your ETA includes that stop.",
    };
  }

  if (queue.otherActiveCount > 0) {
    return {
      tone: "busy",
      title: `Your driver is also handling ${otherDeliveries(queue.otherActiveCount)}`,
      detail:
        "They may make other stops, so their route can differ from the direct way to you.",
    };
  }

  return null;
}
