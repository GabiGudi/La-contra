<script setup>
import { ref, onMounted } from "vue";

const complejo = ref(null);
const nuevaCancha = ref({ nombre: "", tipo: 5 });
const error = ref("");
const aviso = ref("");

const horas = Array.from({ length: 24 }, (_, h) => h);

async function cargar() {
  const r = await fetch("/api/complejo");
  complejo.value = await r.json();
}

async function guardarDatos() {
  error.value = "";
  const r = await fetch("/api/complejo", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: complejo.value.id,
      nombre: complejo.value.nombre,
      apertura: complejo.value.apertura,
      cierre: complejo.value.cierre,
    }),
  });
  const datos = await r.json();
  if (!r.ok) return (error.value = datos.error);
  aviso.value = "Datos guardados.";
  setTimeout(() => (aviso.value = ""), 3000);
}

async function agregarCancha() {
  error.value = "";
  const r = await fetch("/api/canchas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      complejoId: complejo.value.id,
      nombre: nuevaCancha.value.nombre,
      tipo: nuevaCancha.value.tipo,
    }),
  });
  const datos = await r.json();
  if (!r.ok) return (error.value = datos.error);
  nuevaCancha.value = { nombre: "", tipo: 5 };
  cargar();
}

async function eliminarCancha(id) {
  if (!confirm("¿Eliminar esta cancha?")) return;
  const r = await fetch(`/api/canchas/${id}`, { method: "DELETE" });
  if (!r.ok) {
    const datos = await r.json();
    return (error.value = datos.error);
  }
  cargar();
}

onMounted(cargar);
</script>

<template>
  <div v-if="complejo">
    <h2>Configuración del complejo</h2>

    <p v-if="error" style="color: #c00">{{ error }}</p>
    <p v-if="aviso" style="color: #080">{{ aviso }}</p>

    <label>
      Nombre
      <input v-model="complejo.nombre" maxlength="40" />
    </label>

    <label>
      Abre a las
      <select v-model.number="complejo.apertura">
        <option v-for="h in horas" :key="h" :value="h">{{ h }}:00</option>
      </select>
    </label>

    <label>
      Cierra a las
      <select v-model.number="complejo.cierre">
        <option v-for="h in horas" :key="h" :value="h">{{ h }}:00</option>
      </select>
    </label>

    <button @click="guardarDatos">Guardar datos</button>

    <h3>Canchas</h3>
    <ul>
      <li v-for="c in complejo.canchas" :key="c.id">
        {{ c.nombre }} — fútbol {{ c.tipo }}
        <button @click="eliminarCancha(c.id)">Eliminar</button>
      </li>
    </ul>
    <p v-if="!complejo.canchas.length">Todavía no cargaste ninguna cancha.</p>

    <h4>Agregar cancha</h4>
    <input v-model="nuevaCancha.nombre" placeholder="Cancha 2" maxlength="24" />
    <select v-model.number="nuevaCancha.tipo">
      <option :value="5">Fútbol 5</option>
      <option :value="7">Fútbol 7</option>
    </select>
    <button @click="agregarCancha">Agregar</button>
  </div>

  <p v-else>Cargando…</p>
</template>