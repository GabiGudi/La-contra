<script setup>
import { ref } from "vue";

const props = defineProps({
  titulo: String,
  modelValue: Object,
  cupo: { type: Number, default: 0 },
  pedirContacto: { type: Boolean, default: true },
});
const emit = defineEmits(["update:modelValue"]);

const nuevoJugador = ref("");

function cambiar(campo, valor) {
  emit("update:modelValue", { ...props.modelValue, [campo]: valor });
}

function agregarJugador() {
  if (props.cupo && props.modelValue.jugadores.length >= props.cupo) return;
  const nombre = nuevoJugador.value.trim();
  if (!nombre) return;
  cambiar("jugadores", [...props.modelValue.jugadores, nombre]);
  nuevoJugador.value = "";
}

function quitarJugador(indice) {
  cambiar("jugadores", props.modelValue.jugadores.filter((_, i) => i !== indice));
}
</script>

<template>
  <fieldset>
    <legend>{{ titulo }}</legend>

    <label>
      Nombre del equipo
      <input :value="modelValue.nombre" @input="cambiar('nombre', $event.target.value)" maxlength="40" />
    </label>

    <label v-if="pedirContacto">
      Teléfono
      <input :value="modelValue.contacto" @input="cambiar('contacto', $event.target.value)" maxlength="30" />
    </label>

    <p>Jugadores ({{ modelValue.jugadores.length }}/{{ cupo }})</p>
    <ol>
      <li v-for="(j, i) in modelValue.jugadores" :key="i">
        {{ j }} <button type="button" @click="quitarJugador(i)">quitar</button>
      </li>
    </ol>

    <input
      v-model="nuevoJugador"
      @keydown.enter.prevent="agregarJugador"
      placeholder="Nombre del jugador"
      :disabled="cupo && modelValue.jugadores.length >= cupo"
    />
    <button type="button" @click="agregarJugador" :disabled="cupo && modelValue.jugadores.length >= cupo">
      Agregar jugador
    </button>
    <p v-if="cupo && modelValue.jugadores.length >= cupo">Equipo completo.</p>
  </fieldset>
</template>