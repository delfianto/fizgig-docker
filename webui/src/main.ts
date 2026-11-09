import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import CockpitPage from "./pages/CockpitPage.vue";
import ComposerPage from "./pages/ComposerPage.vue";
import DatasetsPage from "./pages/DatasetsPage.vue";
import WorkbenchPage from "./pages/WorkbenchPage.vue";
import SystemPage from "./pages/SystemPage.vue";
import "./app.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/cockpit" },
    { path: "/cockpit", name: "cockpit", component: CockpitPage },
    { path: "/composer", name: "composer", component: ComposerPage },
    { path: "/datasets", name: "datasets", component: DatasetsPage },
    { path: "/workbench", name: "workbench", component: WorkbenchPage },
    { path: "/system", name: "system", component: SystemPage },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
