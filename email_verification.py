"""Send verification email to cletusacaido@gmail.com via Resend API."""
import os
import html

VERIFIER_EMAIL = "cletusacaido@gmail.com"
RESEND_API_URL = "https://api.resend.com/emails"


def send_verification_email(
    company_name,
    address,
    representative_name,
    email,
    contact_number,
    amount,
    reference_number,
    verifier_email=VERIFIER_EMAIL,
    app_software_name=None,
):
    api_key = os.environ.get("RESEND_API_KEY")
    from_email = os.environ.get("FROM_EMAIL", "onboarding@resend.dev")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not set")

    def esc(s):
        return html.escape(s or "")

    app_row = ""
    if app_software_name:
        app_row = f'<tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>App/Software name</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">{esc(app_software_name)}</td></tr>'

    html_body = f"""
    <h2>SKIS Gateway – Payment verification request</h2>
    <p>A user has submitted a GCash/QR Ph reference number for verification.</p>
    <table style="border-collapse: collapse;">
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Company name</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">{esc(company_name)}</td></tr>
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Address</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">{esc(address)}</td></tr>
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Representative</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">{esc(representative_name)}</td></tr>
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Email</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">{esc(email)}</td></tr>
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Contact number</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">{esc(contact_number)}</td></tr>
      {app_row}
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>Amount</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">{esc(amount)}</td></tr>
      <tr><td style="padding:6px 12px; border:1px solid #ddd;"><strong>GCash/QR Ph reference number</strong></td><td style="padding:6px 12px; border:1px solid #ddd;">{esc(reference_number)}</td></tr>
    </table>
    <p>Please verify the payment and send a confirmation email to the user at <strong>{esc(email)}</strong>.</p>
    """

    import requests
    resp = requests.post(
        RESEND_API_URL,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        json={
            "from": from_email,
            "to": [verifier_email],
            "subject": f"SKIS Gateway – Verification: {company_name} – Ref: {reference_number}",
            "html": html_body,
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()
