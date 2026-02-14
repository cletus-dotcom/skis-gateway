import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

interface Body {
  companyName: string;
  address: string;
  representativeName: string;
  email: string;
  contactNumber: string;
  amount: string;
  referenceNumber: string;
  verifierEmail: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors() });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  const {
    companyName,
    address,
    representativeName,
    email,
    contactNumber,
    amount,
    referenceNumber,
    verifierEmail,
  } = body;

  if (!companyName || !referenceNumber || !verifierEmail) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: companyName, referenceNumber, verifierEmail" }),
      { status: 400, headers: { ...cors(), "Content-Type": "application/json" } }
    );
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Server missing RESEND_API_KEY. Add it in Supabase Edge Function secrets." }),
      { status: 500, headers: { ...cors(), "Content-Type": "application/json" } }
    );
  }

  const html = `
    <h2>SKIS Gateway – Payment verification request</h2>
    <p>A user has submitted a GCash/QR Ph reference number for verification.</p>
    <table style="border-collapse: collapse;">
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Company name</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">${escape(companyName)}</td></tr>
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Address</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">${escape(address ?? "")}</td></tr>
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Representative</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">${escape(representativeName ?? "")}</td></tr>
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Email</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">${escape(email ?? "")}</td></tr>
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Contact number</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">${escape(contactNumber ?? "")}</td></tr>
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Amount</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">${escape(amount ?? "")}</td></tr>
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>GCash/QR Ph reference number</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">${escape(referenceNumber)}</td></tr>
    </table>
    <p>Please verify the payment and send a confirmation email to the user at <strong>${escape(email ?? "")}</strong>.</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [verifierEmail],
      subject: `SKIS Gateway – Verification: ${companyName} – Ref: ${referenceNumber}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(
      JSON.stringify({ error: "Email send failed", detail: err }),
      { status: 502, headers: { ...cors(), "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
