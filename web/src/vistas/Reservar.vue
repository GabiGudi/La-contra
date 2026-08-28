<script setup>
import { ref, computed, onMounted } from "vue";
import EditorEquipo from "../componentes/EditorEquipo.vue";

const complejo = ref(null);
const turnos = ref([]);
const error = ref("");
const codigoNuevo = ref("");
const fallo = ref(false);

const canchaSel = ref(null);
const seleccion = ref(null);
const buscaContra = ref(true);
const local = ref({ nombre: "", contacto: "", jugadores: [] });
const visitante = ref({ nombre: "", contacto: "", jugadores: [] });

const anotandose = ref(null);
const equipoContra = ref({ nombre: "", contacto: "", jugadores: [] });

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

const cupoDeCancha = computed(() => canchaSel.value?.tipo || 0);

const yaPaso = (hora) => new Date(`${fechaSel.value}T${String(hora).padStart(2, "0")}:00:00`) < new Date();

const turnoEn = (canchaId, hora) =>
  turnos.value.find((t) => t.cancha_id === canchaId && t.fecha === fechaSel.value && t.hora === hora);

const libresDe = (canchaId) => horarios.value.filter((h) => !turnoEn(canchaId, h) && !yaPaso(h));

const contrasDe = (canchaId) =>
  horarios.value
    .map((h) => turnoEn(canchaId, h))
    .filter((t) => t && t.estado === "esperando" && !yaPaso(t.hora));

const libresEnCancha = computed(() => (canchaSel.value ? libresDe(canchaSel.value.id) : []));
const contrasEnCancha = computed(() => (canchaSel.value ? contrasDe(canchaSel.value.id) : []));

async function cargar() {
  fallo.value = false;
  try {
    const [rc, rt] = await Promise.all([
      fetch("/api/complejo"),
      fetch(`/api/turnos?desde=${dias[0]}&hasta=${dias.at(-1)}`),
    ]);
    if (!rc.ok || !rt.ok) throw new Error("respuesta con error");
    complejo.value = await rc.json();
    turnos.value = await rt.json();
  } catch {
    fallo.value = true;
  }
}

function elegirCancha(cancha) {
  canchaSel.value = cancha;
  cerrarFormularios();
}

function volver() {
  canchaSel.value = null;
  cerrarFormularios();
}

function cerrarFormularios() {
  seleccion.value = null;
  anotandose.value = null;
  error.value = "";
}

function abrirFormulario(hora) {
  seleccion.value = { canchaId: canchaSel.value.id, hora };
  anotandose.value = null;
  buscaContra.value = true;
  local.value = { nombre: "", contacto: "", jugadores: [] };
  visitante.value = { nombre: "", contacto: "", jugadores: [] };
  error.value = "";
  codigoNuevo.value = "";
}

function abrirContra(turno) {
  anotandose.value = turno;
  seleccion.value = null;
  equipoContra.value = { nombre: "", contacto: "", jugadores: [] };
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

async function anotarseDeContra() {
  error.value = "";
  const r = await fetch(`/api/turnos/${anotandose.value.id}/contra`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ equipo: equipoContra.value }),
  });
  const datos = await r.json();

  if (!r.ok) return (error.value = datos.error);

  codigoNuevo.value = datos.codigo;
  anotandose.value = null;
  cargar();
}

onMounted(cargar);
</script>

