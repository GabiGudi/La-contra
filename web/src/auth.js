import { ref } from "vue";

export const token = ref(localStorage.getItem("token") || "");

export function guardarToken(nuevo) {
  token.value = nuevo;
  if (nuevo) localStorage.setItem("token", nuevo);
  else localStorage.removeItem("token");
}

export const esAdmin = () => Boolean(token.value);

/** fetch con el token puesto. Si el servidor lo rechaza, cierra la sesión. */
export async function pedirComoAdmin(url, opciones = {}) {
  const r = await fetch(url, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(opciones.headers || {}),
      Authorization: `Bearer ${token.value}`,
    },
  });

  if (r.status === 401) guardarToken("");
  return r;
}