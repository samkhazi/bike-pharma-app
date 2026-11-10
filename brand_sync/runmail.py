"""Update 19o (Sam 2026-11-11): one email when a brand's sync starts and one when it ends; the end email is the same for every brand:
a head table (brand, start, end, time taken, result), a summary of counts by kind, then every change in numbered tables, section by section.
The whole list also goes along as a CSV file (opens in Excel). Times are India time. Section names are the sync's own."""
import csv, io, html, datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo('Asia/Kolkata')
NAMES = {'hero_dms': 'Hero DMS', 'hero': 'Hero', 'honda': 'Honda', 'tvs': 'TVS', 'tvs_guest': 'TVS (guest catalogue)', 'yamaha': 'Yamaha', 'bajaj': 'Bajaj',
         'ktm': 'KTM', 're_spares': 'Royal Enfield (spares store)', 'royal_enfield': 'Royal Enfield (EPC)', 'all': 'All brands'}
# the kinds a section falls under, in the order the email shows them (first match wins)
KINDS = [('Problems', ('nahi', 'error', 'fail')), ('Removed', ('hata', 'band hua')), ('Price changes', ('mrp',)), ('New', ('naya', 'naye', 'nayi', 'pehl')),
         ('Changed', ('badl', '->')), ('Other', ('',))]
MAX_ROWS = 300   # rows of one section shown in the email; the CSV file has all of them


def name(b): return NAMES.get(b, b)
def now(): return datetime.datetime.now(IST)
def stamp(t): return t.strftime('%d %b %Y, %I:%M %p').lstrip('0').replace(' 0', ' ')
def took(sec):
    m = int(round(sec / 60))
    return f'{int(sec)} sec' if sec < 90 else (f'{m} min' if m < 60 else f'{m // 60} h {m % 60:02d} min')
def kind(section):
    s = section.lower()
    return next(k for k, words in KINDS if any(w in s for w in words))


def start_mail(brand, t0, otp=False):
    """(subject, text, html)"""
    n = name(brand)
    subj = f'{n} sync started · {stamp(t0)}'
    note = 'If the site asks for a login code or OTP, a separate "Enter code" email comes.' if otp else 'An email with the result comes when it ends.'
    text = f'{n} weekly sync started.\nStarted: {stamp(t0)} (India time)\n{note}\n'
    body = f'<h2 style="margin:0 0 8px">{html.escape(n)} sync started</h2>' + table([('Brand', n), ('Started', stamp(t0) + ' (India time)'), ('Next', note)])
    return subj, text, page(body)


def table(pairs):
    return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:6px 0 14px">' + ''.join(
        f'<tr><td style="padding:6px 14px 6px 0;color:#666;vertical-align:top;white-space:nowrap">{html.escape(str(k))}</td><td style="padding:6px 0;font-weight:600">{html.escape(str(v))}</td></tr>'
        for k, v in pairs) + '</table>'


def page(body):
    return ('<div style="font:15px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#141413;max-width:760px">'
            '<div style="background:#141413;color:#FFC400;font-weight:800;padding:10px 14px;border-radius:8px 8px 0 0">Bike Pharma · brand sync</div>'
            f'<div style="border:1px solid #e3e1da;border-top:0;border-radius:0 0 8px 8px;padding:16px 14px">{body}</div></div>')


def grid(head, rows, widths=None):
    th = ''.join(f'<th style="text-align:left;padding:7px 10px;background:#f4f2ea;border:1px solid #e3e1da;font-size:13px"{(" width=" + chr(34) + widths[i] + chr(34)) if widths and widths[i] else ""}>{html.escape(h)}</th>' for i, h in enumerate(head))
    tr = ''.join('<tr>' + ''.join(f'<td style="padding:6px 10px;border:1px solid #e3e1da;vertical-align:top">{html.escape(str(c))}</td>' for c in r) + '</tr>' for r in rows)
    return f'<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:6px 0 16px"><tr>{th}</tr>{tr}</table>'


