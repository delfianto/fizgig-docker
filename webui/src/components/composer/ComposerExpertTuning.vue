<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Search, Sliders, ToggleRight, X } from "lucide-vue-next";
import { type SchemaRow, type SchemaSection } from "@shared/types";
import { BaseInput } from "@/components/common";
import SchemaField from "@/components/schema/SchemaField.vue";
import { useComposerStore } from "@/stores/composer";
import { SUPPRESSED_KEYS } from "@/stores/schema";

const composerStore = useComposerStore();

const paramFilter = ref("");

const hiddenKeySet = computed(() => new Set(composerStore.formState.hidden ?? []));

function isRowVisible(row: SchemaRow | null): row is SchemaRow {
  if (!row || !row.key) return false;
  if (SUPPRESSED_KEYS.has(row.key)) return false;
  if (hiddenKeySet.value.has(row.key)) return false;
  return true;
}

interface VisibleSection {
  section: SchemaSection;
  rows: SchemaRow[];
}

const visibleSections = computed<VisibleSection[]>(() => {
  const raw = composerStore.currentFamilyDesc?.form.sections ?? [];
  const kind = composerStore.formState.kind || "standard";
  const out: VisibleSection[] = [];
  for (const sec of raw) {
    if (sec.id && hiddenKeySet.value.has(sec.id)) continue;
    if (sec.id === "slider" && kind !== "slider") continue;
    if (sec.id === "finetune" && kind !== "finetune") continue;
    if (sec.id === "edit" && kind !== "edit") continue;
    const rows = sec.rows.filter(isRowVisible);
    // Keep sections that have at least one non-note parameter row
    const hasInteractiveRow = rows.some((r) => r.kind !== "note");
    if (rows.length > 0 && hasInteractiveRow) {
      out.push({ section: sec, rows });
    }
  }
  return out;
});

const selectedSectionIndex = computed({
  get: () => {
    const maxIdx = Math.max(0, visibleSections.value.length - 1);
    return Math.min(composerStore.selectedSectionIndex, maxIdx);
  },
  set: (val: number) => {
    composerStore.selectedSectionIndex = val;
  },
});

watch(
  () => visibleSections.value.length,
  (len) => {
    if (len > 0 && composerStore.selectedSectionIndex >= len) {
      composerStore.selectedSectionIndex = 0;
    }
  },
);

const currentVisibleSection = computed<VisibleSection | null>(() => {
  if (visibleSections.value.length === 0) return null;
  return visibleSections.value[selectedSectionIndex.value] ?? visibleSections.value[0] ?? null;
});

function modifiedCountInSection(rows: SchemaRow[]): number {
  let count = 0;
  for (const r of rows) {
    if (composerStore.modifiedKeys.has(r.key)) {
      count++;
    } else if (r.parts?.some((p) => p.key && composerStore.modifiedKeys.has(p.key))) {
      count++;
    }
  }
  return count;
}

function shouldSpanFull(row: SchemaRow): boolean {
  if (row.kind === "note") return true;
  if (row.kind === "text") return true;
  if (row.kind === "blocks") return true;
  if (row.kind === "cadence" || row.kind === "split") return true;
  if (row.kind === "folder" || row.kind === "path") return true;
  if (row.kind === "radio" && (row.choices?.length ?? 0) > 2) return true;
  return false;
}

// All visible rows across all sections if searching globally, or rows of the current visible section
const displayedRows = computed<SchemaRow[]>(() => {
  const query = paramFilter.value.trim().toLowerCase();
  if (query) {
    const matches: SchemaRow[] = [];
    for (const { rows } of visibleSections.value) {
      for (const r of rows) {
        const keyMatch = r.key.toLowerCase().includes(query);
        const labelMatch = r.label ? r.label.toLowerCase().includes(query) : false;
        const hintMatch = r.hint ? r.hint.toLowerCase().includes(query) : false;
        if (keyMatch || labelMatch || hintMatch) {
          matches.push(r);
        }
      }
    }
    return matches;
  }

  return currentVisibleSection.value?.rows ?? [];
});

const toggleRows = computed<SchemaRow[]>(() => {
  return displayedRows.value.filter((r) => r.kind === "check");
});

const standardRows = computed<SchemaRow[]>(() => {
  return displayedRows.value.filter((r) => r.kind !== "check");
});

const activeToggleCount = computed(() => {
  let count = 0;
  for (const r of toggleRows.value) {
    const val =
      composerStore.draftValues[r.key] !== undefined
        ? composerStore.draftValues[r.key]
        : (r.default ?? false);
    if (val === true || val === "true" || val === 1 || val === "1") {
      count++;
    }
  }
  return count;
});
</script>

