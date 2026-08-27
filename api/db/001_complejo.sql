CREATE TABLE complejos (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT     NOT NULL,
  apertura  SMALLINT NOT NULL CHECK (apertura BETWEEN 0 AND 23),
  cierre    SMALLINT NOT NULL CHECK (cierre BETWEEN 0 AND 23),
  CHECK (cierre >= apertura)
);

CREATE TABLE canchas (
  id           SERIAL PRIMARY KEY,
  complejo_id  INTEGER NOT NULL REFERENCES complejos(id) ON DELETE CASCADE,
  nombre       TEXT    NOT NULL,
  tipo         SMALLINT NOT NULL CHECK (tipo IN (5, 7))
);