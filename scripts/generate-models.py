#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate-models.py — папка фотографий → GLB-модели.

Прогоняет каждое фото из data/raw-photos/ через image-to-3D (Meshy)
и складывает готовые .glb в data/models-raw/. Дальше их ужимает
scripts/pack-model.py.

Что нужно:
  • ключ Meshy в переменной окружения MESHY_API_KEY
    (https://www.meshy.ai/ → Settings → API Keys; генерация тратит кредиты)
  • pip install -r scripts/requirements.txt

Запуск:
  set MESHY_API_KEY=xxxxx           (Windows)  |  export MESHY_API_KEY=xxxxx  (mac/linux)
  python scripts/generate-models.py

Флаги:
  --in  data/raw-photos      папка с фото (jpg/png)
  --out data/models-raw      куда класть .glb
  --force                    перегенерировать, даже если .glb уже есть

Альтернатива без облака: TRELLIS 2 локально (нужен GPU). Тогда этот
скрипт не используется — GLB кладутся в data/models-raw/ вручную,
а упаковка (pack-model.py) одинаковая. Прототип v14 делался через TRELLIS.
"""
import argparse, base64, mimetypes, os, sys, time
try: sys.stdout.reconfigure(encoding="utf-8")   # чтобы кириллица/символы печатались в Windows-консоли
except Exception: pass
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Нет requests. Установите: pip install -r scripts/requirements.txt")

API = "https://api.meshy.ai/openapi/v1/image-to-3d"
EXT = {".jpg", ".jpeg", ".png", ".webp"}


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(str(path))[0] or "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def create_task(key: str, image: str) -> str:
    r = requests.post(API, headers={"Authorization": f"Bearer {key}"}, json={
        "image_url": image,          # Meshy принимает и data-URI, и http-ссылку
        "ai_model": "meshy-5",
        "topology": "triangle",
        "should_texture": True,
        "enable_pbr": False,
    }, timeout=60)
    if r.status_code >= 400:
        raise RuntimeError(f"create failed {r.status_code}: {r.text[:300]}")
    return r.json()["result"]


def poll(key: str, task_id: str, every=8, timeout=900) -> dict:
    t0 = time.time()
    while True:
        r = requests.get(f"{API}/{task_id}", headers={"Authorization": f"Bearer {key}"}, timeout=60)
        r.raise_for_status()
        d = r.json()
        st = d.get("status")
        if st == "SUCCEEDED":
            return d
        if st in ("FAILED", "CANCELED", "EXPIRED"):
            raise RuntimeError(f"task {task_id}: {st} — {d.get('task_error')}")
        if time.time() - t0 > timeout:
            raise TimeoutError(f"task {task_id}: не дождались за {timeout}с")
        print(f"    …{st} {int(d.get('progress',0))}%")
        time.sleep(every)


def download_glb(url: str, dest: Path):
    r = requests.get(url, timeout=120); r.raise_for_status()
    dest.write_bytes(r.content)


def main():
    ap = argparse.ArgumentParser(description="Фото → GLB через Meshy")
    ap.add_argument("--in", dest="src", default="data/raw-photos")
    ap.add_argument("--out", dest="dst", default="data/models-raw")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    key = os.environ.get("MESHY_API_KEY")
    if not key:
        sys.exit("Нет MESHY_API_KEY в окружении. См. шапку файла.")

    src, dst = Path(args.src), Path(args.dst)
    dst.mkdir(parents=True, exist_ok=True)
    photos = sorted(p for p in src.glob("*") if p.suffix.lower() in EXT)
    if not photos:
        sys.exit(f"В {src} нет фото ({', '.join(sorted(EXT))}).")

    print(f"Фото: {len(photos)}. Модели → {dst}")
    for p in photos:
        out = dst / (p.stem + ".glb")
        if out.exists() and not args.force:
            print(f"= {p.name}: уже есть, пропуск (--force чтобы перегенерировать)")
            continue
        print(f"→ {p.name}: отправляю…")
        try:
            task = create_task(key, data_uri(p))
            d = poll(key, task)
            glb = (d.get("model_urls") or {}).get("glb")
            if not glb:
                print(f"  ! нет glb в ответе для {p.name}"); continue
            download_glb(glb, out)
            print(f"  ✓ {out.name}")
        except Exception as e:
            print(f"  ! {p.name}: {e}")

    print("Готово. Дальше — упаковать каждую модель: scripts/pack-model.py")


if __name__ == "__main__":
    main()
