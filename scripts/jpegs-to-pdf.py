"""Assemble JPEGs into a PDF, one image per page, at an exact page size.

Used by scripts/print-pdf.js. Pillow was the obvious tool and is not usable
here: it ignores `resolution`/`dpi` when saving a multi-page PDF, so a 2x
capture of an A4 sheet came out as an A2 page. Embedding each JPEG as a
DCTDecode XObject with an explicit MediaBox sets the page size exactly and
re-encodes nothing, so the file stays as small as the captures are.

Usage: python3 jpegs-to-pdf.py out.pdf WIDTHpt HEIGHTpt page-00.jpg ...
"""
import struct
import sys


def jpeg_size(path):
    """(width, height, components) from a JPEG's first SOF marker."""
    with open(path, 'rb') as f:
        data = f.read()
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        seg_len = struct.unpack('>H', data[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            h, w = struct.unpack('>HH', data[i + 5:i + 9])
            return w, h, data[i + 9]
        i += 2 + seg_len
    raise ValueError(f'no SOF marker in {path}')


def build(out, pw, ph, files):
    objs = []          # 1-indexed object bodies, filled in below

    def add(body):
        objs.append(body)
        return len(objs)

    catalog = add(b'')                      # 1, patched once the page tree exists
    pages = add(b'')                        # 2, ditto
    page_ids = []
    for path in files:
        w, h, comps = jpeg_size(path)
        with open(path, 'rb') as f:
            raw = f.read()
        colour = b'/DeviceRGB' if comps == 3 else (b'/DeviceGray' if comps == 1 else b'/DeviceCMYK')
        img = add(
            b'<< /Type /XObject /Subtype /Image /Width ' + str(w).encode() +
            b' /Height ' + str(h).encode() + b' /ColorSpace ' + colour +
            b' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + str(len(raw)).encode() +
            b' >>\nstream\n' + raw + b'\nendstream'
        )
        # the image fills the page; the page is the sheet
        draw = b'q %f 0 0 %f 0 0 cm /Im Do Q' % (pw, ph)
        content = add(b'<< /Length ' + str(len(draw)).encode() + b' >>\nstream\n' + draw + b'\nendstream')
        page_ids.append(add(
            b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %f %f] /Resources << /XObject << /Im %d 0 R >> >> /Contents %d 0 R >>'
            % (pw, ph, img, content)
        ))

    kids = b' '.join(b'%d 0 R' % n for n in page_ids)
    objs[pages - 1] = b'<< /Type /Pages /Kids [' + kids + b'] /Count ' + str(len(page_ids)).encode() + b' >>'
    objs[catalog - 1] = b'<< /Type /Catalog /Pages 2 0 R >>'

    buf = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
    offsets = []
    for n, body in enumerate(objs, start=1):
        offsets.append(len(buf))
        buf += str(n).encode() + b' 0 obj\n' + body + b'\nendobj\n'
    xref = len(buf)
    buf += b'xref\n0 ' + str(len(objs) + 1).encode() + b'\n0000000000 65535 f \n'
    for off in offsets:
        buf += b'%010d 00000 n \n' % off
    buf += (b'trailer\n<< /Size ' + str(len(objs) + 1).encode() + b' /Root 1 0 R >>\nstartxref\n' +
            str(xref).encode() + b'\n%%EOF\n')
    with open(out, 'wb') as f:
        f.write(bytes(buf))
    return len(page_ids)


if __name__ == '__main__':
    out, pw, ph, files = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4:]
    print(build(out, pw, ph, files))
