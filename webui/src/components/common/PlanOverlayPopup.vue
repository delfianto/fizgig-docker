<script setup lang="ts">
import { computed } from "vue";
import { AlertTriangle, CheckCircle2, X } from "lucide-vue-next";
import { usePlanOverlayStore } from "@/stores/overlay";

const overlayStore = usePlanOverlayStore();

const isSuccess = computed(() => overlayStore.status === "success");
</script>

<template>
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
          : 'border-error/70 bg-[#1c0a0c]/95 shadow-error/15 text-base-content'
      "
      role="status"
      aria-live="polite"
      @mouseenter="overlayStore.pauseTimer"
      @mouseleave="overlayStore.resumeTimer"
    >
      <!-- Main Content Block -->
      <div class="p-4 space-y-3">
        <!-- Header Strip -->
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              :class="isSuccess ? 'bg-success/20 text-success' : 'bg-error/20 text-error'"
            >
              <CheckCircle2 v-if="isSuccess" class="h-5 w-5" />
              <AlertTriangle v-else class="h-5 w-5" />
            </div>

            <div>
              <h3
                class="font-bold text-sm leading-tight"
                :class="isSuccess ? 'text-success' : 'text-error'"
              >
                {{ overlayStore.title }}
              </h3>
              <p
                class="text-xs font-mono tracking-tight"
                :class="isSuccess ? 'text-success/80' : 'text-error/80'"
              >
                {{
                  isSuccess
                    ? "Preflight verified • 0 blockers"
                    : `${overlayStore.problems.length} blocker(s) • ${overlayStore.warnings.length} warning(s)`
                }}
              </p>
            </div>
          </div>

          <!-- Dismiss Button -->
          <button
            type="button"
            class="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-base-300 hover:text-base-content"
            title="Dismiss popup"
            @click="overlayStore.dismiss"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- Optional Direct Message -->
        <p v-if="overlayStore.message" class="text-xs text-subtle leading-relaxed">
          {{ overlayStore.message }}
        </p>

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

      <!-- Subtle Auto-fade Indicator Line -->
      <div class="h-0.5 w-full bg-base-300/40">
        <div
          class="h-full transition-all duration-300"
          :class="isSuccess ? 'bg-success' : 'bg-error'"
        />
      </div>
    </div>
  </Transition>
</template>
