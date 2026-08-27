CREATE TABLE turnos (
  id         SERIAL PRIMARY KEY,
  cancha_id  INTEGER  NOT NULL REFERENCES canchas(id) ON DELETE RESTRICT,
  fecha      DATE     NOT NULL,
  hora       SMALLINT NOT NULL CHECK (hora BETWEEN 0 AND 23),
  estado     TEXT     NOT NULL CHECK (estado IN ('esperando', 'confirmado')),
  codigo     CHAR(4)  NOT NULL UNIQUE,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT turno_unico UNIQUE (cancha_id, fecha, hora)
);

CREATE TABLE equipos (
  id        SERIAL PRIMARY KEY,
  turno_id  INTEGER NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
  rol       TEXT    NOT NULL CHECK (rol IN ('local', 'visitante')),
  nombre    TEXT    NOT NULL,
  contacto  TEXT    NOT NULL DEFAULT '',

  CONSTRAINT un_equipo_por_rol UNIQUE (turno_id, rol)
);

CREATE TABLE jugadores (
  id        SERIAL PRIMARY KEY,
  equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  nombre    TEXT    NOT NULL
);