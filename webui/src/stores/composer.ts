import { computed, ref, toRaw } from "vue";
import { defineStore } from "pinia";
import { useDebounceFn } from "@vueuse/core";
import { type FormStateResponse, type PlanValidationResponse } from "@shared/types";
import { apiGet, apiPost } from "@/api/client";
import { estimateVramGb } from "@/utils";
import { useRunStore } from "./run";
import { useSchemaStore } from "./schema";
import { useSystemStore } from "./system";

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    try {
      return structuredClone(toRaw(obj));
    } catch {
      return { ...(obj as object) } as T;
    }
  }
}

function canonicalizeJson(val: unknown): string {
  if (val === null || typeof val !== "object") {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  const entries = Object.entries(val as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .toSorted(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalizeJson(v)}`).join(",")}}`;
}

export function isValueEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined && b === undefined) return true;
  if (a === null && b === null) return true;

  // Normalize booleans strictly between actual booleans and string "true"/"false"
  const isExplicitBoolA = typeof a === "boolean" || a === "true" || a === "false";
  const isExplicitBoolB = typeof b === "boolean" || b === "true" || b === "false";
  if (isExplicitBoolA && isExplicitBoolB) {
    const boolA = a === true || a === "true";
    const boolB = b === true || b === "true";
    return boolA === boolB;
  }

  // Deep comparison for objects/dictionaries (key-order independent, e.g. TRAINING_BLOCKS)
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    try {
      return canonicalizeJson(a) === canonicalizeJson(b);
    } catch {
      return false;
    }
  }

  if (typeof a === "boolean" || typeof b === "boolean") {
    return false;
  }

  // Normalize numeric & scientific notation (e.g. 0.0001 <-> 1e-4, 1 <-> 1.0, 30 <-> "30")
  const strA = String(a ?? "").trim();
  const strB = String(b ?? "").trim();
  if (strA === strB) return true;

  if (strA !== "" && strB !== "") {
    const numA = Number(strA);
    const numB = Number(strB);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      return numA === numB;
    }
  }

  return false;
}

