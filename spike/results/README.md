# Resultados del spike — estado de la línea de base

`spike-consolidated-report.md` lo genera `spike/generate_report.sh` (por defecto escribe en este
directorio). Es un artefacto generado: se regenera, no se edita a mano.

## Qué dice y qué no

Los tres spikes aparecen **PENDING a propósito**. Ausencia de medidas no es un PASS, y el generador
solo sabe convertir a veredicto lo que encuentra en CSV:

- **S1** — no hay ningún `audio-core-latency-*.csv` (0/4 plataformas). `spike/audio-core/` solo trae
  targets de dispositivo (iOS/Android/macOS/Windows); esta máquina es Linux y no puede producirlos.
  Además el parseo de `audio-interruptions-*.csv` importa `pandas`, que no está instalado.
- **S2** — el veredicto está fijado por un `sed` incondicional, así que seguiría PENDING aunque
  llegaran los CSV. Descubrimiento, heartbeat y failover sí se ejecutaron en loopback: 6/6 pares
  descubiertos, 150/100 filas de heartbeat, 143 filas por esclavo con relevo al matar al maestro
  (los `discovery_node*.log` locales, que `*.log` deja fuera del repo, y L4/L9 de
  `odd/tasks/spike-suite-modular.md`). Falta roaming real
  (2 APs + 3 dispositivos) y netem (root), que este entorno no tiene.
- **S3** — también está marcado PENDING por el generador, pero **sí está medido**: `corpus-load` 2/2,
  `perf` 3/3, `stress` 3/3 y `visual-parity` 2/2 = **10/10**. Los números y comandos están en L6–L9
  del registro ODD. El único criterio S3 que no se cumple es el **tamaño del wasm: 4,04 MB gzip
  frente al objetivo <3 MB** (el build usa `SINGLE_FILE=1`), así que el veredicto honesto de S3 es
  FAIL por tamaño, no PASS.

En resumen: la línea de base es correcta como línea de base, y no es el acta de cierre de G2. El
acta necesita los CSV de S1/S2 y una decisión sobre el tamaño del wasm de S3.

Los datos crudos que existan van en este directorio junto al informe; el generador toma
`audio-core-latency-<plataforma>.csv` y `audio-interruptions-<plataforma>.csv` de aquí.
