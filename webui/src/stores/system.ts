import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { type LocalBundlesResponse } from "@shared/types";
import { apiGet, apiPost } from "@/api/client";

export type UiDensity = "default" | "compact";
export type FontScale = "normal" | "large" | "xlarge";

function safeStorageGet(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

function safeStorageSet(key: string, val: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, val);
    }
  } catch {
    // Ignore storage access errors
  }
}

export const useSystemStore = defineStore("system", () => {
  const density = ref<UiDensity>((safeStorageGet("fizgig.ui.density") as UiDensity) || "default");
  const fontScale = ref<FontScale>((safeStorageGet("fizgig.ui.fontScale") as FontScale) || "large");
  const explainMode = ref<boolean>(safeStorageGet("fizgig.ui.explain") === "1");
  const localBundles = ref<LocalBundlesResponse | null>(null);
  const prefs = ref<Record<string, unknown>>({});

  watch(
    density,
    (val) => {
      safeStorageSet("fizgig.ui.density", val);
      if (typeof document !== "undefined") {
        if (val === "compact") {
          document.documentElement.setAttribute("data-density", "compact");
        } else {
          document.documentElement.removeAttribute("data-density");
        }
      }
    },
    { immediate: true },
  );

  watch(
    fontScale,
    (val) => {
      safeStorageSet("fizgig.ui.fontScale", val);
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-font-size", val);
      }
    },
    { immediate: true },
  );

  watch(explainMode, (val) => {
    safeStorageSet("fizgig.ui.explain", val ? "1" : "0");
  });

  async function fetchLocalBundles(): Promise<void> {
    try {
      localBundles.value = await apiGet<LocalBundlesResponse>("/ui-api/local/bundles");
    } catch {
      localBundles.value = null;
    }
  }

  async function fetchPrefs(): Promise<void> {
    try {
      prefs.value = await apiGet<Record<string, unknown>>("/api/prefs");
    } catch {
      // Ignore
    }
  }

  async function updatePrefs(changes: Record<string, unknown>): Promise<boolean> {
    try {
      await apiPost("/api/prefs", { changes });
      await fetchPrefs();
      return true;
    } catch (err) {
      console.error("Failed to update preferences:", err);
      return false;
    }
  }

  function toggleDensity(): void {
    density.value = density.value === "compact" ? "default" : "compact";
  }

  function cycleFontScale(): void {
    const order: FontScale[] = ["normal", "large", "xlarge"];
    const nextIdx = (order.indexOf(fontScale.value) + 1) % order.length;
    fontScale.value = order[nextIdx] ?? "large";
  }

  function setFontScale(scale: FontScale): void {
    fontScale.value = scale;
  }

  return {
    density,
    fontScale,
    explainMode,
    localBundles,
    prefs,
    fetchLocalBundles,
    fetchPrefs,
    updatePrefs,
    toggleDensity,
    cycleFontScale,
    setFontScale,
  };
});