def done_mail(brand, t0, t1, results):
    """results: [(brand name as run, Report or None, error text or '')]  ->  (subject, text, html, csv bytes or None, csv file name)"""
    n = name(brand)
    errs = [(b, e) for b, _, e in results if e]
    secs = {}            # (brand shown, section) -> [texts], in the order they came
    for b, rep, _ in results:
        for sec, t in (rep.lines if rep else []):
            secs.setdefault((getattr(rep, 'brand', None) or name(b), sec), []).append(t)
    total = sum(len(v) for v in secs.values())
    by_kind = {}
    for (b, sec), v in secs.items():
        by_kind.setdefault(kind(sec), []).append((b, sec, v))
    order = [k for k, _ in KINDS if k in by_kind]
    result = 'ERROR' if errs else 'OK'
    counts = ', '.join(f'{sum(len(v) for _, _, v in by_kind[k])} {k.lower()}' for k in order) or 'no changes'
    subj = f'{n} sync done · {result} · {took((t1 - t0).total_seconds())} · {counts}'
    head = [('Brand', n), ('Started', stamp(t0)), ('Ended', stamp(t1) + ' (India time)'), ('Time taken', took((t1 - t0).total_seconds())), ('Result', result),
            ('Changes found', str(total) if total else 'None: nothing new this week')]
    text = [f'{n} sync done: {result}'] + [f'{k}: {v}' for k, v in head]
    body = f'<h2 style="margin:0 0 8px">{html.escape(n)} sync done: <span style="color:{"#b00020" if errs else "#1a7f37"}">{result}</span></h2>'
    for b, e in errs:
        body += f'<div style="background:#fdecea;border:1px solid #f5c2c0;border-radius:6px;padding:10px 12px;margin:0 0 10px"><b>{html.escape(name(b))} failed:</b> {html.escape(str(e))[:600]}</div>'
        text.append(f'ERROR {name(b)}: {e}')
    body += table(head)
    if total:
        many = len({b for b, _ in secs}) > 1
        body += '<h3 style="margin:14px 0 4px">1. Summary</h3>'
        rows, i = [], 0
        for k in order:
            for b, sec, v in by_kind[k]:
                i += 1; rows.append((i, k, (b + ' · ' if many else '') + sec, len(v)))
        rows.append(('', '', 'Total', total))
        body += grid(['#', 'Kind', 'Section', 'Count'], rows, ['36', '120', None, '70'])
        text += ['', 'SUMMARY'] + [f'{r[1]:<14} {r[2]:<50} {r[3]}' for r in rows]
        body += '<h3 style="margin:14px 0 4px">2. Details</h3>'
        i = 0
        for k in order:
            for b, sec, v in by_kind[k]:
                i += 1
                body += f'<div style="font-weight:700;margin:12px 0 2px">2.{i} {html.escape((b + " · " if many else "") + sec)} <span style="color:#666;font-weight:400">({len(v)}) · {k}</span></div>'
                body += grid(['#', 'Detail'], [(j + 1, t) for j, t in enumerate(v[:MAX_ROWS])], ['44', None])
                if len(v) > MAX_ROWS:
                    body += f'<div style="color:#666;margin:-10px 0 14px">+ {len(v) - MAX_ROWS} more rows in the attached file.</div>'
                text += ['', f'{sec} ({len(v)})'] + [f'{j + 1}. {t}' for j, t in enumerate(v[:MAX_ROWS])]
        body += '<div style="color:#666">The attached file has every row (opens in Excel).</div>'
    data = None
    if total:
        f = io.StringIO(); w = csv.writer(f); w.writerow(['Brand', 'Kind', 'Section', 'No.', 'Detail'])
        for k in order:
            for b, sec, v in by_kind[k]:
                for j, t in enumerate(v): w.writerow([b, k, sec, j + 1, t])
        data = ('﻿' + f.getvalue()).encode('utf-8')
    return subj, '\n'.join(text) + '\n', page(body), data, f'{brand}_sync_{t1.strftime("%Y-%m-%d")}.csv'
