# Как готовить 3D-модели

Пайплайн из двух шагов: **фото → GLB → компактный JS для сайта.**
Скрипты лежат в `scripts/` и на сайт не попадают.

## Зачем это

Модель, полученная из фотографии, тяжёлая (десятки МБ с текстурой) — телефон
такое не потянет. Мы её ужимаем: геометрию квантуем, текстуру сжимаем, и всё
кладём в один компактный JS-файл, который распаковывает браузер.

И главный принцип проекта: **в модели нет реального размера.** Нейросеть строит
форму, не размер. Поэтому модель обезразмеривается (нормализуется), а реальный
размер задаётся на сайте ОДНИМ числом (см) — по нему модель масштабируется.

## Разовая подготовка

```bash
pip install -r scripts/requirements.txt
```

Папки (обе в `.gitignore`, в репозиторий не попадают):

```
data/raw-photos/     ← сюда кладёте исходные фото (jpg/png)
data/models-raw/     ← сюда падают сырые .glb
```

## Шаг 1. Фото → GLB

Через облако Meshy (нужен ключ и кредиты):

```bash
# ключ: meshy.ai → Settings → API Keys
export MESHY_API_KEY=xxxxx          # Windows: set MESHY_API_KEY=xxxxx
python scripts/generate-models.py
```

Пройдёт по всем фото из `data/raw-photos/` и сложит `.glb` в `data/models-raw/`.

**Альтернатива без облака:** TRELLIS 2 локально (нужен GPU). Тогда этот шаг делаете
сами и кладёте готовые `.glb` в `data/models-raw/` — упаковка (шаг 2) одинаковая.
Прототип v14 делался через TRELLIS.

## Шаг 2. GLB → компактный JS

```bash
# цветок с текстурой
python scripts/pack-model.py data/models-raw/peony.glb \
    --kind flower --mode textured \
    --registry FLOWER_MODELS --key peony \
    --out assets/catalog/models/peony.js

# цветок, цвет запечь в вершины и выкинуть текстуру (легче; так сделана роза)
python scripts/pack-model.py data/models-raw/rose.glb \
    --kind flower --mode vertexcolor \
    --registry FLOWER_MODELS --key rose \
    --out assets/catalog/models/rose.js

# ваза (скрипт заодно посчитает пропорции neck_ratio и width_ratio)
python scripts/pack-model.py data/models-raw/vase.glb \
    --kind vase --mode textured \
    --registry VASE_MODELS --key tall \
    --out assets/catalog/models/vase-tall.js
```

Нормализация:
- **цветок** — обезразмеривается по горизонтальному диаметру (= 1);
- **ваза** — по высоте (= 1), плюс скрипт печатает `neck_ratio` (радиус горловины)
  и `width_ratio` (ширина) — их вписываете в каталог. Это и есть «одно число
  руками (высота), остальное из пропорций».

## Шаг 3. Подключить в каталог

1. Добавьте `<script>` с новым файлом в `constructor.html` (рядом с
   `models/vases.js` и `models/rose.js`).
2. В `assets/catalog/catalog.js` пропишите позицию и укажите ключ модели:

```javascript
// цветок с реальной моделью
{id:'peo', type:'flower', name:'Пион розовый', role:'accent',
 bloom_cm:11, stem_cm:50, price:28, color:0xE7A9BC, shape:'ball',
 model:'peony'},        // ← ключ из --key; без него рисуется процедурная форма

// ваза
{id:'tall', type:'vase', name:'Ваза высокая', price:45,
 height_cm:30,                          // ЕДИНСТВЕННЫЙ размер руками
 neck_ratio:0.19, width_ratio:0.51,     // из вывода pack-model.py
 model:'tall'},
```

`color` и `shape` остаются как запасной вариант: если модель не загрузится,
бутон нарисуется процедурно.

## Важно про текстуры

В `assets/js/model-loader.js` у всех текстур стоит `flipY = false` — модели из
TRELLIS/Meshy идут в развёртке glTF (V сверху вниз). Без этого текстура ложится
зеркально. Это уже учтено, трогать не нужно.
