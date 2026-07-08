# AGENT.md

This file provides guidance for AI agents (and human contributors) working in the Label Studio codebase.

## Project Overview

Label Studio is an open source data labeling tool for annotating audio, text, images, video, and time-series data. It is a full-stack application: a Django/DRF backend (the `label_studio` Python package, distributed on PyPI) plus a React/NX monorepo frontend (the `web` directory). The same repository also ships the embeddable editor (`web/libs/editor`) and the Data Manager (`web/libs/datamanager`) as standalone libraries.

- **Version**: see `label_studio/__init__.py` (read from package metadata) and `pyproject.toml`.
- **License**: Apache 2.0.
- **Python**: >=3.10, <4.
- **Node/Yarn**: Yarn workspaces + Nx (see `web/package.json`).

## Repository Layout

```
label-studio/
├── label_studio/            # Django backend (the pip package)
│   ├── core/                # Settings, middleware, utils, feature flags, static assets
│   │   ├── settings/        # base.py + label_studio.py (DJANGO_SETTINGS_MODULE)
│   │   ├── feature_flags/   # LaunchDarkly + offline feature flags
│   │   └── utils/           # common, db, params, formatter, etc.
│   ├── projects/            # Project model, API, signals, next_task logic
│   ├── tasks/               # Task, Annotation, Prediction, TaskLock models + APIs
│   ├── data_import/         # FileUpload, uploader
│   ├── data_manager/        # Data exploration: filters, views, actions (next_task, cache_labels, ...)
│   ├── data_export/         # Export serializers and API
│   ├── io_storages/         # Cloud storage providers: s3, gcs, azure_blob, redis, localfiles
│   ├── ml/                  # ML backend connections and prediction sync
│   ├── ml_models/           # ML model models
│   ├── ml_model_providers/  # ML provider models
│   ├── organizations/       # Organization + membership
│   ├── users/               # User, auth, product tours
│   ├── webhooks/            # Webhook models and dispatch
│   ├── labels_manager/      # Label model and helpers
│   ├── fsm/                 # Finite State Machine framework (projects/tasks use it)
│   ├── jwt_auth/            # JWT auth + token phaseout
│   ├── session_policy/      # Session policy models/API
│   ├── annotation_templates/# Bundled labeling config templates (XML/YAML)
│   ├── server.py            # `label-studio` CLI entrypoint (main())
│   ├── manage.py            # Django manage.py
│   └── conftest.py          # Root pytest fixtures
├── web/                     # Frontend (Nx monorepo)
│   ├── apps/
│   │   ├── labelstudio/     # Main React app (pages: Projects, CreateProject, DataManager, Export, Settings, Webhooks, Organization)
│   │   ├── labelstudio-e2e/ # Cypress E2E tests
│   │   └── playground/      # Standalone playground app
│   └── libs/
│       ├── editor/          # Label Studio Frontend (LSF) — React + mobx-state-tree annotation library
│       ├── datamanager/     # Data Manager library
│       ├── app-common/      # Shared application components
│       └── core/            # Shared core utilities, API provider, hooks
├── deploy/                  # Nginx, uwsgi, docker-compose, Heroku, Azure, GCP configs
├── docs/                    # Hexo documentation site (source/guide, source/tags, ...)
├── .github/workflows/       # CI: ruff, biome, bandit, gitleaks, tests, docker build, etc.
├── .cursor/rules/           # Coding standards (react, typescript, storage-provider, async_migrations, ...)
├── pyproject.toml           # Poetry project + ruff config
├── Makefile                 # Common dev commands
├── docker-compose.yml       # Label Studio + Nginx + PostgreSQL
└── Dockerfile*              # Multiple Dockerfile variants (default, cloudrun, heroku, development, testing)
```

## Backend Architecture

### Django Apps (INSTALLED_APPS order matters)

The FSM app **must** be registered before apps that use FSM transitions (`projects`, `tasks`). See [label_studio/core/settings/base.py](label_studio/core/settings/base.py) `INSTALLED_APPS`.

Core domain apps and their responsibilities:

