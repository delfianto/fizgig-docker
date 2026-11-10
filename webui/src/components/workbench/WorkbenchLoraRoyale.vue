<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Loader2, Play, Square, Trophy } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type CheckpointItem } from "@shared/types";
import { apiGet, apiPost } from "@/api/client";
import { BaseBadge, BaseButton, BaseCard, BaseInput, BaseSelect } from "@/components/common";
import { useRunStore } from "@/stores/run";

const props = defineProps<{
  checkpoints: CheckpointItem[];
  royaleStatus: Record<string, unknown> | null;
}>();

const emit = defineEmits<{
  (e: "refresh-status"): void;
}>();

const runStore = useRunStore();

interface RoyaleInfoResponse {
  families?: Array<{ key: string; name: string; video?: boolean }>;
  out_dir?: string;
}

const families = ref<Array<{ key: string; name: string }>>([]);
const selectedFamily = ref<string>("krea2");
const folderPath = ref<string>(runStore.activeOutputDir || "/workspace/output_loras");
const maxEpochs = ref<string>("12");
const evalPrompt = ref<string>("");
const submitting = ref<boolean>(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;

const isRunning = computed(() => Boolean(props.royaleStatus?.running));
const renderedCount = computed(() => Number(props.royaleStatus?.done ?? 0));
const totalCount = computed(() => Number(props.royaleStatus?.total ?? 0));
const generationId = computed(() => String(props.royaleStatus?.gen ?? ""));

async function fetchRoyaleInfo(): Promise<void> {
  try {
    const info = await apiGet<RoyaleInfoResponse>("/api/royale/info");
    if (Array.isArray(info.families) && info.families.length > 0) {
      families.value = info.families;
      if (!families.value.some((f) => f.key === selectedFamily.value)) {
        selectedFamily.value = families.value[0]!.key;
      }
    }
    if (info.out_dir && !folderPath.value) {
      folderPath.value = info.out_dir;
    }
  } catch {
    // Keep defaults
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

async function startTournamentRender(): Promise<void> {
  if (!evalPrompt.value.trim()) {
    toast.error("Enter an evaluation prompt (include your trigger word)");
    return;
  }
  submitting.value = true;
  try {
    await apiPost("/api/royale/render", {
      family: selectedFamily.value,
      folder: folderPath.value.trim(),
      max: maxEpochs.value,
      prompt: evalPrompt.value.trim(),
    });
    toast.success("Started LoRA Royale multi-epoch render");
    emit("refresh-status");
    startPolling();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to start LoRA Royale");
  } finally {
    submitting.value = false;
  }
}

async function cancelTournament(): Promise<void> {
  try {
    await apiPost("/api/royale/cancel", {});
    toast.info("Cancelled LoRA Royale render");
    emit("refresh-status");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to cancel");
  }
}

onMounted(async () => {
  await fetchRoyaleInfo();
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
    <div class="mx-auto max-w-5xl space-y-4">
      <BaseCard
        title="LoRA Royale — Multi-Epoch Tournament &amp; Likeness Arena"
        subtitle="Render saved checkpoints side-by-side under identical seeds and prompts to pinpoint the best epoch before overtraining."
      >
        <template #icon>
          <Trophy class="h-4 w-4 text-warning" />
        </template>
        <template #actions>
          <BaseBadge :variant="isRunning ? 'warning' : 'neutral'" size="sm" mono>
            {{
              isRunning
                ? `Rendering ${renderedCount}/${totalCount}`
                : `${checkpoints.length} checkpoints`
            }}
          </BaseBadge>
        </template>

        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div class="sm:col-span-2">
              <label class="mb-1 block text-xs font-semibold text-subtle">Checkpoint Folder</label>
              <BaseInput v-model="folderPath" mono placeholder="/workspace/output_loras" />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-subtle">Model Family</label>
              <BaseSelect
                :model-value="selectedFamily"
                class="w-full"
                :options="
                  families.length > 0
                    ? families.map((f) => ({ value: f.key, label: f.name }))
                    : [{ value: selectedFamily, label: selectedFamily }]
                "
                @update:model-value="selectedFamily = String($event)"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-subtle">Max Checkpoints</label>
              <BaseSelect
                :model-value="maxEpochs"
                mono
                class="w-full"
                :options="[
                  { value: '6', label: 'Up to 6 epochs' },
                  { value: '12', label: 'Up to 12 epochs' },
                  { value: '20', label: 'Up to 20 epochs' },
                ]"
                @update:model-value="maxEpochs = String($event)"
              />
            </div>
          </div>

          <div class="flex flex-wrap items-end gap-3">
            <div class="flex-1 min-w-64">
              <label class="mb-1 block text-xs font-semibold text-subtle">
                Evaluation Prompt (Include Trigger Word)
              </label>
              <BaseInput
                v-model="evalPrompt"
                mono
                placeholder="e.g. A crisp studio portrait of ohwx, natural window lighting..."
                @keyup.enter="startTournamentRender"
              />
            </div>

            <BaseButton
              v-if="!isRunning"
              variant="primary"
              :disabled="submitting || checkpoints.length === 0 || runStore.isActiveOrStarting"
              :title="
                runStore.isActiveOrStarting
                  ? 'GPU is currently running a training job'
                  : 'Render comparison across checkpoints'
              "
              @click="startTournamentRender"
            >
              <template #icon-left><Play class="h-3.5 w-3.5 fill-current" /></template>
              <span>Run Tournament Render</span>
            </BaseButton>

            <BaseButton v-else variant="error" @click="cancelTournament">
              <template #icon-left><Square class="h-3.5 w-3.5" /></template>
              <span>Cancel Render</span>
            </BaseButton>
          </div>

          <!-- Active Progress Banner -->
          <div
            v-if="isRunning"
            class="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 font-mono text-xs text-warning"
          >
            <span class="flex items-center gap-2">
              <Loader2 class="h-4 w-4 animate-spin" />
              {{ royaleStatus?.status || "Rendering epoch checkpoints on GPU..." }}
            </span>
            <span>{{ renderedCount }} / {{ totalCount }}</span>
          </div>

          <!--Rendered Comparison Grid (when renders are available) -->
          <div
            v-if="renderedCount > 0"
            class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
          >
            <div
              v-for="idx in renderedCount"
              :key="`${generationId}-${idx - 1}`"
              class="overflow-hidden rounded-lg border border-hairline bg-base-100"
            >
              <img
                :src="`/api/royale/image?i=${idx - 1}&gen=${generationId}`"
                :alt="`Royale render ${idx}`"
                loading="lazy"
                class="aspect-square w-full object-cover"
              />
              <div
                class="border-t border-hairline bg-base-200 px-2.5 py-1.5 font-mono text-[11px] text-subtle"
              >
                Candidate #{{ idx }}
              </div>
            </div>
          </div>

          <!-- Candidate Checkpoints Inventory -->
          <div class="space-y-2 border-t border-hairline pt-3">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Detected Checkpoints ({{ Math.min(checkpoints.length, Number(maxEpochs)) }} of
              {{ checkpoints.length }} shown)
            </div>
            <div
              v-if="checkpoints.length === 0"
              class="rounded-lg border border-hairline bg-base-300/40 p-6 text-center text-xs text-muted"
            >
              No saved checkpoints found in {{ folderPath }}.
            </div>
            <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              <div
                v-for="ckpt in checkpoints.slice(0, Number(maxEpochs))"
                :key="ckpt.path"
                class="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-base-300/60 px-3 py-2"
              >
                <div class="min-w-0">
                  <div class="truncate font-mono text-xs font-semibold text-base-content">
                    {{ ckpt.name }}
                  </div>
                  <div class="font-mono text-[10px] text-muted">
                    {{ ckpt.run || "root" }}
                  </div>
                </div>
                <BaseBadge variant="primary" mono>
                  {{ ckpt.epoch !== undefined ? `ep ${ckpt.epoch}` : "final" }}
                </BaseBadge>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>
