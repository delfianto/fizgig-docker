<script setup lang="ts">
import { computed, ref } from "vue";
import { AlertTriangle, Replace, Save, Search, Sparkles } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type CaptionEntry } from "@shared/types";
import { apiPost, thumbUrl } from "@/api/client";
import { useComposerStore } from "@/stores/composer";

const props = defineProps<{
  selectedFolder: string;
  entries: CaptionEntry[];
  editedCaptions: Record<string, string>;
  dirtyPaths: Set<string>;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "caption-change", payload: { path: string; value: string; original: string }): void;
  (e: "save-caption", item: CaptionEntry): void;
  (e: "save-all-dirty"): void;
  (e: "reload-captions"): void;
}>();

const composerStore = useComposerStore();

const searchQuery = ref("");
const filterMode = ref<"all" | "uncaptioned" | "dirty">("all");

// Trigger word tokenizer check
const triggerWord = ref("");
const triggerResult = ref<Record<string, unknown> | null>(null);
const checkingTrigger = ref(false);

// Bulk Find & Replace
const findText = ref("");
const replaceText = ref("");
const dryRunPreview = ref<{ changed?: number; note?: string } | null>(null);

const filteredEntries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return props.entries.filter((item) => {
    const currentCaption = props.editedCaptions[item.path] ?? item.caption ?? "";
    if (filterMode.value === "uncaptioned" && currentCaption.trim().length > 0) {
      return false;
    }
    if (filterMode.value === "dirty" && !props.dirtyPaths.has(item.path)) {
      return false;
    }
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || currentCaption.toLowerCase().includes(q);
  });
});

async function checkTriggerTokens(): Promise<void> {
  if (!triggerWord.value.trim()) return;
  checkingTrigger.value = true;
  try {
    triggerResult.value = await apiPost<Record<string, unknown>>("/api/captions/trigger_check", {
      word: triggerWord.value.trim(),
      trigger: triggerWord.value.trim(),
      family: composerStore.family,
      folder: props.selectedFolder,
    });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Trigger check failed");
  } finally {
    checkingTrigger.value = false;
  }
}