- **projects** ([label_studio/projects/models.py](label_studio/projects/models.py)): `Project` model with label config (XML), parsed config, sampling, skip-queue policy, soft delete (`deleted_at`). Uses `ProjectVisibleManager` (hides soft-deleted) and `all_objects` for unfiltered access.
- **tasks** ([label_studio/tasks/models.py](label_studio/tasks/models.py)): `Task`, `Annotation`, `Prediction`, `AnnotationDraft`, `TaskLock`. Tasks track `is_labeled`, overlap, comment counts, and are the central unit of work.
- **data_manager** ([label_studio/data_manager/](label_studio/data_manager/)): Filters, ordering, tabs/views, and bulk actions (`actions/` directory: `next_task`, `cache_labels`, `predictions_to_annotations`, `remove_duplicates`).
- **io_storages** ([label_studio/io_storages/README.md](label_studio/io_storages/README.md)): Import (source) and Export (target) cloud storages. Providers: `s3`, `gcs`, `azure_blob`, `redis`, `localfiles`. Each provider has models, serializers, API, form_layout, utils. Includes a Storage Proxy API for secure URL resolution (presign vs. proxy streaming).
- **ml** ([label_studio/ml/README.md](label_studio/ml/README.md)): Connects to external ML Backend servers (https://github.com/HumanSignal/label-studio-ml-backend) for predictions and training.
- **fsm** ([label_studio/fsm/README.md](label_studio/fsm/README.md)): High-performance finite state machine with UUID7-optimized state records, declarative Pydantic transitions, registry, and `StateManager` extension point. Used by projects and tasks for workflow states.
- **organizations**, **users**, **jwt_auth**, **session_policy**: Auth and tenancy. Multi-tenant via `Organization` (users have `active_organization`).
- **webhooks**, **labels_manager**, **data_import**, **data_export**, **ml_models**, **ml_model_providers**: Supporting apps.

### Key Patterns

- **Settings**: `core/settings/base.py` (shared) is extended by `core/settings/label_studio.py` (the default `DJANGO_SETTINGS_MODULE` for OSS). Enterprise extends further.
- **Feature flags**: `core.feature_flags.flag_set("feat_name")`. In OSS community edition, flags default to `True` (offline mode). New behavior changes should be guarded behind a feature flag.
- **Async jobs**: `core.redis.start_job_async_or_sync()` dispatches to RQ workers (storage sync, ML training, stats calculation, async migrations). Redis is required for async; falls back to sync if unavailable.
- **Current request context**: `core.current_request.CurrentContext` (thread-local) holds the current user/request. Cleared between tests by [label_studio/conftest.py](label_studio/conftest.py).
- **Mixin loading**: `settings.PROJECT_MIXIN`, `settings.TASK_MIXIN`, `settings.RECALCULATE_ALL_STATS` allow Enterprise to swap in extended model mixins via `load_func`.
- **Soft delete**: Projects use `deleted_at` / `deleted_by`. Use `Project.all_objects` to include deleted; default `Project.objects` hides them.
- **Storage proxy**: `/tasks/<id>/resolve/` and `/projects/<id>/resolve/` resolve cloud URIs (e.g. `s3://bucket/file`) into presigned redirects or proxied streams based on the storage's `presign` flag.

### Database

- **SQLite** (default, for local dev) and **PostgreSQL** (production). All migrations must work on both. Use `connection.vendor` checks for PG-specific SQL (e.g. `CREATE INDEX CONCURRENTLY`, BRIN/GIN indexes).
- Migrations live under each app's `migrations/` directory. Run with `python label_studio/manage.py migrate`.

### Async Migrations

For long-running schema changes, use async migrations ([.cursor/rules/async_migrations.mdc](.cursor/rules/async_migrations.mdc)): set `atomic = False`, enqueue real DDL via `start_job_async_or_sync`, track in `AsyncMigrationStatus`, and use `CREATE INDEX CONCURRENTLY` on Postgres with SQLite fallbacks.

## Frontend Architecture

The frontend is an **Nx monorepo** in `web/` managed with Yarn. Three top-level targets:

1. **`web/apps/labelstudio`** — main app integrating everything (pages: Projects, CreateProject, DataManager, Export, Settings with Storage/MachineLearning/Webhooks, Organization/People/Models).
2. **`web/libs/editor`** — Label Studio Frontend (LSF): the embeddable annotation UI. React + `mobx-state-tree`. Can run standalone (`yarn lsf:serve`).
3. **`web/libs/datamanager`** — Data Manager library for data exploration.

Shared libraries: `web/libs/core` (utilities, API provider, hooks), `web/libs/app-common` (shared app components).

### Frontend Conventions (from [.cursor/rules/react.mdc](.cursor/rules/react.mdc), [.cursor/rules/typescript.mdc](.cursor/rules/typescript.mdc))

- **State management**: Jotai atoms for global state (not Context API). Use `atomWithQuery` for API-driven state. Keep state local where possible.
- **UI library**: `@humansignal/ui` package, `@humansignal/icons`, `@humansignal/core`. UI components live in `web/libs/ui`.
- **Import rules**: `web/apps` may import from `web/libs`; `web/libs` cannot import from `web/apps`. `web/libs/app-common` may import from other `web/libs` or `web/apps`, but no other `web/libs` may import from `app-common`.
- **No lodash**: Use `es-toolkit` re-exported via `@humansignal/core/lib/utils/*`. Use native `structuredClone` for deep clone. See [.cursor/rules/no-lodash.mdc](.cursor/rules/no-lodash.mdc).
- **Naming**: kebab-case file names for components (`list-item.tsx`), one component per file, co-locate `.module.css` and `.stories.tsx`.
- **Linting**: Biome (`yarn lint`, `yarn lint-css`). Config in `web/biome.json`.
- **Styling**: Tailwind + CSS modules. Design tokens in `web/design-tokens.json` and `web/libs/ui/src/tokens/`.

### Key Frontend Commands

```bash
cd web && yarn install --frozen-lockfile   # install deps
yarn dev            # HMR dev server (needs FRONTEND_HMR=true in root .env)
yarn ls:dev         # main app dev with HMR
yarn lsf:watch      # editor continuous build
yarn dm:watch       # datamanager continuous build
yarn build          # production build all
yarn test:unit      # unit tests across all apps/libs
yarn test:e2e       # cypress E2E
yarn lint           # biome check --write .
```

## Development Workflow

### Backend (from [Makefile](Makefile))

```bash
poetry install                              # install Python deps
DJANGO_DB=sqlite ... poetry run python label_studio/manage.py migrate
DJANGO_DB=sqlite ... poetry run python label_studio/manage.py runserver   # http://localhost:8080
```

Or use Make targets:

```bash
make run-dev          # run Django dev server with sqlite
make migrate-dev      # run migrations
make makemigrations-dev
make shell-dev        # shell_plus
make test             # pytest -v -m "not integration_tests" (sqlite)
make frontend-dev     # yarn dev (HMR)
make frontend-build   # yarn build
make fmt              # pre-commit run on changed files
make fmt-check        # pre-commit pre-push check
make generate-swagger # regenerate swagger.json
```

Environment variables commonly set: `DJANGO_DB=sqlite|default`, `DJANGO_SETTINGS_MODULE=core.settings.label_studio`, `DEBUG=true`, `LOG_LEVEL=DEBUG`, `LOG_DIR=tmp`. For HMR, set `FRONTEND_HMR=true` in the repo root `.env` (copy from `.env.development`).

### Running the CLI

```bash
label-studio                                          # start server (auto-migrates, creates default user)
label-studio start --log-level DEBUG                  # start with debug logging
label-studio init --project-name myproject            # init a project
label-studio user --username default_user@localhost   # print user info + token
label-studio reset_password --username ...            # reset a password
label-studio export <project_id> <format> <path>      # export a project
```

Entry point: [label_studio/server.py](label_studio/server.py) `main()`.

### Testing

Backend tests ([label_studio/conftest.py](label_studio/conftest.py) + per-app `tests/`):

```bash
cd label_studio
DJANGO_DB=sqlite DJANGO_SETTINGS_MODULE=core.settings.label_studio pytest -vv
# or with postgres:
DJANGO_DB=default DJANGO_SETTINGS_MODULE=core.settings.label_studio pytest -vv
```

- Use `tavern` for API endpoint tests where possible.
- Tests run against both SQLite and Postgres on CI.
- `label_studio/tests/sdk/` contains SDK-compatible API tests; `label_studio/tests/sdk/legacy/` covers legacy endpoints.

Frontend tests:

```bash
cd web
yarn test:unit       # all unit tests
yarn test:e2e        # cypress E2E (ls:e2e + lsf:integration)
yarn ls:unit         # main app unit
yarn lsf:unit        # editor unit
yarn dm:unit         # datamanager unit
```

### Docker

```bash
docker pull heartexlabs/label-studio:latest
docker run -it -p 8080:8080 -v $(pwd)/mydata:/label-studio/data heartexlabs/label-studio:latest
docker-compose up                                                  # LS + Nginx + Postgres
docker compose -f docker-compose.yml -f docker-compose.minio.yml up -d   # with MinIO for S3 testing
```

## Coding Standards

### Python

- **Linter**: Ruff (`pyproject.toml [tool.ruff]`). Line length 119. Single quotes for strings. isort enabled.
- **Typing**: Type-hint all new code (mypy is being phased in).
- **Strings**: single quotes.
- **Imports**: at module top-level (E402 ignored because isort handles ordering and some files intentionally defer imports).
- **Migrations**: `python label_studio/manage.py makemigrations` only. Never edit applied migrations. Use `atomic = False` for async migrations.
- **PRs**: keep small (~400 lines changed), one feature/bug per PR. Prefix titles: `fix:`, `feat:`, `docs:`.
- **Feature flags**: guard risky changes with `flag_set("feat_name")`.

### JavaScript/TypeScript

- **Linter**: Biome (`web/biome.json`).
- **No lodash** — use `@humansignal/core` wrappers or `es-toolkit`.
- **React**: functional components, Jotai for global state, hooks for reusable logic.
- **Files**: kebab-case, one component per file, co-located CSS modules + stories.

## CI/CD

Workflows in `.github/workflows/`:

- `ruff.yml`, `biome.yml` — linting (Python, JS/CSS).
- `tests.yml`, `tests-yarn-lsf.yml`, `tests-yarn-unit.yml` — backend and frontend tests.
- `bandit.yml`, `gitleaks.yml`, `codeql.yml` — security scanning.
- `docker-build.yml`, `build_pypi.yml` — build artifacts.
- `test_migrations.yml` — verifies migrations apply cleanly.
- Pre-commit hooks (`.pre-commit-config.yaml`, `.pre-commit-dev.yaml`) enforce formatting on push. Install with `make configure-hooks`.

## Important References

- [README.md](README.md) — install and usage instructions.
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution guide and code organization.
- [web/README.md](web/README.md) — frontend install and commands.
- [DESIGN.md](DESIGN.md) — design system, tokens, accessibility standards.
- [label_studio/io_storages/README.md](label_studio/io_storages/README.md) — cloud storage architecture, proxy API, sync states.
- [label_studio/fsm/README.md](label_studio/fsm/README.md) — FSM framework usage and extension points.
- [label_studio/projects/README.md](label_studio/projects/README.md) — task lock behavior.
- [.cursor/rules/](.cursor/rules/) — coding standards (react, typescript, storage-provider, async_migrations, design, tailwind, cypress_tests, iterate_queryset, no-lodash).
- [docs/source/guide/](docs/source/guide/) — user-facing documentation (install, storage, ml, export, api, etc.).
- API schema: generated via drf-spectacular at `/docs/api/schema/swagger-ui/` and `/docs/api/schema/redoc/` when the server is running.

## Ecosystem

| Project | Description |
| - | - |
| **label-studio** (this repo) | Server, distributed as a pip package |
| [label-studio-frontend](web/libs/editor/) | React + mobx-state-tree annotation library |
| [datamanager](web/libs/datamanager/) | Data exploration tool |
| [label-studio-sdk](https://github.com/HumanSignal/label-studio-sdk) | Python SDK + converter for API automation |
| [label-studio-ml-backend](https://github.com/HumanSignal/label-studio-ml-backend) | ML backend SDK and examples |
