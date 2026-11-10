<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Replace,
  Save,
  Search,
  Sparkles,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type CaptionEntry } from "@shared/types";
import { apiPost, thumbUrl } from "@/api/client";
import { BaseBadge, BaseButton, BaseInput, BasePillGroup, BaseSelect } from "@/components/common";
import { useComposerStore } from "@/stores/composer";

const props = withDefaults(
  defineProps<{
    selectedFolder: string;
    entries: CaptionEntry[];
    editedCaptions: Record<string, string>;
    dirtyPaths: Set<string>;
    loading: boolean;
    savingAll?: boolean;
  }>(),
  {
    savingAll: false,
  },
);

const emit = defineEmits<{
  (e: "caption-change", payload: { path: string; value: string; original: string }): void;
  (e: "save-caption", item: CaptionEntry): void;
  (e: "save-all-dirty"): void;
  (e: "reload-captions"): void;
}>();

const composerStore = useComposerStore();

const searchQuery = ref("");
const filterMode = ref<"all" | "uncaptioned" | "dirty">("all");
const activeUtility = ref<"none" | "tokens" | "affix" | "replace">("none");

// Pagination state to avoid mounting 500–5000+ textareas at once
const currentPage = ref(1);
const pageSize = ref(48);

// Trigger word tokenizer check
const triggerWord = ref("");
const triggerResult = ref<Record<string, unknown> | null>(null);
const checkingTrigger = ref(false);

// Bulk Prepend / Append (/api/captions/add)
const prefixText = ref("");
const suffixText = ref("");
const affixPreview = ref<{ changed?: number; note?: string } | null>(null);

// Bulk Find & Replace (/api/captions/replace)
const findText = ref("");
const replaceText = ref("");
const dryRunPreview = ref<{ changed?: number; note?: string } | null>(null);

const uncaptionedCount = computed(() => {
  let count = 0;
  for (const item of props.entries) {
    const cap = (props.editedCaptions[item.path] ?? item.caption ?? "").trim();
    if (!cap) count++;
  }
  return count;
});

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

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredEntries.value.length / pageSize.value)),
);

watch([() => props.selectedFolder, searchQuery, filterMode, pageSize], () => {
  currentPage.value = 1;
});

watch(totalPages, (maxP) => {
  if (currentPage.value > maxP) {
    currentPage.value = maxP;
  }
});

const pagedEntries = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredEntries.value.slice(start, start + pageSize.value);
});

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

async function checkTriggerTokens(): Promise<void> {
  if (!triggerWord.value.trim()) return;
  checkingTrigger.value = true;
  try {
    triggerResult.value = await apiPost<Record<string, unknown>>("/api/captions/trigger_check", {
      word: triggerWord.value.trim(),
      trigger: triggerWord.value.trim(),
      family: composerStore.family || "krea2",
      folder: props.selectedFolder,
    });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Trigger check failed");
  } finally {
    checkingTrigger.value = false;
  }
}

