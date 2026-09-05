from pathlib import Path
import json

root = Path(__file__).resolve().parents[2]
cssfile = root / 'app/globals.css'
css = cssfile.read_text(encoding='utf-8')
start = css.index('/* ===========================================================================\n   S7 ·')
end = css.index('/* ===========================================================================\n   The Name —', start)
archive = root / 'Dead Code/2026-09-05-origin'
(archive / 'origin-styles.css').write_text(css[start:end], encoding='utf-8')
new = (root / 'app/origin.css').read_text(encoding='utf-8')
css = css[:start] + new + '\n\n' + css[end:]
start = css.index('/* S8 Beat 5 — wordmark convergence')
end = css.index('.logo-mark {', start)
(archive / 'origin-wordmark.css').write_text(css[start:end], encoding='utf-8')
css = css[:start] + css[end:]
cssfile.write_text(css, encoding='utf-8')

for locale in ['en', 'pt']:
    file = root / f'lib/i18n/messages/{locale}.json'
    data = json.loads(file.read_text(encoding='utf-8'))
    data['name']['headline'] = 'Where force finds direction.' if locale == 'en' else 'Onde a força encontra direção.'
    data['name']['open'] = 'Zéfiro brings movement. Ventura gives it direction. Their meeting is Zirtuno.' if locale == 'en' else 'Zéfiro traz movimento. Ventura dá direção. Do encontro, nasce Zirtuno.'
    data['name']['convergence'] = 'What was dispersed begins to belong together.' if locale == 'en' else 'O que estava disperso começa a fazer parte do mesmo todo.'
    file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
