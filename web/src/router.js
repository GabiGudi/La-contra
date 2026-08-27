import { createRouter, createWebHistory } from "vue-router";
import Reservar from "./vistas/Reservar.vue";
import MiTurno from "./vistas/MiTurno.vue";
import AdminConfig from "./vistas/AdminConfig.vue";
import AdminTurnos from "./vistas/AdminTurnos.vue";
import Login from "./vistas/Login.vue";
import { esAdmin } from "./auth.js";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Reservar },
    { path: "/mi-turno", component: MiTurno },
    { path: "/login", component: Login },
    { path: "/admin", component: AdminConfig, meta: { admin: true } },
    { path: "/admin/turnos", component: AdminTurnos, meta: { admin: true } },
  ],
});

router.beforeEach((destino) => {
  if (destino.meta.admin && !esAdmin()) return "/login";
});