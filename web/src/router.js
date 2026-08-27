import { createRouter, createWebHistory } from "vue-router";
import Reservar from "./vistas/Reservar.vue";
import AdminConfig from "./vistas/AdminConfig.vue";
import MiTurno from "./vistas/MiTurno.vue";
import AdminTurnos from "./vistas/AdminTurnos.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Reservar },
    { path: "/mi-turno", component: MiTurno },
    { path: "/admin", component: AdminConfig },
    { path: "/admin/turnos", component: AdminTurnos },
  ],
});