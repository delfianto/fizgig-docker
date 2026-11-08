# Fizgig MCP

The image runs a companion MCP process alongside the upstream web UI. The official
Python MCP SDK lives in `/opt/fizgig-mcp`, separate from training dependencies.
It calls the UI at container loopback, using the existing session-token/password
login flow. The UI continues to own training, the queue and run history. The
supervisor forwards shutdown signals and exits if either process dies.

Streamable HTTP: `/mcp` on port **8083**. Every MCP request, including initialize,
SSE and session deletion, requires `Authorization: Bearer <Fizgig password>`.
Reuse the central `fizgig_password` secret; no value belongs in a client config.
Host/Origin protection remains enabled through `FIZGIG_MCP_ALLOWED_HOSTS`.
`/health` needs no auth and returns only availability, after checking the UI.

| Area | Tools |
| --- | --- |
| Live state | `get_status`, `get_gpu_stats`, `get_logs` |
| History | `list_runs`, `get_run`, `get_run_loss`, `get_run_files`, `get_run_samples`, `list_outputs` |
| Configuration | `list_families`, `get_family`, `get_paths`, `list_model_bundles`, `validate_model_bundle` |
| Dataset | `list_datasets`, `get_dataset_info`, `get_caption`, `set_caption` |
| Planning | `prepare_training` |
| Execution | `start_training`, `pause_training`, `resume_training`, `stop_training` |
| Queue | `list_queue`, `get_queue_item`, `queue_training`, `start_queue`, `hold_queue` |

Read `get_family` for the complete form/presets before preparing a run. Supply
`family`, a complete `values` object using upstream form keys, and an existing
container folder below `/datasets`. Set `LORA_NAME`; outputs must remain beneath
`/workspace/output_loras`. Existing manifest model paths stay in UI preferences.
`prepare_training` calls the UI planner and never submits. Warnings and problems
are retained; `start_training` does not bypass them. Only explicit execution
calls start GPU work. The UI-selected GPU applies; inspect it before execution.

Queue insertion may start training immediately when dispatch is enabled, even
with no queued jobs. `queue_training` requires `allow_dispatch=true` in that case.
A held queue may be appended to, but the UI API has no transactional compare-and-set:
avoid concurrent queue control from the UI or other clients. An empty queue cannot
remain held upstream. `start_queue` can dispatch every pending run.

Mutations are never retried on connection errors or timeouts. Read `get_status`
and the queue before deciding whether a request needs recovery. Authentication
rejection may refresh login once, before the rejected action can execute.

Log reads return bounded saved console tails, not a continuous SSE connection or
AI Toolkit byte offsets. Run/checkpoint paths belong to the Fizgig container.
Dataset inspection/caption editing uses paths below `/datasets`; edits also affect
Toolkit's shared dataset. No raw HTTP, shell, credentials, model downloads,
checkpoint deletion or backend switching tools are exposed. Workbench rendering
and repair remain in the UI in this version.

Read-only live smoke test inside the container:

```sh
docker exec fizgig /opt/fizgig-mcp/bin/python -m fizgig_mcp.smoke_test
```

This checks auth, protocol discovery and representative reads. It never queues or
starts training. Reload client MCP connections after updating their configuration.
