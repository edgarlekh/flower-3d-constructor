#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pack-model.py — GLB → компактный JS для сайта.

Зачем: модели из TRELLIS 2 / Meshy тяжёлые (десятки МБ, с текстурой).
Для мобильного браузера их надо ужать. Скрипт квантует геометрию
(позиции в Uint16, нормали в Int8, UV в Uint16) и ужимает текстуру,
затем кладёт всё в один JS-файл, который распаковывает браузер
(assets/js/model-loader.js).

Модель НОРМАЛИЗУЕТСЯ (обезразмеривается) — это незыблемый принцип
проекта: в модели нет реального размера. На сайте пользователь вводит
ОДИН размер (см), и модель масштабируется. Поэтому:
  • цветок  — нормируется так, что горизонтальный диаметр = 1;
  • ваза    — нормируется так, что высота = 1, плюс из геометрии
              считаются пропорции neck_ratio (радиус горловины) и
              width_ratio (ширина) — «одно число руками, остальное
              из пропорций».

Форматы на выходе (совпадают с распаковкой в model-loader.js):
  textured    : nv, mn, sp, p(Uint16), n(Int8), u(Uint16), i(Uint16/32), t(data-URI)
  vertexcolor : nv, mn, sp, p(Uint16), n(Int8), c(Uint8),  i(Uint16/32)

Примеры:
  # ваза (текстурная), в реестр VASE_MODELS под ключом 'tall'
  python scripts/pack-model.py data/models-raw/vase.glb \
      --kind vase --registry VASE_MODELS --key tall \
      --out assets/catalog/models/vase-tall.js

  # цветок с текстурой, в реестр FLOWER_MODELS под ключом 'peony'
  python scripts/pack-model.py data/models-raw/peony.glb \
      --kind flower --mode textured --registry FLOWER_MODELS --key peony \
      --out assets/catalog/models/peony.js

  # цветок, цвет запечь в вершины и выкинуть текстуру (как роза)
  python scripts/pack-model.py data/models-raw/rose.glb \
      --kind flower --mode vertexcolor --registry FLOWER_MODELS --key rose \
      --out assets/catalog/models/rose.js
