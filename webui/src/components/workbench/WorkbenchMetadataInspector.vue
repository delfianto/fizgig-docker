<script setup lang="ts">
import { computed, ref } from "vue";
import { Copy, FileCode2, RefreshCw, Search } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { formatBytes } from "@/api/client";
import { BaseBadge, BaseButton, BaseCard, BaseInput } from "@/components/common";
import { formatLearnRate } from "@/utils";

const props = defineProps<{
  metadataJson: Record<string, unknown> | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "reload"): void;
}>();

const filterText = ref("");
const showRawJson = ref(false);

const metaMap = computed<Record<string, string>>(() => {
  if (!props.metadataJson) return {};
  const nested = props.metadataJson.meta;
  const source =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : props.metadataJson;

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) {
    if (k === "size" && nested) continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
});

const fileSizeBytes = computed<number | null>(() => {
  const s = props.metadataJson?.size;
  return typeof s === "number" && s > 0 ? s : null;
});

const embeddedThumbnail = computed<string | null>(() => {
  const thumb = metaMap.value["modelspec.thumbnail"];
  if (typeof thumb === "string" && thumb.startsWith("data:image/")) {
    return thumb;
  }
  return null;
});

const summaryHighlights = computed(() => {
  const m = metaMap.value;
  return [
    { label: "Title", value: m["modelspec.title"] || m.ss_output_name || "—" },
    { label: "Architecture", value: m["modelspec.architecture"] || m.ss_architecture || "—" },
    { label: "Epoch", value: m.ss_epoch || "—" },
    {
      label: "Rank / Alpha",
      value: m.ss_network_dim
        ? `${m.ss_network_dim} / ${m.ss_network_alpha ?? m.ss_network_dim}`
        : "—",
    },
    {
      label: "Learn Rate",
      value: m.ss_learning_rate ? formatLearnRate(m.ss_learning_rate) : "—",
    },
    { label: "Resolution", value: m["modelspec.resolution"] || "—" },
  ];
});

const filteredRows = computed(() => {
  const q = filterText.value.trim().toLowerCase();
  return Object.entries(metaMap.value)
    .filter(([k]) => k !== "modelspec.thumbnail")
    .filter(([k, v]) => !q || k.toLowerCase().includes(q) || v.toLowerCase().includes(q))
    .toSorted(([a], [b]) => a.localeCompare(b));
});

async function copyMetadataJson(): Promise<void> {
  if (!props.metadataJson) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(props.metadataJson, null, 2));
    toast.success("Copied safetensors metadata JSON to clipboard");
  } catch {
    toast.error("Clipboard copy unavailable");
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div class="mx-auto max-w-5xl space-y-4">
      <BaseCard
        title="Safetensors Header Metadata (__metadata__)"
        subtitle="Inspect embedded ModelSpec tags, training hyperparameters, and preview thumbnail without loading tensor weights."
      >
        <template #icon>
          <FileCode2 class="h-4 w-4 text-primary" />
        </template>
        <template #actions>
          <BaseBadge v-if="fileSizeBytes" variant="neutral" size="sm" mono>
            {{ formatBytes(fileSizeBytes) }}
          </BaseBadge>
          <BaseButton
            v-if="metadataJson"
            size="compact"
            variant="ghost"
            @click="showRawJson = !showRawJson"
          >
            <span>{{ showRawJson ? "Structured View" : "Raw JSON" }}</span>
          </BaseButton>
          <BaseButton v-if="metadataJson" size="compact" variant="ghost" @click="copyMetadataJson">
            <template #icon-left><Copy class="h-3.5 w-3.5" /></template>
            <span>Copy JSON</span>
          </BaseButton>
          <BaseButton size="compact" variant="ghost" :disabled="loading" @click="emit('reload')">
            <template #icon-left><RefreshCw class="h-3.5 w-3.5" /></template>
            <span>Reload</span>
          </BaseButton>
        </template>

        <div v-if="loading" class="py-10 text-center text-xs text-muted">
          Reading safetensors header...
        </div>

        <div v-else-if="!metadataJson" class="py-10 text-center text-xs text-muted">
          Select a LoRA checkpoint above to inspect its safetensors header metadata.
        </div>

        <div v-else class="space-y-4">
          <!-- Top Summary Strip + Embedded Thumbnail -->
          <div class="flex flex-col gap-4 sm:flex-row">
            <div
              v-if="embeddedThumbnail"
              class="h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-hairline bg-base-100"
            >
              <img
                :src="embeddedThumbnail"
                alt="Embedded ModelSpec Thumbnail"
                class="h-full w-full object-cover"
              />
            </div>

            <div class="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-3">
              <div
                v-for="item in summaryHighlights"
                :key="item.label"
                class="rounded-lg border border-hairline bg-base-300/60 px-3 py-2"
              >
                <div class="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {{ item.label }}
                </div>
                <div class="mt-0.5 truncate font-mono text-xs font-bold text-base-content">
                  {{ item.value }}
                </div>
              </div>
            </div>
          </div>

          <!-- Raw JSON Mode -->
          <pre
            v-if="showRawJson"
            class="max-h-[58vh] overflow-auto rounded-lg border border-hairline bg-base-100 p-3 font-mono text-xs text-subtle"
            >{{ JSON.stringify(metadataJson, null, 2) }}</pre>

          <!-- Structured Filterable Key-Value Table -->
          <div v-else class="space-y-2.5">
            <div class="w-72">
              <BaseInput
                v-model="filterText"
                size="compact"
                mono
                placeholder="Filter header keys..."
              >
                <template #prefix>
                  <Search class="h-3.5 w-3.5 text-muted" />
                </template>
              </BaseInput>
            </div>

            <div
              class="max-h-[52vh] divide-y divide-hairline overflow-y-auto rounded-lg border border-hairline bg-base-100"
            >
              <div
                v-for="[key, val] in filteredRows"
                :key="key"
                class="grid grid-cols-1 gap-1 px-3.5 py-2 font-mono text-xs sm:grid-cols-[240px_1fr] hover:bg-surface-hover"
              >
                <span class="truncate text-muted">{{ key }}</span>
                <span class="break-all text-base-content">{{ val }}</span>
              </div>
              <div v-if="filteredRows.length === 0" class="p-6 text-center text-xs text-muted">
                No metadata fields match "{{ filterText }}".
              </div>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>
