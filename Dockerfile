# syntax=docker/dockerfile:1
ARG BASE_IMAGE=ghcr.io/shootthesound/fizgig:latest

FROM oven/bun:1-slim AS webui-build
WORKDIR /build/webui
COPY webui/package.json webui/bun.lock ./
RUN bun install --frozen-lockfile
COPY webui/ ./
RUN bun run build

FROM ${BASE_IMAGE}
ARG UPSTREAM_COMMIT=HEAD
LABEL org.opencontainers.image.title="Fizgig" \
    org.opencontainers.image.source="https://github.com/delfianto/fizgig-docker" \
    org.opencontainers.image.description="Fizgig with Linear-dark WebUI, read-only local manifests and offline model workers" \
    io.github.delfianto.fizgig.upstream-revision="${UPSTREAM_COMMIT}"
WORKDIR /opt/Fizgig
RUN git init . \
    && git remote add origin https://github.com/shootthesound/Fizgig.git \
    && if [ -z "$UPSTREAM_COMMIT" ] || [ "$UPSTREAM_COMMIT" = "HEAD" ]; then \
        git fetch --depth 1 origin HEAD \
        && git checkout --detach FETCH_HEAD; \
    else \
        test "${#UPSTREAM_COMMIT}" -eq 40 \
        && case "$UPSTREAM_COMMIT" in *[!0-9a-f]*) exit 1 ;; esac \
        && git fetch --depth 1 origin "$UPSTREAM_COMMIT" \
        && git checkout --detach FETCH_HEAD \
        && test "$(git rev-parse HEAD)" = "$UPSTREAM_COMMIT"; \
    fi \
    && git rev-parse HEAD > /etc/fizgig-upstream-revision \
    && UV_NO_CACHE=1 python3 uv_install_deps.py requirements.txt /opt/venv \
    && rm -rf /root/.cache /workspace/.cache/uv
COPY docker/mcp-requirements.txt /tmp/mcp-requirements.txt
RUN python3 -m venv /opt/fizgig-mcp \
    && /opt/fizgig-mcp/bin/pip install --no-cache-dir -r /tmp/mcp-requirements.txt
COPY mcp/src /opt/fizgig-local
COPY --from=webui-build /build/webui/dist /opt/fizgig-webui
COPY docker/fizgig-local.pth /tmp/fizgig-local.pth
COPY docker/entrypoint.sh /entrypoint.sh
RUN python3 -c 'import pathlib,site,shutil; shutil.copy("/tmp/fizgig-local.pth", pathlib.Path(site.getsitepackages()[0]) / "fizgig-local.pth")' \
    && chmod +x /entrypoint.sh \
    && mkdir -p /workspace/user_data /workspace/models /opt/Fizgig/user_data \
    && ln -s /workspace/models /opt/Fizgig/user_data/models
ENV FIZGIG_OFFLINE=1 FIZGIG_POD=0 FIZGIG_HOME=/workspace \
    FIZGIG_USER_DATA=/workspace/user_data \
    FIZGIG_MODEL_CATALOG=/etc/fizgig/models.json \
    FIZGIG_WEBUI_DIST=/opt/fizgig-webui \
    PYTHONPATH=/opt/Fizgig/src:/opt/fizgig-local \
    HF_HOME=/workspace/.cache/huggingface \
    HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1
# The repository-root fizgig.py shadows the package for python -c/-m imports.
WORKDIR /workspace
# Catch upstream preference/registry and WebUI gateway changes before publishing; no model loads.
RUN test -f /opt/fizgig-webui/index.html \
    && python3 -c 'from fizgig.web import server; from fizgig.families.registry import get; assert callable(server.main); assert {f.pref_key for f in get("krea2").model_files} >= {"krea2_raw_dit", "krea2_vae", "krea2_text_encoder"}' \
    && /opt/fizgig-mcp/bin/python -c 'from fizgig_mcp import server, webui; assert callable(server.main) and callable(webui.main)'
EXPOSE 8081
EXPOSE 8083
ENTRYPOINT ["/entrypoint.sh"]
CMD []
