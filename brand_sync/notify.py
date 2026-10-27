"""Optional: email the weekly report (SMTP settings in .env). Nothing is sent if SMTP_HOST is empty."""
import smtplib, logging
from email.message import EmailMessage
from common import env


def send(text):
    host = env('SMTP_HOST')
    to = env('REPORT_TO')
    if not host or not to:
        return
    m = EmailMessage()
    m['Subject'] = env('REPORT_SUBJECT', 'Brand catalogue weekly sync report')
    m['From'] = env('SMTP_FROM', env('SMTP_USER', ''))
    m['To'] = to
    m.set_content(text)
    try:
        with smtplib.SMTP(host, int(env('SMTP_PORT', '587'))) as s:
            s.starttls()
            if env('SMTP_USER'):
                s.login(env('SMTP_USER'), env('SMTP_PASS', ''))
            s.send_message(m)
    except Exception as e:
        logging.warning('report email failed: %s', e)
