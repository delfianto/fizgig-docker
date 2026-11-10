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
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

export const usePlanOverlayStore = defineStore("planOverlay", () => {
  const visible = ref(false);
  const status = ref<PlanOverlayStatus>("success");
  const title = ref("");
  const message = ref<string | undefined>(undefined);
  const problems = ref<string[]>([]);
  const warnings = ref<string[]>([]);
  const duration = ref(5000);
  const actionLabel = ref<string | undefined>(undefined);
  const paused = ref(false);
  const seq = ref(0);
  let actionHandler: (() => void | Promise<void>) | undefined;
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;
  let startedAt = 0;
  let remainingMs = 0;

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
    actionLabel.value = payload.actionLabel;
    actionHandler = payload.onAction;
    paused.value = false;
    seq.value += 1;
    visible.value = true;

    if (duration.value > 0) {
      remainingMs = duration.value;
      startedAt = Date.now();
      dismissTimer = setTimeout(() => {
        dismiss();
      }, remainingMs);
    }
  }

  function dismiss(): void {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    paused.value = false;
    actionLabel.value = undefined;
    actionHandler = undefined;
    visible.value = false;
  }

  async function triggerAction(): Promise<void> {
    const fn = actionHandler;
    dismiss();
    if (fn) {
      await fn();
    }
  }

  function pauseTimer(): void {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
      const elapsed = Date.now() - startedAt;
      remainingMs = Math.max(1200, remainingMs - elapsed);
    }
    paused.value = true;
  }

  function resumeTimer(): void {
    paused.value = false;
    if (visible.value && duration.value > 0 && !dismissTimer) {
      const waitMs = Math.max(1500, remainingMs || 2000);
      startedAt = Date.now();
      dismissTimer = setTimeout(() => {
        dismiss();
      }, waitMs);
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
    actionLabel,
    paused,
    seq,
    show,
    dismiss,
    triggerAction,
    pauseTimer,
    resumeTimer,
  };
});
