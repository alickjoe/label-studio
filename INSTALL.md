# INSTALL.md

Label Studio 编译与打包指南。涵盖本地源码构建、Docker 镜像构建、PyPI 发布以及各云平台部署变体。

## 1. 环境要求

| 工具 | 版本 | 用途 |
| - | - | - |
| Python | >=3.10, <4（生产推荐 3.13） | 后端运行时 |
| Poetry | >=2.0.0, <3.0.0（推荐 2.3.2） | Python 依赖与打包 |
| Node.js | 22 | 前端构建 |
| Yarn | 最新稳定版 | 前端依赖管理（Nx 单仓） |
| Git | 任意 | 版本号生成依赖 `git describe` |
| Docker | Buildx（多平台构建需启用 experimental） | 容器镜像构建 |
| PostgreSQL（可选） | 14+（生产） / SQLite（默认开发） | 数据库 |
| Redis（可选） | 5.2+ | 异步任务队列（RQ），缺失时自动降级为同步 |

Python 依赖在 [pyproject.toml](pyproject.toml) 中声明，前端依赖在 [web/package.json](web/package.json) 中声明。

## 2. 项目结构与构建产物

```
label-studio/
├── label_studio/            # Python 包（最终发布产物）
│   ├── core/
│   │   ├── version_.py      # 构建时生成，不入 Git
│   │   ├── static/          # collectstatic 输出
│   │   └── static_build/    # 静态资源最终目录（打包进 sdist/wheel）
├── web/                     # Nx 单仓前端
│   └── dist/                # 前端构建产物（打包进 sdist/wheel）
│       ├── apps/labelstudio/
│       ├── libs/editor/
│       └── libs/datamanager/
├── deploy/                  # Docker/Nginx/uWSGI/Heroku 部署脚本
├── Dockerfile*              # 多种构建变体
├── docker-compose.yml       # Nginx + App + PostgreSQL 一体化
├── Makefile                 # 常用构建命令封装
└── pyproject.toml           # Poetry 项目定义（含打包配置）
```

**最终产物**：

- **PyPI 包**（`dist/label_studio-*.whl` + `*.tar.gz`）：包含 Python 后端 + 预构建前端 + 静态资源 + 模板。
- **Docker 镜像**（`heartexlabs/label-studio:<tag>`）：Alpine 基础镜像 + venv + Nginx + 前端 dist + uWSGI 启动。

## 3. 本地源码构建

### 3.1 一键构建（推荐）

仓库根目录执行 [deploy/prebuild.sh](deploy/prebuild.sh)：

```bash
./deploy/prebuild.sh
```

该脚本依次执行：

1. `cd label_studio/frontend && npm ci && npm run build:production`（旧前端构建路径，主仓已迁移到 `web/`）
2. `python label_studio/manage.py collectstatic --no-input`
3. `python label_studio/core/version.py`（生成 `version_.py`）

如需跳过前端构建（仅刷新静态资源与版本号），使用 [deploy/prebuild_wo_frontend.sh](deploy/prebuild_wo_frontend.sh)：

```bash
./deploy/prebuild_wo_frontend.sh
```

### 3.2 分步构建

#### Step 1: 安装 Python 依赖

```bash
poetry install --extras uwsgi           # 生产部署用（带 uWSGI）
# 或开发模式：
poetry install --extras uwsgi --with test
```

