<script setup lang="ts">
import { computed, ref } from "vue";
import { AlertTriangle, Replace, Save, Search, Sparkles } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type CaptionEntry } from "@shared/types";
import { apiPost, thumbUrl } from "@/api/client";
import { BaseButton, BaseInput, BasePillGroup } from "@/components/common";
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
        <div class="w-60">
          <BaseInput v-model="searchQuery" placeholder="Filter filename or caption...">
            <template #prefix>
              <Search class="h-3.5 w-3.5" />
            </template>
          </BaseInput>
        </div>

        <BasePillGroup
          :model-value="filterMode"
          :options="[
            { value: 'all', label: `All (${entries.length})`, variant: 'neutral' },
            { value: 'uncaptioned', label: 'Uncaptioned' },
            { value: 'dirty', label: `Unsaved (${dirtyPaths.size})`, variant: 'warning' },
          ]"
          @update:model-value="(val) => (filterMode = val as 'all' | 'uncaptioned' | 'dirty')"
        />
      </div>

      <BaseButton v-if="dirtyPaths.size > 0" variant="primary" @click="emit('save-all-dirty')">
        <template #icon-left><Save class="h-3.5 w-3.5" /></template>
        <span>Save All ({{ dirtyPaths.size }})</span>
      </BaseButton>
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
        <div class="w-40">
          <BaseInput
            v-model="triggerWord"
            size="compact"
            mono
            placeholder="e.g. jeje, ohwx"
            @keyup.enter="checkTriggerTokens"
          />
        </div>
        <BaseButton
          size="compact"
          variant="ghost"
          :disabled="checkingTrigger"
          @click="checkTriggerTokens"
        >
          <template #icon-left><Sparkles class="h-3.5 w-3.5 text-primary" /></template>
          <span>Inspect Tokens</span>
        </BaseButton>
        <span v-if="triggerResult" class="truncate font-mono text-[11px] text-info">
          {{ triggerResult.note || triggerResult.summary || JSON.stringify(triggerResult) }}
        </span>
      </div>

      <!-- Bulk Find & Replace -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
          Bulk Replace:
        </span>
        <div class="w-36">
          <BaseInput v-model="findText" size="compact" placeholder="Find text..." />
        </div>
        <div class="w-36">
          <BaseInput v-model="replaceText" size="compact" placeholder="Replace with..." />
        </div>
        <BaseButton size="compact" variant="ghost" @click="runFindReplace(true)">
          <span>Dry Run</span>
        </BaseButton>
        <BaseButton size="compact" variant="secondary" @click="runFindReplace(false)">
          <template #icon-left><Replace class="h-3.5 w-3.5" /></template>
          <span>Apply</span>
        </BaseButton>
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
                <BaseButton
                  size="icon-xs"
                  variant="ghost"
                  :disabled="!dirtyPaths.has(item.path)"
                  title="Save caption"
                  @click="emit('save-caption', item)"
                >
                  <Save class="h-3.5 w-3.5 text-primary" />
                </BaseButton>
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
