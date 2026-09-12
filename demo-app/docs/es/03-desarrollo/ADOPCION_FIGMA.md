# Adoptar la referencia de Figma: topbar, breadcrumb, encabezado-pregunta

Fase 0 (extracción) y Fase 1 (propuesta) para la reestructuración más grande
que se ha pedido en este proyecto: una capa de topbar nueva, breadcrumbs, un
banner informativo, y el lenguaje visual de la referencia aplicado a las
cuatro secciones.

**Nada de esto está implementado.** Este es el documento que se aprueba o se
rechaza primero — el mismo contrato bajo el que corrió
`ADOPCION_LENGUAJE_VISUAL.md`, y por la misma razón: la reestructuración del
riel en CP3 rompió el presupuesto de layout en varias pantallas a la vez y
costó una sesión completa de correcciones. Este documento existe para que ese
riesgo se cotice antes de que se mueva una línea de código.

Dos insumos, de calidad distinta, y no se tratan igual:

- **El topbar** tiene una especificación autoritativa, generada desde Figma,
  entregada en la solicitud. Sus valores se usan literales donde sobreviven a
  la revisión, y cada lugar donde no, se nombra abajo con la medición que lo
  descartó.
- **Todo lo demás** es una captura rasterizada de una sola pantalla (Agentes).
  Sus valores se **muestrearon del PNG**, no se estimaron a ojo — lecturas
  exactas de píxel y conteos de color dominante por región — y cada color se
  verificó luego por contraste en vez de darse por bueno.

---

# Fase 0 — Qué es realmente la referencia

## 0.1 Una pantalla, y tres cosas que ya son ciertas

La referencia cubre solo Agentes. Antes de diseñar nada, se comprobaron contra
el código tres afirmaciones de la solicitud, porque la solicitud pedía
comprobarlas en vez de asumirlas. Las tres resultaron distintas de lo que la
solicitud suponía, y cada una **reduce** el trabajo:

| La solicitud suponía | Lo que es cierto | Efecto |
|---|---|---|
| El detalle del agente "probablemente es un diálogo/modal" | **Ya es un split view.** `AgentsView.tsx` renderiza un `AgentsList` de 300px junto a un panel de detalle `flex-1` con un `role="tablist"` de Resumen / Versiones / Ejecutar, siempre visible. Los únicos diálogos son `CreateAgentDialog` y `DeleteAgentDialog` — acciones de crear y borrar, no el detalle. | El ítem estructural más grande de la solicitud **no hay que construirlo**. Agentes ya tiene la arquitectura de la referencia; lo que cambia es el estilo. |
| Los encabezados en forma de pregunta son un patrón nuevo | **Son la estructura existente y obligada.** `StopFrame` recibe `title` y `question` como props obligatorias sin valor por defecto, deliberadamente: *"una superficie que necesita una segunda pregunta es una segunda pantalla, y aquí no hay forma de expresarlo."* Cada pantalla ya renderiza una pregunta. | El "propone la pregunta de cada sección" de la Fase 1 ya está contestado por el código. Las cuatro secciones ya las tienen. |
| El breadcrumb es una capa nueva | El `title` de `StopFrame` ya es una línea pequeña en mayúsculas justo encima de la pregunta — el mismo espacio, el mismo papel, un segmento en vez de dos. | El breadcrumb es un **reajuste de una línea existente**, no una adición. Cuesta ~0px. |

Lo genuinamente nuevo, entonces, son exactamente dos cosas: **el topbar** y
**el banner**. Ese es todo el costo vertical, y la §1.2 lo cotiza.

## 0.2 Geometría medida

Escaneada del PNG por detección de bordes de color, no estimada:

| | valor |
|---|---|
| Topbar | `y 0 → 56`, ancho completo del viewport, `#1c1c1c` |
| Barra de acento del topbar | `x 0 → 6`, 56px de alto completo, `#d4003b` |
| Riel | empieza en `y 56` — **debajo** del topbar, no al lado — y llega a `x 252` |
| Ítem activo del riel | `y 170 → 222` (52px), `#1e293b`, con una barra `#d4003b` en `x 216 → 220`, `y 187 → 203` |
| Banner | `y 149 → 180` (31px), `#f8fafc`, filete `#e2e8f0` arriba y abajo |
| Inicio del contenido | `y ≈ 205` |
| **Chrome sobre el contenido** | **205px** |

