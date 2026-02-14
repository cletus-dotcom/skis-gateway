"""
SKIS Gateway – Flask app (Python + PostgreSQL + Waitress).
Runs on port 8035; deployable on Render.com with Supabase Postgres.
"""
import os
import io
import base64
import json

import qrcode
from flask import Flask, request, redirect, url_for, render_template, flash
from dotenv import load_dotenv

load_dotenv()

from db import init_db, create_submission, get_submission, set_reference_number
from email_verification import send_verification_email

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
# Reload templates from disk when they change (no server restart needed)
app.config["TEMPLATES_AUTO_RELOAD"] = True

PORT = int(os.environ.get("PORT", 8035))
VERIFIER_EMAIL = "cletusacaido@gmail.com"


def qr_data_url(payload: str) -> str:
    """Generate QR code PNG and return as data URL."""
    qr = qrcode.QRCode(version=1, box_size=8, border=4)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0f172a", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode()
    return f"data:image/png;base64,{b64}"


@app.route("/")
def index():
    amount = request.args.get("amount") or request.args.get("amt") or ""
    app_software_name = request.args.get("app_name") or request.args.get("app_software_name") or request.args.get("software") or ""
    return render_template("index.html", amount=amount, app_software_name=app_software_name)


@app.route("/submit", methods=["POST"])
def submit():
    company_name = (request.form.get("company_name") or "").strip()
    address = (request.form.get("address") or "").strip()
    representative_name = (request.form.get("representative_name") or "").strip()
    email = (request.form.get("email") or "").strip()
    contact_number = (request.form.get("contact_number") or "").strip()
    app_software_name = (request.form.get("app_software_name") or "").strip()
    amount = (request.form.get("amount") or "").strip()

    errors = []
    if not company_name:
        errors.append("Company name is required.")
    if not address:
        errors.append("Address is required.")
    if not representative_name:
        errors.append("Name of representative is required.")
    if not email:
        errors.append("Email address is required.")
    if not contact_number:
        errors.append("Contact number is required.")
    try:
        amt_val = float(amount.replace(",", ""))
        if amt_val <= 0:
            errors.append("Amount must be greater than 0.")
    except (ValueError, TypeError):
        errors.append("Please enter a valid amount.")

    if errors:
        for msg in errors:
            flash(msg, "error")
        return render_template(
            "index.html",
            amount=amount,
            app_software_name=app_software_name,
            company_name=company_name,
            address=address,
            representative_name=representative_name,
            email=email,
            contact_number=contact_number,
        )

    try:
        row = create_submission(
            company_name=company_name,
            address=address,
            representative_name=representative_name,
            email=email,
            contact_number=contact_number,
            app_software_name=app_software_name,
            amount=amount,
        )
    except Exception as e:
        flash(f"Could not save submission: {e}", "error")
        return render_template(
            "index.html",
            amount=amount,
            app_software_name=app_software_name,
            company_name=company_name,
            address=address,
            representative_name=representative_name,
            email=email,
            contact_number=contact_number,
        )

    return redirect(url_for("qr", submission_id=str(row["id"])))


@app.route("/qr/<submission_id>")
def qr(submission_id):
    sub = get_submission(submission_id)
    if not sub:
        flash("Submission not found.", "error")
        return redirect(url_for("index"))
    payload = json.dumps({
        "type": "skis_gateway",
        "amount": sub["amount"],
        "company": sub["company_name"],
        "rep": sub["representative_name"],
        "app": sub.get("app_software_name") or "",
    })
    qr_url = qr_data_url(payload)
    return render_template(
        "qr.html",
        submission_id=submission_id,
        amount=sub["amount"],
        qr_data_url=qr_url,
    )


@app.route("/verify/<submission_id>", methods=["GET", "POST"])
def verify(submission_id):
    sub = get_submission(submission_id)
    if not sub:
        flash("Submission not found.", "error")
        return redirect(url_for("index"))

    if request.method == "POST":
        reference_number = (request.form.get("reference_number") or "").strip()
        if not reference_number:
            flash("Please enter the GCash/QR Ph reference number.", "error")
            return render_template("reference.html", submission_id=submission_id, submission=sub)

        try:
            set_reference_number(submission_id, reference_number)
        except Exception as e:
            flash(f"Could not save reference: {e}", "error")
            return render_template("reference.html", submission_id=submission_id, submission=sub)

        try:
            send_verification_email(
                company_name=sub["company_name"],
                address=sub["address"],
                representative_name=sub["representative_name"],
                email=sub["email"],
                contact_number=sub["contact_number"],
                amount=sub["amount"],
                reference_number=reference_number,
                verifier_email=VERIFIER_EMAIL,
                app_software_name=sub.get("app_software_name"),
            )
        except Exception as e:
            flash(f"Verification email could not be sent: {e}", "error")
            return render_template("reference.html", submission_id=submission_id, submission=sub)

        return redirect(url_for("success", submission_id=submission_id))

    return render_template("reference.html", submission_id=submission_id, submission=sub)


@app.route("/success/<submission_id>")
def success(submission_id):
    sub = get_submission(submission_id)
    if not sub:
        flash("Submission not found.", "error")
        return redirect(url_for("index"))
    return render_template("success.html", submission=sub, verifier_email=VERIFIER_EMAIL)


def main():
    if os.environ.get("DATABASE_URL"):
        init_db()
    from waitress import serve
    print(f"SKIS Gateway running at http://0.0.0.0:{PORT}")
    serve(app, host="0.0.0.0", port=PORT)


if __name__ == "__main__":
    main()
