"""產生測試用 EPUB：tests/fixtures/muestra.epub（自寫的西班牙文短文，無版權問題）"""
import zipfile, pathlib

OUT = pathlib.Path(__file__).with_name('muestra.epub')

PARAGRAPHS = [
    'María abrió la ventana y miró el banco del parque. Allí estaba sentado su abuelo, leyendo el periódico como cada mañana.',
    'Más tarde fue al banco para sacar dinero, porque quería comprarle un regalo. La cola era larga y el empleado parecía cansado.',
    'Cuando volvió, el abuelo ya no estaba. Sobre el banco había una carta con su nombre escrito a mano.',
]

def chapter(n):
    body = ''.join(f'<p>{p}</p>' for p in PARAGRAPHS * 6)
    return f'''<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="es" lang="es">
<head><title>Capítulo {n}</title></head>
<body><h1>Capítulo {n}</h1>{body}</body></html>'''

CONTAINER = '''<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>'''

OPF = '''<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">urn:uuid:polyglot-reader-muestra</dc:identifier>
<dc:title>La carta del abuelo</dc:title>
<dc:creator>Autor de prueba</dc:creator>
<dc:language>es-ES</dc:language>
<meta property="dcterms:modified">2026-10-17T00:00:00Z</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/>
<item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/>
</manifest>
<spine><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>'''

NAV = '''<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="es">
<head><title>Índice</title></head>
<body><nav epub:type="toc"><ol>
<li><a href="c1.xhtml">Capítulo 1</a></li>
<li><a href="c2.xhtml">Capítulo 2</a></li>
</ol></nav></body></html>'''

with zipfile.ZipFile(OUT, 'w') as z:
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
    z.writestr('META-INF/container.xml', CONTAINER, compress_type=zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/content.opf', OPF, compress_type=zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/nav.xhtml', NAV, compress_type=zipfile.ZIP_DEFLATED)
    for n in (1, 2):
        z.writestr(f'OEBPS/c{n}.xhtml', chapter(n), compress_type=zipfile.ZIP_DEFLATED)
print(OUT)


# ---- 安全測試用：夾帶腳本的 EPUB（tests/fixtures/script-test.epub）----
# 開啟後若 window.__pwned 被設值，代表 CSP 沒擋住書中腳本
SCRIPT_OUT = pathlib.Path(__file__).with_name('script-test.epub')

SCRIPT_CHAPTER = '''<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head><title>Prueba</title><script src="evil.js"></script></head>
<body>
<h1>Prueba de seguridad</h1>
<p>Este libro intenta ejecutar código.</p>
<script>parent.__pwned = 'inline'; top.__pwned = 'inline';</script>
<img src="no-existe.png" alt="" onerror="top.__pwned = 'handler'" />
</body></html>'''

SCRIPT_OPF = OPF.replace('La carta del abuelo', 'Libro con scripts').replace(
    '<item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="c1" href="c1.xhtml" media-type="application/xhtml+xml" properties="scripted"/>'
    '<item id="js" href="evil.js" media-type="application/javascript"/>',
).replace('<item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/>', '').replace('<itemref idref="c2"/>', '')

with zipfile.ZipFile(SCRIPT_OUT, 'w') as z:
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
    z.writestr('META-INF/container.xml', CONTAINER, compress_type=zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/content.opf', SCRIPT_OPF, compress_type=zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/nav.xhtml', NAV.replace('<li><a href="c2.xhtml">Capítulo 2</a></li>', ''), compress_type=zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/c1.xhtml', SCRIPT_CHAPTER, compress_type=zipfile.ZIP_DEFLATED)
    z.writestr('OEBPS/evil.js', "top.__pwned = 'external';", compress_type=zipfile.ZIP_DEFLATED)
print(SCRIPT_OUT)
