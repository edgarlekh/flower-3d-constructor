# Архитектура

Конструктор разложен на модули (Этап 1), добавлено ручное перетаскивание
(Этап 2) и пайплайн подготовки моделей (Этап 3).

## Принцип

`constructor.html` — тонкий. Вся логика живёт в модулях `assets/js/`, чтобы
дальше наращивать (зал, показ заказчику) без переписывания.

## Модули

| Файл | Ответственность |
|------|-----------------|
| `assets/js/three.min.js` | three.js r128 (локальная копия) |
| `assets/catalog/catalog.js` | данные: `CATALOG`, `ROLES`, `VASES` — позиции, цены, размеры в см, роли |
| `assets/catalog/models/vases.js` | упакованная геометрия ваз (`VASE_MODELS`) |
| `assets/catalog/models/rose.js` | упакованная модель розы (`ROSE_MODEL`) |
| `assets/js/model-loader.js` | распаковка компактных моделей (textured / vertex-color), `flipY=false`, реестры `VASE_MODELS`/`FLOWER_MODELS`, сборка меша бутона |
| `assets/js/bouquet-engine.js` | ГПСЧ, смета с предупреждениями, раскладка по ролям (золотой угол, купол) |
| `assets/js/camera-controls.js` | мобильная камера: орбита/зум/pan, инерция, кадрирование, `setPaused()` |
| `assets/js/bouquet-builder.js` | собирает букет как единый объект (ваза+стебли+бутоны); общий для конструктора и зала |
| `assets/js/flower-drag.js` | движок «взять и поставить»: захват рейкастом, `planeMode` экран/горизонталь (цветы в букете и букеты на столе) |
| `assets/js/catalog-render.js` | UI каталога-корзины и панель сметы |
| `constructor.html` | сборка букета + ручное перетаскивание цветов; кнопка «На стол» (localStorage → зал) |
| `hall.html` | Этап 4: стол в реальных см, копии букета, расстановка по столешнице тем же движком |

## Пайплайн моделей (`scripts/`, не деплоится)

| Файл | Ответственность |
|------|-----------------|
| `scripts/generate-models.py` | фото → GLB через Meshy (или TRELLIS локально) |
| `scripts/pack-model.py` | GLB → компактный JS: нормализация, квантование, сжатие текстуры |

Формат упаковки задан распаковкой в `model-loader.js` — правки формата держать
синхронно в обоих. Подробно — [docs/model-pipeline.md](model-pipeline.md).

## Поток данных

```
catalog.js + models/*.js (данные)
   → model-loader.js (распаковка моделей)
   → catalog-render.js (UI выбора) ──┐
                                     │ меняет state.cart / state.vaseId
   → bouquet-engine.js (раскладка + смета)
   → constructor.html: rebuild() собирает сцену
   → camera-controls.js кадрирует
   → flower-drag.js: пользователь двигает цветы руками (moveFlower)
```

`constructor.html` тонкий: только сцена и склейка. Вся логика — в модулях,
чтобы дальше наращивать (зал, показ заказчику, арки) без переписывания.
Тот же `flower-drag.js` — общий движок расстановки для будущих сцен.
