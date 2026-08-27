import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router.js";
import "./estilos.css";

createApp(App).use(router).mount("#app");