async function runBulkAffix(apply: boolean): Promise<void> {
  if (!props.selectedFolder || (!prefixText.value.trim() && !suffixText.value.trim())) return;
  try {
    const res = await apiPost<{ changed?: number; note?: string }>("/api/captions/add", {
      folder: props.selectedFolder,
      start: prefixText.value,
      end: suffixText.value,
      apply,
    });
    affixPreview.value = res;
    if (apply) {
      toast.success(res.note ?? `Updated ${res.changed ?? 0} captions`);
      emit("reload-captions");
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Bulk prepend/append failed");
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
    <!-- Filter Bar & Bulk Utility Toggles -->
    <div
      class="flex flex-wrap items-center justify-between gap-2.5 border-b border-hairline bg-base-200/70 px-4 py-2"
    >
      <div class="flex flex-wrap items-center gap-2">
        <div class="w-56">
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
            { value: 'uncaptioned', label: `Uncaptioned (${uncaptionedCount})` },
            { value: 'dirty', label: `Unsaved (${dirtyPaths.size})`, variant: 'warning' },
          ]"
          @update:model-value="(val) => (filterMode = val as 'all' | 'uncaptioned' | 'dirty')"
        />

        <!-- Compact Bulk Tool Switchers -->
        <div class="flex items-center gap-1.5 pl-1">
          <BaseButton
            size="compact"
            :variant="activeUtility === 'tokens' ? 'primary' : 'ghost'"
            :active="activeUtility === 'tokens'"
            @click="activeUtility = activeUtility === 'tokens' ? 'none' : 'tokens'"
          >
            <template #icon-left><Sparkles class="h-3.5 w-3.5" /></template>
            <span>Token Check</span>
          </BaseButton>

          <BaseButton
            size="compact"
            :variant="activeUtility === 'affix' ? 'primary' : 'ghost'"
            :active="activeUtility === 'affix'"
            @click="activeUtility = activeUtility === 'affix' ? 'none' : 'affix'"
          >
            <template #icon-left><Plus class="h-3.5 w-3.5" /></template>
            <span>Prepend / Append</span>
          </BaseButton>

          <BaseButton
            size="compact"
            :variant="activeUtility === 'replace' ? 'primary' : 'ghost'"
            :active="activeUtility === 'replace'"
            @click="activeUtility = activeUtility === 'replace' ? 'none' : 'replace'"
          >
            <template #icon-left><Replace class="h-3.5 w-3.5" /></template>
            <span>Find &amp; Replace</span>
          </BaseButton>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <BaseButton
          v-if="dirtyPaths.size > 0"
          variant="primary"
          :disabled="savingAll"
          @click="emit('save-all-dirty')"
        >
          <template #icon-left><Save class="h-3.5 w-3.5" /></template>
          <span>{{ savingAll ? "Saving..." : `Save All (${dirtyPaths.size})` }}</span>
        </BaseButton>
      </div>
    </div>

    <!-- Collapsible Utility Drawer Row -->
    <div
      v-if="activeUtility !== 'none'"
      class="border-b border-hairline bg-base-300/60 px-4 py-2.5 text-xs"
    >
      <!-- Utility 1: Trigger Tokenizer Inspector -->
      <div v-if="activeUtility === 'tokens'" class="flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Trigger Token Check ({{ composerStore.family || "krea2" }}):
        </span>
        <div class="w-44">
          <BaseInput
            v-model="triggerWord"
            size="compact"
            mono
            placeholder="e.g. ohwx, kang_inkyung"
            @keyup.enter="checkTriggerTokens"
          />
        </div>
        <BaseButton
          size="compact"
          variant="primary"
          :disabled="checkingTrigger || !triggerWord.trim()"
          @click="checkTriggerTokens"
        >
          <template #icon-left><Sparkles class="h-3.5 w-3.5" /></template>
          <span>Inspect Tokens</span>
        </BaseButton>
        <span v-if="triggerResult" class="font-mono text-xs text-info">
          {{
            triggerResult.verdict ||
            triggerResult.note ||
            triggerResult.summary ||
            (Array.isArray(triggerResult.tokens)
              ? `${triggerResult.count ?? triggerResult.tokens.length} token(s): ${triggerResult.tokens.join(" · ")}`
              : JSON.stringify(triggerResult))
          }}
        </span>
      </div>

      <!-- Utility 2: Bulk Prepend / Append -->
      <div v-else-if="activeUtility === 'affix'" class="flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Bulk Prepend / Append:
        </span>
        <div class="w-48">
          <BaseInput
            v-model="prefixText"
            size="compact"
            placeholder="Prepend trigger (e.g. ohwx, )"
          />
        </div>
        <div class="w-48">
          <BaseInput v-model="suffixText" size="compact" placeholder="Append tag..." />
        </div>
        <BaseButton
          size="compact"
          variant="ghost"
          :disabled="!prefixText.trim() && !suffixText.trim()"
          @click="runBulkAffix(false)"
        >
          <span>Preview</span>
        </BaseButton>
        <BaseButton
          size="compact"
          variant="primary"
          :disabled="!prefixText.trim() && !suffixText.trim()"
          @click="runBulkAffix(true)"
        >
          <span>Apply to Dataset</span>
        </BaseButton>
        <span v-if="affixPreview" class="font-mono text-xs text-warning">
          {{ affixPreview.note || `${affixPreview.changed ?? 0} caption(s) affected` }}
        </span>
      </div>

      <!-- Utility 3: Bulk Find & Replace -->
      <div v-else-if="activeUtility === 'replace'" class="flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Bulk Find &amp; Replace:
        </span>
        <div class="w-44">
          <BaseInput v-model="findText" size="compact" placeholder="Find text..." />
        </div>
        <div class="w-44">
          <BaseInput v-model="replaceText" size="compact" placeholder="Replace with..." />
        </div>
        <BaseButton
          size="compact"
          variant="ghost"
          :disabled="!findText"
          @click="runFindReplace(true)"
        >
          <span>Dry Run</span>
        </BaseButton>
        <BaseButton
          size="compact"
          variant="primary"
          :disabled="!findText"
          @click="runFindReplace(false)"
        >
          <template #icon-left><Replace class="h-3.5 w-3.5" /></template>
          <span>Apply</span>
        </BaseButton>
        <span v-if="dryRunPreview" class="font-mono text-xs text-warning">
          {{ dryRunPreview.note || `${dryRunPreview.changed ?? 0} matches` }}
        </span>
      </div>
    </div>

    <!-- Paginated Caption Cards Grid -->
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="loading" class="flex h-48 items-center justify-center text-xs text-muted">
        Loading dataset images and captions...
      </div>

      <div
        v-else-if="filteredEntries.length === 0"
        class="flex h-48 flex-col items-center justify-center gap-2 text-xs text-muted"
      >
        <AlertTriangle class="h-5 w-5 text-warning" />
        <span>No matching images in this dataset filter.</span>
      </div>

      <div v-else class="space-y-4">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          <div
            v-for="item in pagedEntries"
            :key="item.path"
            class="flex gap-3 rounded-lg border bg-base-200/80 p-2.5 transition-colors"
            :class="
              dirtyPaths.has(item.path)
                ? 'border-warning/60 bg-warning/5'
                : 'border-hairline hover:border-hairline-strong'
            "
          >
            <div
              class="relative h-28 w-28 shrink-0 overflow-hidden rounded-md border border-hairline bg-base-300"
            >
              <img
                :src="thumbUrl(item.path, 256)"
                :alt="item.name"
                loading="lazy"
                class="h-full w-full object-cover"
              />
              <span
                v-if="item.width && item.height"
                class="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 font-mono text-[9px] text-subtle"
              >
                {{ item.width }}×{{ item.height }}
              </span>
            </div>

            <div class="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
              <div class="flex items-center justify-between gap-2">
                <span
                  class="truncate font-mono text-[11px] font-medium text-base-content"
                  :title="item.name"
                >
                  {{ item.name }}
                </span>
                <div class="flex items-center gap-1.5 shrink-0">
                  <BaseBadge
                    :variant="
                      countWords(editedCaptions[item.path] ?? item.caption ?? '') === 0
                        ? 'warning'
                        : 'neutral'
                    "
                    mono
                  >
                    {{ countWords(editedCaptions[item.path] ?? item.caption ?? "") }}w
                  </BaseBadge>

                  <BaseButton
                    v-if="dirtyPaths.has(item.path)"
                    size="xs"
                    variant="primary"
                    title="Save caption (Ctrl+S)"
                    @click="emit('save-caption', item)"
                  >
                    <template #icon-left><Save class="h-3 w-3" /></template>
                    <span>Save</span>
                  </BaseButton>
                </div>
              </div>

              <textarea
                :value="editedCaptions[item.path] ?? item.caption ?? ''"
                rows="4"
                placeholder="Enter training caption..."
                class="textarea textarea-bordered w-full flex-1 border-hairline-strong bg-base-100 p-2 text-xs leading-snug text-base-content focus:border-primary focus:outline-none"
                @input="
                  emit('caption-change', {
                    path: item.path,
                    value: ($event.target as HTMLTextAreaElement).value,
                    original: item.caption ?? '',
                  })
                "
                @keydown.ctrl.s.prevent="emit('save-caption', item)"
                @keydown.meta.s.prevent="emit('save-caption', item)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Pagination Bar -->
    <div
      v-if="filteredEntries.length > 0"
      class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-hairline bg-base-200 px-4 py-2 text-xs"
    >
      <div class="flex items-center gap-2 text-muted font-mono">
        <span>
          Showing {{ (currentPage - 1) * pageSize + 1 }}–{{
            Math.min(filteredEntries.length, currentPage * pageSize)
          }}
          of {{ filteredEntries.length }} images
        </span>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-muted whitespace-nowrap shrink-0">Per page:</span>
        <BaseSelect
          :model-value="pageSize"
          size="compact"
          mono
          :options="[
            { value: 48, label: '48' },
            { value: 96, label: '96' },
            { value: 192, label: '192' },
          ]"
          @update:model-value="pageSize = Number($event)"
        />

        <BasePillGroup v-if="totalPages > 1">
          <BaseButton
            size="pill"
            :disabled="currentPage <= 1"
            title="Previous page"
            @click="currentPage = Math.max(1, currentPage - 1)"
          >
            <ChevronLeft class="h-3.5 w-3.5" />
          </BaseButton>
          <span class="px-2.5 font-mono text-xs text-base-content whitespace-nowrap shrink-0">
            Page {{ currentPage }} / {{ totalPages }}
          </span>
          <BaseButton
            size="pill"
            :disabled="currentPage >= totalPages"
            title="Next page"
            @click="currentPage = Math.min(totalPages, currentPage + 1)"
          >
            <ChevronRight class="h-3.5 w-3.5" />
          </BaseButton>
        </BasePillGroup>
      </div>
    </div>
  </div>
</template>
