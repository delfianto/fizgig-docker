# Fizgig MCP & Python Runtime Project

The Python backend root for [Fizgig](https://github.com/delfianto/fizgig-docker), housing the Model Context Protocol (MCP) server, container adapters, and offline model catalog runtime.

## Directory Structure

```
mcp/
├── pyproject.toml         # Python project configuration (setuptools + uv)
├── uv.lock                # Locked dependency tree (Python >=3.12, mcp==2.3.0)
├── src/
│   ├── fizgig_mcp/        # Model Context Protocol (MCP) server implementation
│   │   ├── adapter.py     # HTTP adapter talking to Fizgig internal endpoints
│   │   ├── server.py      # FastMCP StreamableHTTP & stdio server definition
│   │   ├── supervise.py   # Background process supervisor
│   │   └── smoke_test.py  # Local integration test against running container
│   └── fizgig_local/      # Offline manifest catalog and worker utilities
│       ├── catalog.py     # Declarative models.json parser & manifest hydrator
│       ├── offline.py     # Network sandbox enforcer & loopback gatekeeper
│       └── __main__.py    # CLI entry point (`python -m fizgig_local`)
├── tests/
│   ├── test_catalog.py    # Unit tests for models.json validation & path sandboxing
│   ├── test_mcp.py        # Integration tests for MCP tools & bearer auth
│   └── test_upstream.py   # Tests for upstream release fingerprint verification
└── tools/
    ├── smoke.py           # Container runtime smoke test
    └── upstream/check.py  # Head commit & published Docker digest checker
```

## Setup & Local Development

This project uses [`uv`](https://docs.astral.sh/uv/) for high-performance Python environment management:

```bash
cd mcp

# Install virtual environment with MCP dependencies
uv sync --extra mcp

# Run unit tests
uv run python -m unittest discover -s tests -v

# Run smoke test against running Fizgig container
uv run python -m fizgig_mcp.smoke_test
```

## Provided Tools & Architecture

### 1. `fizgig_mcp` (Model Context Protocol Server)
Implements an MCP-compliant server providing agentic assistants and external clients with safe, structured interfaces to manage Fizgig training jobs:

- **Discovery:** `get_status`, `list_jobs`, `get_job`, `get_logs`, `get_loss`.
- **Training Orchestration:** `prepare_training`, `queue_training`, `start_training`, `stop_training`.
- **Dataset Operations:** `get_caption`, `set_caption` (atomic path-sandboxed caption editing).
- **Model Catalog:** `list_catalog`, `apply_catalog` (declarative bundle activation).

All mutations enforce strict validation (no path traversal, confirmation before dispatching held queues, and atomic caption writes).

### 2. `fizgig_local` (Offline Model Manifest Hydrator)
Enforces completely offline operation (`FIZGIG_OFFLINE=1`) and hydrates declarative model bundles from `/etc/fizgig/models.json` into `/workspace/models` without downloading external weights at runtime.
