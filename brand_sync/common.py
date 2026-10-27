"""Shared helpers: .env loading, polite HTTP session, state files, report."""
import os, json, time, datetime, logging, requests

ROOT = os.path.dirname(os.path.abspath(__file__))
log = logging.getLogger('brand_sync')


def load_env(path=None):
    path = path or os.path.join(ROOT, '.env')
    if not os.path.exists(path):
        return
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def env(name, default=None, required=False):
    v = os.environ.get(name, default)
    if required and not v:
        raise SystemExit(f'{name} missing in .env')
    return v


def data_dir(*parts):
    d = os.path.join(env('DATA_DIR', os.path.join(ROOT, 'data')), *parts)
    os.makedirs(d, exist_ok=True)
    return d


class Http:
    """requests.Session with timeout, retry and a small delay between calls (be gentle with the brand's server)."""
    def __init__(self, base, delay=None, timeout=90):
        self.base = base.rstrip('/')
        self.s = requests.Session()
        self.s.headers['User-Agent'] = 'Mozilla/5.0 (brand_sync; dealer catalogue sync)'
        self.delay = float(env('REQUEST_DELAY', delay if delay is not None else 0.5))
        self.timeout = timeout

    def url(self, path):
        return path if path.startswith('http') else self.base + path

    def req(self, method, path, tries=4, **kw):
        kw.setdefault('timeout', self.timeout)
        for i in range(tries):
            try:
                r = self.s.request(method, self.url(path), **kw)
                time.sleep(self.delay)
                if r.status_code >= 500 and i < tries - 1:
                    raise requests.HTTPError(f'{r.status_code}')
                return r
            except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as e:
                log.warning('retry %s %s: %s', i + 1, path, e)
                time.sleep(5 * (i + 1))
        raise RuntimeError(f'failed: {method} {path}')

    def get(self, path, **kw): return self.req('GET', path, **kw)
    def post(self, path, **kw): return self.req('POST', path, **kw)


def load_json(path, default):
    try:
        return json.load(open(path, encoding='utf-8'))
    except (FileNotFoundError, ValueError):
        return default


def save_json(path, obj):
    tmp = path + '.tmp'
    json.dump(obj, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
    os.replace(tmp, path)


def today():
    return datetime.date.today().isoformat()


class Report:
    def __init__(self, brand):
        self.brand = brand
        self.lines = []
        self.counts = {}

    def add(self, section, text):
        self.lines.append((section, text))
        self.counts[section] = self.counts.get(section, 0) + 1

    def markdown(self):
        out = [f'## {self.brand}  ({today()})', '']
        if not self.lines:
            out.append('Koi naya badlav nahi mila.')
        cur = None
        for sec, t in self.lines:
            if sec != cur:
                out += ['', f'### {sec} ({self.counts[sec]})']
                cur = sec
            out.append(f'- {t}')
        return '\n'.join(out) + '\n'
