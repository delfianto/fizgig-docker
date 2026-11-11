<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Activity, ExternalLink, Loader2, Play, Square } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { apiGet, apiPost, profilerReportUrl } from "@/api/client";
import { BaseBadge, BaseButton, BaseCard, BaseInput, BaseSelect } from "@/components/common";
import { useRunStore } from "@/stores/run";

const props = defineProps<{
  selectedLoraPath: string;
  profilerStatus: Record<string, unknown> | null;
}>();

const emit = defineEmits<{
  (e: "refresh-status"): void;
}>();

const runStore = useRunStore();

const supportedFamilies = ref<Array<{ key: string; name: string }>>([]);
const selectedFamily = ref<string>("krea2");
const profileMode = ref<"quick" | "thorough">("quick");
const renderSize = ref<number>(768);
const subjectPrompt = ref<string>("");
const classPrompt = ref<string>("");
const starting = ref<boolean>(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;

const isRunning = computed(() => Boolean(props.profilerStatus?.running));
const reportPath = computed(() => {
  const r = props.profilerStatus?.report;
  return typeof r === "string" && r.endsWith(".html") ? r : "";
});

async function loadProfilerInfo(): Promise<void> {
  try {
    const info = await apiGet<{ families?: Array<{ key: string; name: string }> }>(
      "/api/profile/info",
    );
    if (Array.isArray(info.families) && info.families.length > 0) {
      supportedFamilies.value = info.families;
      if (!supportedFamilies.value.some((f) => f.key === selectedFamily.value)) {
        selectedFamily.value = supportedFamilies.value[0]!.key;
      }
    }
  } catch {
    // Keep defaults
  }
}

async function prefillFromCheckpoint(loraPath: string): Promise<void> {
  if (!loraPath) return;
  try {
    const [famRes, prefill] = await Promise.all([
      apiGet<{ key?: string }>("/api/studio/lorafamily", { path: loraPath }).catch(() => null),
      apiGet<{ prompt?: string; class_prompt?: string; family?: string }>("/api/profile/prefill", {
        path: loraPath,
      }).catch(() => null),
    ]);
    const fam = prefill?.family || famRes?.key;
    if (fam && supportedFamilies.value.some((f) => f.key === fam)) {
      selectedFamily.value = fam;
    }
    if (prefill?.prompt && !subjectPrompt.value) {
      subjectPrompt.value = prefill.prompt;
    }
    if (prefill?.class_prompt && !classPrompt.value) {
      classPrompt.value = prefill.class_prompt;
    }
  } catch {
    // Ignore prefill errors
  }
}

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    emit("refresh-status");
  }, 1800);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function startProfiler(): Promise<void> {
  if (!props.selectedLoraPath) {
    toast.error("Select a Target LoRA checkpoint in the top bar first");
    return;
  }
  starting.value = true;
  try {
    await apiPost("/api/profile/run", {
      family: selectedFamily.value,
      lora: props.selectedLoraPath,
      mode: profileMode.value,
      size: renderSize.value,
      prompt: subjectPrompt.value.trim(),
      class_prompt: classPrompt.value.trim(),
    });
    toast.success("Started automated block importance profiler");
    emit("refresh-status");
    startPolling();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to start block profiler");
  } finally {
    starting.value = false;
  }
}

async function stopProfiler(): Promise<void> {
  try {
    await apiPost("/api/profile/stop", {});
    toast.info("Stopped block profiler");
    emit("refresh-status");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to stop profiler");
  }
}

watch(
  () => props.selectedLoraPath,
  (path) => {
    void prefillFromCheckpoint(path);
  },
);

onMounted(async () => {
  await loadProfilerInfo();
  await prefillFromCheckpoint(props.selectedLoraPath);
  if (isRunning.value) {
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div class="mx-auto max-w-4xl space-y-4">
      <BaseCard
        title="Automated Block Importance Profiler"
        subtitle="Measure per-block reconstruction delta and identity vs. style contribution across transformer blocks for the selected LoRA."
      >
        <template #icon>
          <Activity class="h-4 w-4 text-primary" />
        </template>
        <template #actions>
          <BaseBadge :variant="isRunning ? 'warning' : 'neutral'" size="sm" mono>
            {{ isRunning ? "Profiling Active" : "Idle" }}
          </BaseBadge>
        </template>

        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-subtle">Model Family</label>
              <BaseSelect
                :model-value="selectedFamily"
                class="w-full"
                :options="
                  supportedFamilies.length > 0
                    ? supportedFamilies.map((f) => ({ value: f.key, label: f.name }))
                    : [{ value: selectedFamily, label: selectedFamily }]
                "
                @update:model-value="selectedFamily = String($event)"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-subtle">Profiler Depth</label>
              <BaseSelect
                :model-value="profileMode"
                class="w-full"
                :options="[
                  { value: 'quick', label: 'Quick Sweep' },
                  { value: 'thorough', label: 'Thorough Per-Block' },
                ]"
                @update:model-value="profileMode = $event as 'quick' | 'thorough'"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-subtle">Probe Resolution</label>
              <BaseSelect
                :model-value="renderSize"
                mono
                class="w-full"
                :options="[
                  { value: 512, label: '512 px' },
                  { value: 768, label: '768 px' },
                  { value: 1024, label: '1024 px' },
                ]"
                @update:model-value="renderSize = Number($event)"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-semibold text-subtle">
                Subject Probe Prompt (With Trigger)
              </label>
              <BaseInput
                v-model="subjectPrompt"
                mono
                placeholder="e.g. A portrait photo of ohwx person"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-subtle">
                Baseline Class Prompt (Without Trigger)
              </label>
              <BaseInput
                v-model="classPrompt"
                mono
                placeholder="e.g. A portrait photo of a person"
              />
            </div>
          </div>

          <!-- Live Status Banner -->
          <div
            v-if="isRunning || profilerStatus?.status"
            class="flex items-center justify-between rounded-lg border border-hairline bg-base-300/60 px-3.5 py-2.5 font-mono text-xs text-subtle"
          >
            <span class="flex items-center gap-2">
              <Loader2 v-if="isRunning" class="h-4 w-4 animate-spin text-warning" />
              <span>{{ profilerStatus?.status || "Profiler active..." }}</span>
            </span>

            <a
              v-if="reportPath"
              :href="profilerReportUrl(reportPath)"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <span>Open HTML Report</span>
              <ExternalLink class="h-3 w-3" />
            </a>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-hairline pt-3">
            <BaseButton
              v-if="!isRunning"
              variant="primary"
              :disabled="starting || !selectedLoraPath || runStore.isActiveOrStarting"
              @click="startProfiler"
            >
              <template #icon-left><Play class="h-3.5 w-3.5 fill-current" /></template>
              <span>Run Block Profiler</span>
            </BaseButton>

            <BaseButton v-else variant="error" @click="stopProfiler">
              <template #icon-left><Square class="h-3.5 w-3.5" /></template>
              <span>Stop Profiler</span>
            </BaseButton>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>