Esa última fila es el número sobre el que gira toda la propuesta. **El nuestro
hoy es 123px** (medido en vivo, §1.2). La referencia gasta 82px más antes del
primer píxel de contenido.

Nótese el riel: el topbar abarca todo el ancho y el riel empieza debajo. Eso
responde directamente la pregunta de la solicitud — el topbar es una capa
*encima* del riel, no un reemplazo de parte de él.

## 0.3 Paleta, muestreada y verificada por contraste

La paleta de la referencia es **la escala slate de Tailwind más un carmesí
propio**. Valores muestreados, con el veredicto AA para el uso que se les da:

| Referencia | Valor | Se usa para | Contraste | Veredicto |
|---|---|---|---|---|
| fondo topbar | `#1c1c1c` | solo el topbar | — | casi-negro neutro; ver §1.5 |
| fondo riel | `#0f172a` | riel | — | slate-900 |
| fila activa del riel | `#1e293b` | ítem activo, etiqueta del topbar | `#94a3b8` encima = 5.71:1 | pasa |
| carmesí de marca | `#d4003b` | barra, marcador activo, badge, enlaces | ver abajo | pasa casi siempre — §0.4 |
| lienzo de página | `#f1f5f9` | fondo de página | `#1e293b` encima = 13.35:1 | pasa, y **no es blanco puro** — consistente con §4.5 |
| superficie | `#ffffff` | tarjetas, panel de detalle | — | |
| banner | `#f8fafc` | banner informativo | `#d4003b` encima = 5.20:1 | pasa |
| tarjeta seleccionada | `#fff5f5` | tarjeta de agente seleccionada | `#d4003b` encima = 5.08:1 | pasa |
| bordes | `#e2e8f0` | filetes | — | |
| texto apagado | `#475569` / `#94a3b8` | etiquetas | 6.92:1 / 6.65:1 | pasa |
| verde de estado | `#10b981` / `#d1fae5` | "Running", "active" | — | **rechazado — §0.6** |

**El carmesí es una mejora de contraste sobre fondos claros y un fallo de
contraste sobre los oscuros.** Ambas mitades importan:

| `#d4003b` … | ratio | |
|---|---|---|
| como texto sobre blanco | 5.44:1 | pasa — y supera a nuestro `#e2196f` actual |
| como texto sobre `#f8fafc` / `#f1f5f9` / `#fff5f5` | 5.20 / 4.96 / 5.08 | pasa |
| **bajo texto blanco** (badges, píldora activa) | **5.44:1** | pasa — **mejor que el 4.56:1 de nuestro rosa actual** |
| **como texto sobre `#1c1c1c`** (el propio subtítulo de la spec) | **3.13:1** | **falla AA** |
| como texto sobre `#0f172a` | 3.28:1 | falla AA |
| como bloque decorativo sobre cualquiera de los dos oscuros | 3.13 / 3.28 | pasa la barra de 3:1 de no-texto |

## 0.4 La spec del topbar — tres conflictos con decisiones ya tomadas

La spec es autoritativa y se siguió. Tres de sus valores chocan con reglas que
este proyecto ya resolvió, y **cada uno necesita tu decisión**, porque
resolverlos unilateralmente rompería la spec o revertiría en silencio una
decisión documentada:

**1. El subtítulo falla AA, por partida doble.** `"Azure AI Gateway · Demo
Platform": Inter 500, 10px, #D4003B` sobre `#1c1c1c` es **3.13:1 a 10px**.
Falla la barra de 4.5:1 de texto, y 10px está muy por debajo del **piso de
proyector de 16px** que fija la §4.5 y al que todo el esfuerzo de F7 subió
cada cadena. Tres salidas, en el orden en que yo las elegiría:

- **Recolorearlo a `#94a3b8`** — 6.65:1, pasa, y el carmesí se queda donde sí
  se lee: la barra de 6px y el badge de versión. Lo más barato, no toca el
  layout.
- **Quitarlo.** La propia regla responsive de la spec ya dice que el subtítulo
  es lo primero que se oculta, lo que es admitir que es el elemento menos
  portante de la barra.
- Mantener el carmesí pero aclararlo para fondos oscuros — una parada
  `brand-on-dark`, el mismo tono más claro. Es el precedente que ya sentamos
  con `--color-rail-live-mark` (`#4f46e5` → `#7b74ec`) por exactamente esta
  razón.

