# Corpus S3 — partituras MusicXML de referencia

Cinco extractos reales de obras en dominio público, todos tomados de los corpus abiertos de
**OpenScore** y redistribuidos aquí bajo **CC0 1.0 Universal** (`https://creativecommons.org/publicdomain/zero/1.0/`),
la licencia que declaran ambos repositorios de origen.

| Fichero | Obra | Composición | Clase | Qué ejercita |
|---|---|---|---|---|
| `schroeter-an-laura.musicxml` | *An Laura*, de *25 Lieder* | Corona Schröter (1751–1802) | `simple` | 8 compases, voz + piano, letra, sin elementos raros |
| `schubert-der-zwerg.musicxml` | *Der Zwerg*, D.771, Op. 22/1 | Franz Schubert (1797–1828) | `two-parts` | 40 compases de 300, textura sostenida con muchas ligaduras y alteraciones |
| `holmes-thrinodia.musicxml` | *Thrînôdia (Chants de la Kitharède, No. 3)* | Augusta Holmès (1847–1903) | `3-staves-pedal` | piano en **3 pentagramas** (manos separadas) con **8 marcas de pedal**; 16 compases de 82 |
| `stanford-windy-west.musicxml` | *Out in the windy West*, de *Choral Songs in Honour of Her Majesty Queen Victoria* (1899) | Charles Villiers Stanford (1852–1924) | `4-voices-lyrics` | **7 partes vocales** (S, S II, A, T I, T II, B I, B II) con letra bajo cada voz, más reducción de piano; 48 compases de 1408 |
| `mozart-k464-menuetto.musicxml` | *Menuetto and Trio*, Cuarteto de cuerda nº 18 en La mayor, K.464 | W. A. Mozart (1756–1791) | `4-parts-instrumental` | 4 partes de cuerda, polifonía sin texto, tresillos y articulación abundante; 32 compases de 104 |

Las cinco composiciones están en dominio público en EE. UU. y en la UE (todas se publicaron antes de
1930 y sus autores murieron hace más de 70 años). Lo que se licencia aquí es la **codificación**
MusicXML, que OpenScore libera como CC0.

## Procedencia exacta

Repositorio `https://github.com/OpenScore/Lieder` (CC0-1.0):

| Fichero destino | Ruta upstream (`.mxl`) |
|---|---|
| `schroeter-an-laura.musicxml` | `scores/Schröter,_Corona/25_Lieder/03_An_Laura/lc6019054.mxl` |
| `schubert-der-zwerg.musicxml` | `scores/Schubert,_Franz/Op.22/1_Der_Zwerg,_D.771/lc6838113.mxl` |
| `holmes-thrinodia.musicxml` | `scores/Holmès,_Augusta_Mary_Anne/Mélodies_pour_piano_et_chant/12_Thrînôdia/lc6005658.mxl` |
| `stanford-windy-west.musicxml` | `scores/Parratt,_Walter/Choral_Songs_in_Honour_of_Her_Majesty_Queen_Victoria/02_Out_in_the_windy_West/lc6681689.mxl` |

Repositorio `https://github.com/OpenScore/StringQuartets` (CC0-1.0):

| Fichero destino | Ruta upstream (`.mxl`) |
|---|---|
| `mozart-k464-menuetto.musicxml` | `scores/Mozart,_Wolfgang_Amadeus/String_Quartet_No.18_in_A_major,_K.464_(Op._10,_No._5)/sq7070781.mxl` |

Los `.mxl` son MusicXML comprimido. Cada fichero de este directorio es el `score.xml` interno del
`.mxl`, **recortado a los primeros N compases de cada parte** (ver la columna «Qué ejercita») y
reserializado con `xml.etree.ElementTree`, que elimina el `DOCTYPE` pero no toca notas, direcciones
ni atributos de presentación. No hay ninguna otra modificación: no se transponen voces, no se
añaden marcas y no se corrige la edición.

## Diferencia respecto al plan original

El plan de S3 pedía una clase `transposition` (partitura con instrumentos transpositores, p. ej. una
orquesta de jazz). **No hay fuente CC0 de eso**: OpenScore Lieder es voz + piano y OpenScore
StringQuartets son instrumentos no transpositores, de modo que no existe un fichero abierto con
licencia verificable para esa clase. En lugar de fabricar uno, la clase pasa a
`4-parts-instrumental`. La cobertura del *código* de transposición no se pierde:
`tests/perf.test.ts` transpone ±6 semitonos **las cinco** partituras, no solo una.

Tampoco se usó el corpus de `music21`, pese a tener las obras adecuadas: su
`corpus/license.txt` advierte que algunas codificaciones «may have restrictions on commercial use»,
lo que no permite documentarlas como dominio público verificado como exige
`docs/copyright-policy.md` §5.