<template>
  <main class="flex-1 overflow-hidden grid grid-cols-[240px_1fr]">
    <!-- Expert Left Category Tabs -->
    <aside
      class="flex flex-col border-r border-hairline bg-base-200/50 p-2.5 space-y-1 overflow-y-auto"
    >
      <div
        class="mb-2 px-2 pt-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted"
      >
        <span>Expert Sections</span>
        <span class="badge badge-xs font-mono font-normal">{{ visibleSections.length }}</span>
      </div>

      <div v-if="visibleSections.length === 0" class="py-6 text-center text-xs text-muted">
        Loading schema sections...
      </div>

      <button
        v-for="({ section: sec, rows }, idx) in visibleSections"
        :key="sec.id || sec.title || idx"
        type="button"
        class="flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition cursor-pointer"
        :class="
          selectedSectionIndex === idx && !paramFilter
            ? 'bg-primary text-primary-content font-bold shadow'
            : 'text-subtle hover:bg-base-300'
        "
        @click="
          selectedSectionIndex = idx;
          paramFilter = '';
        "
      >
        <span class="truncate">{{ sec.title || `Section ${idx + 1}` }}</span>
        <span
          v-if="modifiedCountInSection(rows) > 0"
          class="badge badge-xs font-mono"
          :class="selectedSectionIndex === idx && !paramFilter ? 'badge-warning' : 'badge-primary'"
        >
          {{ modifiedCountInSection(rows) }}
        </span>
      </button>
    </aside>

    <!-- Expert Main Parameter Form Panel -->
    <section class="flex flex-col overflow-hidden bg-base-100">
      <!-- Sub-header with Section Meta & Search Filter -->
      <div
        class="flex items-center justify-between gap-4 border-b border-hairline bg-base-200/50 px-5 py-3 shrink-0"
      >
        <div class="space-y-1 min-w-0">
          <div class="flex items-center gap-2.5">
            <div
              class="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary shrink-0"
            >
              <Sliders class="h-3.5 w-3.5" />
            </div>
            <h2 class="text-sm font-bold tracking-tight text-base-content truncate">
              {{
                paramFilter
                  ? `Search Results ("${paramFilter}")`
                  : currentVisibleSection?.section.title
              }}
            </h2>
            <span class="badge badge-sm badge-neutral font-mono text-[11px] shrink-0">
              {{ displayedRows.length }} params
            </span>
          </div>
          <p class="text-xs text-muted pl-8.5 leading-relaxed">
            {{
              paramFilter
                ? `Found ${displayedRows.length} parameter(s) matching "${paramFilter}" across active sections.`
                : `Fine-tune active ${composerStore.formState.kind || "standard"} hyperparameters for ${composerStore.family} while preserving recipe baseline defaults.`
            }}
          </p>
        </div>

        <!-- Search Input with Clear Action -->
        <div class="w-72 sm:w-80 shrink-0">
          <BaseInput
            v-model="paramFilter"
            placeholder="Filter parameters (e.g. lr, dim, epoch)..."
            mono
          >
            <template #prefix>
              <Search class="h-4 w-4 text-muted" />
            </template>
            <template #suffix>
              <button
                v-if="paramFilter"
                type="button"
                class="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-base-200 hover:text-base-content cursor-pointer transition-colors"
                title="Clear search"
                @click="paramFilter = ''"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </template>
          </BaseInput>
        </div>
      </div>

      <!-- Render Parameter Fields -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5">
        <div class="mx-auto max-w-6xl space-y-4">
          <div
            v-if="displayedRows.length === 0"
            class="rounded-lg border border-hairline bg-base-200/40 p-8 text-center text-xs text-muted"
          >
            No parameters found{{ paramFilter ? ` matching "${paramFilter}"` : "" }}.
          </div>

          <template v-else>
            <!-- 1. Consolidated Feature Toggles Section -->
            <div
              v-if="toggleRows.length > 0"
              class="rounded-xl border border-hairline-strong bg-base-200/60 p-4 space-y-3 shadow-xs"
            >
              <div
                class="flex flex-wrap items-center justify-between gap-2 border-b border-hairline/70 pb-2.5"
              >
                <div class="flex items-center gap-2.5">
                  <div
                    class="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20 text-primary shrink-0"
                  >
                    <ToggleRight class="h-4 w-4" />
                  </div>
                  <div>
                    <h3 class="text-xs font-bold uppercase tracking-wider text-base-content">
                      Feature Toggles &amp; Execution Flags
                    </h3>
                  </div>
                  <span
                    class="badge badge-sm font-mono font-semibold"
                    :class="activeToggleCount > 0 ? 'badge-primary' : 'badge-neutral'"
                  >
                    {{ activeToggleCount }} / {{ toggleRows.length }} Active
                  </span>
                </div>
                <span class="text-[11px] text-muted hidden sm:inline">
                  Shortened labels · Full descriptions &amp; live recommendations in
                  <span class="font-semibold text-primary">?</span>
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <div
                  v-for="r in toggleRows"
                  :key="r.key"
                  class="rounded-lg border px-3 py-2.5 transition-colors flex items-center justify-between min-h-13"
                  :class="[
                    composerStore.draftValues[r.key] === true ||
                    composerStore.draftValues[r.key] === 'true' ||
                    (composerStore.draftValues[r.key] === undefined && r.default === true)
                      ? 'border-primary/40 bg-primary/8 shadow-2xs'
                      : 'border-hairline bg-base-300/40 hover:border-hairline-strong',
                  ]"
                >
                  <SchemaField :row="r" compact />
                </div>
              </div>
            </div>

            <!-- 2. Standard Hyperparameters Grid (Inputs, Selects, Combos, Cadence, Blocks) -->
            <div
              v-if="standardRows.length > 0"
              class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5"
            >
              <div
                v-for="r in standardRows"
                :key="r.key"
                class="rounded-lg border p-2.5 transition-colors flex flex-col justify-between"
                :class="[
                  r.kind === 'note'
                    ? 'col-span-full border-info/30 bg-info/10'
                    : 'border-hairline bg-base-200/60 hover:border-hairline-strong',
                  shouldSpanFull(r) && r.kind !== 'note' ? 'col-span-full' : 'col-span-1',
                ]"
              >
                <SchemaField :row="r" />
              </div>
            </div>
          </template>
        </div>
      </div>
    </section>
  </main>
</template>
