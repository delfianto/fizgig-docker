<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-vue-next";
import { usePlanOverlayStore } from "@/stores/overlay";

const overlayStore = usePlanOverlayStore();

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && overlayStore.visible) {
    overlayStore.dismiss();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

const isSuccess = computed(() => overlayStore.status === "success");
const isWarningOnly = computed(
  () =>
    overlayStore.status === "warning" ||
    (overlayStore.status === "attention" &&
      overlayStore.problems.length === 0 &&
      overlayStore.warnings.length > 0),
);

const subtitleText = computed(() => {
  if (isSuccess.value) {
    return "Preflight verified • 0 blockers";
  }
  if (overlayStore.problems.length > 0 && overlayStore.warnings.length > 0) {
    return `${overlayStore.problems.length} blocker(s) • ${overlayStore.warnings.length} warning(s)`;
  }
  if (overlayStore.problems.length > 0) {
    return `${overlayStore.problems.length} blocker(s) to resolve`;
  }
  if (overlayStore.warnings.length > 0) {
    return `${overlayStore.warnings.length} advisory warning(s)`;
  }
  return "Action prevented • See details below";
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform -translate-y-3 translate-x-4 opacity-0 scale-95"
      enter-to-class="transform translate-y-0 translate-x-0 opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform translate-x-4 opacity-0 scale-95"
    >
      <div
        v-if="overlayStore.visible"
        class="fixed top-14 right-5 z-50 w-96 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-xl border shadow-2xl backdrop-blur-md select-none"
        :class="
          isSuccess
            ? 'border-success/60 bg-[#0a180f]/95 shadow-success/10 text-base-content'
            : isWarningOnly
              ? 'border-warning/70 bg-[#1c1608]/95 shadow-warning/15 text-base-content'
              : 'border-error/70 bg-[#1c0a0c]/95 shadow-error/15 text-base-content'
        "
        role="alert"
        aria-live="assertive"
        @mouseenter="overlayStore.pauseTimer"
        @mouseleave="overlayStore.resumeTimer"
      >
        <!-- Main Content Block -->
        <div class="p-4 space-y-3">
          <!-- Header Strip -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                :class="
                  isSuccess
                    ? 'bg-success/20 text-success'
                    : isWarningOnly
                      ? 'bg-warning/20 text-warning'
                      : 'bg-error/20 text-error'
                "
              >
                <CheckCircle2 v-if="isSuccess" class="h-5 w-5" />
                <AlertTriangle v-else-if="isWarningOnly" class="h-5 w-5" />
                <AlertCircle v-else class="h-5 w-5" />
              </div>

              <div class="min-w-0">
                <h3
                  class="font-bold text-sm leading-tight truncate"
                  :class="
                    isSuccess ? 'text-success' : isWarningOnly ? 'text-warning' : 'text-error'
                  "
                >
                  {{ overlayStore.title }}
                </h3>
                <p
                  class="text-xs font-mono tracking-tight"
                  :class="
                    isSuccess
                      ? 'text-success/80'
                      : isWarningOnly
                        ? 'text-warning/80'
                        : 'text-error/80'
                  "
                >
                  {{ subtitleText }}
                </p>
              </div>
            </div>

            <!-- Dismiss Button -->
            <button
              type="button"
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-base-300 hover:text-base-content cursor-pointer"
              title="Dismiss alert (Esc)"
              @click="overlayStore.dismiss"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <!-- Direct Message (e.g. Conflicted LoRA name or API error) -->
          <div
            v-if="overlayStore.message"
            class="rounded-md border p-2.5 text-xs font-medium leading-relaxed"
            :class="
              isSuccess
                ? 'border-success/30 bg-success/10 text-success'
                : isWarningOnly
                  ? 'border-warning/30 bg-warning/10 text-warning'
                  : 'border-error/30 bg-error/10 text-error'
            "
          >
            {{ overlayStore.message }}
          </div>

          <!-- Blockers / Problems List -->
          <div v-if="overlayStore.problems.length > 0" class="space-y-1.5 pt-1">
            <div class="text-[11px] font-bold uppercase tracking-wider text-error">
              Blockers to Resolve:
            </div>
            <ul class="space-y-1">
              <li
                v-for="(problem, idx) in overlayStore.problems"
                :key="idx"
                class="flex items-start gap-1.5 rounded bg-error/15 px-2.5 py-1.5 font-mono text-xs text-error leading-snug border border-error/30"
              >
                <span class="font-bold shrink-0">•</span>
                <span>{{ problem }}</span>
              </li>
            </ul>
          </div>

          <!-- Warnings List -->
          <div v-if="overlayStore.warnings.length > 0" class="space-y-1.5 pt-1">
            <div class="text-[11px] font-bold uppercase tracking-wider text-warning">
              Advisory Warnings:
            </div>
            <ul class="space-y-1">
              <li
                v-for="(warning, idx) in overlayStore.warnings"
                :key="idx"
                class="flex items-start gap-1.5 rounded bg-warning/15 px-2.5 py-1.5 font-mono text-xs text-warning leading-snug border border-warning/30"
              >
                <span class="font-bold shrink-0">•</span>
                <span>{{ warning }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Animated Auto-fade Countdown Bar -->
        <div v-if="overlayStore.duration > 0" class="h-0.5 w-full bg-base-300/40 overflow-hidden">
          <div
            :key="overlayStore.seq"
            class="overlay-countdown-bar h-full w-full origin-left"
            :class="isSuccess ? 'bg-success' : isWarningOnly ? 'bg-warning' : 'bg-error'"
            :style="{
              animationDuration: `${overlayStore.duration}ms`,
              animationPlayState: overlayStore.paused ? 'paused' : 'running',
            }"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay-countdown-bar {
  animation-name: overlay-countdown-shrink;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes overlay-countdown-shrink {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
</style>
