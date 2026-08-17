# Архитектура

Конструктор из прототипа v14 разложен на модули (Этап 1 выполнен).

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
| `assets/js/model-loader.js` | распаковка компактного GLB, `texture.flipY = false`, сборка меша бутона |
| `assets/js/bouquet-engine.js` | ГПСЧ, смета с предупреждениями, раскладка по ролям (золотой угол, купол) |
| `assets/js/camera-controls.js` | мобильная камера: орбита/зум/pan, инерция, кадрирование |
| `assets/js/catalog-render.js` | UI каталога-корзины и панель сметы |
| `constructor.html` | тонкая склейка: сцена three.js, `rebuild()`, запуск |

## Поток данных

```
catalog.js + models/*.js (данные)
   → model-loader.js (распаковка моделей)
   → catalog-render.js (UI выбора) ──┐
                                     │ меняет state.cart / state.vaseId
   → bouquet-engine.js (раскладка + смета)
   → constructor.html: rebuild() собирает сцену
   → camera-controls.js кадрирует
```

`constructor.html` тонкий: только сцена и склейка. Вся логика — в модулях,
чтобы дальше наращивать (Этап 2 — перетаскивание, потом зал) без переписывания.