**2. Texto de 10px y 11px reintroduce lo que F7 eliminó.** Las etiquetas se
especifican a 11px, el subtítulo a 10px. §4.5: *"El tamaño base de 16px es el
'piso de proyector': nunca más pequeño."* F7 gastó una pasada entera en subir
cada cadena a 16px. No voy a eximir el topbar en silencio de una regla
enunciada en absoluto — pero hay un argumento real de que un badge de versión
es chrome, no *"contenido que la sala debe leer desde el fondo"*. **Tu
decisión**, y tiene consecuencia de altura (punto siguiente).

**3. Logo de 40px + 12px de padding vertical = 64px, no los 56px
especificados.** Los propios números de la spec no cierran. Y con el piso de
16px, un bloque de marca de dos líneas (nombre + subtítulo) son ~42px de
texto, que con cualquier padding también supera 56px. Las combinaciones que
sí funcionan:

| | altura |
|---|---|
| logo 40px, padding 8px, una sola línea de 16px (sin subtítulo) | **56px** ✓ |
| logo 40px, padding 12px | 64px |
| dos líneas de 16px + padding 12px | ~66px |
| la spec tal cual (texto 10/11px) | 56px ✓ pero falla §4.5 y AA |

**56px es alcanzable con el piso de 16px solo quitando el subtítulo.** Cada
8–10px extra de topbar sale directo de las nueve pantallas.

## 0.5 El ítem activo del riel

Referencia: fila tintada `#1e293b`, 52px de alto, con una **barra carmesí de
4×16px en el borde derecho**, centrada verticalmente, más un subtítulo
descriptivo bajo la etiqueta ("Hosted Agents" / "Agentes desplegados").

Dos notas. La solicitud lo describe como borde *izquierdo*; la imagen lo mide
a la **derecha**. La imagen es el artefacto, así que gana la imagen salvo que
digas lo contrario. Y el subtítulo por ítem es una ganancia real de
información sobre nuestro relleno sólido actual — nuestras cuatro secciones
se leerían:

| | etiqueta | subtítulo |
|---|---|---|
| | Agentes | Agentes desplegados |
| | Gateway | Ruta, credenciales y política |
| | Observabilidad | Evidencia de cada solicitud |
| | Plataforma | Entorno, controles y costo |

Costo: el riel crece verticalmente. **Eso es gratis** — el riel y el escenario
son hermanos flex en una fila de altura fija, así que la altura del riel no
toca el presupuesto de ninguna pantalla (§4.12 lo estableció y lo midió). El
riel tiene 257px de espacio vertical de sobra expandido.

## 0.6 Semántica de color — las colisiones

| Significado en la referencia | Su color | Qué hacemos |
|---|---|---|
| "Running" / "active" | verde `#10b981` | **No se adopta.** El verde es `--color-affirm` y `--color-affirm` es el 401 y nada más (§4.4/§4.5, F4). Nótese que esto *ya* es como se comporta el código: `AgentsList.tsx` usa `bg-accent` con el comentario *"accent, no affirm: 'esto está encendido' es el trabajo documentado del accent. El verde está reservado para el 401."* Adoptar el carmesí para Running es por tanto un cambio de azul-accent → carmesí, no de verde. |
| badge de versión `v2.4.0` | carmesí | **No se puede adoptar tal cual.** `package.json` es `version: "0.0.0"` — no existe concepto de versión en este proyecto. Un badge que muestre un `v2.4.0` inventado es precisamente el elemento decorativo-pero-falso que prohíbe la §1.6. O se va, o lleva algo cierto (ver §0.7). |
| "solución activa: Hosted Agents" | resaltado carmesí | Desajustado estructuralmente — ver §0.7. |

## 0.7 La referencia es un shell multi-solución. Nosotros somos una sola.

El riel de la referencia dice **SOLUCIONES DEMO → Hosted Agents / Panel
General / Consola / Configuración**: es un *selector de soluciones*, donde
Hosted Agents es una de varias. Su etiqueta del topbar y el "Solución activa:
Hosted Agents" de su banner solo llevan información en ese mundo.

El nuestro es una consola de una sola solución cuyo riel es un *selector de
secciones* (Agentes / Gateway / Observabilidad / Plataforma). Si se adoptan
esos espacios literalmente, se vuelven decoración estática que nunca cambia —
y "una etiqueta que siempre dice lo mismo" es justo la forma que la §1.6
existe para evitar.

