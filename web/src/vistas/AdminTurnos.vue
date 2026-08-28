<script setup>
import { ref, onMounted } from "vue";
import { pedirComoAdmin } from "../auth.js";

const turnos = ref([]);
const filtro = ref("todos");
const soloProximos = ref(true);
const dia = ref("");
const error = ref("");

/** Fecha local en AAAA-MM-DD. Nunca toISOString: eso devuelve UTC. */
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function cargar() {
  error.value = "";
  const params = new URLSearchParams();

  if (filtro.value !== "todos") params.set("estado", filtro.value);

  if (dia.value) {
    // Un día puntual gana sobre "solo próximos"
    params.set("desde", dia.value);
    params.set("hasta", dia.value);
  } else if (soloProximos.value) {
    params.set("desde", hoy());
  }

  const r = await pedirComoAdmin(`/api/turnos/admin?${params}`);
  if (!r.ok) return (error.value = "No se pudieron cargar los turnos.");
  turnos.value = await r.json();
}

async function eliminar(turno) {
  if (!confirm(`¿Eliminar el turno de ${turno.local.nombre} del ${turno.fecha} a las ${turno.hora}:00?`)) return;

  const r = await pedirComoAdmin(`/api/turnos/${turno.id}`, { method: "DELETE" });
  if (!r.ok) {
    const datos = await r.json();
    return (error.value = datos.error);
  }
  cargar();
}

function cambiarFiltro(valor) {
  filtro.value = valor;
  cargar();
}

function alternarProximos() {
  soloProximos.value = !soloProximos.value;
  cargar();
}

function cambiarDia(valor) {
  dia.value = valor;
  cargar();
}

onMounted(cargar);
</script>

<template>
  <h2>Turnos</h2>

  <p v-if="error" class="error">{{ error }}</p>

  <div class="filtros">
    <button @click="cambiarFiltro('todos')" :disabled="filtro === 'todos'">Todos</button>
    <button @click="cambiarFiltro('esperando')" :disabled="filtro === 'esperando'">Esperando contra</button>
    <button @click="cambiarFiltro('confirmado')" :disabled="filtro === 'confirmado'">Con contra</button>
  </div>

  <div class="filtros">
    <label>
      Día
      <input type="date" :value="dia" @change="cambiarDia($event.target.value)" />
    </label>
    <button v-if="dia" class="hueco" @click="cambiarDia('')">Ver todos los días</button>
    <label v-else>
      <input type="checkbox" :checked="soloProximos" @change="alternarProximos" />
      Solo próximos
    </label>
  </div>

  <p>{{ turnos.length }} turno(s).</p>

  <div class="tabla">
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Hora</th>
          <th>Cancha</th>
          <th>Local</th>
          <th>Visitante</th>
          <th>Estado</th>
          <th>Contacto</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in turnos" :key="t.id">
          <td>{{ t.fecha }}</td>
          <td>{{ t.hora }}:00</td>
          <td>{{ t.cancha }} (F{{ t.tipo }})</td>
          <td>{{ t.local.nombre }} ({{ t.local.jugadores.length }}/{{ t.tipo }})</td>
          <td>
            <template v-if="t.visitante">
              {{ t.visitante.nombre }} ({{ t.visitante.jugadores.length }}/{{ t.tipo }})
            </template>
            <span v-else class="busca">busca contra</span>
          </td>
          <td>
            <span :class="t.estado === 'esperando' ? 'busca' : 'armado'">{{ t.estado }}</span>
          </td>
          <td>{{ t.local.contacto }}</td>
          <td><button class="peligro" @click="eliminar(t)">Eliminar</button></td>
        </tr>
      </tbody>
    </table>
  </div>

  <p v-if="!turnos.length">No hay turnos con ese filtro.</p>
</template>