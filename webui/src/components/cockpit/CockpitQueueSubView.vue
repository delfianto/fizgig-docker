<script setup lang="ts">
import { ArrowDown, ArrowUp, Pause, Play, Trash2 } from "lucide-vue-next";
import { useRunStore } from "@/stores/run";

const runStore = useRunStore();
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4">
    <div class="mx-auto max-w-5xl rounded-lg border border-hairline bg-base-300">
      <div class="flex items-center justify-between border-b border-hairline bg-base-200 px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-base-content">Shared Training Queue</h2>
          <p class="text-xs text-muted">
            Jobs run sequentially. Holding the queue prevents pending jobs from starting when the
            current run finishes.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="!runStore.run?.web_queue?.held"
            type="button"
            class="btn btn-sm h-8.5 rounded-lg btn-ghost border border-warning/40 bg-warning/10 text-warning px-3 text-xs font-semibold gap-1.5 cursor-pointer"
            @click="runStore.holdQueue()"
          >
            <Pause class="h-3.5 w-3.5" />
            <span>Hold Queue Dispatch</span>
          </button>
          <button
            v-else
            type="button"
            class="btn btn-sm h-8.5 rounded-lg btn-primary px-3 text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
            @click="runStore.startQueue()"
          >
            <Play class="h-3.5 w-3.5" />
            <span>Release Hold &amp; Start Queue</span>
          </button>
        </div>
      </div>

      <div class="divide-y divide-hairline">
        <div
          v-if="!runStore.run?.web_queue?.items?.length"
          class="p-8 text-center text-xs text-muted"
        >
          Queue is currently empty. Use the
          <strong class="text-base-content">Composer</strong> to validate and add runs to the queue.
        </div>

        <div
          v-for="(item, idx) in runStore.run?.web_queue?.items ?? []"
          :key="item.id"
          class="flex items-center justify-between px-4 py-3 text-xs hover:bg-surface-hover"
        >
          <div class="flex items-center gap-3">
            <span
              class="font-mono-num flex h-6 w-6 items-center justify-center rounded bg-base-200 text-subtle"
            >
              {{ idx + 1 }}
            </span>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono font-semibold text-base-content">
                  {{ item.lora }}
                </span>
                <span class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-[10px]">
                  {{ item.family }}
                </span>
              </div>
              <div class="mt-0.5 font-mono text-[11px] text-muted">
                {{ item.image_folder }}
                <span v-if="item.summary"> · {{ item.summary }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="btn btn-sm h-7.5 w-7.5 p-0 rounded-md btn-ghost border border-hairline cursor-pointer flex items-center justify-center"
              :disabled="idx === 0"
              title="Move run up in queue"
              @click="runStore.moveQueueItem(item.id, -1)"
            >
              <ArrowUp class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="btn btn-sm h-7.5 w-7.5 p-0 rounded-md btn-ghost border border-hairline cursor-pointer flex items-center justify-center"
              :disabled="idx === (runStore.run?.web_queue?.items?.length ?? 1) - 1"
              title="Move run down in queue"
              @click="runStore.moveQueueItem(item.id, 1)"
            >
              <ArrowDown class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="btn btn-sm h-7.5 w-7.5 p-0 rounded-md btn-ghost border border-error/30 text-error hover:bg-error/15 cursor-pointer flex items-center justify-center"
              title="Remove from queue"
              @click="runStore.removeQueueItem(item.id)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
