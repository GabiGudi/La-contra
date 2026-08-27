<script setup>
import { ref, onMounted } from "vue";

const turnos = ref([]);
const filtro = ref("todos");
const soloProximos = ref(true);
const error = ref("");

const hoy = () => new Date().toISOString().slice(0, 10);

async function cargar() {
  const params = new URLSearchParams();
  if (filtro.value !== "todos") params.set("estado", filtro.value);
  if (soloProximos.value) params.set("desde", hoy());

  const r = await fetch(`/api/turnos/admin?${params}`);
  turnos.value = await r.json();
}

async function eliminar(turno) {
  if (!confirm(`¿Eliminar el turno de ${turno.local.nombre} del ${turno.fecha} a las ${turno.hora}:00?`)) return;

  const r = await fetch(`/api/turnos/${turno.id}`, { method: "DELETE" });
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

onMounted(cargar);
</script>

<template>
  <h2>Turnos</h2>

  <p v-if="error" class="error">{{ error }}</p>

  <div class="filtros">
    <button @click="cambiarFiltro('todos')" :disabled="filtro === 'todos'">Todos</button>
    <button @click="cambiarFiltro('esperando')" :disabled="filtro === 'esperando'">Esperando contra</button>
    <button @click="cambiarFiltro('confirmado')" :disabled="filtro === 'confirmado'">Con contra</button>
    <label>
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
              <em v-else>busca contra</em>
            </td>
            <td>{{ t.estado }}</td>
            <td>{{ t.local.contacto }}</td>
            <td><button class="peligro" @click="eliminar(t)">Eliminar</button></td>
          </tr>
        </tbody>
      </table>
    </div>

  <p v-if="!turnos.length">No hay turnos con ese filtro.</p>
</template>