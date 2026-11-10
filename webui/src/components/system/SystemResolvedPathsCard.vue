<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, Pencil, RefreshCw, Settings2, X } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { BaseBadge, BaseButton, BaseCard, BaseInput } from "@/components/common";
import { useSystemStore } from "@/stores/system";

const systemStore = useSystemStore();

const READ_ONLY_KEYS = new Set(["host_name", "lan_ip", "port_now", "web_port"]);

const editingKey = ref<string | null>(null);
const draftValue = ref<string>("");
const saving = ref<boolean>(false);

const prefEntries = computed(() => {
  return Object.entries(systemStore.prefs)
    .filter(([, val]) => typeof val === "string" || typeof val === "number")
    .toSorted(([a], [b]) => a.localeCompare(b));
});

function startEditing(key: string, currentVal: string | number): void {
  if (READ_ONLY_KEYS.has(key)) return;
  editingKey.value = key;
  draftValue.value = String(currentVal ?? "");
}

function cancelEditing(): void {
  editingKey.value = null;
  draftValue.value = "";
}

async function savePrefKey(key: string): Promise<void> {
  saving.value = true;
  try {
    const ok = await systemStore.updatePrefs({ [key]: draftValue.value.trim() });
    if (ok) {
      toast.success(`Updated preference "${key}"`);
      editingKey.value = null;
    } else {
      toast.error(`Failed to update "${key}"`);
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseCard
    title="Resolved Container Preferences (/api/prefs)"
    subtitle="Inspect or update active Fizgig workspace directories, CUDA device bindings, and model paths."
  >
    <template #icon>
      <Settings2 class="h-4 w-4 text-primary" />
    </template>
    <template #actions>
      <BaseButton size="compact" variant="ghost" @click="systemStore.fetchPrefs()">
        <template #icon-left><RefreshCw class="h-3.5 w-3.5" /></template>
        <span>Refresh</span>
      </BaseButton>
    </template>

    <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
      <div
        v-for="[key, val] in prefEntries"
        :key="key"
        class="flex items-center justify-between gap-2.5 rounded-lg border border-hairline bg-base-300/50 px-3 py-2 font-mono text-xs"
      >
        <span class="shrink-0 text-muted">{{ key }}</span>

        <!-- Inline Edit State -->
        <div v-if="editingKey === key" class="flex flex-1 items-center justify-end gap-1.5 min-w-0">
          <BaseInput
            v-model="draftValue"
            size="xs"
            mono
            @keyup.enter="savePrefKey(key)"
            @keyup.esc="cancelEditing"
          />
          <BaseButton
            size="icon-xs"
            variant="primary"
            :disabled="saving"
            title="Save preference"
            @click="savePrefKey(key)"
          >
            <Check class="h-3 w-3" />
          </BaseButton>
          <BaseButton
            size="icon-xs"
            variant="ghost"
            :disabled="saving"
            title="Cancel"
            @click="cancelEditing"
          >
            <X class="h-3 w-3" />
          </BaseButton>
        </div>

        <!-- Read State -->
        <div v-else class="flex items-center gap-2 min-w-0">
          <span
            class="truncate text-right"
            :class="String(val).trim() === '' ? 'text-muted' : 'text-base-content'"
            :title="String(val)"
          >
            {{ String(val).trim() === "" ? "—" : val }}
          </span>
          <BaseBadge v-if="READ_ONLY_KEYS.has(key)" variant="outline" mono>ro</BaseBadge>
          <button
            v-else
            type="button"
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-base-200 hover:text-base-content cursor-pointer transition"
            :title="`Edit ${key}`"
            @click="startEditing(key, val as string | number)"
          >
            <Pencil class="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  </BaseCard>
</template>
