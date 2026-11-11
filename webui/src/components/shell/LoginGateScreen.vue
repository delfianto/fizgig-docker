<script setup lang="ts">
import { ref } from "vue";
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-vue-next";
import { ApiError, apiPost } from "@/api/client";
import { BaseButton, BaseInput } from "@/components/common";

const emit = defineEmits<{
  (e: "authenticated"): void;
}>();

const password = ref("");
const showPassword = ref(false);
const submitting = ref(false);
const errorMessage = ref<string | null>(null);

async function submitLogin(): Promise<void> {
  const pw = password.value.trim();
  if (!pw || submitting.value) return;
  submitting.value = true;
  errorMessage.value = null;

  try {
    await apiPost("/api/login", { password: pw }, { skipAuthRedirect: true });
    password.value = "";
    emit("authenticated");
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      errorMessage.value = "Invalid password. Check your Fizgig access credential.";
    } else {
      errorMessage.value = err instanceof Error ? err.message : "Authentication failed";
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex h-screen w-screen items-center justify-center bg-base-100 p-4 select-none">
    <form
      class="w-full max-w-sm rounded-xl border border-hairline-strong bg-base-300 p-6 space-y-5"
      @submit.prevent="submitLogin"
    >
      <div class="flex items-center gap-3 border-b border-hairline pb-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/15 font-mono text-sm font-bold text-base-content"
        >
          FZ
        </div>
        <div>
          <h1 class="text-sm font-bold text-base-content">Fizgig Studio</h1>
          <p class="text-xs text-muted">Enter your workspace password to unlock.</p>
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="flex items-start gap-2 rounded-lg border border-error/40 bg-error/10 p-2.5 text-xs text-error"
        role="alert"
      >
        <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ errorMessage }}</span>
      </div>

      <div class="space-y-1.5">
        <label class="block text-xs font-semibold text-subtle">Access Password</label>
        <BaseInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Enter Fizgig password..."
          mono
          :error="Boolean(errorMessage)"
        >
          <template #prefix>
            <KeyRound class="h-3.5 w-3.5 text-muted" />
          </template>
          <template #suffix>
            <button
              type="button"
              class="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-base-200 hover:text-base-content cursor-pointer transition"
              :title="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" class="h-3.5 w-3.5" />
              <Eye v-else class="h-3.5 w-3.5" />
            </button>
          </template>
        </BaseInput>
      </div>

      <BaseButton
        type="submit"
        variant="primary"
        class="w-full"
        :disabled="submitting || !password.trim()"
      >
        <template #icon-left>
          <Loader2 v-if="submitting" class="h-4 w-4 animate-spin" />
        </template>
        <span>{{ submitting ? "Unlocking..." : "Unlock Studio" }}</span>
      </BaseButton>
    </form>
  </div>
</template>
