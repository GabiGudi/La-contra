CREATE TABLE notificaciones (
  id        SERIAL PRIMARY KEY,
  tipo      TEXT NOT NULL CHECK (tipo IN ('reserva', 'contra', 'cancelacion', 'baja_contra')),
  texto     TEXT NOT NULL,
  -- Si el turno se borra, la notificación queda: es el registro de que
  -- eso pasó, y justamente las cancelaciones son las que más importan.
  turno_id  INTEGER REFERENCES turnos(id) ON DELETE SET NULL,
  leida     BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notificaciones_nuevas ON notificaciones (creado_en DESC) WHERE NOT leida;