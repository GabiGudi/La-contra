<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { guardarToken } from "../auth.js";

const clave = ref("");
const error = ref("");
const router = useRouter();

async function entrar() {
  error.value = "";
  const r = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clave: clave.value }),
  });
  const datos = await r.json();

  if (!r.ok) return (error.value = datos.error);

  guardarToken(datos.token);
  router.push("/admin");
}
</script>

<template>
  <h2>Entrar como administrador</h2>
  <input type="password" v-model="clave" @keydown.enter="entrar" placeholder="Clave" />
  <button @click="entrar">Entrar</button>
  <p v-if="error" style="color: #c00">{{ error }}</p>
</template>