<script setup lang="ts">
import { computed } from "vue";
import { Eye } from "lucide-vue-next";
import { useComposerStore } from "@/stores/composer";

const composerStore = useComposerStore();

const samplePromptCount = computed(() => {
  const text = String(composerStore.draftValues.SAMPLE_PROMPT ?? "").trim();
  if (!text) return 0;
  return text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
});
</script>

<template>
  <section class="rounded-xl border border-hairline bg-base-300/80 p-2.5 space-y-1.5">
    <div class="flex items-center justify-between border-b border-hairline pb-1.5">
      <div class="flex items-center gap-2">
        <Eye class="h-4 w-4 text-info" />
        <h2 class="text-xs font-bold uppercase tracking-wider text-base-content">
          Sample Prompts (Draft)
        </h2>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="samplePromptCount > 0" class="badge badge-xs badge-primary font-mono">
          {{ samplePromptCount }} prompt(s)
        </span>
        <span class="badge badge-xs badge-info font-mono">Isolated</span>
      </div>
    </div>

    <p class="text-[11px] text-subtle">
      Test prompts rendered every
      {{ composerStore.draftValues.SAMPLE_EVERY_N_EPOCHS ?? 1 }} epoch to monitor generalization:
    </p>

    <!-- Compact, comfortable textarea that fits nicely without page scroll -->
    <textarea
      :value="String(composerStore.draftValues.SAMPLE_PROMPT ?? '')"
      rows="4"
      placeholder="A close-up portrait of trigger, looking at camera, neutral background...&#10;&#10;A dynamic wide shot of trigger outdoors in the city, golden hour lighting..."
      class="textarea textarea-bordered w-full h-28 min-h-[80px] max-h-[200px] resize-y border-hairline-strong bg-base-100 font-mono text-xs leading-relaxed text-base-content focus:border-primary p-2"
      @input="
        composerStore.setFieldValue('SAMPLE_PROMPT', ($event.target as HTMLTextAreaElement).value)
      "
    />

    <div class="flex items-center justify-between text-[11px] text-muted pt-0.5">
      <span>Separate multiple prompts with a blank line.</span>
      <span class="font-mono">Renders per checkpoint</span>
    </div>
  </section>
</template>
