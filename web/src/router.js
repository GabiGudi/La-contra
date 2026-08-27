import { createRouter, createWebHistory } from "vue-router";
import Reservar from "./vistas/Reservar.vue";
import AdminConfig from "./vistas/AdminConfig.vue";
import MiTurno from "./vistas/MiTurno.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Reservar },
    { path: "/mi-turno", component: MiTurno },
    { path: "/admin", component: AdminConfig },
  ],
});