<template>
  <div v-if="complejo">
    <h2>Reservar turno</h2>

    <label>
      Día
      <select v-model="fechaSel" @change="cerrarFormularios">
        <option v-for="d in dias" :key="d" :value="d">{{ d }}</option>
      </select>
    </label>

    <p v-if="codigoNuevo" class="codigo">
      <strong>{{ codigoNuevo }}</strong>
      Guardá este código: con él vas a poder ver y cancelar tu turno.
    </p>

    <!-- Paso 1: elegir cancha -->
    <template v-if="!canchaSel">
      <p v-if="!complejo.canchas.length">El complejo todavía no publicó canchas.</p>

      <ul>
        <li v-for="c in complejo.canchas" :key="c.id">
          <span>
            {{ c.nombre }} · fútbol {{ c.tipo }}<br />
            <span v-if="libresDe(c.id).length" class="armado">{{ libresDe(c.id).length }} libre(s)</span>
            <span v-else class="busca">Sin turnos</span>
            <span v-if="contrasDe(c.id).length" class="busca">
              {{ contrasDe(c.id).length }} busca(n) contra
            </span>
          </span>
          <button @click="elegirCancha(c)">Ver turnos</button>
        </li>
      </ul>
    </template>

    <!-- Paso 2: turnos de esa cancha -->
    <template v-else>
      <button class="hueco" @click="volver">← Todas las canchas</button>

      <h3>{{ canchaSel.nombre }} · fútbol {{ canchaSel.tipo }}</h3>

      <template v-if="libresEnCancha.length">
        <h4>Turnos libres</h4>
        <div class="horarios">
          <button v-for="h in libresEnCancha" :key="h" @click="abrirFormulario(h)">{{ h }}:00</button>
        </div>
      </template>

      <p v-else-if="!contrasEnCancha.length">
        <strong>No hay más turnos en esta cancha.</strong> Probá con otro día u otra cancha.
      </p>

      <template v-if="contrasEnCancha.length">
        <h4>Buscan contra</h4>
        <ul>
          <li v-for="t in contrasEnCancha" :key="t.id" class="anotado">
            <div>
              <strong>{{ t.hora }}:00 · {{ t.local.nombre }}</strong>
              <span class="busca">{{ t.local.jugadores.length }}/{{ canchaSel.tipo }} jugadores</span>
              <ol class="equipo-lista">
                <li v-for="(j, i) in t.local.jugadores" :key="i">{{ j }}</li>
              </ol>
            </div>
            <button @click="abrirContra(t)">Anotarme</button>
          </li>
        </ul>
      </template>

      <!-- Reservar un horario libre -->
      <div v-if="seleccion" class="tarjeta">
        <h3>Reservar {{ fechaSel }} a las {{ seleccion.hora }}:00</h3>

        <label><input type="radio" :value="true" v-model="buscaContra" /> Busco contra</label>
        <label><input type="radio" :value="false" v-model="buscaContra" /> Ya tengo contra</label>

        <EditorEquipo titulo="Mi equipo" v-model="local" :cupo="cupoDeCancha" />
        <EditorEquipo
          v-if="!buscaContra"
          titulo="Equipo rival"
          v-model="visitante"
          :cupo="cupoDeCancha"
          :pedir-contacto="false"
        />

        <p v-if="error" class="error">{{ error }}</p>

        <button @click="guardar">Guardar turno</button>
        <button class="hueco" @click="seleccion = null">Cancelar</button>
      </div>

      <!-- Anotarse de contra -->
      <div v-if="anotandose" class="tarjeta">
        <h3>Jugar contra {{ anotandose.local.nombre }}</h3>
        <p>
          {{ fechaSel }} a las {{ anotandose.hora }}:00 ·
          {{ anotandose.local.jugadores.length }} jugadores anotados
        </p>
        <ol class="equipo-lista">
          <li v-for="(j, i) in anotandose.local.jugadores" :key="i">{{ j }}</li>
        </ol>
        <p class="cx-nota">Cuando te anotes vas a ver su teléfono en "Mi turno", con tu código.</p>

        <EditorEquipo titulo="Mi equipo" v-model="equipoContra" :cupo="cupoDeCancha" />

        <p v-if="error" class="error">{{ error }}</p>

        <button @click="anotarseDeContra">Confirmar</button>
        <button class="hueco" @click="anotandose = null">Cancelar</button>
      </div>
    </template>
  </div>

  <p v-else-if="fallo" class="error">
    No pudimos conectarnos con el servidor.
    <button class="hueco" @click="cargar">Reintentar</button>
  </p>
  <p v-else>Cargando…</p>
</template>