> **注意**：`--extras uwsgi` 是必须的，因为 Poetry 存在已知 bug（[python-poetry/poetry#7302](https://github.com/python-poetry/poetry/issues/7302)）。

#### Step 2: 构建前端

```bash
cd web
yarn install --frozen-lockfile
yarn build                 # 等价于 NODE_ENV=production yarn ls:build
# 可选：生成各库的 version.json（需要 .git 可访问）
yarn version:libs
cd ..
```

产物输出到 `web/dist/`，包括：

- `web/dist/apps/labelstudio/` — 主应用
- `web/dist/libs/editor/` — Label Studio Frontend 编辑器
- `web/dist/libs/datamanager/` — 数据管理库

#### Step 3: 收集静态资源

```bash
DJANGO_SETTINGS_MODULE=core.settings.label_studio \
  poetry run python label_studio/manage.py collectstatic --no-input
```

输出到 `label_studio/core/static_build/`。

#### Step 4: 生成版本文件

```bash
poetry run python label_studio/core/version.py
# 可通过环境变量覆盖：
VERSION_OVERRIDE=1.24.0 BRANCH_OVERRIDE=main poetry run python label_studio/core/version.py
```

生成两个文件（**不要提交到 Git**）：

- `label_studio/core/version_.py` — Python 包版本信息
- `label_studio/core/ls-version_.py` — 前端版本信息

#### Step 5: 打包为 sdist/wheel

```bash
poetry build
# 产物在 dist/ 目录
poetry run twine check dist/*    # 校验元数据
```

[pyproject.toml](pyproject.toml) 的 `[tool.poetry]` 段已配置 `include` 规则，确保 `web/dist/**`、`static_build/**`、`version_.py` 等被正确打包进 sdist 和 wheel。

### 3.3 本地运行验证

```bash
# 开发模式（SQLite + HMR）
make env-dev-setup          # 复制 .env.development -> .env
make migrate-dev
make run-dev                # http://localhost:8080

# 生产模式（uWSGI）
DJANGO_SETTINGS_MODULE=core.settings.label_studio \
  poetry run uwsgi --ini deploy/uwsgi.ini
```

## 4. Docker 镜像构建

### 4.1 默认 Dockerfile（生产，Alpine 多阶段）

[Dockerfile](Dockerfile) 采用 5 个构建阶段：

1. **frontend-builder** — Node 22 Alpine，构建 `web/dist/`（使用 BuildKit 缓存 yarn 与 nx）
2. **frontend-version-generator** — 在 frontend-builder 基础上生成 `version.json`
3. **venv-builder** — Python Alpine + Poetry，安装依赖到 `.venv/`，运行 `collectstatic`
4. **py-version-generator** — 生成 `label_studio/core/version_.py`
5. **prod** — Python Alpine 最终镜像，含 Nginx、venv、前端 dist、部署脚本

**构建命令**：

```bash
docker build -t heartexlabs/label-studio:latest \
  --build-arg VERSION_OVERRIDE=$(git describe --tags --always) \
  --build-arg BRANCH_OVERRIDE=$(git branch --show-current) \
  .
```

**支持的构建参数**：

| 参数 | 默认值 | 说明 |
| - | - | - |
| `NODE_VERSION` | 22 | 前端构建器 Node 版本 |
| `PYTHON_VERSION` | 3.13 | Python 运行时版本 |
| `POETRY_VERSION` | 2.3.2 | Poetry 版本 |
| `VERSION_OVERRIDE` | （git tag） | 覆盖版本号 |
| `BRANCH_OVERRIDE` | （git branch） | 覆盖分支名 |
| `INCLUDE_DEV` | false | 是否安装测试依赖 |

**运行镜像**：

```bash
docker run -it -p 8080:8080 \
  -v $(pwd)/mydata:/label-studio/data:rw \
  heartexlabs/label-studio:latest
```

容器内端口映射：

- `8080` → Nginx `8085`（HTTP 入口）
- `8081` → Nginx `8086`（HTTPS，需挂载证书到 `deploy/nginx/certs/`）
- uWSGI 监听容器内 `8000`
- uWSGI stats 在容器内 `1717`

### 4.2 Dockerfile 变体

仓库提供多个 [Dockerfile](Dockerfile) 变体以适配不同场景：

| 文件 | 基础镜像 | 用途 |
| - | - | - |
| [Dockerfile](Dockerfile) | `python:3.13-alpine` + `node:22-alpine` | **默认生产镜像**（多阶段，最终 Alpine + Nginx + uWSGI） |
| [Dockerfile.development](Dockerfile.development) | `python:3.12-slim` + `node:22` | 开发/调试镜像（基于 Debian slim，体积较大便于排查） |
| [Dockerfile.testing](Dockerfile.testing) | `heartexlabs/label-studio:latest` | 在生产镜像上叠加测试依赖，用于容器内跑单测 |
| [Dockerfile.cloudrun](Dockerfile.cloudrun) | `heartexlabs/label-studio:latest` | Google Cloud Run 单容器部署（禁用持久化存储） |
| [Dockerfile.heroku](Dockerfile.heroku) | `heartexlabs/label-studio:latest` | Heroku 部署（使用 `deploy/heroku_run.sh` 解析 `DATABASE_URL`） |
| [Dockerfile.hgface](Dockerfile.hgface) | `heartexlabs/label-studio:develop` | Hugging Face Spaces 部署（放宽 CSRF，SameSite=None） |

**构建测试镜像**（Makefile 已封装）：

```bash
make build-testing-image         # 构建生产镜像 + 测试镜像
make docker-testing-shell        # 进入测试容器交互式 shell（挂载源码）
# 容器内：cd label_studio && DJANGO_DB=sqlite pytest .
```

### 4.3 Docker Compose 一体化部署

[docker-compose.yml](docker-compose.yml) 启动三服务：`nginx`（端口转发）、`app`（uWSGI）、`db`（PostgreSQL 17，自动升级）。

```bash
# 启动全部服务
docker compose up -d --build

# 仅迁移数据库
docker compose run app python3 /label-studio/label_studio/manage.py migrate

# 收集静态资源
docker compose run app python3 /label-studio/label_studio/manage.py collectstatic
```

**配置覆盖**：

- 复制 `docker-compose.override.example.yml` → `docker-compose.override.yml`（或 `make docker-dev-override`）
- 数据卷默认挂载到 `./mydata` 和 `./postgres-data`
- PostgreSQL 证书：放入 `deploy/pgsql/certs/`，取消注释 compose 文件中 ssl 相关行
- Nginx SSL 证书：放入 `deploy/nginx/certs/`，取消注释相关环境变量

**扩展 Compose**：

```bash
# 带 MinIO（S3 兼容存储测试）
docker compose -f docker-compose.yml -f docker-compose.minio.yml up -d

# 带 MySQL
docker compose -f docker-compose.yml -f docker-compose.mysql.yml up -d
```

### 4.4 容器入口行为

[deploy/docker-entrypoint.sh](deploy/docker-entrypoint.sh) 根据 `CMD` 第一个参数分发：

| CMD | 行为 |
| - | - |
| `nginx` | 启动独立 Nginx 容器（执行 `docker-entrypoint.d/nginx/` 脚本） |
| `label-studio-uwsgi` | 启动 uWSGI（执行 `docker-entrypoint.d/app/`，含等数据库就绪 + 迁移 + init） |
| `label-studio-migrate` | 仅执行数据库迁移（执行 `docker-entrypoint.d/app-init/`） |
| 其他（如 `label-studio`） | 直接 exec 命令（执行 `docker-entrypoint.d/app-docker/`） |

支持 `CMD_WRAPPER` 环境变量包装启动命令（如注入 Datadog agent），以及 `ENV_INJECT_SOURCES` 注入额外 env 文件。

## 5. PyPI 发布

完整流程见 [.github/workflows/build_pypi.yml](.github/workflows/build_pypi.yml)。

### 5.1 手动发布

```bash
# 1. 更新 pyproject.toml 中的 version
sed -i 's/^version = .*/version = "1.24.0"/' pyproject.toml

# 2. 构建前端
cd web && yarn install --frozen-lockfile && yarn build && yarn version:libs && cd ..

# 3. 安装打包工具
poetry install --with build

# 4. 收集静态资源
poetry run python label_studio/manage.py collectstatic

# 5. 生成版本文件
VERSION_OVERRIDE=v1.24.0 poetry run python label_studio/core/version.py

# 6. 构建 sdist + wheel
poetry build

# 7. 校验
poetry run twine check dist/*

# 8. 上传（生产或测试 PyPI）
twine upload dist/*                                              # 生产
twine upload --repository-url https://test.pypi.org/legacy/ dist/*   # 测试
```

### 5.2 CI 自动发布

`build_pypi.yml` 为 `workflow_call` / `workflow_dispatch` 触发，输入参数：

- `version`：版本号（会写入 `pyproject.toml`）
- `ref`：构建的 Git ref
- `upload_to_pypi`：是否上传到正式 PyPI（false 时上传到 TestPyPI）
- `release_type`：`release` 或 `nightly`

CI 还会：

- 检查 `label-studio-sdk` 依赖不能是 git sha（正式 release 时）
- 校验每个产物文件大小 < 100MB
- 产物作为 GitHub Release asset 附加上传

## 6. Docker 镜像发布（CI）

完整流程见 [.github/workflows/docker-build.yml](.github/workflows/docker-build.yml)。

- **多平台构建**：`linux/amd64` + `linux/arm64`（分别在不同 runner 上构建，再合并 manifest）
- **LaunchDarkly 配置**：构建前下载社区版 feature flags 到 `label_studio/feature_flags.json`
- **构建参数**：注入 `VERSION_OVERRIDE`（时间戳+分支+短 sha）和 `BRANCH_OVERRIDE`
- **镜像标签**：
  - `ls-release/*` 分支 → `<version>rc<sha>`
  - 其他分支 → `<pretty-branch-name>`（分支名规范化，最长 25 字符）
  - 同时打 `build_version` 标签（如 `20260708.120000-develop-abc1234`）
- **缓存**：`type=gha`（GitHub Actions 缓存）
- **产物**：SBOM + provenance 已启用

## 7. 云平台部署

### 7.1 Heroku

基于 [Dockerfile.heroku](Dockerfile.heroku) + [deploy/heroku_run.sh](deploy/heroku_run.sh)。

[app.json](app.json) 配置了 Heroku button 一键部署，`build.prebuild` 命令使用 `Dockerfile.cloudrun`（注意：app.json 实际指向 cloudrun Dockerfile，这是历史遗留）。

环境变量：`USERNAME`、`PASSWORD`（默认账户）、`DATABASE_URL`（Heroku Postgres 插件自动注入）。

### 7.2 Google Cloud Run

使用 [Dockerfile.cloudrun](Dockerfile.cloudrun)，单容器模式：

- `LABEL_STUDIO_ONE_CLICK_DEPLOY=1`
- `STORAGE_PERSISTENCE=0`（不依赖本地磁盘）

### 7.3 Hugging Face Spaces

使用 [Dockerfile.hgface](Dockerfile.hgface)，基于 develop 镜像：

- 放宽 CSRF 检查
- `SESSION_COOKIE_SAMESITE=None` + `SESSION_COOKIE_SECURE=1`
- 监听 `$SPACE_HOST`

### 7.4 Azure / GCP

仓库根目录提供 [azuredeploy.json](azuredeploy.json) + [azuredeploy.parameters.json](azuredeploy.parameters.json) ARM 模板。GCP 部署参考 [docs/source/guide/install.md](docs/source/guide/install.md)。

## 8. Makefile 速查

| 目标 | 作用 |
| - | - |
| `make env-dev-setup` | 复制 `.env.development` → `.env` |
| `make docker-dev-setup` | 初始化 docker 开发环境（含 override 文件） |
| `make docker-run-dev` | `docker compose up --build` |
| `make docker-migrate-dev` | 容器内执行 migrate |
| `make docker-collectstatic-dev` | 容器内执行 collectstatic |
| `make frontend-install` | `cd web && yarn install --frozen-lockfile` |
| `make frontend-dev` | `cd web && yarn run dev`（HMR） |
| `make frontend-watch` | `cd web && yarn run watch`（持续构建） |
| `make frontend-build` | `cd web && yarn run build`（生产构建） |
| `make frontend-storybook-serve` | 启动 Storybook |
| `make build-testing-image` | 构建生产 + 测试镜像 |
| `make docker-testing-shell` | 进入测试容器交互式 shell |
| `make test` | `cd label_studio && DJANGO_DB=sqlite pytest -v -m "not integration_tests"` |
| `make generate-swagger` | 生成 `swagger.json` |
| `make update-urls` | 导出 `core/all_urls.json` |
| `make fmt` | pre-commit 修复改动文件 |
| `make fmt-check` | pre-commit pre-push 检查 |
| `make configure-hooks` | 安装 pre-push hook |

## 9. 端口与运行时配置参考

| 服务 | 端口 | 说明 |
| - | - | - |
| Django dev server | 8080 | `make run-dev` |
| uWSGI（容器内） | 8000 | `deploy/uwsgi.ini` |
| Nginx HTTP（容器内） | 8085 | `deploy/default.conf` |
| Nginx HTTPS（容器内） | 8086 | 需挂载证书 |
| uWSGI stats | 1717 | `deploy/uwsgi.ini` |
| 对外暴露（docker-compose） | 8080 / 8081 | 映射到 Nginx 8085 / 8086 |

**关键环境变量**：

| 变量 | 默认 | 说明 |
| - | - | - |
| `DJANGO_SETTINGS_MODULE` | `core.settings.label_studio` | Django 设置模块 |
| `DJANGO_DB` | `default`（Postgres）/ `sqlite`（开发） | 数据库选择 |
| `POSTGRE_NAME/USER/PASSWORD/HOST/PORT` | — | PostgreSQL 连接（docker-compose 已配） |
| `LABEL_STUDIO_BASE_DATA_DIR` | `/label-studio/data` | 数据持久化目录 |
| `LABEL_STUDIO_HOST` | — | 对外访问地址（影响 URL 生成） |
| `JSON_LOG` | 0 | 1 启用 JSON 结构化日志 |
| `LOG_LEVEL` | INFO | 日志级别 |
| `DEBUG` | false | Django DEBUG 模式 |
| `UWSGI_PROCESSES` | 4 | uWSGI worker 数 |
| `UWSGI_WORKER_RELOAD_ON_RSS` | 1024 (MB) | worker 内存阈值触发回收 |
| `UWSGI_WORKER_MAX_LIFETIME` | 1200 (s) | worker 最大存活时间 |
| `UWSGI_WORKER_HARAKIRI` | 91 (s) | 请求超时杀进程阈值 |
| `CMD_WRAPPER` | — | 启动命令包装器（如 APM agent） |
| `ENV_INJECT_SOURCES` | — | 逗号分隔的 env 文件列表，启动前 source |

## 10. 常见问题

**Q: 构建时 `version_.py` 报错或版本异常？**
A: `version.py` 依赖 `git describe --tags`。确保：1）在 Git 仓库内构建；2）已拉取 tags（`git fetch --tags`）；3）或通过 `VERSION_OVERRIDE` / `BRANCH_OVERRIDE` 显式指定。

**Q: Poetry 安装报 `pyuwsgi` 编译失败？**
A: 必须带 `--extras uwsgi`，并确保系统有 `build-base` / `python3-dev` / `linux-headers`（Alpine）或 `build-essential`（Debian）。容器构建已处理这些依赖。

**Q: 前端构建 OOM？**
A: Dockerfile 已设 `NODE_OPTIONS="--max-old-space-size=4096"`。本地构建可在 shell 中导出相同环境变量。

**Q: collectstatic 报缺少前端文件？**
A: 必须先执行 `yarn build` 生成 `web/dist/`，再执行 collectstatic。`prebuild.sh` 已按正确顺序执行。

**Q: Docker 镜像构建慢？**
A: 使用 BuildKit（`DOCKER_BUILDKIT=1`）启用缓存挂载。CI 已配置 `cache-from/to: type=gha`。本地可改用 `Dockerfile.development`（基于 slim 镜像，构建更快但体积更大）。

**Q: 多平台构建（arm64）失败？**
A: 参考 [docker-build.yml](.github/workflows/docker-build.yml)，arm64 在 `ubuntu-24.04-arm` runner 上原生构建（非 QEMU 模拟）。本地构建 arm64 需启用 binfmt 并使用 `--platform linux/arm64`。

## 11. 参考文档

- [README.md](README.md) — 用户安装与使用
- [CONTRIBUTING.md](CONTRIBUTING.md) — 贡献指南
- [Makefile](Makefile) — 所有构建命令封装
- [Dockerfile](Dockerfile) — 默认生产镜像构建逻辑
- [deploy/](deploy/) — 部署脚本目录（docker-entrypoint、uwsgi.ini、nginx.conf）
- [pyproject.toml](pyproject.toml) — Poetry 打包配置与依赖
- [web/package.json](web/package.json) — 前端构建脚本
- [web/README.md](web/README.md) — 前端开发指南
- [docs/source/guide/install.md](docs/source/guide/install.md) — 用户部署文档
- [.github/workflows/build_pypi.yml](.github/workflows/build_pypi.yml) — PyPI 发布 CI
- [.github/workflows/docker-build.yml](.github/workflows/docker-build.yml) — Docker 镜像发布 CI
