<script setup>
import { ref, computed } from "vue";
 
const codigo = ref("");
const turno = ref(null);
const error = ref("");
const aviso = ref("");
 
const editando = ref(false);
const listaEditada = ref([]);
const nuevoJugador = ref("");
 
/** El equipo que me corresponde según el código con el que entré. */
const miEquipo = computed(() =>
  turno.value ? (turno.value.es_local ? turno.value.local : turno.value.visitante) : null
);
 
const yaEmpezo = computed(() => {
  if (!turno.value) return false;
  const inicio = new Date(`${turno.value.fecha}T${String(turno.value.hora).padStart(2, "0")}:00:00`);
  return inicio < new Date();
});
 
async function buscar() {
  error.value = "";
  aviso.value = "";
  turno.value = null;
  editando.value = false;
 
  const limpio = codigo.value.trim();
  if (!limpio) return;
 
  try {
    const r = await fetch(`/api/turnos/codigo/${limpio}`);
    const datos = await r.json();
    if (!r.ok) return (error.value = datos.error);
    turno.value = datos;
  } catch {
    error.value = "No pudimos conectarnos con el servidor.";
  }
}
 
function empezarAEditar() {
  listaEditada.value = [...miEquipo.value.jugadores];
  nuevoJugador.value = "";
  editando.value = true;
  error.value = "";
}
 
function agregar() {
  const nombre = nuevoJugador.value.trim();
  if (!nombre) return;
  if (listaEditada.value.length >= turno.value.tipo) return;
  listaEditada.value.push(nombre);
  nuevoJugador.value = "";
}
 
const quitar = (i) => listaEditada.value.splice(i, 1);
 
async function guardarJugadores() {
  error.value = "";
  try {
    const r = await fetch(`/api/turnos/codigo/${codigo.value.trim()}/jugadores`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jugadores: listaEditada.value }),
    });
    const datos = await r.json();
    if (!r.ok) return (error.value = datos.error);
 
    editando.value = false;
    aviso.value = "Jugadores actualizados.";
    buscar();
  } catch {
    error.value = "No pudimos conectarnos con el servidor.";
  }
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
 
  <div v-if="turno" class="tarjeta">
    <h3>{{ turno.fecha }} a las {{ turno.hora }}:00</h3>
    <p>{{ turno.cancha }} (fútbol {{ turno.tipo }})</p>
    <p>Sos el equipo <strong>{{ turno.es_local ? "local" : "visitante" }}</strong>.</p>
 
    <!-- Mi equipo, con edición de la lista -->
    <h4>{{ miEquipo.nombre }} <span class="busca">{{ miEquipo.jugadores.length }}/{{ turno.tipo }}</span></h4>
 
    <template v-if="!editando">
      <ol>
        <li v-for="(j, i) in miEquipo.jugadores" :key="i">{{ j }}</li>
      </ol>
      <button v-if="!yaEmpezo" class="hueco" @click="empezarAEditar">Editar jugadores</button>
      <p v-else class="cx-nota">El turno ya empezó: la lista quedó cerrada.</p>
    </template>
 
    <template v-else>
      <ol>
        <li v-for="(j, i) in listaEditada" :key="i">
          {{ j }}
          <button class="chico" @click="quitar(i)">quitar</button>
        </li>
      </ol>
 
      <input
        v-model="nuevoJugador"
        @keydown.enter.prevent="agregar"
        placeholder="Nombre del jugador"
        maxlength="30"
        :disabled="listaEditada.length >= turno.tipo"
      />
      <button @click="agregar" :disabled="listaEditada.length >= turno.tipo">Agregar jugador</button>
      <p v-if="listaEditada.length >= turno.tipo" class="cx-nota">Equipo completo.</p>
 
      <div>
        <button @click="guardarJugadores">Guardar cambios</button>
        <button class="hueco" @click="editando = false">Descartar</button>
      </div>
    </template>
 
    <!-- El equipo rival, solo para mirar -->
    <template v-if="turno.es_local && turno.visitante">
      <h4>{{ turno.visitante.nombre }}</h4>
      <ol>
        <li v-for="(j, i) in turno.visitante.jugadores" :key="i">{{ j }}</li>
      </ol>
      <p v-if="turno.visitante.contacto">Contacto: {{ turno.visitante.contacto }}</p>
    </template>
 
    <template v-else-if="!turno.es_local">
      <h4>{{ turno.local.nombre }}</h4>
      <ol>
        <li v-for="(j, i) in turno.local.jugadores" :key="i">{{ j }}</li>
      </ol>
      <p v-if="turno.local.contacto">Contacto: {{ turno.local.contacto }}</p>
    </template>
 
    <p v-else><em>Todavía sin contra.</em></p>
 
    <button class="peligro" @click="cancelar">
      {{ turno.es_local ? "Cancelar turno" : "Bajarme del partido" }}
    </button>
  </div>
</template>
 