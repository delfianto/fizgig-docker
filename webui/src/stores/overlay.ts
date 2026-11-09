import { ref } from "vue";
import { defineStore } from "pinia";

export type PlanOverlayStatus = "success" | "attention" | "warning";

export interface PlanOverlayPayload {
  status: PlanOverlayStatus;
  title: string;
  message?: string;
  problems?: string[];
  warnings?: string[];
  duration?: number; // In milliseconds, defaults to 5000
}

export const usePlanOverlayStore = defineStore("planOverlay", () => {
  const visible = ref(false);
  const status = ref<PlanOverlayStatus>("success");
  const title = ref("");
  const message = ref<string | undefined>(undefined);
  const problems = ref<string[]>([]);
  const warnings = ref<string[]>([]);
  const duration = ref(5000);
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  function show(payload: PlanOverlayPayload): void {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }

    status.value = payload.status;
    title.value = payload.title;
    message.value = payload.message;
    problems.value = payload.problems ? [...payload.problems] : [];
    warnings.value = payload.warnings ? [...payload.warnings] : [];
    duration.value = payload.duration ?? 5000;
    visible.value = true;

    if (duration.value > 0) {
      dismissTimer = setTimeout(() => {
        dismiss();
      }, duration.value);
    }
  }

  function dismiss(): void {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    visible.value = false;
  }

  function pauseTimer(): void {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  }

  function resumeTimer(): void {
    if (visible.value && duration.value > 0 && !dismissTimer) {
      dismissTimer = setTimeout(() => {
        dismiss();
      }, 2000); // 2 second grace period after mouse leave
    }
  }

  return {
    visible,
    status,
    title,
    message,
    problems,
    warnings,
    duration,
    show,
    dismiss,
    pauseTimer,
    resumeTimer,
  };
});
