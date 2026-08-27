<script setup>
import { esAdmin, guardarToken } from "./auth.js";
import { useRouter } from "vue-router";

const router = useRouter();

function salir() {
  guardarToken("");
  router.push("/");
}
</script>

<template>
  <header>
    <h1>La Contra</h1>
    <nav>
      <RouterLink to="/">Reservar</RouterLink> |
      <RouterLink to="/mi-turno">Mi turno</RouterLink>
      <template v-if="esAdmin()">
        | <RouterLink to="/admin">Config</RouterLink> |
        <RouterLink to="/admin/turnos">Turnos</RouterLink> |
        <button @click="salir">Salir</button>
      </template>
      <template v-else> | <RouterLink to="/login">Admin</RouterLink></template>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>