**Reutilizarlos es la mejor jugada, y es casi gratis:** el espacio derecho del
topbar y el banner deberían llevar **el indicador Live / Simulación y la
identidad del despliegue** (`región · resource group · conteo de recursos`).
Eso es real, cambia, es la señal persistente más importante del sistema de
honestidad, y la §1.2/§0.8 de `ADOPCION_LENGUAJE_VISUAL.md` ya argumentó que
debía ser persistente. Además permite que el pie del riel suelte ese bloque.

---

# Fase 1 — Propuesta, y el presupuesto de layout

## 1.1 Preguntas y breadcrumbs de las cuatro secciones

Las preguntas ya existen y ya están en las cadenas en español desplegadas.
No hay nada que inventar:

| Sección / pestaña | Pregunta existente |
|---|---|
| Agentes | ¿Qué agentes tengo desplegados y en qué estado están? |
| Gateway · En vivo | ¿Cómo llegan los clientes al agente? |
| Gateway · Credenciales | ¿Qué credenciales se aceptan? |
| Gateway · Referencia | (existe; la pantalla de tono referencia) |
| Observabilidad · Registro | ¿Qué se preguntó y qué se respondió? |
| Observabilidad · Mediciones | ¿Cuánto costó esta solicitud? |
| Plataforma | (existe) |

**¿La pregunta aplica por sub-pestaña o por sección?** Por sub-pestaña, y ya
es así — y eso es portante, no incidental. Las tres pestañas de Gateway
responden tres preguntas genuinamente distintas, y todo el argumento de la
§4.8 para separar Credenciales fue que *"ruta, camino y términos son tres
argumentos, y tres argumentos no caben en una pantalla."* Colapsarlas bajo una
sola pregunta de sección desharía eso. Se queda como está construido.

Breadcrumb, reemplazando la línea `title` en mayúsculas existente:

```
AZURE AI GATEWAY DEMO  /  AGENTES
AZURE AI GATEWAY DEMO  /  GATEWAY  /  CREDENCIALES
```

Dos segmentos para secciones, tres donde hay sub-pestaña. Mismo espacio, misma
altura, estrictamente más información que el `AGENTES` de hoy.

## 1.2 El presupuesto de layout — medido, y no cabe tal como se especifica

> ### Resultado, medido tras la implementación (2026-09-11)
>
> **La estimación de esta sección estaba equivocada en un punto y costó una
> pantalla.** La banda de contexto de una línea se cifró aquí como sustituta
> de los 52px del banner a coste neto cercano a cero, fusionada en la fila de
> las migas. No se construyó fusionada — es su propia fila — y medida cuesta
> **48px** (36px de banda más 12px de separación), en las cinco pantallas que
> pasan `footer`.
>
> La consecuencia fue Plataforma/Live en **−15px**: contenido oculto, que
> §4.7 prohíbe. Se recuperó del marco compartido (`gap-3`→`gap-2`, tarjeta
> `p-5`→`p-4`, banda `py-1.5`→`py-1`, procedencia `pt-2.5`→`pt-2`, `main`
> `py-4`→`py-3`) y Plataforma queda en **+19**.
>
> Dos de los números de entrada de esta sección también estaban obsoletos. El
> contenido de Plataforma/Live es **491px**, no los 120px de la tabla — esa
> fila se midió con el panel aún cargando, con 2 segundos de espera contra un
> backend que tiene ~11,4s de calentamiento. Y la cifra de 457px del §4.11
> está obsoleta para la misma pantalla. Ambos se corrigieron volviendo a medir
> la línea base como A/B (un worktree en `295a310` contra el mismo backend
> real en el mismo minuto), que además mostró que el contenido no cambia más
> de 2px en ninguna de las nueve pantallas.
>
> Estado final y atribución completa: DECISIONES_DE_DISENO.md §4.15.

Este es el riesgo central y no es un detalle a verificar al final.

**Medido en vivo, hoy, a 1366×768 contra el backend real** (producción `-v2`,
con datos de agentes reales cargados — las cifras anteriores de esta sesión se
tomaron contra un broker caído y subestiman la altura del contenido):

