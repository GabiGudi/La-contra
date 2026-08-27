<script setup>
import { ref } from "vue";

const codigo = ref("");
const turno = ref(null);
const error = ref("");
const aviso = ref("");

async function buscar() {
  error.value = "";
  aviso.value = "";
  turno.value = null;

  const limpio = codigo.value.trim();
  if (!limpio) return;

  const r = await fetch(`/api/turnos/codigo/${limpio}`);
  const datos = await r.json();

  if (!r.ok) return (error.value = datos.error);
  turno.value = datos;
}

async function cancelar() {
  const queSeVa = turno.value.es_local
    ? "Se cancela el turno completo y la cancha queda libre."
    : "Te bajás como contra. El turno sigue en pie buscando otro rival.";

  if (!confirm(`${queSeVa}\n\n¿Confirmás?`)) return;

  error.value = "";
  const r = await fetch(`/api/turnos/codigo/${codigo.value.trim()}`, { method: "DELETE" });
  const datos = await r.json();

  if (!r.ok) return (error.value = datos.error);

  turno.value = null;
  aviso.value = datos.cancelado === "turno" ? "Turno cancelado." : "Te bajaste del partido.";
}
</script>

<template>
  <h2>Mi turno</h2>
  <p>Poné el código de 4 dígitos que te dimos al reservar o al anotarte de contra.</p>

  <input v-model="codigo" @keydown.enter="buscar" placeholder="1234" maxlength="4" />
  <button @click="buscar">Buscar</button>

  <p v-if="error" class="error">{{ error }}</p>
  <p v-if="aviso" class="aviso">{{ aviso }}</p>

  <div v-if="turno">
    <h3>{{ turno.fecha }} a las {{ turno.hora }}:00</h3>
    <p>{{ turno.cancha }} (fútbol {{ turno.tipo }})</p>
    <p>Sos el equipo <strong>{{ turno.es_local ? "local" : "visitante" }}</strong>.</p>

    <div>
      <h4>{{ turno.local.nombre }}</h4>
      <ol>
        <li v-for="(j, i) in turno.local.jugadores" :key="i">{{ j }}</li>
      </ol>
    </div>

    <div v-if="turno.visitante">
      <h4>{{ turno.visitante.nombre }}</h4>
      <ol>
        <li v-for="(j, i) in turno.visitante.jugadores" :key="i">{{ j }}</li>
      </ol>
    </div>
    <p v-else><em>Todavía sin contra.</em></p>

    <button class="peligro" @click="cancelar">
      {{ turno.es_local ? "Cancelar turno" : "Bajarme del partido" }}
    </button>
  </div>
</template>