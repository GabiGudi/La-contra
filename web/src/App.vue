<script setup>
import { ref } from "vue";
</script>

<template>
  <header>
    <h1>La Contra</h1>
    <nav>
      <RouterLink to="/">Reservar</RouterLink> |
      <RouterLink to="/mi-turno">Mi turno</RouterLink> |
      <RouterLink to="/admin">Admin</RouterLink>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>
