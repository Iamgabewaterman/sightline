export const NOTIF_TYPES = {
  money: [
    { key: "invoice_paid",    label: "Invoice paid" },
    { key: "invoice_viewed",  label: "Invoice viewed" },
    { key: "invoice_overdue", label: "Invoice overdue" },
    { key: "payment_failed",  label: "Payment failed" },
  ],
  jobsite: [
    { key: "clocked_in",          label: "Clocked in" },
    { key: "clocked_out",         label: "Clocked out" },
    { key: "not_clocked_in",      label: "Not clocked in" },
    { key: "job_assigned",        label: "Job assigned" },
    { key: "assignment_reminder", label: "Assignment reminder" },
    { key: "no_crew_assigned",    label: "No crew assigned" },
    { key: "punch_list_complete", label: "Punch list complete" },
    { key: "photo_uploaded",      label: "Photo uploaded" },
    { key: "job_on_hold",         label: "Job put on hold" },
  ],
  operational: [
    { key: "no_activity_3_days",    label: "No activity 3 days" },
    { key: "materials_over_budget", label: "Materials over budget" },
    { key: "labor_near_budget",     label: "Labor near budget" },
    { key: "job_falling_behind",    label: "Job falling behind" },
  ],
  client: [
    { key: "portal_viewed", label: "Portal viewed" },
    { key: "quote_signed",  label: "Quote signed" },
  ],
} as const;

export type NotifKey =
  | "invoice_paid" | "invoice_viewed" | "invoice_overdue" | "payment_failed"
  | "clocked_in" | "clocked_out" | "not_clocked_in" | "job_assigned"
  | "assignment_reminder" | "no_crew_assigned" | "punch_list_complete"
  | "photo_uploaded" | "job_on_hold"
  | "no_activity_3_days" | "materials_over_budget" | "labor_near_budget" | "job_falling_behind"
  | "portal_viewed" | "quote_signed";
