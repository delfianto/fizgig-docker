import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useDebounceFn } from "@vueuse/core";
import { type FormStateResponse, type PlanValidationResponse } from "@shared/types";
import { apiGet, apiPost } from "@/api/client";
import { useSchemaStore } from "./schema";

export const useComposerStore = defineStore("composer", () => {
  const schemaStore = useSchemaStore();

  const family = ref<string>("krea2");
  const presetName = ref<string>("");
  const userPresets = ref<string[]>([]);
  const imageFolder = ref<string>("/datasets/jeje_v1");

  const baselineValues = ref<Record<string, unknown>>({});
  const draftValues = ref<Record<string, unknown>>({});

  const formState = ref<FormStateResponse>({
    kind: "standard",
    hidden: [],
    disabled: [],
    notes: {},
    placeholders: {},
  });

  const planResult = ref<PlanValidationResponse | null>(null);
  const validatingPlan = ref(false);
  const triggerCheckVerdict = ref<{
    trigger: string;
    tokens: number;
    text: string;
    ok: boolean;
  } | null>(null);

  const currentFamilyDesc = computed(() => schemaStore.getFamily(family.value));

  const modifiedKeys = computed(() => {
    const modified = new Set<string>();
    for (const [k, v] of Object.entries(draftValues.value)) {
      if (k.startsWith("__")) continue;
      const base = baselineValues.value[k];
      if (base !== undefined && String(v) !== String(base)) {
        modified.add(k);
      }
    }
    return modified;
  });

  const refreshFormState = useDebounceFn(async () => {
    if (!family.value) return;
    try {
      const res = await apiPost<FormStateResponse>("/api/form/state", {
        family: family.value,
        values: draftValues.value,
        image_folder: imageFolder.value,
      });
      formState.value = res;
    } catch {
      // Keep previous formState on transient error
    }
  }, 220);

  async function fetchPresetsList(famKey: string): Promise<void> {
    try {
      const res = await apiGet<{ builtin?: string[]; user?: string[] }>("/api/presets", {
        family: famKey,
      });
      userPresets.value = res.user ?? [];
    } catch {
      userPresets.value = [];
    }
  }

  async function selectFamily(famKey: string): Promise<void> {
    await schemaStore.fetchSchema();
    const desc = schemaStore.getFamily(famKey);
    if (!desc) return;
    family.value = famKey;
    planResult.value = null;

    const defaults = schemaStore.buildDefaults(famKey);
    await fetchPresetsList(famKey);

    const firstPreset = desc.form.presets[0] ?? desc.presets[0];
    if (firstPreset) {
      await applyPreset(firstPreset.name, defaults);
    } else {
      baselineValues.value = { ...defaults };
      draftValues.value = { ...defaults };
      presetName.value = "";
      await refreshFormState();
    }
  }

  async function applyPreset(name: string, seedDefaults?: Record<string, unknown>): Promise<void> {
    const base = seedDefaults ?? schemaStore.buildDefaults(family.value);
    try {
      const res = await apiPost<{ values: Record<string, unknown> }>("/api/preset", {
        family: family.value,
        name,
        values: base,
      });
      // Preserve user's LoRA name if already typed
      const existingLoraName = draftValues.value.LORA_NAME;
      const merged = {
        ...base,
        ...res.values,
      };
      if (
        typeof existingLoraName === "string" &&
        existingLoraName.trim() !== "" &&
        !existingLoraName.startsWith("my_lora_")
      ) {
        merged.LORA_NAME = existingLoraName;
      }
      presetName.value = name;
      baselineValues.value = structuredClone(merged);
      draftValues.value = structuredClone(merged);
      await refreshFormState();
    } catch {
      baselineValues.value = { ...base };
      draftValues.value = { ...base };
    }
  }

  function setFieldValue(key: string, value: unknown): void {
    draftValues.value[key] = value;
    const rowMap = schemaStore.getRowMap(family.value);
    const row = rowMap.get(key);
    if (row?.sets && typeof value === "string" && row.sets[value]) {
      for (const [targetKey, targetVal] of Object.entries(row.sets[value])) {
        draftValues.value[targetKey] = targetVal;
      }
    }
    void refreshFormState();
  }

  function resetField(key: string): void {
    if (key in baselineValues.value) {
      draftValues.value[key] = baselineValues.value[key];
      void refreshFormState();
    }
  }

  function resetAllToPreset(): void {
    draftValues.value = structuredClone(baselineValues.value);
    planResult.value = null;
    void refreshFormState();
  }

  async function checkTriggerWord(): Promise<void> {
    const trigger = String(draftValues.value.CAPTION_TRIGGER_WORD ?? "").trim();
    if (!trigger) {
      triggerCheckVerdict.value = null;
      return;
    }
    try {
      const res = await apiPost<{
        tokens?: string[];
        count?: number;
        verdict?: string;
        good?: boolean;
      }>("/api/captions/trigger_check", {
        family: family.value,
        trigger,
      });
      triggerCheckVerdict.value = {
        trigger,
        tokens: res.count ?? res.tokens?.length ?? 1,
        text: res.verdict ?? `${res.tokens?.join(" · ") ?? trigger}`,
        ok: res.good ?? res.count === 1,
      };
    } catch {
      triggerCheckVerdict.value = null;
    }
  }

  async function validatePlan(): Promise<PlanValidationResponse> {
    validatingPlan.value = true;
    try {
      const res = await apiPost<PlanValidationResponse>("/api/plan", {
        family: family.value,
        values: draftValues.value,
        image_folder: imageFolder.value,
      });
      planResult.value = res;
      return res;
    } finally {
      validatingPlan.value = false;
    }
  }

  async function submitStartTraining(): Promise<PlanValidationResponse> {
    const plan = await validatePlan();
    if (
      (plan.problems && plan.problems.length > 0) ||
      (plan.warnings && plan.warnings.length > 0)
    ) {
      return plan;
    }
    await apiPost("/api/start", {
      family: family.value,
      values: draftValues.value,
      image_folder: imageFolder.value,
    });
    return plan;
  }

  async function submitQueueTraining(): Promise<PlanValidationResponse> {
    const plan = await validatePlan();
    if (
      (plan.problems && plan.problems.length > 0) ||
      (plan.warnings && plan.warnings.length > 0)
    ) {
      return plan;
    }
    await apiPost("/api/queue/add", {
      family: family.value,
      values: draftValues.value,
      image_folder: imageFolder.value,
    });
    return plan;
  }

  function setImageFolder(folder: string): void {
    imageFolder.value = folder;
    void refreshFormState();
  }

  function loadFromHistoricalRun(run: {
    family: string;
    image_folder?: string;
    values?: Record<string, unknown>;
    lora: string;
  }): void {
    family.value = run.family;
    imageFolder.value = run.image_folder || imageFolder.value;
    const defaults = schemaStore.buildDefaults(run.family);
    const merged = { ...defaults, ...run.values };
    baselineValues.value = structuredClone(merged);
    draftValues.value = structuredClone(merged);
    presetName.value = "Cloned from " + run.lora;
    planResult.value = null;
    void refreshFormState();
  }

  return {
    family,
    presetName,
    userPresets,
    imageFolder,
    baselineValues,
    draftValues,
    formState,
    planResult,
    validatingPlan,
    triggerCheckVerdict,
    currentFamilyDesc,
    modifiedKeys,
    selectFamily,
    applyPreset,
    setFieldValue,
    resetField,
    resetAllToPreset,
    refreshFormState,
    checkTriggerWord,
    validatePlan,
    submitStartTraining,
    submitQueueTraining,
    setImageFolder,
    loadFromHistoricalRun,
  };
});
