<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { ArrowRight, CheckCircle2, FolderGit2, Package, RefreshCw } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { BaseBadge, BaseButton, BaseCard } from "@/components/common";
import { useComposerStore } from "@/stores/composer";
import { useSystemStore } from "@/stores/system";

const router = useRouter();
const systemStore = useSystemStore();
const composerStore = useComposerStore();

const bundleEntries = computed(() => {
  const bundles = systemStore.localBundles?.bundles ?? {};
  const activeSet = new Set(systemStore.localBundles?.active ?? []);
  return Object.entries(bundles).map(([key, val]) => ({
    key,
    active: activeSet.has(key),
    family: val.family,
    description: val.description ?? "",
    preferences: val.preferences ?? {},
  }));
});

function resolveSpecLabel(spec: unknown): string {
  if (spec && typeof spec === "object") {
    const rec = spec as Record<string, unknown>;
    if (typeof rec.path === "string" && rec.path) return rec.path;
    if (typeof rec.source === "string" && rec.source) return rec.source;
  }
  return "configured";
}

async function openBundleInComposer(family: string, bundleKey: string): Promise<void> {
  await composerStore.selectFamily(family);
  toast.success(`Selected ${bundleKey} (${family}) in Composer`);
  void router.push("/composer");
}
</script>

<template>
  <BaseCard
    title="Declarative Model Catalog (models.json)"
    subtitle="Read-only local manifest bundles hydrated into Fizgig preferences at container startup."
  >
    <template #icon>
      <Package class="h-4 w-4 text-primary" />
    </template>
    <template #actions>
      <BaseButton size="compact" variant="ghost" @click="systemStore.fetchLocalBundles()">
        <template #icon-left><RefreshCw class="h-3.5 w-3.5" /></template>
        <span>Reload Catalog</span>
      </BaseButton>
    </template>

    <div class="space-y-4">
      <div
        v-if="
          systemStore.localBundles?.externalRoots &&
          Object.keys(systemStore.localBundles.externalRoots).length > 0
        "
        class="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-base-300/50 px-3 py-2 text-xs"
      >
        <FolderGit2 class="h-3.5 w-3.5 text-info" />
        <span class="font-semibold text-subtle">External Mount Roots:</span>
        <BaseBadge
          v-for="(val, key) in systemStore.localBundles.externalRoots"
          :key="key"
          variant="neutral"
          size="sm"
          mono
        >
          {{ key }}: {{ val }}
        </BaseBadge>
      </div>

      <div
        v-if="bundleEntries.length === 0"
        class="rounded-lg border border-hairline bg-base-300/40 p-6 text-center text-xs text-muted"
      >
        No local model catalog found at
        <code class="font-mono">{{
          systemStore.localBundles?.catalogPath || "/etc/fizgig/models.json"
        }}</code
        >.
      </div>

      <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div
          v-for="bundle in bundleEntries"
          :key="bundle.key"
          class="flex flex-col justify-between rounded-lg border p-3.5 transition-colors"
          :class="
            bundle.active
              ? 'border-success/40 bg-success/5'
              : 'border-hairline bg-base-300/50 hover:border-hairline-strong'
          "
        >
          <div>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-mono text-xs font-bold text-base-content truncate">
                  {{ bundle.key }}
                </span>
                <BaseBadge variant="outline" mono>{{ bundle.family }}</BaseBadge>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <BaseBadge v-if="bundle.active" variant="success">
                  <CheckCircle2 class="h-2.5 w-2.5" />
                  <span>active</span>
                </BaseBadge>
                <BaseButton
                  size="xs"
                  variant="bare"
                  class="text-primary hover:bg-primary/10 px-1.5"
                  :title="`Compose a ${bundle.family} training run`"
                  @click="openBundleInComposer(bundle.family, bundle.key)"
                >
                  <span>Use</span>
                  <template #icon-right><ArrowRight class="h-2.5 w-2.5" /></template>
                </BaseButton>
              </div>
            </div>

            <p v-if="bundle.description" class="mt-1.5 text-xs text-subtle">
              {{ bundle.description }}
            </p>
          </div>

          <div class="mt-2.5 space-y-1 border-t border-hairline pt-2">
            <div
              v-for="(spec, prefKey) in bundle.preferences"
              :key="prefKey"
              class="flex items-center justify-between gap-2 font-mono text-[11px]"
            >
              <span class="text-muted shrink-0">{{ prefKey }}</span>
              <span class="truncate text-subtle" :title="resolveSpecLabel(spec)">
                {{ resolveSpecLabel(spec) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseCard>
</template>
