<script setup>
import { ref, onMounted } from "vue";
import { pedirComoAdmin } from "../auth.js";

const lista = ref([]);
const nuevas = ref(0);
const error = ref("");

const etiquetas = {
  reserva: "Reserva",
  contra: "Contra",
  cancelacion: "Cancelación",
  baja_contra: "Se bajó",
};

/** "hace 5 min", "hace 2 h", o la fecha si ya es viejo. */
function hace(iso) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 1440) return `hace ${Math.floor(minutos / 60)} h`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "numeric" });
}

async function cargar() {
  error.value = "";
  try {
    const r = await pedirComoAdmin("/api/notificaciones");
    if (!r.ok) return (error.value = "No se pudieron cargar las novedades.");
    const datos = await r.json();
    lista.value = datos.lista;
    nuevas.value = datos.nuevas;
  } catch {
    error.value = "No pudimos conectarnos con el servidor.";
  }
}

async function marcarLeidas() {
  await pedirComoAdmin("/api/notificaciones/leidas", { method: "POST" });
  cargar();
}

async function limpiar() {
  if (!confirm("¿Borrar todo el historial de novedades?")) return;
  await pedirComoAdmin("/api/notificaciones", { method: "DELETE" });
  cargar();
}

onMounted(cargar);
</script>

<template>
  <h2>Novedades</h2>
  <p v-if="error" class="error">{{ error }}</p>

  <div class="filtros">
    <button class="hueco" @click="cargar">Actualizar</button>
    <button v-if="nuevas" @click="marcarLeidas">Marcar como leídas ({{ nuevas }})</button>
    <button v-if="lista.length" class="peligro" @click="limpiar">Limpiar historial</button>
  </div>

  <p v-if="!lista.length">Todavía no hay movimientos.</p>

  <ul>
    <li v-for="n in lista" :key="n.id" :class="{ nueva: !n.leida }">
      <div>
        <span :class="n.tipo === 'reserva' || n.tipo === 'contra' ? 'armado' : 'busca'">
          {{ etiquetas[n.tipo] }}
        </span>
        <p class="texto">{{ n.texto }}</p>
        <span class="cx-nota">{{ hace(n.creado_en) }}</span>
      </div>
    </li>
  </ul>
</template>