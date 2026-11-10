<script setup lang="ts">
import { type HistoricalRun } from "@shared/types";
import { useRunStore } from "@/stores/run";
import ActiveTrainingBanner from "./banner/ActiveTrainingBanner.vue";
import ArchivedRunBanner from "./banner/ArchivedRunBanner.vue";
import CompletedRunBanner from "./banner/CompletedRunBanner.vue";
import PausedResumeBanner from "./banner/PausedResumeBanner.vue";
import StandbyBanner from "./banner/StandbyBanner.vue";

withDefaults(
  defineProps<{
    inspectingHistoricalRun?: HistoricalRun | null;
    sessionDismissed?: boolean;
    latestHistoricalRun?: HistoricalRun | null;
  }>(),
  {
    inspectingHistoricalRun: null,
    sessionDismissed: false,
    latestHistoricalRun: null,
  },
);

const emit = defineEmits<{
  (
    e: "clone",
    run: {
      family: string;
      image_folder?: string;
      values?: Record<string, unknown>;
      lora: string;
    },
  ): void;
  (e: "dismiss"): void;
  (e: "restore-session"): void;
  (e: "inspect-latest"): void;
  (e: "view-history"): void;
  (e: "return-to-live"): void;
}>();

const runStore = useRunStore();
</script>

<template>
  <div>
    <!-- STATE 1: Historical Archive Inspection Banner -->
    <ArchivedRunBanner
      v-if="inspectingHistoricalRun"
      :run="inspectingHistoricalRun"
      :is-active-or-starting="runStore.isActiveOrStarting"
      @clone="(r) => emit('clone', r)"
      @return-to-live="emit('return-to-live')"
    />

    <!-- STATE 2: Active Training Run -->
    <ActiveTrainingBanner
      v-else-if="runStore.isActiveOrStarting && runStore.run"
      :run="runStore.run"
    />

    <!-- STATE 3: Paused / Resumable Run -->
    <PausedResumeBanner v-else-if="runStore.run?.resume" :run="runStore.run" />

    <!-- STATE 4: Completed Run Summary Card -->
    <CompletedRunBanner
      v-else-if="runStore.isCompleted && !sessionDismissed && runStore.run"
      :run="runStore.run"
      @clone="(r) => emit('clone', r)"
      @dismiss="emit('dismiss')"
      @view-history="emit('view-history')"
    />

    <!-- STATE 5: Standby / Idle Banner -->
    <StandbyBanner
      v-else
      :session-dismissed="sessionDismissed"
      :last-run-lora="runStore.run?.lora"
      :latest-historical-lora="latestHistoricalRun?.lora"
      @restore-session="emit('restore-session')"
      @inspect-latest="emit('inspect-latest')"
      @view-history="emit('view-history')"
    />
  </div>
</template>
