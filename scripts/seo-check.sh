#!/usr/bin/env bash
# SEO smoke check: fetches reference URLs as Googlebot and writes a diffable report.
#
# Usage: scripts/seo-check.sh <base-url> [output-file]
#   scripts/seo-check.sh https://www.moto-scoot.tn seo-reports/prod.txt
#   scripts/seo-check.sh http://localhost:3000 seo-reports/local.txt
#   diff seo-reports/prod.txt seo-reports/local.txt
#
# For each URL: HTTP code, redirect chain, <title>, meta description, canonical,
# meta robots / X-Robots-Tag, H1 count and text, internal <a href> count and
# JSON-LD validity. Robots.txt and sitemaps get a structural summary instead.
set -euo pipefail

BASE="${1:?usage: scripts/seo-check.sh <base-url> [output-file]}"
OUT="${2:-/dev/stdout}"
BASE="${BASE%/}"

PATHS=(
  /
  /annonces
  "/annonces?page=2"
  "/annonces?brand=Honda"
  /fiches-techniques
  /fiches-techniques/honda
  /fiches-techniques/qj-motor
  /fiche-technique/sym-jet-x-125
  /article/tmax-560-vs-x-adv-750-8c8fa93e-4fe2-4ecc-9925-b7995746b7df
  /article/cfmoto-1000mt-x-2026-le-nouveau-maxi-trail-chinois-qui-peut-seduire-les-tunisiens-3d13e125-a8e2-4b0c-9495-d1470ced00cc
  /guide/comment-bien-graisser-son-kit-chaine-4703630e-6577-40ec-8ef2-95cbf4596263
  /actualites
  /garages
  /garage/hatem-racing-monastir-monastir-0f5e9454-0fa6-46f4-a4ab-7656f0f2de0f
  /annonce/voge-900-blacknight-2024-1
  /contact
  /plan-du-site
  /page-qui-nexiste-pas-seo-check
  /robots.txt
  /sitemap.xml
  /sitemap-dynamic.xml
)

python3 -I - "$BASE" "${PATHS[@]}" > "$OUT" <<'PY'
import html, json, re, subprocess, sys
from urllib.parse import urljoin

UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
base, paths = sys.argv[1], sys.argv[2:]


def fetch(url):
    """One request without following redirects: (code, headers, body)."""
    r = subprocess.run(['curl', '-s', '-A', UA, '--max-time', '40', '-D', '-', url],
                       capture_output=True, timeout=60)
    raw = r.stdout.decode('utf-8', 'replace')
    head, _, body = raw.partition('\r\n\r\n')
    while head.startswith('HTTP/') and re.match(r'HTTP/\S+ 1\d\d', head):  # skip 100-continue
        head, _, body = body.partition('\r\n\r\n')
    lines = head.split('\r\n')
    code = int(lines[0].split()[1]) if lines and lines[0].startswith('HTTP/') else 0
    headers = {}
    for line in lines[1:]:
        k, _, v = line.partition(':')
        headers[k.strip().lower()] = v.strip()
    return code, headers, body


def follow(url):
    chain = []
    for _ in range(6):
        code, headers, body = fetch(url)
        chain.append(str(code))
        if code in (301, 302, 303, 307, 308) and headers.get('location'):
            url = urljoin(url, headers['location'])
            chain[-1] += '>' + url.replace(base, '')
            continue
        return code, headers, body, chain
    return code, headers, body, chain


def one(pattern, text):
    m = re.search(pattern, text, re.I | re.S)
    return html.unescape(m.group(1)).strip() if m else '-'


def text_of(fragment):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', fragment))).strip()


out = [f'# seo-check base={base}', '']
for path in paths:
    code, headers, body, chain = follow(base + path)
    out.append(f'== {path}')
    out.append(f'  http: {code}   chain: {" ".join(chain)}')
    if path.endswith('robots.txt'):
        groups = re.findall(r'(?im)^user-agent:\s*(.+)$', body)
        dis = re.findall(r'(?im)^disallow:\s*(.+)$', body)
        out.append(f'  user-agents: {len(groups)}   disallow lines: {len(dis)}')
        out.append(f'  sitemaps: {", ".join(re.findall(r"(?im)^sitemap:\s*(.+)$", body)) or "-"}')
        out.append(f'  crawl-delay/host: {bool(re.search(r"(?im)^(crawl-delay|host):", body))}')
    elif path.endswith('.xml'):
        locs = re.findall(r'<loc>([^<]+)</loc>', body)
        kinds = {}
        for loc in locs:
            seg = '/' + loc.split('/', 3)[3].split('/')[0] if loc.count('/') >= 3 else loc
            kinds[seg] = kinds.get(seg, 0) + 1
        out.append(f'  urls: {len(locs)}   lastmod: {body.count("<lastmod>")}')
        out.append('  by section: ' + ', '.join(f'{k}={v}' for k, v in sorted(kinds.items())))
    else:
        h = body.split('</head>')[0]
        b = body.split('<body', 1)[-1]
        titles = re.findall(r'<title[^>]*>(.*?)</title>', h, re.S)
        robots = re.findall(r'<meta name="robots" content="([^"]*)"', h)
        h1s = [text_of(x) for x in re.findall(r'<h1[^>]*>(.*?)</h1>', b, re.S)]
        hrefs = set(re.findall(r'<a\s[^>]*href="([^"#]+)"', b))
        internal = {u for u in hrefs if u.startswith('/') or 'moto-scoot.tn' in u}
        blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', body, re.S)
        valid, types = 0, []
        for blk in blocks:
            try:
                data = json.loads(blk)
                valid += 1
                for node in (data.get('@graph') or [data]) if isinstance(data, dict) else data:
                    t = node.get('@type')
                    types.extend(t if isinstance(t, list) else [t])
            except Exception:
                pass
        out.append(f'  title: {html.unescape(titles[-1]).strip() if titles else "-"}   (x{len(titles)})')
        out.append(f'  description: {one(r"<meta name=\"description\" content=\"([^\"]*)\"", h)}')
        out.append(f'  canonical: {one(r"<link rel=\"canonical\" href=\"([^\"]*)\"", h)}')
        out.append(f'  robots: {" | ".join(robots) or "-"}   x-robots-tag: {headers.get("x-robots-tag", "-")}')
        out.append(f'  h1: {len(h1s)} {json.dumps(h1s, ensure_ascii=False)}')
        out.append(f'  internal links: {len(internal)}')
        out.append(f'  json-ld: {valid}/{len(blocks)} valid   types: {",".join(sorted({str(t) for t in types})) or "-"}')
    out.append('')
print('\n'.join(out))
PY
