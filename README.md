# PhytoScope

PhytoScope — веб-приложение для plant genomics research. Проект собран на `Next.js 16` и объединяет два равноправных сценария работы:

- `search-first workbench` для запросов по `AGI ID`, символу гена, локусу или варианту;
- `upload-first pipeline` для загрузки `VCF / FASTA / BAM / BED` с последующим разворачиванием исследовательского контекста.

Первая версия сделана `Arabidopsis-first`: максимальная глубина данных и интерфейса ориентирована на `Arabidopsis thaliana`, но архитектура остаётся species-generic и допускает расширение на другие растения.

## Что сейчас умеет проект

- Главная страница с описанием продукта, capability matrix и входами в `workbench` и `upload`.
- Страница `/workbench` для поиска по гену, локусу и варианту.
- Страница `/upload` для plant-aware загрузки файлов с выбором `species` и `assembly`.
- Страница `/dashboard` с unified research view для загруженного анализа.
- Страница `/reports` с архивом запусков, экспортом `CSV/PDF` и быстрым доступом к последнему run.
- Агрегация данных из внешних источников с graceful degradation вместо падения интерфейса.

## Исследовательский фокус

Workbench собирает в одном экране:

- `variant context`
- `gene function / GO`
- `expression`
- `regulation`
- `interactions`
- `orthology`
- `literature evidence`
- `source status`

То есть проект больше не является human-clinical demo: клинические поля и `hg38/hg19` удалены, а модель данных теперь строится вокруг `species + assembly` и plant-specific evidence.

## Основные источники данных

Базовый live-слой использует:

- `Ensembl Plants REST`
- `BAR ThaleMine`
- `Expression Atlas`
- `Europe PMC`

`TAIR` учитывается как опциональный premium connector: интерфейс не зависит от него жёстко и умеет работать без него.

## Технологический стек

| Слой | Технологии |
|---|---|
| Фреймворк | Next.js 16, App Router |
| UI | React 19, Tailwind CSS 4 |
| Язык | TypeScript (`strict`) |
| Состояние | Zustand |
| Иконки | Lucide React |
| UI-примитивы | Headless UI, Radix Slot, CVA |
| Внешние данные | Ensembl Plants, BAR ThaleMine, Expression Atlas, Europe PMC |
| Качество | ESLint 9, TypeScript, Node test runner, Prettier |

## Быстрый старт

```bash
npm install
npm run dev
```

После запуска приложение доступно на [http://localhost:3000](http://localhost:3000).

## Скрипты

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run format
```

## Маршруты

### `/`
Маркетинговая и навигационная точка входа с описанием продукта и capability matrix.

### `/workbench`
Search-first интерфейс. Принимает:

- `AT1G01010`
- `NAC001`
- `1:3631-5899`
- `1:3631 G>A`

### `/upload`
Upload-first интерфейс для plant genomics файлов. Позволяет выбрать `species`, `assembly`, загрузить файл и перейти к upload-driven dashboard.

### `/dashboard`
Показывает результат конкретного запуска: variant cards, focus gene, expression, regulation, GO, orthology и literature.

### `/reports`
Архив completed/processing runs с экспортом `CSV/PDF`.

## API

Проект уже содержит прикладной API-слой:

- `POST /api/analysis/upload`
- `GET /api/search/resolve`
- `GET /api/gene/:id`
- `GET /api/locus/:region`
- `POST /api/variant/annotate`
- `GET /api/literature`
- `GET /api/source-status`

### Поведение upload-режима

- Для `VCF` используется plant-aware annotation через `Ensembl overlap` и эвристическая оценка impact/consequence.
- Для `FASTA/BAM/BED` остаётся structured fallback, который всё равно приводит пользователя в research dashboard, а не в пустой экран.

## Структура проекта

```text
src/
├── app/
│   ├── api/
│   ├── dashboard/
│   ├── reports/
│   ├── upload/
│   ├── workbench/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── layout/
│   ├── research/
│   └── ui/
├── hooks/
│   └── useAnalysisStore.ts
├── lib/
│   ├── constants.ts
│   ├── ensembl.ts
│   ├── exporters.ts
│   ├── mockData.ts
│   ├── query.ts
│   ├── researchAggregator.ts
│   └── utils.ts
├── services/
│   ├── analysisService.ts
│   ├── genomeApi.ts
│   └── researchApi.ts
└── types/
    └── genome.ts
```

## Тесты

Минимальный automated test layer уже есть:

- `src/lib/query.test.ts` проверяет нормализацию gene/locus/variant query.
- `src/lib/ensembl.test.ts` проверяет VCF parsing и plant variant annotation contract.

## Текущее состояние

Проект собран и проверен командами:

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

## Что можно развивать дальше

- Реальный backend для тяжёлых `BAM/FASTA/BED` пайплайнов.
- Персистентное хранилище runs и кэш внешних источников.
- Более глубокие адаптеры для `TAIR`, `GO`, `Expression Atlas` и species-specific ресурсов.
- Полноценный literature workspace с ранжированием и фильтрами.
