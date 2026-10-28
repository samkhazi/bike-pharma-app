"""Optional: email the weekly report and the TVS OTP / Honda code links (SMTP settings in .env).
On the Bike Pharma server the website's own .env (one folder up) gives SMTP_* when brand_sync/.env has none.
Nothing is sent if there is no SMTP_HOST or REPORT_TO."""
import os, smtplib, logging
from email.message import EmailMessage
from common import env, ROOT


def site_env():
    out = {}
    try:
        for line in open(os.path.join(os.path.dirname(ROOT), '.env'), encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return out


def send_code_link(link):
    """the login code / OTP email: nothing but the Enter code link (Sam 2026-10-28, same for every brand)"""
    send(link, subject='Enter code', html=f'<p><a href="{link}" style="display:inline-block;padding:14px 28px;background:#111;color:#ffd200;'
                                          f'font:bold 18px sans-serif;text-decoration:none;border-radius:8px">Enter code</a></p>')


def send(text, subject=None, html=None):
    site = {} if env('SMTP_HOST') else site_env()
    get = lambda k, d=None: env(k) or site.get(k) or d
    host, to = get('SMTP_HOST'), env('REPORT_TO')
    if not host or not to:
        return
    port = int(get('SMTP_PORT', '587'))
    user, pw = get('SMTP_USER', ''), (get('SMTP_PASS', '') or '').replace(' ', '')
    m = EmailMessage()
    m['Subject'] = subject or env('REPORT_SUBJECT', 'Brand catalogue weekly sync report')
    m['From'] = get('SMTP_FROM', user)
    m['To'] = to
    m.set_content(text)
    if html:
        m.add_alternative(html, subtype='html')
    try:
        with (smtplib.SMTP_SSL(host, port, timeout=60) if port == 465 else smtplib.SMTP(host, port, timeout=60)) as s:
            if port != 465:
                s.starttls()
            if user:
                s.login(user, pw)
            s.send_message(m)
    except Exception as e:
        logging.warning('report email failed: %s', e)
