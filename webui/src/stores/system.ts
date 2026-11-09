import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { type LocalBundlesResponse } from "@shared/types";
import { apiGet } from "@/api/client";

export type UiDensity = "default" | "compact";
export type FontScale = "normal" | "large" | "xlarge";

export const useSystemStore = defineStore("system", () => {
  const density = ref<UiDensity>(
    (localStorage.getItem("fizgig.ui.density") as UiDensity) || "default",
  );
  const fontScale = ref<FontScale>(
    (localStorage.getItem("fizgig.ui.fontScale") as FontScale) || "large",
  );
  const explainMode = ref<boolean>(localStorage.getItem("fizgig.ui.explain") === "1");
  const localBundles = ref<LocalBundlesResponse | null>(null);
  const prefs = ref<Record<string, unknown>>({});

  watch(
    density,
    (val) => {
      localStorage.setItem("fizgig.ui.density", val);
      if (val === "compact") {
        document.documentElement.setAttribute("data-density", "compact");
      } else {
        document.documentElement.removeAttribute("data-density");
      }
    },
    { immediate: true },
  );

  watch(
    fontScale,
    (val) => {
      localStorage.setItem("fizgig.ui.fontScale", val);
      document.documentElement.setAttribute("data-font-size", val);
    },
    { immediate: true },
  );

  watch(explainMode, (val) => {
    localStorage.setItem("fizgig.ui.explain", val ? "1" : "0");
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
    toggleDensity,
    cycleFontScale,
    setFontScale,
  };
});
