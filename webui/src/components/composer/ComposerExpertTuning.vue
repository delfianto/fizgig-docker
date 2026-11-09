<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Search, Sliders } from "lucide-vue-next";
import { type SchemaRow, type SchemaSection } from "@shared/types";
import SchemaField from "@/components/schema/SchemaField.vue";
import { useComposerStore } from "@/stores/composer";

const composerStore = useComposerStore();

const selectedSectionIndex = ref(0);
const paramFilter = ref("");

const sections = computed<SchemaSection[]>(() => {
  return composerStore.currentFamilyDesc?.form.sections ?? [];
});

// Reset selected section if family changes and index is out of bounds
watch(
  () => composerStore.family,
  () => {
    selectedSectionIndex.value = 0;
  },
);

const currentSection = computed<SchemaSection | null>(() => {
  if (sections.value.length === 0) return null;
  return sections.value[selectedSectionIndex.value] ?? sections.value[0] ?? null;
});

function modifiedCountInSection(sec: SchemaSection): number {
  let count = 0;
  for (const r of sec.rows) {
    if (r && r.key && composerStore.modifiedKeys.has(r.key)) {
      count++;
    }
  }
  return count;
}

// All rows across all sections if searching globally, or rows of the current section
const displayedRows = computed<SchemaRow[]>(() => {
  const query = paramFilter.value.trim().toLowerCase();
  if (query) {
    // Global search across all sections
    const matches: SchemaRow[] = [];
    for (const sec of sections.value) {
      for (const r of sec.rows) {
        if (!r || !r.key) continue;
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

  // Current section rows
  if (!currentSection.value) return [];
  return currentSection.value.rows.filter((r): r is SchemaRow => r !== null && Boolean(r.key));
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
        <span class="badge badge-xs font-mono font-normal">{{ sections.length }}</span>
      </div>

      <div v-if="sections.length === 0" class="py-6 text-center text-xs text-muted">
        Loading schema sections...
      </div>

      <button
        v-for="(sec, idx) in sections"
        :key="sec.title || idx"
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
          v-if="modifiedCountInSection(sec) > 0"
          class="badge badge-xs font-mono"
          :class="selectedSectionIndex === idx && !paramFilter ? 'badge-warning' : 'badge-primary'"
        >
          {{ modifiedCountInSection(sec) }}
        </span>
      </button>
    </aside>

    <!-- Expert Main Parameter Form Panel -->
    <section class="flex flex-col overflow-hidden bg-base-100">
      <!-- Sub-header with Filter Search -->
      <div
        class="flex items-center justify-between border-b border-hairline bg-base-200/40 px-5 py-2.5"
      >
        <div>
          <h2 class="text-sm font-bold text-base-content flex items-center gap-2">
            <Sliders class="h-4 w-4 text-primary" />
            <span>{{
              paramFilter ? `Search Results ("${paramFilter}")` : currentSection?.title
            }}</span>
          </h2>
          <p class="text-xs text-muted">
            {{
              paramFilter
                ? `Found ${displayedRows.length} parameter(s) matching "${paramFilter}" across all sections.`
                : `Fine-tune underlying hyperparameters for ${composerStore.family} while preserving recipe baseline defaults.`
            }}
          </p>
        </div>

        <div class="relative w-72">
          <Search class="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
          <input
            v-model="paramFilter"
            type="text"
            placeholder="Filter parameters (e.g. lr, dim, epoch)..."
            class="input input-xs input-bordered w-full bg-base-300/60 pl-8 text-xs font-mono"
          />
        </div>
      </div>

      <!-- Render Parameter Fields in Clean Grid -->
      <div class="flex-1 overflow-y-auto p-5">
        <div class="mx-auto max-w-4xl space-y-3.5">
          <div
            v-if="displayedRows.length === 0"
            class="rounded-lg border border-hairline bg-base-200/40 p-8 text-center text-xs text-muted"
          >
            No parameters found{{ paramFilter ? ` matching "${paramFilter}"` : "" }}.
          </div>

          <div
            v-for="r in displayedRows"
            :key="r.key"
            class="rounded-lg border border-hairline bg-base-200/60 p-3.5 transition-colors hover:border-hairline-strong"
          >
            <SchemaField :row="r" />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
