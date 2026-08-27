import { createRouter, createWebHistory } from "vue-router";
import Reservar from "./vistas/Reservar.vue";
import AdminConfig from "./vistas/AdminConfig.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Reservar },
    { path: "/admin", component: AdminConfig },
  ],
});