<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { esAdmin, guardarToken, pedirComoAdmin } from "./auth.js";

const router = useRouter();
const ruta = useRoute();
const nuevas = ref(0);
let reloj = null;

const destinoAdmin = computed(() => (esAdmin() ? "/admin/turnos" : "/login"));

/** El contador de la campanita. Se consulta cada 30 segundos. */
async function contarNuevas() {
  if (!esAdmin()) {
    nuevas.value = 0;
    return;
  }
  try {
    const r = await pedirComoAdmin("/api/notificaciones/nuevas");
    if (!r.ok) return;
    nuevas.value = (await r.json()).nuevas;
  } catch {
    /* sin conexión: dejamos el número anterior */
  }
}

function salir() {
  guardarToken("");
  nuevas.value = 0;
  router.push("/");
}

onMounted(() => {
  contarNuevas();
  reloj = setInterval(contarNuevas, 30000);
});

onUnmounted(() => clearInterval(reloj));

// Al navegar (por ejemplo, al entrar o salir del panel) se recuenta.
watch(() => ruta.path, contarNuevas);
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
          <RouterLink to="/admin/novedades">
            Novedades
            <span v-if="nuevas" class="globo">{{ nuevas }}</span>
          </RouterLink>
          <RouterLink to="/admin/turnos">Turnos</RouterLink>
          <RouterLink to="/admin">Canchas</RouterLink>
          <button class="salir" @click="salir">Cerrar sesión</button>
        </template>

        <template v-else>
          <span class="separador"></span>
          <RouterLink to="/login">Soy el dueño</RouterLink>
        </template>
      </nav>
    </aside>

    <div class="principal">
      <!-- Celular: barra de arriba, con la campanita -->
      <header class="barra-top">
        <p class="marca">LA<b>CONTRA</b></p>
        <RouterLink v-if="esAdmin()" to="/admin/novedades" class="campana">
          Novedades
          <span v-if="nuevas" class="globo">{{ nuevas }}</span>
        </RouterLink>
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