"""Build review-only shell, bridge and injected Mono HTML from committed sources."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit


def digest(data):
    return hashlib.sha256(data).hexdigest()


def origin(value):
    parsed = urlsplit(value)
    if not re.fullmatch(r'https?://[A-Za-z0-9.-]+(?::[0-9]{1,5})?', value):
        raise ValueError('origin contains unsafe characters')
    if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.username is not None or parsed.password is not None or parsed.path or parsed.query or parsed.fragment:
        raise ValueError('expected an origin without a path or userinfo')
    labels = (parsed.hostname or '').split('.')
    if len(parsed.hostname or '') > 253 or any(not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?', label) for label in labels):
        raise ValueError('invalid origin hostname')
    if parsed.port is not None and not 1 <= parsed.port <= 65535:
        raise ValueError('expected an origin without a path')
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mono', required=True, type=Path, help='pristine prerendered Mono HTML')
    parser.add_argument('--gold', required=True, type=Path, help='pristine prerendered Gold HTML')
    parser.add_argument('--source', required=True, help='committed full source SHA')
    parser.add_argument('--build-id', required=True)
    parser.add_argument('--origin', required=True, type=origin, help='immutable iframe origin')
    parser.add_argument('--stable-origin', required=True, type=origin, help='stable review shell origin')
    parser.add_argument('--output', required=True, type=Path, help='new empty output directory')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}', args.source):
        raise ValueError('source must be a full commit SHA')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', args.build_id):
        raise ValueError('invalid build ID')
    here = Path(__file__).resolve().parent
    root = here.parent.parent
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    if head != args.source:
        raise ValueError('checkout HEAD differs from source')
    if subprocess.run(['git', 'diff', '--quiet', 'HEAD', '--', 'deploy/review'], cwd=root).returncode:
        raise ValueError('review chrome differs from committed HEAD')
    names = ('build_chrome.py', 'shell.html', 'motion-bridge.js', 'presentation.css', 'review-overlay.js', 'review-gold.js')
    committed = {name: subprocess.check_output(['git', 'show', f'HEAD:deploy/review/{name}'], cwd=root) for name in names}
    raw = args.mono.read_bytes()
    if raw.count(b'</head>') != 1 or b'data-review-motion-launch' not in raw or args.build_id.encode() not in raw:
        raise ValueError('unexpected Mono HTML or build ID')
    gold = args.gold.read_bytes()
    if gold.count(b'</head>') != 1 or args.build_id.encode() not in gold:
        raise ValueError('unexpected Gold HTML or build ID')
    css = committed['presentation.css']
    injection = b'<style>' + css + b'</style><script defer src="/review-overlay.js"></script><script defer src="/review-session-dock.js"></script>'
    shell = committed['shell.html'].decode('utf-8-sig').replace('__REVISION_ORIGIN__', args.origin)
    bridge = committed['motion-bridge.js'].decode('utf-8-sig').replace('__REVISION_ORIGIN__', args.origin).replace('__STABLE_ORIGIN__', args.stable_origin)
    gold_injection = b'<style>a[href="/p/2"]{display:none!important}</style><script defer src="/review-gold.js"></script>'
    outputs = {'index.html': shell.encode(), 'mono.html': raw.replace(b'</head>', injection + b'</head>'),
               'gold.html': gold.replace(b'</head>', gold_injection + b'</head>'),
               'review-session-dock.js': bridge.encode(), 'review-overlay.js': committed['review-overlay.js'],
               'review-gold.js': committed['review-gold.js']}
    args.output.mkdir(parents=True, exist_ok=False)
    for name, data in outputs.items():
        (args.output / name).write_bytes(data)
    metadata = {'source': args.source, 'build_id': args.build_id, 'origin': args.origin,
                'mono_source_sha256': digest(raw), 'gold_source_sha256': digest(gold),
                'files': {name: digest(data) for name, data in outputs.items()}}
    (args.output / 'chrome-manifest.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()
