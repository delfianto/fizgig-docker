# syntax=docker/dockerfile:1
ARG BASE_IMAGE=ghcr.io/shootthesound/fizgig@sha256:92aeb5a6041123ae9c9c89060c8f237d9c1a49ef36da00be9cfa0f7bb305abac
FROM ${BASE_IMAGE}
ARG UPSTREAM_COMMIT=2b309bd47fdf77216e2bc94dce8d099d58e40998
LABEL org.opencontainers.image.title="Fizgig" \
    org.opencontainers.image.source="https://github.com/delfianto/fizgig-docker" \
    org.opencontainers.image.description="Fizgig with read-only local manifests and offline model workers" \
    io.github.delfianto.fizgig.upstream-revision="${UPSTREAM_COMMIT}"
WORKDIR /opt/Fizgig
RUN test "${#UPSTREAM_COMMIT}" -eq 40 \
    && case "$UPSTREAM_COMMIT" in *[!0-9a-f]*) exit 1 ;; esac \
    && git init . \
    && git remote add origin https://github.com/shootthesound/Fizgig.git \
    && git fetch --depth 1 origin "$UPSTREAM_COMMIT" \
    && git checkout --detach FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "$UPSTREAM_COMMIT" \
    && UV_NO_CACHE=1 python3 uv_install_deps.py requirements.txt /opt/venv \
    && rm -rf /root/.cache /workspace/.cache/uv
COPY src/fizgig_local /opt/fizgig-local/fizgig_local
COPY docker/fizgig-local.pth /tmp/fizgig-local.pth
COPY docker/entrypoint.sh /entrypoint.sh
RUN python3 -c 'import pathlib,site,shutil; shutil.copy("/tmp/fizgig-local.pth", pathlib.Path(site.getsitepackages()[0]) / "fizgig-local.pth")' \
    && chmod +x /entrypoint.sh \
    && mkdir -p /workspace/user_data /workspace/models /opt/Fizgig/user_data \
    && ln -s /workspace/models /opt/Fizgig/user_data/models
ENV FIZGIG_OFFLINE=1 FIZGIG_POD=0 FIZGIG_HOME=/workspace \
    FIZGIG_USER_DATA=/workspace/user_data \
    FIZGIG_MODEL_CATALOG=/etc/fizgig/models.json \
    PYTHONPATH=/opt/Fizgig/src:/opt/fizgig-local \
    HF_HOME=/workspace/.cache/huggingface \
    HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1
# The repository-root fizgig.py shadows the package for python -c/-m imports.
WORKDIR /workspace
# Catch upstream preference/registry changes before publishing; no model loads.
RUN python3 -c 'from fizgig.web import server; from fizgig.families.registry import get; assert callable(server.main); assert {f.pref_key for f in get("krea2").model_files} >= {"krea2_raw_dit", "krea2_vae", "krea2_text_encoder"}'
EXPOSE 8081
ENTRYPOINT ["/entrypoint.sh"]
CMD []
