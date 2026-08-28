<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { esAdmin, guardarToken } from "./auth.js";

const router = useRouter();

/** En el celular, el tercer botón lleva al panel o al login según corresponda. */
const destinoAdmin = computed(() => (esAdmin() ? "/admin/turnos" : "/login"));

function salir() {
  guardarToken("");
  router.push("/");
}
</script>

<template>
  <div class="app">
    <!-- Escritorio: barra lateral -->
    <aside class="lateral">
      <p class="marca">LA<b>CONTRA</b></p>

      <nav>
        <RouterLink to="/">Reservar</RouterLink>
        <RouterLink to="/mi-turno">Mi turno</RouterLink>

        <template v-if="esAdmin()">
          <span class="separador"></span>
          <RouterLink to="/admin/turnos">Turnos</RouterLink>
          <RouterLink to="/admin">Canchas</RouterLink>
          <button class="salir" @click="salir">Cerrar sesión</button>
        </template>

        <template v-else>
          <span class="separador"></span>
          <RouterLink to="/login">Admin</RouterLink>
        </template>
      </nav>
    </aside>

    <div class="principal">
      <!-- Celular: barra de arriba -->
      <header class="barra-top">
        <p class="marca">LA<b>CONTRA</b></p>
      </header>

      <main>
        <RouterView />
      </main>
    </div>

    <!-- Celular: barra de abajo -->
    <nav class="barra-abajo">
      <RouterLink to="/">Reservar</RouterLink>
      <RouterLink to="/mi-turno">Mi turno</RouterLink>
      <RouterLink :to="destinoAdmin">Dueño</RouterLink>
    </nav>
  </div>
</template>