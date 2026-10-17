"""產生測試用文字型 PDF：tests/fixtures/muestra.pdf（自寫西班牙文，兩頁，句子跨行）"""
import pathlib

OUT = pathlib.Path(__file__).with_name('muestra.pdf')

PAGES = [
    ['Capitulo uno', '', 'Lucía abrió la ventana y miró el banco', 'del parque. Más tarde fue al banco para',
     'sacar dinero, porque quería comprar un regalo.'],
    ['Capitulo dos', '', 'Cuando volvió, había una carta sobre', 'la mesa con su nombre escrito a mano.'],
]

def esc(s):
    # WinAnsiEncoding ≈ latin-1；括號與反斜線需跳脫
    b = s.encode('latin-1')
    return ''.join('\\%03o' % c if c > 126 or c in b'()\\' else chr(c) for c in b)

def content(lines):
    ops = ['BT', '/F1 16 Tf', '72 720 Td', '22 TL']
    for line in lines:
        ops.append(f'({esc(line)}) Tj T*')
    ops.append('ET')
    return '\n'.join(ops).encode('latin-1')

objects = []
def add(body):
    objects.append(body)
    return len(objects)

font = add(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
pages_id = len(objects) + 1 + 2 * len(PAGES) + 1  # 先預留，下面會補正
page_ids = []
content_ids = []
for lines in PAGES:
    data = content(lines)
    content_ids.append(add(b'<< /Length %d >>\nstream\n' % len(data) + data + b'\nendstream'))
pages_id = len(objects) + len(PAGES) + 1
for cid in content_ids:
    page_ids.append(add(b'<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>' % (pages_id, font, cid)))
kids = ' '.join(f'{p} 0 R' for p in page_ids).encode()
assert add(b'<< /Type /Pages /Kids [' + kids + b'] /Count %d >>' % len(page_ids)) == pages_id
catalog = add(b'<< /Type /Catalog /Pages %d 0 R /Lang (es) >>' % pages_id)
info = add(b'<< /Title (Documento de prueba) /Author (Autor de prueba) >>')

out = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
offsets = []
for i, body in enumerate(objects, 1):
    offsets.append(len(out))
    out += b'%d 0 obj\n' % i + body + b'\nendobj\n'
xref = len(out)
out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objects) + 1)
for off in offsets:
    out += b'%010d 00000 n \n' % off
out += b'trailer\n<< /Size %d /Root %d 0 R /Info %d 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objects) + 1, catalog, info, xref)
OUT.write_bytes(out)
print(OUT, len(out), 'bytes')
