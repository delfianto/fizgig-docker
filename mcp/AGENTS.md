# MCP & Python Runtime Workspace Guide

This directory houses the Python backend runtime for Fizgig, including the Model Context Protocol (MCP) server, internal container adapters, offline model catalog management, and upstream verification tooling.

---

## 1. Technology Stack & Environment

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Python Runtime** | Python 3.12+ | Target version `py312`, strictly pinned in `pyproject.toml` |
| **Package Management** | uv | `uv.lock` dependency lockfile, `uv sync --extra mcp` |
| **MCP Framework** | FastMCP | `mcp==2.3.0` supporting both `StreamableHTTP` and `stdio` transports |
| **Linter & Formatter** | Ruff | Configured in `pyproject.toml` (`[tool.ruff] target-version = "py312"`) |
| **Type Checker** | Basedpyright | Configured in `pyproject.toml` (`[tool.basedpyright] typeCheckingMode = "standard"`) |
| **Testing Framework** | Python unittest / pytest | Standard discovery via `python -m unittest discover -s tests -v` |
| **Security & Sandbox** | Loopback / Socket Filtering | Enforced by `fizgig_local.offline` under `FIZGIG_OFFLINE=1` |

---

## 2. Directory Structure

```
mcp/
├── pyproject.toml              # Build backend (setuptools), Ruff, and Basedpyright configuration
├── uv.lock                     # Locked dependencies (Python >=3.12, mcp==2.3.0)
├── README.md                   # Human-readable project overview
├── AGENTS.md                   # Machine-readable architectural guide and development contract
├── src/
│   ├── fizgig_mcp/             # Model Context Protocol (MCP) server & adapters
│   │   ├── server.py           # FastMCP server definition, tool exposure, Bearer token auth
│   │   ├── adapter.py          # HTTP client adapter connecting to internal Fizgig endpoints
│   │   ├── supervise.py        # Background process supervisor & process management
│   │   └── smoke_test.py       # Integration smoke test against a live Fizgig container
│   └── fizgig_local/           # Offline manifest catalog and security runtime
│       ├── catalog.py          # Declarative models.json parser & manifest hydrator
│       ├── offline.py          # Network sandbox enforcer & loopback gatekeeper
│       └── __main__.py         # CLI entry point (`python -m fizgig_local`)
├── tests/
│   ├── test_catalog.py         # Unit tests for manifest parsing, path sandboxing & duplicate rejection
│   ├── test_mcp.py             # Integration tests for MCP tools, bearer auth, and queue safety
│   └── test_upstream.py        # Tests for upstream release fingerprint and Docker digest validation
└── tools/
    ├── smoke.py                # Container runtime health and smoke checks
    └── upstream/check.py       # Upstream release and digest synchronization tool
```

---

## 3. Architecture & Security Invariants

### 3.1. Model Context Protocol Server (`fizgig_mcp`)
Exposes a safe, structured tool interface for AI agents and automation clients to manage Fizgig training runs:
- **Discovery Tools**:
  - `get_status`: Reads current training state, elapsed time, step progress, speed, and VRAM utilization.
  - `list_jobs`: Lists active, queued, and historical training jobs with status filters.
  - `get_job`: Retrieves full training metadata, hyperparameters, and directory paths for a specific job.
  - `get_logs`: Streams or fetches live execution stdout/stderr logs.
  - `get_loss`: Retrieves epoch/step loss series, EMA trends, and gradient norms.
- **Training Orchestration Tools**:
  - `prepare_training`: Validates hyperparameters and generates a declarative training plan without executing.
  - `queue_training`: Adds a validated plan to the background execution queue. Requires explicit confirmation if queue dispatch is enabled to prevent unexpected launches.
  - `start_training`: Dispatches a training run directly to the GPU worker.
  - `stop_training`: Sends an interrupt/cancellation signal to an active worker.
- **Dataset & Caption Operations**:
  - `get_caption`: Reads raw text caption for an image.
  - `set_caption`: Performs atomic, path-sandboxed text updates.
- **Catalog Management**:
  - `list_catalog`: Inspects declared model bundles in `/etc/fizgig/models.json`.
  - `apply_catalog`: Hydrates and switches active model weights in `/workspace/models`.

### 3.2. Strict Sandboxing & Safety Contracts
- **Path Confinement**: All dataset and file paths must strictly resolve beneath their designated root (e.g. `/datasets`). Any path traversal attempts (`..`, absolute root escapes, or malicious symlinks) are caught and rejected with an explicit error.
- **Atomic File Writes**: `set_caption` writes to a sibling temporary file (`.tmp.caption`) and uses `os.replace` to guarantee atomic file replacement, preventing race conditions or corruptions during live training reads.
- **Uncertain Mutation State Handling**: When a state-mutating request (`start_training`, `stop_training`, `queue_training`) encounters a timeout or network failure, the operation outcome is marked **uncertain**. Agents must read status (`get_status` / `get_job`) before attempting any retries.
- **Bearer Authentication**: When exposed over `StreamableHTTP`, all MCP endpoints require a valid Bearer token (`Authorization: Bearer <FIZGIG_MCP_TOKEN>`).

### 3.3. Offline Catalog Hydration (`fizgig_local`)
- Designed to run inside container environments where `FIZGIG_OFFLINE=1` is enforced.
- Parses `/etc/fizgig/models.json` and ensures required diffusion, encoder, VAE, and LoRA weights are present in external mounted storage before symlinking or hydrating into `/workspace/models`.
- Validates recorded file sizes and SHA256 checksums to reject corrupt or tampered model weights.

---

## 4. Development & Quality Gates

Before committing any changes to the Python workspace, all gates must pass cleanly:

```bash
cd mcp

# 1. Synchronize virtual environment
uv sync --extra mcp

# 2. Code style & linting (Ruff)
uv run ruff check

# 3. Static type checking (Basedpyright)
uv run basedpyright

# 4. Run full test suite (Unittest / Pytest)
uv run python -m unittest discover -s tests -v

# 5. Container integration smoke test (when container is running)
uv run python -m fizgig_mcp.smoke_test
```

---

## 5. Git & Workflow Rules

- **Strictly Local Commits**: All commits must be made locally on the active branch (`main`). Never push to `origin/main` unless explicitly commanded by the user.
- **Documentation Parity**: Whenever modifying MCP tool definitions, adapter endpoints, or catalog schemas, update `README.md` and this `AGENTS.md` in the same commit.
