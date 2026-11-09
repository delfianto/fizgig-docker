import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  type DatasetSummary,
  type FamilyDescription,
  type SchemaResponse,
  type SchemaRow,
} from "@shared/types";
import { apiGet } from "@/api/client";

const SUPPRESSED_KEYS = new Set([
  "__SAMPLE_LIVE",
  "_when_read",
  "_overtrain_tip",
  "_slider_help_pairs",
  "_slider_help_prompts",
  "_ft_to_lora",
  "_subjects_intro",
  "TURBO_MISSING",
]);

export const useSchemaStore = defineStore("schema", () => {
  const families = ref<FamilyDescription[]>([]);
  const order = ref<string[]>([]);
  const datasets = ref<DatasetSummary[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref<string | null>(null);

  const familyMap = computed(() => {
    const map = new Map<string, FamilyDescription>();
    for (const fam of families.value) {
      map.set(fam.key, fam);
    }
    return map;
  });

  async function fetchSchema(force = false): Promise<void> {
    if (loaded.value && !force) return;
    loading.value = true;
    error.value = null;
    try {
      const res = await apiGet<SchemaResponse>("/api/schema");
      families.value = res.families ?? [];
      order.value = res.order ?? families.value.map((f) => f.key);
      loaded.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load Fizgig schema";
    } finally {
      loading.value = false;
    }
  }

  async function fetchDatasets(): Promise<void> {
    try {
      const res = await apiGet<{ datasets?: DatasetSummary[] }>("/api/datasets");
      datasets.value = (res.datasets ?? []).map((d) => {
        d.count = d.count ?? d.pictures ?? 0;
        d.captioned = d.captioned ?? 0;
        return d;
      });
    } catch {
      // Keep previous list on transient error
    }
  }

  function getFamily(key: string): FamilyDescription | undefined {
    return familyMap.value.get(key);
  }

  function getRowMap(familyKey: string): Map<string, SchemaRow> {
    const map = new Map<string, SchemaRow>();
    const fam = getFamily(familyKey);
    if (!fam) return map;
    for (const sec of fam.form.sections) {
      for (const row of sec.rows) {
        if (row && row.key && !SUPPRESSED_KEYS.has(row.key)) {
          map.set(row.key, row);
        }
      }
    }
    return map;
  }

  function buildDefaults(familyKey: string): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    const fam = getFamily(familyKey);
    if (!fam) return defaults;
    for (const sec of fam.form.sections) {
      for (const row of sec.rows) {
        if (!row || !row.key || SUPPRESSED_KEYS.has(row.key)) continue;
        if (row.default !== undefined) {
          defaults[row.key] = row.default;
        }
        if (row.parts) {
          for (const part of row.parts) {
            if (part.key && part.default !== undefined) {
              defaults[part.key] = part.default;
            }
          }
        }
      }
    }
    return defaults;
  }

  return {
    families,
    order,
    datasets,
    loading,
    loaded,
    error,
    familyMap,
    fetchSchema,
    fetchDatasets,
    getFamily,
    getRowMap,
    buildDefaults,
  };
});