"""
import argparse, base64, io, json, sys
try: sys.stdout.reconfigure(encoding="utf-8")   # чтобы кириллица/стрелки печатались в Windows-консоли
except Exception: pass
import numpy as np

try:
    import trimesh
    from PIL import Image
except ImportError as e:
    sys.exit("Нет зависимостей. Установите: pip install -r scripts/requirements.txt\n" + str(e))


def load_mesh(path):
    """Грузит GLB и сводит сцену к одному мешу."""
    obj = trimesh.load(path, process=False)
    if isinstance(obj, trimesh.Scene):
        geoms = [g for g in obj.geometry.values() if isinstance(g, trimesh.Trimesh)]
        if not geoms:
            sys.exit("В GLB не нашлось меша.")
        mesh = trimesh.util.concatenate(geoms) if len(geoms) > 1 else geoms[0]
    else:
        mesh = obj
    return mesh


def normalize(mesh, kind):
    """Обезразмеривает модель. Возвращает (proportions) для вазы."""
    v = mesh.vertices.copy()
    lo, hi = v.min(0), v.max(0)
    size = hi - lo
    if kind == "vase":
        scale = 1.0 / max(size[1], 1e-6)          # высота = 1
    else:
        scale = 1.0 / max(size[0], size[2], 1e-6)  # горизонтальный диаметр = 1
    v *= scale
    # центрируем по X/Z, ставим низ на y=0
    lo, hi = v.min(0), v.max(0)
    cx, cz = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2
    v[:, 0] -= cx; v[:, 2] -= cz; v[:, 1] -= lo[1]
    mesh.vertices = v

    props = {}
    if kind == "vase":
        lo, hi = v.min(0), v.max(0)
        height = hi[1] - lo[1]
        r = np.sqrt(v[:, 0] ** 2 + v[:, 2] ** 2)
        props["w"] = float((hi[0] - lo[0]) / height)          # ширина / высота
        top = v[:, 1] > (lo[1] + 0.95 * height)               # верхний срез — горловина
        props["neck"] = float(r[top].max() / height) if top.any() else float(r.max() / height)
    return props


def quantize(mesh):
    """Квантует позиции/нормали/индекс. Возвращает dict полей."""
    pos = np.asarray(mesh.vertices, dtype=np.float64)
    nrm = np.asarray(mesh.vertex_normals, dtype=np.float64)
    idx = np.asarray(mesh.faces, dtype=np.int64).reshape(-1)

    mn = pos.min(0)
    sp = pos.max(0) - mn
    sp[sp == 0] = 1.0
    P = np.round((pos - mn) / sp * 65535).astype("<u2")
    N = np.clip(np.round(nrm * 127), -127, 127).astype("<i1")

    nv = len(pos)
    idt = "<u4" if nv > 65535 else "<u2"
    I = idx.astype(idt)

    out = {
        "nv": int(nv),
        "nf": int(len(mesh.faces)),
        "mn": [float(x) for x in mn],
        "sp": [float(x) for x in sp],
        "p": b64(P), "n": b64(N), "i": b64(I),
    }
    if idt == "<u4":
        out["i32"] = 1
    return out


def add_uv(out, mesh):
    uv = getattr(mesh.visual, "uv", None)
    if uv is None:
        sys.exit("У модели нет UV — нельзя упаковать как textured. Используйте --mode vertexcolor.")
    U = np.clip(np.round(np.asarray(uv) * 65535), 0, 65535).astype("<u2")
    out["u"] = b64(U)


def get_image(mesh):
    """Достаёт PIL-картинку текстуры из разных вариантов визуала trimesh."""
    vis = mesh.visual
    matt = getattr(vis, "material", None)
    for obj, attr in ((matt, "baseColorTexture"), (matt, "image"), (vis, "image")):
        img = getattr(obj, attr, None) if obj is not None else None
        if img is not None:
            return img
    return None


def add_texture(out, mesh, max_size, quality):
    img = get_image(mesh)
    if img is None:
        sys.exit("У модели нет текстуры. Используйте --mode vertexcolor.")
    img = img.convert("RGB")
    if max(img.size) > max_size:
        s = max_size / max(img.size)
        img = img.resize((int(img.size[0] * s), int(img.size[1] * s)), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, "JPEG", quality=quality)
    out["t"] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def add_vertex_colors(out, mesh):
    """Запекает цвет в вершины: из vertex_colors или сэмплом текстуры по UV."""
    vc = getattr(mesh.visual, "vertex_colors", None)
    if vc is not None and len(vc) == out["nv"]:
        C = np.asarray(vc)[:, :3].astype(np.uint8)
    else:
        img = get_image(mesh)
        uv = getattr(mesh.visual, "uv", None)
        if img is None or uv is None:
            sys.exit("Нет ни vertex_colors, ни текстуры+UV — нечего запекать в цвет.")
        img = np.asarray(img.convert("RGB"))
        h, w = img.shape[:2]
        u = np.clip((np.asarray(uv)[:, 0] * (w - 1)).astype(int), 0, w - 1)
        vv = np.clip(((1 - np.asarray(uv)[:, 1]) * (h - 1)).astype(int), 0, h - 1)  # V сверху вниз
        C = img[vv, u].astype(np.uint8)
    out["c"] = b64(C.astype(np.uint8))


def b64(arr):
    return base64.b64encode(arr.tobytes()).decode()


def main():
    ap = argparse.ArgumentParser(description="GLB → компактный JS для сайта")
    ap.add_argument("glb", help="входной .glb")
    ap.add_argument("--kind", choices=["flower", "vase"], required=True)
    ap.add_argument("--mode", choices=["textured", "vertexcolor"], default="textured")
    ap.add_argument("--registry", required=True, help="имя реестра в window (VASE_MODELS / FLOWER_MODELS)")
    ap.add_argument("--key", required=True, help="ключ модели в реестре")
    ap.add_argument("--out", required=True, help="выходной .js")
    ap.add_argument("--tex-size", type=int, default=1024, help="макс. сторона текстуры")
    ap.add_argument("--tex-quality", type=int, default=85)
    args = ap.parse_args()

    mesh = load_mesh(args.glb)
    props = normalize(mesh, args.kind)
    rec = quantize(mesh)

    if args.mode == "textured":
        add_uv(rec, mesh)
        add_texture(rec, mesh, args.tex_size, args.tex_quality)
    else:
        add_vertex_colors(rec, mesh)

    rec.update(props)  # для вазы — neck / w

    # JS, который дописывает себя в реестр (порядок загрузки не важен)
    payload = json.dumps(rec, separators=(",", ":"), ensure_ascii=False)
    js = (f"/* Модель '{args.key}' — упакована scripts/pack-model.py */\n"
          f"window.{args.registry}=Object.assign(window.{args.registry}||{{}},"
          f"{{{json.dumps(args.key, ensure_ascii=False)}:{payload}}});\n")
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(js)

    kb = len(js) / 1024
    extra = f", neck={props['neck']:.3f}, w={props['w']:.3f}" if props else ""
    print(f"OK: {args.out}  ({kb:.0f} КБ, {rec['nv']} вершин, {args.mode}{extra})")
    if args.kind == "vase":
        print(f"  -> в catalog.js: height_cm задать вручную; "
              f"neck_ratio={props['neck']:.4f}, width_ratio={props['w']:.4f}")


if __name__ == "__main__":
    main()