async function runFindReplace(dryRun: boolean): Promise<void> {
  if (!props.selectedFolder || !findText.value) return;
  try {
    const res = await apiPost<{ changed?: number; note?: string }>("/api/captions/replace", {
      folder: props.selectedFolder,
      find: findText.value,
      replace: replaceText.value,
      dry_run: dryRun,
    });
    dryRunPreview.value = res;
    if (!dryRun) {
      toast.success(res.note ?? `Updated ${res.changed ?? 0} captions`);
      emit("reload-captions");
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Find/replace failed");
  }
}
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Filter Bar & Quick Tools Header -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 bg-base-200/40 px-4 py-2.5"
    >
      <div class="flex items-center gap-2">
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/40"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Filter filename or caption..."
            class="input input-sm h-8.5 rounded-lg border-hairline-strong bg-base-100 pl-8.5 w-60 text-xs focus:border-primary focus:outline-none"
          />
        </div>

        <div
          class="join border border-hairline-strong bg-base-300 p-0.5 rounded-lg h-8.5 items-center"
        >
          <button
            type="button"
            class="btn btn-sm h-7.5 join-item border-0 gap-1.5 px-3 text-xs font-semibold rounded-md transition cursor-pointer"
            :class="
              filterMode === 'all'
                ? 'bg-neutral text-neutral-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            @click="filterMode = 'all'"
          >
            All ({{ entries.length }})
          </button>
          <button
            type="button"
            class="btn btn-sm h-7.5 join-item border-0 gap-1.5 px-3 text-xs font-semibold rounded-md transition cursor-pointer"
            :class="
              filterMode === 'uncaptioned'
                ? 'bg-primary text-primary-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            @click="filterMode = 'uncaptioned'"
          >
            Uncaptioned
          </button>
          <button
            type="button"
            class="btn btn-sm h-7.5 join-item border-0 gap-1.5 px-3 text-xs font-semibold rounded-md transition cursor-pointer"
            :class="
              filterMode === 'dirty'
                ? 'bg-warning text-warning-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            @click="filterMode = 'dirty'"
          >
            Unsaved ({{ dirtyPaths.size }})
          </button>
        </div>
      </div>

      <button
        v-if="dirtyPaths.size > 0"
        type="button"
        class="btn btn-sm h-8.5 rounded-lg btn-primary cursor-pointer gap-1.5 px-3.5 text-xs font-semibold shadow-xs"
        @click="emit('save-all-dirty')"
      >
        <Save class="h-3.5 w-3.5" />
        <span>Save All ({{ dirtyPaths.size }})</span>
      </button>
    </div>

    <!-- Tokenizer Check & Find/Replace Utility Strip -->
    <div
      class="grid grid-cols-1 gap-3 border-b border-base-300 bg-base-200/25 px-4 py-2.5 xl:grid-cols-2"
    >
      <!-- Trigger Tokenizer Inspector -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
          Trigger Token Check:
        </span>
        <input
          v-model="triggerWord"
          type="text"
          placeholder="e.g. jeje, ohwx"
          class="input input-sm h-8 rounded-md border-base-300 bg-base-100 font-mono text-xs w-40 focus:border-primary focus:outline-none"
          @keyup.enter="checkTriggerTokens"
        />
        <button
          type="button"
          class="btn btn-sm h-8 rounded-md btn-ghost border border-base-300 hover:border-primary px-3 text-xs font-semibold gap-1.5 cursor-pointer"
          :disabled="checkingTrigger"
          @click="checkTriggerTokens"
        >
          <Sparkles class="h-3.5 w-3.5 text-primary" />
          <span>Inspect Tokens</span>
        </button>
        <span v-if="triggerResult" class="truncate font-mono text-[11px] text-info">
          {{ triggerResult.note || triggerResult.summary || JSON.stringify(triggerResult) }}
        </span>
      </div>

      <!-- Bulk Find & Replace -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
          Bulk Replace:
        </span>
        <input
          v-model="findText"
          type="text"
          placeholder="Find text..."
          class="input input-sm h-8 rounded-md border-base-300 bg-base-100 text-xs w-36 focus:border-primary focus:outline-none"
        />
        <input
          v-model="replaceText"
          type="text"
          placeholder="Replace with..."
          class="input input-sm h-8 rounded-md border-base-300 bg-base-100 text-xs w-36 focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          class="btn btn-sm h-8 rounded-md btn-ghost border border-base-300 hover:border-base-content/30 px-3 text-xs font-semibold cursor-pointer"
          @click="runFindReplace(true)"
        >
          Dry Run
        </button>
        <button
          type="button"
          class="btn btn-sm h-8 rounded-md btn-secondary px-3 text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
          @click="runFindReplace(false)"
        >
          <Replace class="h-3.5 w-3.5" />
          <span>Apply</span>
        </button>
        <span v-if="dryRunPreview" class="font-mono text-[11px] text-warning">
          {{ dryRunPreview.note || `${dryRunPreview.changed ?? 0} matches` }}
        </span>
      </div>
    </div>

    <!-- Caption Cards Grid -->
    <div class="flex-1 overflow-y-auto p-4">
      <div
        v-if="loading"
        class="flex h-48 items-center justify-center text-xs text-base-content/50"
      >
        Loading dataset images and captions...
      </div>

      <div
        v-else-if="filteredEntries.length === 0"
        class="flex h-48 flex-col items-center justify-center gap-2 text-xs text-base-content/50"
      >
        <AlertTriangle class="h-5 w-5 text-warning" />
        <span>No matching images in this dataset filter.</span>
      </div>

      <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        <div
          v-for="item in filteredEntries"
          :key="item.path"
          class="flex gap-3 rounded-lg border bg-base-200/70 p-2.5 transition-colors"
          :class="dirtyPaths.has(item.path) ? 'border-warning/60' : 'border-base-300'"
        >
          <div
            class="relative h-28 w-28 shrink-0 overflow-hidden rounded border border-base-300 bg-base-300"
          >
            <img
              :src="thumbUrl(item.path, 256)"
              :alt="item.name"
              loading="lazy"
              class="h-full w-full object-cover"
            />
            <span
              v-if="item.width && item.height"
              class="absolute bottom-1 right-1 rounded bg-base-100/85 px-1 py-0.5 font-mono text-[9px] text-base-content/75"
            >
              {{ item.width }}×{{ item.height }}
            </span>
          </div>

          <div class="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-mono text-[11px] font-medium text-base-content/85">
                {{ item.name }}
              </span>
              <div class="flex items-center gap-1">
                <span
                  v-if="dirtyPaths.has(item.path)"
                  class="badge badge-warning badge-xs text-[9px]"
                >
                  modified
                </span>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost h-6 min-h-0 px-1.5 text-primary cursor-pointer"
                  :disabled="!dirtyPaths.has(item.path)"
                  title="Save caption"
                  @click="emit('save-caption', item)"
                >
                  <Save class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <textarea
              :value="editedCaptions[item.path] ?? item.caption ?? ''"
              rows="3"
              placeholder="Enter training caption..."
              class="textarea textarea-bordered w-full flex-1 bg-base-300/60 p-2 text-xs leading-snug focus:border-primary"
              @input="
                emit('caption-change', {
                  path: item.path,
                  value: ($event.target as HTMLTextAreaElement).value,
                  original: item.caption ?? '',
                })
              "
              @keydown.ctrl.s.prevent="emit('save-caption', item)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