| Pantalla | chrome arriba | presupuesto | contenido | margen |
|---|---|---|---|---|
| Agentes · Resumen | 123 | 508 | 413 | **+95** |
| Agentes · Versiones | 123 | 508 | 421 | **+87** |
| Agentes · Ejecutar | 123 | 508 | 327 | +181 |
| Gateway · En vivo | 123 | 507 | 328 | +179 |
| Gateway · Credenciales | 123 | 507 | 122 | +385 |
| Observabilidad · Registro | **159** | 473 | 421 | **+52** |
| Observabilidad · Mediciones | 123 | 507 | 132 | +375 |
| Plataforma · Azure Live | 123 | 507 | 120 | +387 |
| Plataforma · Simulación | 123 | 485 | 536 | **−51** (conocido, §4.11) |

*(Los presupuestos están en el marco canónico de 728px de este documento —
`clientHeight − 40` — para que comparen directo con §4.8/§4.9/§4.11. Los 159px
de chrome de Observabilidad · Registro son su pregunta de dos líneas.)*

*(Gateway · Referencia mide 2171px de contenido en un presupuesto de 523px. No
es una regresión: es el único documento de referencia deliberadamente largo,
con scroll interno, y no es una de las nueve.)*

**Costo del chrome nuevo, si se adopta tal como se especifica:**

| | px |
|---|---|
| Topbar | +56 |
| Breadcrumb reemplazando la línea de título existente | ~0 |
| Banner como bloque separado (31px + ~21px de gaps a nuestra escala) | +52 |
| **Neto** | **+108** |

**Lo que eso le hace a las nueve:**

| Pantalla | margen hoy | tras +108 |
|---|---|---|
| Agentes · Resumen | +95 | **−13** ✗ |
| Agentes · Versiones | +87 | **−21** ✗ |
| Agentes · Ejecutar | +181 | +73 ✓ |
| Gateway · En vivo | +179 | +71 ✓ |
| Gateway · Credenciales | +385 | +277 ✓ |
| Observabilidad · Registro | +52 | **−56** ✗ |
| Observabilidad · Mediciones | +375 | +267 ✓ |
| Plataforma · Azure Live | +387 | +279 ✓ |
| Plataforma · Simulación | −51 | **−159** ✗✗ |

**Cuatro de nueve se rompen.** Es la forma exacta del fallo de CP3
repitiéndose, y es la razón por la que existe este documento.

### Qué recupera el espacio

Cotizado por separado, para que puedas elegir:

| Cambio | recupera | costo |
|---|---|---|
| **Banner en una línea, fundido en la fila del breadcrumb** (breadcrumb a la izquierda, despliegue activo a la derecha) en vez de bloque separado | **+52** | el banner deja de ser un párrafo; pasa a ser una línea de estado |
| Padding vertical de `main` 24 → 16 | +16 | marco más apretado también a 1920 |
| Padding de `Surface` `p-6` → `p-5` | +8 | |
| Gap encabezado→cuerpo `gap-4` → `gap-3` | +4 | |
| **Mover la frase del pie al banner** — son el mismo tipo de frase, y el banner de la referencia *es* una frase explicativa | +22 | el pie se queda solo con la insignia de procedencia |
| Mover también la insignia de procedencia a la fila del banner, eliminando el pie entero | +49 total | **cambia dónde vive la procedencia**, que la §1.6 fijó deliberadamente abajo a la derecha. La señal sobrevive; su posición documentada no. Señalado, no recomendado sin tu decisión. |

**La combinación recomendada — banner fundido (+52), padding recuperado
(+24), frase del pie subida (+22) — son +98 contra un costo de +108: neto
+10px.**

Resultado con neto +10:

| Pantalla | después |
|---|---|
| Agentes · Resumen | +85 ✓ |
| Agentes · Versiones | +77 ✓ |
| Observabilidad · Registro | +42 ✓ |
| Plataforma · Simulación | −61 ✗ (ya estaba en −51) |

Ocho de nueve pasan con margen real. **Plataforma · Simulación no, y tampoco
pasaba antes** — es el defecto de i18n documentado en §4.11, que esa misma
sección ya dice que debe arreglarse traduciendo los nombres de control del
broker y reflowing la pantalla. Esta reestructuración lo empeora 10px; no lo
causa. Yo metería ese reflow en el mismo trabajo en vez de fingir que la
reestructuración lo arregló o lo rompió.

**La consecuencia más importante: el banner no puede ser un párrafo.** El
banner de la referencia es un bloque de frase completa. A nuestro piso de 16px
cuesta 52px, y 52px es la diferencia entre cuatro pantallas rotas y ninguna.
Si quieres el banner-párrafo, el precio honesto es reflowing también Agentes y
Observabilidad.

