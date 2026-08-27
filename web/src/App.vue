<script setup>
import { ref } from "vue";

const respuesta = ref("");

async function probar() {
  const r = await fetch("/api/ping");
  const datos = await r.json();
  respuesta.value = datos.mensaje;
}
</script>

<template>
  <main>
    <h1>La Contra</h1>
    <button @click="probar">Probar conexión</button>
    <p>{{ respuesta }}</p>
  </main>
</template>