export const useComposerStore = defineStore("composer", () => {
  const schemaStore = useSchemaStore();
  const systemStore = useSystemStore();

  const family = ref<string>("");
  const presetName = ref<string>("");
  const userPresets = ref<string[]>([]);
  const imageFolder = ref<string>("");
  const selectedGpuIndex = ref<number>(0);

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
  const selectedSectionIndex = ref(0);
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
      if (base !== undefined && !isValueEqual(v, base)) {
        modified.add(k);
      }
    }
    return modified;
  });

  let formStateReqSeq = 0;
  let formStateAbort: AbortController | null = null;

  const refreshFormState = useDebounceFn(async () => {
    if (!family.value) return;
    formStateAbort?.abort();
    const controller = new AbortController();
    formStateAbort = controller;
    const reqId = ++formStateReqSeq;
    try {
      const res = await apiPost<FormStateResponse>(
        "/api/form/state",
        {
          family: family.value,
          values: draftValues.value,
          image_folder: imageFolder.value,
        },
        { signal: controller.signal },
      );
      if (reqId === formStateReqSeq) {
        formState.value = res;
      }
    } catch {
      // Keep previous formState on aborted or transient error
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
    const prevFamily = family.value;
    family.value = famKey;
    selectedSectionIndex.value = 0;
    planResult.value = null;

    const defaults = schemaStore.buildDefaults(famKey);
    await fetchPresetsList(famKey);

    const firstPreset = desc.form.presets[0] ?? desc.presets[0];
    if (firstPreset) {
      await applyPreset(firstPreset.name, defaults);
    } else {
      baselineValues.value = deepClone(defaults);
      draftValues.value = deepClone(defaults);
      presetName.value = "";
      await refreshFormState();
    }

    const curName = String(draftValues.value.LORA_NAME ?? "");
    if (
      imageFolder.value &&
      (!curName ||
        curName.startsWith("my_lora_") ||
        (prevFamily && curName.endsWith(`_${prevFamily}_v1`)))
    ) {
      autoSuggestLoraName(true);
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
      baselineValues.value = deepClone(merged);
      draftValues.value = deepClone(merged);
      await refreshFormState();
    } catch {
      baselineValues.value = deepClone(base);
      draftValues.value = deepClone(base);
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
      draftValues.value[key] = deepClone(baselineValues.value[key]);
      void refreshFormState();
    } else {
      const row = schemaStore.getRowMap(family.value).get(key);
      if (row && row.default !== undefined) {
        draftValues.value[key] = deepClone(row.default);
        void refreshFormState();
      }
    }
  }

  function resetAllToPreset(): void {
    draftValues.value = deepClone(baselineValues.value);
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

  async function submitStartTraining(forceIgnoreWarnings = false): Promise<PlanValidationResponse> {
    const plan = await validatePlan();
    if (plan.problems && plan.problems.length > 0) {
      return plan;
    }
    if (!forceIgnoreWarnings && plan.warnings && plan.warnings.length > 0) {
      return plan;
    }
    await apiPost("/api/start", {
      family: family.value,
      values: draftValues.value,
      image_folder: imageFolder.value,
      cuda_device: String(selectedGpuIndex.value),
    });
    return plan;
  }

  async function submitQueueTraining(forceIgnoreWarnings = false): Promise<PlanValidationResponse> {
    const plan = await validatePlan();
    if (plan.problems && plan.problems.length > 0) {
      return plan;
    }
    if (!forceIgnoreWarnings && plan.warnings && plan.warnings.length > 0) {
      return plan;
    }
    await apiPost("/api/queue/add", {
      family: family.value,
      values: draftValues.value,
      image_folder: imageFolder.value,
      cuda_device: String(selectedGpuIndex.value),
    });
    return plan;
  }

  const estimatedVramGb = computed<number>(() => {
    return estimateVramGb(family.value, draftValues.value);
  });

  async function setSelectedGpu(index: number): Promise<void> {
    selectedGpuIndex.value = index;
    await systemStore.updatePrefs({ cuda_device: String(index) });
    const runStore = useRunStore();
    await runStore.pollStats();
  }

  function setImageFolder(folder: string): void {
    imageFolder.value = folder;
    void refreshFormState();
  }

  function autoSuggestLoraName(asBaseline = true): void {
    const ds = schemaStore.datasets.find((d) => d.path === imageFolder.value)?.name;
    if (!ds || !family.value) return;
    const clean = ds.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const name = `${clean}_${family.value}_v1`;
    setFieldValue("LORA_NAME", name);
    if (asBaseline || !modifiedKeys.value.has("LORA_NAME")) {
      baselineValues.value.LORA_NAME = name;
    }
  }

  function selectDataset(path: string, asBaseline = true): void {
    setImageFolder(path);
    const currentName = String(draftValues.value.LORA_NAME ?? "");
    const isAutoNamed =
      !currentName || currentName.startsWith("my_lora_") || /_[a-z0-9]+_v1$/i.test(currentName);
    if (isAutoNamed) {
      autoSuggestLoraName(asBaseline);
    }
  }

  function ensureValidDatasetSelected(): void {
    const list = schemaStore.datasets;
    if (list.length === 0) return;
    const hasCurrent = Boolean(imageFolder.value) && list.some((d) => d.path === imageFolder.value);
    if (!hasCurrent) {
      const readyDs = list.find((d) => d.count > 0 && (d.captioned ?? 0) >= d.count);
      const fallback = readyDs ?? list[0];
      if (fallback) {
        selectDataset(fallback.path, true);
      }
    }
  }

  function resolvePreferredFamily(): string {
    const bundles = systemStore.localBundles;
    if (bundles?.available && Array.isArray(bundles.active)) {
      for (const bundleKey of bundles.active) {
        const famKey = bundles.bundles[bundleKey]?.family;
        if (famKey && schemaStore.getFamily(famKey)) {
          return famKey;
        }
      }
    }
    return schemaStore.order[0] ?? schemaStore.families[0]?.key ?? "";
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
    baselineValues.value = deepClone(merged);
    draftValues.value = deepClone(merged);
    presetName.value = "Cloned from " + run.lora;
    planResult.value = null;
    void refreshFormState();
  }

  return {
    family,
    presetName,
    userPresets,
    imageFolder,
    selectedGpuIndex,
    estimatedVramGb,
    baselineValues,
    draftValues,
    selectedSectionIndex,
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
    setSelectedGpu,
    setImageFolder,
    autoSuggestLoraName,
    selectDataset,
    ensureValidDatasetSelected,
    resolvePreferredFamily,
    loadFromHistoricalRun,
  };
});