## 1.3 Detalle del agente — no hace falta migración

Confirmado leyendo el código en vez de asumirlo: `AgentsView` ya es lista +
detalle con pestañas en línea, siempre visible. No hay diálogo que migrar, y
por tanto no existe el problema de "qué pasa con el resto de la pantalla
cuando el panel está siempre visible" — ya lo está siempre.

Lo que la referencia cambia en esta pantalla es cosmético: tratamiento de la
tarjeta seleccionada (relleno `#fff5f5`, borde carmesí), la tira de pestañas
ganando un subrayado carmesí, y el punto de estado pasando de azul-accent a
carmesí. Nada de eso mueve el presupuesto. **Es la parte más barata de toda la
adopción.**

## 1.4 Eliminar la pantalla de inicio — qué hace hoy el botón

Comprobado, porque la solicitud lo pedía. `startDemonstration` **no** es una
llamada de navegación. Hace cinco cosas además de navegar:

```
view          → "dashboard"
stop          → "frameworks"      (resetea qué pantalla está en escena)
copilotOpen   → false
lastAskId     → null              (suelta la clave de unión de Observabilidad/Plataforma)
hasActiveConversation → false
targetAgent   → "pydantic-agent"  (resetea el agente seleccionado)
accessControlRunToken → 0         (limpia los resultados de la prueba 401)
```

Y hace algo más grande por efecto secundario. `App.tsx` renderiza
`LandingPage` **o** `AppShell` según `store.view` — así que salir del
dashboard *desmonta la consola entera*, llevándose el historial del copiloto y
los tiempos del journey. `store.ts` lo dice explícitamente: *"La mayor parte
de un reseteo ya ocurre gratis."*

**Así que la pantalla de inicio es el mecanismo de reseteo entre
demostraciones**, no solo una pantalla de bienvenida. Quitarla quita el
reseteo. Se rompen tres cosas:

1. El **botón Home** del riel (`handleHome` → diálogo de confirmación →
   `goToLanding`) pierde su destino.
