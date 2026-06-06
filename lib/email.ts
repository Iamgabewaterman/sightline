import { Resend } from "resend";

// Set RESEND_FROM="Sightline <support@sightline.one>" in env once domain is verified in Resend
const FROM = process.env.RESEND_FROM ?? "Sightline <onboarding@resend.dev>";

// Lazy so the module can be imported at build time without crashing when the key is absent
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function fmtAmount(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateStr(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function ctaButton(label: string, url: string): string {
  return `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 8px;">
      <tr>
        <td align="center">
          <a href="${url}" style="display:inline-block;background-color:#F97316;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;text-decoration:none;padding:18px 40px;border-radius:12px;min-width:220px;text-align:center;">${label}</a>
        </td>
      </tr>
    </table>`;
}

function wrapper(businessName: string, body: string, replyEmail?: string | null): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background-color:#F97316;padding:28px 32px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:-0.2px;">${businessName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            ${replyEmail ? `<p style="margin:0 0 6px;color:#6b7280;font-size:13px;">Questions? Reply to this email or contact <a href="mailto:${replyEmail}" style="color:#F97316;text-decoration:none;">${replyEmail}</a></p>` : ""}
            <p style="margin:0;color:#9ca3af;font-size:12px;">Powered by Sightline &mdash; Built for contractors</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendQuoteEmail(params: {
  to: string;
  clientName: string | null;
  businessName: string;
  contractorEmail: string | null;
  jobName: string;
  quoteTotal: number;
  signUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { to, clientName, businessName, contractorEmail, jobName, quoteTotal, signUrl } = params;
  const hi = clientName ? `Hi ${clientName.split(" ")[0]},` : "Hello,";

  const body = `
    <p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:#111827;">${hi}</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Your quote for <strong>${jobName}</strong> is ready to review and sign.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:4px;">
      <tr>
        <td style="padding:20px 24px 8px;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:bold;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Project</p>
          <p style="margin:0;font-size:16px;font-weight:bold;color:#111827;">${jobName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 24px 20px;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:bold;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Quote Total</p>
          <p style="margin:0;font-size:30px;font-weight:bold;color:#F97316;">${fmtAmount(quoteTotal)}</p>
        </td>
      </tr>
    </table>
    ${ctaButton("Review &amp; Sign Quote &rarr;", signUrl)}
    <p style="margin:4px 0 0;font-size:13px;color:#9ca3af;text-align:center;">Takes less than a minute. No account required.</p>
  `;

  await resend.emails.send({
    from: FROM,
    ...(contractorEmail ? { replyTo: contractorEmail } : {}),
    to,
    subject: `Your quote from ${businessName} is ready to review`,
    html: wrapper(businessName, body, contractorEmail),
  });
}

export async function sendInvoiceEmail(params: {
  to: string;
  clientName: string | null;
  businessName: string;
  contractorEmail: string | null;
  jobName: string;
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  dueDate: string | null;
  lineItems: Array<{ name: string; amount: number }>;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const {
    to, clientName, businessName, contractorEmail,
    jobName, invoiceId, invoiceNumber, total, dueDate, lineItems,
  } = params;
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://sightline.one";
  const payUrl = `${origin}/pay/${invoiceId}`;
  const hi = clientName ? `Hi ${clientName.split(" ")[0]},` : "Hello,";
  const dueLine = dueDate ? `Due ${fmtDateStr(dueDate)}` : "Due on receipt";
  const subjectDue = dueDate ? `due ${fmtDateStr(dueDate)}` : "due on receipt";

  const rows = lineItems.length > 0
    ? lineItems.map((item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">${item.name}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:600;color:#374151;text-align:right;white-space:nowrap;">${fmtAmount(item.amount)}</td>
        </tr>`).join("")
    : `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">Professional Services &mdash; ${jobName}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:600;color:#374151;text-align:right;white-space:nowrap;">${fmtAmount(total)}</td>
      </tr>`;

  const body = `
    <p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:#111827;">${hi}</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      An invoice has been sent for <strong>${jobName}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:4px;">
      <tr>
        <td style="background-color:#f9fafb;padding:12px 20px;border-bottom:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;font-weight:bold;color:#9ca3af;">${invoiceNumber}</p>
        </td>
        <td style="background-color:#f9fafb;padding:12px 20px;border-bottom:1px solid #e5e7eb;text-align:right;">
          <p style="margin:0;font-size:12px;font-weight:600;color:#6b7280;">${dueLine}</p>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:16px 20px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            ${rows}
            <tr>
              <td style="padding:14px 0 0;font-size:15px;font-weight:bold;color:#111827;">Total Due</td>
              <td style="padding:14px 0 0;text-align:right;font-size:24px;font-weight:bold;color:#F97316;white-space:nowrap;">${fmtAmount(total)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${ctaButton("Pay Now &rarr;", payUrl)}
    <p style="margin:4px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
      Pay securely by bank transfer ($5 flat) or card (2.9% + $0.30).
    </p>
  `;

  await resend.emails.send({
    from: FROM,
    ...(contractorEmail ? { replyTo: contractorEmail } : {}),
    to,
    subject: `Invoice from ${businessName} — ${fmtAmount(total)} ${subjectDue}`,
    html: wrapper(businessName, body, contractorEmail),
  });
}

export async function sendPaymentConfirmationEmail(params: {
  to: string;
  clientName: string | null;
  businessName: string;
  contractorEmail: string | null;
  contractorPhone: string | null;
  jobName: string;
  amountPaid: number;
  paidAt: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const {
    to, clientName, businessName, contractorEmail, contractorPhone, jobName, amountPaid, paidAt,
  } = params;
  const hi = clientName ? `Hi ${clientName.split(" ")[0]},` : "Hello,";
  const paidDate = new Date(paidAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const contactLines = [
    contractorEmail
      ? `<p style="margin:0 0 4px;font-size:14px;color:#374151;">Email: <a href="mailto:${contractorEmail}" style="color:#F97316;text-decoration:none;">${contractorEmail}</a></p>`
      : "",
    contractorPhone
      ? `<p style="margin:0;font-size:14px;color:#374151;">Phone: ${contractorPhone}</p>`
      : "",
  ].filter(Boolean).join("");

  const body = `
    <p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:#111827;">${hi}</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Your payment has been received. Thank you!
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin-bottom:24px;">
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:bold;color:#16a34a;text-transform:uppercase;letter-spacing:0.06em;">Payment Confirmed</p>
          <p style="margin:0 0 16px;font-size:34px;font-weight:bold;color:#15803d;">${fmtAmount(amountPaid)}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#374151;"><strong>Project:</strong> ${jobName}</p>
          <p style="margin:0;font-size:13px;color:#374151;"><strong>Date:</strong> ${paidDate}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#111827;">Your contractor</p>
    <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#374151;">${businessName}</p>
    ${contactLines || `<p style="margin:0;font-size:14px;color:#9ca3af;">No contact details on file.</p>`}
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Keep this email as your payment receipt.</p>
  `;

  await resend.emails.send({
    from: FROM,
    ...(contractorEmail ? { replyTo: contractorEmail } : {}),
    to,
    subject: "Payment confirmed — thank you",
    html: wrapper(businessName, body, contractorEmail),
  });
}
