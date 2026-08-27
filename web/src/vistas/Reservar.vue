<script setup>
import { ref, computed, onMounted } from "vue";
import EditorEquipo from "../componentes/EditorEquipo.vue";

const complejo = ref(null);
const turnos = ref([]);
const error = ref("");
const codigoNuevo = ref("");

const seleccion = ref(null); // { canchaId, hora }
const buscaContra = ref(true);
const local = ref({ nombre: "", contacto: "", jugadores: [] });
const visitante = ref({ nombre: "", contacto: "", jugadores: [] });

// Próximos 14 días
const dias = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});
const fechaSel = ref(dias[0]);

const horarios = computed(() => {
  if (!complejo.value) return [];
  const salida = [];
  for (let h = complejo.value.apertura; h <= complejo.value.cierre; h++) salida.push(h);
  return salida;
});

const cupoDeCancha = computed(() => {
  const c = complejo.value?.canchas.find((x) => x.id === seleccion.value?.canchaId);
  return c ? c.tipo : 0;
});

const turnoEn = (canchaId, hora) =>
  turnos.value.find((t) => t.cancha_id === canchaId && t.fecha === fechaSel.value && t.hora === hora);

const yaPaso = (hora) => new Date(`${fechaSel.value}T${String(hora).padStart(2, "0")}:00:00`) < new Date();

async function cargar() {
  const [rc, rt] = await Promise.all([
    fetch("/api/complejo"),
    fetch(`/api/turnos?desde=${dias[0]}&hasta=${dias.at(-1)}`),
  ]);
  complejo.value = await rc.json();
  turnos.value = await rt.json();
}

function abrirFormulario(canchaId, hora) {
  seleccion.value = { canchaId, hora };
  buscaContra.value = true;
  local.value = { nombre: "", contacto: "", jugadores: [] };
  visitante.value = { nombre: "", contacto: "", jugadores: [] };
  error.value = "";
  codigoNuevo.value = "";
}

async function guardar() {
  error.value = "";
  const cuerpo = {
    canchaId: seleccion.value.canchaId,
    fecha: fechaSel.value,
    hora: seleccion.value.hora,
    equipoLocal: local.value,
  };
  if (!buscaContra.value) cuerpo.equipoVisitante = visitante.value;

  const r = await fetch("/api/turnos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const datos = await r.json();

  if (!r.ok) return (error.value = datos.error);

  codigoNuevo.value = datos.codigo;
  seleccion.value = null;
  cargar();
}

onMounted(cargar);
</script>

<template>
  <div v-if="complejo">
    <h2>Reservar turno</h2>

    <label>
      Día
      <select v-model="fechaSel">
        <option v-for="d in dias" :key="d" :value="d">{{ d }}</option>
      </select>
    </label>

    <p v-if="codigoNuevo">
      <strong>¡Turno guardado! Tu código es {{ codigoNuevo }}</strong><br />
      Anotalo: con ese código vas a poder ver y cancelar tu turno.
    </p>

    <table border="1" cellpadding="6">
      <thead>
        <tr>
          <th>Hora</th>
          <th v-for="c in complejo.canchas" :key="c.id">{{ c.nombre }} (F{{ c.tipo }})</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="h in horarios" :key="h">
          <td>{{ h }}:00</td>
          <td v-for="c in complejo.canchas" :key="c.id">
            <template v-if="turnoEn(c.id, h)">
              {{ turnoEn(c.id, h).local.nombre }}
              <template v-if="turnoEn(c.id, h).visitante">
                vs {{ turnoEn(c.id, h).visitante.nombre }}
              </template>
              <em v-else>(busca contra)</em>
            </template>
            <span v-else-if="yaPaso(h)">—</span>
            <button v-else @click="abrirFormulario(c.id, h)">Reservar</button>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="!complejo.canchas.length">El complejo todavía no publicó canchas.</p>

    <div v-if="seleccion">
      <h3>Reservar {{ fechaSel }} a las {{ seleccion.hora }}:00</h3>

      <label>
        <input type="radio" :value="true" v-model="buscaContra" /> Busco contra
      </label>
      <label>
        <input type="radio" :value="false" v-model="buscaContra" /> Ya tengo contra
      </label>

      <EditorEquipo titulo="Mi equipo" v-model="local" :cupo="cupoDeCancha" />
      <EditorEquipo
        v-if="!buscaContra"
        titulo="Equipo rival"
        v-model="visitante"
        :cupo="cupoDeCancha"
        :pedir-contacto="false"
      />

      <p v-if="error" style="color: #c00">{{ error }}</p>

      <button @click="guardar">Guardar turno</button>
      <button @click="seleccion = null">Cancelar</button>
    </div>
  </div>

  <p v-else>Cargando…</p>
</template>