2. **`Esc`** (`useKeyboardShortcuts`, "salir del dashboard cuando nada más lo
   reclama") pierde su destino.
3. **Ya no hay forma de empezar una segunda demostración limpia** en una misma
   sesión sin recargar el navegador.

Una eliminación segura necesita por tanto un reemplazo, no un borrado:

- Arrancar directo en `stop: "frameworks"` — `App.tsx` renderiza `AppShell`
  incondicionalmente, `view`/`transitioning` se retiran.
- Reapuntar Home y `Esc` a **`resetDemoState()`** — que ya existe, ya está
  cableado al botón de reseteo del cajón de Configuración, y ya limpia
  exactamente los valores del alcance de la demo preservando deliberadamente
  idioma, tema, movimiento reducido y Live/Simulación del operador.
- Mantener el diálogo de confirmación en Home: protege una conversación viva,
  y esa razón sobrevive.
- El historial del copiloto y los tiempos del journey que el desmontaje
  limpiaba hay que limpiarlos explícitamente — un `key` en el escenario, o un
  reseteo explícito en `resetDemoState`. **Esta es la única pieza de trabajo
  real** de la eliminación.

La pantalla de inicio además muestra hoy región · resource group · modo antes
de empezar. Con la propuesta de §0.7 esa información vive en el topbar de
forma permanente, así que no se pierde nada.

## 1.5 ¿Un oscuro o dos? (`#1c1c1c` del topbar vs el riel)

Hay tres valores en juego: el `#1c1c1c` del topbar de la spec, el `#0f172a`
del riel de la referencia, y nuestro `#17132b` de hoy.

**Recomendación: unificar el riel al `#1c1c1c` del topbar.** Razones, en
orden:

1. Dos casi-negros que difieren ligeramente se leen como defecto de
   renderizado, no como decisión — a 1366 en un proyector, la costura
   topbar/riel es una junta vertical de 56px de alto donde el ojo aterriza de
   inmediato. La referencia se sale con la suya con `#1c1c1c` sobre `#0f172a`
   porque su topbar es de ancho completo y la costura es horizontal; la
   nuestra también lo sería, lo que debilita la objeción — pero solo si el
   riel nunca queda *al lado* del topbar. No queda, según §0.2. Así que es un
   juicio genuino, no algo forzado.
2. `#17132b` se adoptó esta misma sesión de la paleta de *otra* referencia. No
   tiene ninguna pretensión de permanencia, y toda su justificación era que la
   paleta aportada era internamente coherente — afirmación que una paleta
   aportada más nueva y más autoritativa reemplaza.
3. El contraste se preserva o mejora: nuestra tinta de riel `#f4f2f8` mide
   16.23:1 sobre `#17132b` y **17.4:1** sobre `#1c1c1c`.

**En contra de unificar**, y vale decirlo: `#1c1c1c` es un neutro verdadero y
`#17132b`/`#0f172a` son tintados. Un riel neutro pierde la ligera calidez que
hoy distingue nuestro chrome del escenario azul-gris. Eso es estético, no
medible, y yo lo cambiaría por un valor arbitrario menos.

## 1.6 `#D4003B` como el rojo de marca canónico

Adoptarlo es una **mejora de contraste**, que es el caso inusual:

| | hoy | con `#d4003b` |
|---|---|---|
| ítem activo del riel, etiqueta blanca | `#e2196f` → 4.56:1 | **5.44:1** |
| marca en el riel | `#d50243` → 3.37:1 | 3.13:1 sobre `#1c1c1c` — sigue pasando la barra gráfica de 3:1 |
| carmesí como texto sobre superficies claras | n/a | 4.96 – 5.44:1 |

Así que `#e2196f` (el `--color-rail-accent` de esta sesión) y `#b8125b` se
retiran en favor de `#d4003b` y un hover más oscuro. El **asset del logo
conserva su propio carmesí** (`#d50243`) — es un asset de marca aportado, no
un token, y a 3.13:1 sobre `#1c1c1c` sigue pasando la barra gráfica.

**El único lugar donde `#d4003b` no debe ir es como texto sobre cualquier
fondo oscuro** (3.13:1 / 3.28:1). Eso lo descarta para el subtítulo del topbar
(§0.4) y para cualquier futura etiqueta carmesí en el riel.

---

# Riesgos y objeciones, antes de que apruebes

**1. El banner es el elemento caro, no el topbar.** 56px de topbar son
asumibles. Los 52px de banner-como-párrafo son los que rompen cuatro
pantallas. Si solo sobrevive una cosa de este documento a la revisión, que sea
esta.

**2. La spec pide texto de 10–11px y el proyecto lo prohíbe.** F7 subió cada
cadena a 16px contra un piso de proyector declarado. No he eximido el topbar
unilateralmente. Si quieres los tamaños de la spec, eso es una reversión
documentada de la §4.5 y debería escribirse como tal.

**3. El badge de versión no tiene nada cierto que mostrar.** `package.json` es
`0.0.0`. O se quita, o el espacio lleva algo real (§0.7).

**4. La arquitectura de información de la referencia no es la nuestra.** Su
riel cambia entre soluciones; el nuestro cambia entre secciones de una
solución. Los espacios de "solución activa" son decorativos en nuestro mundo
salvo que se reutilicen.

**5. `Plataforma · Simulación` ya está rota y sigue rota.** −51px hoy, −61px
después. Esta reestructuración es el lugar equivocado para arreglarlo, pero es
el momento correcto para agendar el trabajo de traducir-y-reflowing de §4.11
en paralelo.

**6. El blanco puro no es el lienzo.** Vale decirlo porque es fácil leerlo mal
de la captura: el fondo de página de la referencia es `#f1f5f9`, no `#ffffff`
— lo que es consistente con la regla de "nunca blanco puro" de §4.5, no una
violación. Las tarjetas son blancas; la página no.

**7. El tema oscuro es, otra vez, trabajo original.** La referencia no tiene
variante oscura. Cada valor de modo oscuro para topbar, banner, breadcrumb y
tratamiento de tarjetas se diseñaría aquí y se comprobaría aquí, exactamente
como advirtió la §0.1 de `ADOPCION_LENGUAJE_VISUAL.md` la vez anterior.

**8. Revisión de alcance real.** Con la migración del detalle del agente y los
encabezados-pregunta resultando ya existentes, el trabajo real es: un
componente de topbar, un reajuste de breadcrumb, un banner/línea de estado, un
cambio de paleta, la eliminación de la pantalla de inicio con su reemplazo de
reseteo, y un reflow en Plataforma · Simulación. Es un cambio bastante más
pequeño de lo que la solicitud suponía — y el análisis de presupuesto de
arriba es la parte que sí merece la cautela.
