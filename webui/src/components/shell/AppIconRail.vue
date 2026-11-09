<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Activity,
  FlaskConical,
  HelpCircle,
  Images,
  Minimize2,
  Settings,
  SlidersHorizontal,
} from "lucide-vue-next";
import { useComposerStore } from "@/stores/composer";
import { useRunStore } from "@/stores/run";
import { useSystemStore } from "@/stores/system";

const route = useRoute();
const router = useRouter();
const runStore = useRunStore();
const composerStore = useComposerStore();
const systemStore = useSystemStore();

const navItems = computed(() => [
  {
    name: "Cockpit",
    path: "/cockpit",
    icon: Activity,
    shortcut: "Alt+1",
    badge: runStore.run?.web_queue?.items?.length || 0,
  },
  {
    name: "Composer",
    path: "/composer",
    icon: SlidersHorizontal,
    shortcut: "Alt+2",
    dot: composerStore.modifiedKeys.size > 0,
  },
  {
    name: "Datasets",
    path: "/datasets",
    icon: Images,
    shortcut: "Alt+3",
  },
  {
    name: "Workbench",
    path: "/workbench",
    icon: FlaskConical,
    shortcut: "Alt+4",
  },
]);
</script>

<template>
  <aside
    class="flex h-full w-16 shrink-0 flex-col items-center justify-between border-r border-hairline bg-base-200 py-3 select-none"
  >
    <!-- Top Brand & Primary Workspaces -->
    <div class="flex flex-col items-center gap-3">
      <button
        type="button"
        class="group relative flex h-10 w-10 items-center justify-center rounded-lg border border-hairline-strong bg-base-300 text-primary transition hover:border-primary"
        title="Fizgig Studio — Jump to Cockpit"
        @click="router.push('/cockpit')"
      >
        <span class="font-mono text-sm font-bold tracking-tight text-base-content"> FZ </span>
        <span v-if="runStore.isRunning" class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75"
          />
          <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-warning" />
        </span>
      </button>

      <div class="h-px w-8 bg-hairline" />

      <nav class="flex flex-col items-center gap-1.5">
        <button
          v-for="item in navItems"
          :key="item.path"
          type="button"
          class="group relative flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors duration-150"
          :class="
            route.path.startsWith(item.path)
              ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
              : 'text-subtle hover:bg-surface-hover hover:text-base-content'
          "
          :title="`${item.name} (${item.shortcut})`"
          @click="router.push(item.path)"
        >
          <component :is="item.icon" class="h-4 w-4" />
          <span class="text-[10px] font-medium tracking-tight">
            {{ item.name }}
          </span>

          <!-- Queue count badge -->
          <span
            v-if="item.badge && item.badge > 0"
            class="font-mono-num absolute top-1 right-1 rounded bg-primary px-1 text-[9px] font-semibold text-primary-content"
          >
            {{ item.badge }}
          </span>

          <!-- Modified draft indicator -->
          <span
            v-if="item.dot"
            class="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary"
            title="Draft has modified preset parameters"
          />
        </button>
      </nav>
    </div>

    <!-- Bottom Quick Toggles & System Settings -->
    <div class="flex flex-col items-center gap-1.5">
      <button
        type="button"
        class="flex h-8 w-10 items-center justify-center rounded-md transition-colors"
        :class="
          systemStore.explainMode
            ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
            : 'text-muted hover:bg-surface-hover hover:text-base-content'
        "
        title="Toggle inline field explanations (Explain Mode)"
        @click="systemStore.explainMode = !systemStore.explainMode"
      >
        <HelpCircle class="h-4 w-4" />
      </button>

      <!-- Font Size Cycler (Placed directly above UI Density) -->
      <button
        type="button"
        class="flex h-8 w-10 items-center justify-center gap-0.5 rounded-md transition-colors text-subtle hover:bg-surface-hover hover:text-base-content cursor-pointer border border-transparent hover:border-hairline"
        :title="`Font size: ${systemStore.fontScale} (Click to cycle Normal → Large → Extra Large)`"
        @click="systemStore.cycleFontScale()"
      >
        <span class="font-bold text-xs text-base-content">A</span>
        <span
          class="rounded bg-primary/20 px-1 font-mono text-[9px] font-bold text-primary uppercase"
        >
          {{
            systemStore.fontScale === "xlarge"
              ? "XL"
              : systemStore.fontScale === "large"
                ? "L"
                : "M"
          }}
        </span>
      </button>

      <button
        type="button"
        class="flex h-8 w-10 items-center justify-center rounded-md transition-colors"
        :class="
          systemStore.density === 'compact'
            ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
            : 'text-muted hover:bg-surface-hover hover:text-base-content'
        "
        :title="`UI Density: ${systemStore.density} (Click to toggle)`"
        @click="systemStore.toggleDensity()"
      >
        <Minimize2 class="h-4 w-4" />
      </button>

      <div class="my-0.5 h-px w-8 bg-hairline" />

      <button
        type="button"
        class="flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors"
        :class="
          route.path.startsWith('/system')
            ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
            : 'text-subtle hover:bg-surface-hover hover:text-base-content'
        "
        title="System, Bundles & Preferences (Alt+5)"
        @click="router.push('/system')"
      >
        <Settings class="h-4 w-4" />
        <span class="text-[10px] font-medium tracking-tight">System</span>
      </button>
    </div>
  </aside>
</template>
