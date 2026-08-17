# Архитектура

Черновик. Наполняется на Этапе 1, когда конструктор из прототипа v14
раскладывается на модули.

## Принцип

`constructor.html` — тонкий. Вся логика живёт в модулях `assets/js/`, чтобы
дальше наращивать (зал, показ заказчику) без переписывания.

## Модули (план)

| Файл | Ответственность |
|------|-----------------|
| `assets/js/three.min.js` | three.js r128 |
| `assets/js/bouquet-engine.js` | раскладка по ролям, золотой угол, купол Fibonacci, детерминированный ГПСЧ, смета |
| `assets/js/camera-controls.js` | мобильная камера: орбита/зум/pan, инерция, кадрирование |
| `assets/js/model-loader.js` | распаковка компактного GLB, `texture.flipY = false` |
| `assets/js/catalog-render.js` | UI каталога-корзины |
| `assets/catalog/catalog.js` | данные: позиции, цены, размеры, роли |

## Поток данных (план)

```
catalog.js (данные)
   → catalog-render.js (UI выбора)
   → bouquet-engine.js (раскладка + смета)
   → model-loader.js (модели)
   → сцена three.js
```
