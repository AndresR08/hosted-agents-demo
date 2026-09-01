# Auditoría de diseño y UX

Realizada el 2026-09-01 sobre la consola desplegada, leyendo primero
[`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md) y auditando la
implementación **contra el sistema que este proyecto ya declaró** — no contra
una guía de estilo genérica.

Ese encuadre importa, porque casi nada de lo que sigue es "esto se ve mal". Es
"el sistema de diseño dice X, el código hace Y, y esa brecha cuesta algo
concreto en una sala con proyector".

## Los dos usuarios contra los que se juzga

1. **El presentador**, operando en vivo mientras habla, bajo la presión
   particular de no poder detenerse a leer.
2. **La sala**, que solo ve la pantalla y debe entenderla sin que nadie narre
   la interfaz misma.

Un hallazgo solo cuenta si falla para uno de esos dos. Lo que únicamente
molestaría a alguien navegando solo en su escritorio queda fuera de alcance.

## La restricción que está por encima de la estética

El sistema de honestidad — insignias de procedencia, el banner y el
`tone="reference"` de la pestaña Referencia, las píldoras "Se usa aquí", las
etiquetas `derivado` / `no medido` / `live-delayed` con la edad del dato — **no
está** disponible para simplificarse. Nada de lo que sigue propone quitar una
señal. Dos hallazgos proponen llevar la misma señal *de forma más legible*, y
están marcados como tales en vez de presentarse como limpieza.

---

# Fase 1 — Hallazgos

## F1. La aplicación está escrita a 13 px, por debajo de su propio piso de proyector

**Medido.** `--text-caption` son 13 px. En todo `src/`:

| Token | Tamaño | Usos |
|---|---|---|
| `text-display` | 32 px | 1 |
| `text-body-lg` | 24 px | 2 |
| `text-body` | 16 px | 28 |
| **`text-caption`** | **13 px** | **135** |

`DECISIONES_DE_DISENO.md` §4.5 dice: *"El cuerpo base de 16 px es el 'piso de
proyector': nunca menos."* La implementación está por debajo de ese piso en el
**83% de su uso tipográfico** — y no en el chrome. Hoy 13 px carga los números
de latencia por salto, las leyendas que nombran la política y la audiencia de
cada APIM, el cuerpo de cada tarjeta de capacidad, la tabla de tiers y las
descripciones de los pasos de la secuencia. Ese es el contenido que la sala
debe leer.

**Por qué importa aquí.** Una leyenda que en un portátil solo es pequeña es
*ilegible* al fondo de una sala. Las señales que cargan todo el argumento —
`2 ms` junto a `7.0 s`, `inference · identidad administrada →
cognitiveservices.azure.com` — son justo las que están más chicas. El
presentador termina leyendo la pantalla en voz alta, que es el modo de fallo
que el sistema de diseño se escribió para evitar.

**Propuesta.** Subir `--text-caption` a 14 px. Es un solo token, levanta los
135 sitios a la vez, y 14 px sigue siendo visiblemente subordinado al cuerpo de
16 px — la jerarquía sobrevive. Verificar que ninguna pantalla gane barra de
desplazamiento, porque "sin scroll de página" es una restricción dura (§4.7).

*Esto no llega a 16 px.* Honrar de verdad el piso declarado implica promover
cadenas individuales y rebalancear layouts, que es F7.

---

## F2. Nueve pantallas proyectan errores crudos del broker frente al cliente

**Medido.** El patrón `{t("assistant.liveError")} ({error})` aparece en nueve
componentes: `AgentOverview`, `AgentRun` (×2), `AgentsList`, `AgentVersions`,
`CreateAgentDialog`, `DeleteAgentDialog`, `CopilotPanel`.

Lo que eso renderiza, observado durante la verificación de esta misma sesión:

```
Falló la llamada en vivo — verifique que el broker esté en ejecución
(Broker request failed (502) for /api/agents/pydantic-agent:
{"error":"Foundry agents list failed: 404"})
```

**Por qué importa aquí.** §4.5 es explícito en que ningún estado de fallo debe
comunicarse visualmente — *"una caída real cae a modo Replay en vez de
renderizar un error"*. En la práctica un tropiezo transitorio del backend pone
un código HTTP y un fragmento JSON en una pantalla que el cliente está mirando.
Se lee como software roto y no como un sistema que topó con una dependencia
lenta, y es el único momento de la sesión en que el presentador más necesita
verse tranquilo.

**Propuesta — misma señal, mejor llevada.** Un componente compartido. Por
defecto: una frase serena y un desplegable de "detalles". Desplegado: la misma
cadena cruda, textual.

El detalle **no** se elimina. Ocultárselo al presentador sería justo el tipo de
embellecimiento que esta auditoría no puede permitirse — el presentador
necesita el 502 para decidir si cambia a Simulación o reintenta. Solo deja de
ser lo primero que lee la sala.

---

## F3. Los atajos de teclado existen y son invisibles

**Medido.** `useKeyboardShortcuts.ts` enlaza `←` `→` `C` `S` `L` `Esc`. Un grep
por cualquier listado de ellos en la UI no devuelve nada. Solo están
documentados en `GUIA_PRESENTACION.md`, que se lee antes de la sesión, no
durante.

**Por qué importa aquí.** §4.4 pide que el menú del presentador se maneje por
teclado *"para que el presentador nunca rompa el contacto visual"*. Un
presentador que se queda en blanco con el atajo de la prueba de credenciales no
tiene forma de recuperarse desde la pantalla; o busca el botón o pierde el
ritmo. El cajón de Configuración ya es la superficie privada del presentador,
ya está fuera de la atención de la audiencia, y hoy solo tiene idioma, tema y
modo.

**Propuesta.** Una sección de atajos en el cajón de Configuración. Sin
superficie nueva, sin chrome hacia la audiencia, sin tocar ninguna afirmación
de datos.

---

## F4. `affirm` significa hoy seis cosas distintas

`DECISIONES_DE_DISENO.md` §4.4 reserva el color afirmativo para los rechazos de
seguridad y llama a esa inversión *"la decisión semántica más importante de
todo el sistema visual"*. Auditado en `src/`, hoy además codifica:

| Significado | Dónde |
|---|---|
| Rechazo de seguridad (401) — *el documentado* | `StatusPill` |
| Estado de agente "Running" | `AgentsList` |
| Costo de procesamiento propio de API Management | `RequestFlowDiagram`, `GatewayStop` |
| Pasos de identidad / token | `IdentityFlowSequence` |
| Modo de conexión "Azure en vivo" | `Header`, `LandingPage` |
| Control activo en este despliegue | `OperationsStop` |
| Copia exitosa, valores de atributo XML | `PolicyViewerDialog` |

**Por qué importa aquí.** Un presentador frecuente construye un instinto sobre
qué significa un color. Cuando un mismo tono significa *rechazado-y-eso-es-
bueno*, *corriendo*, *rápido*, *identidad*, *conectado* y *habilitado*, el
instinto deja de formarse, y la inversión deliberada del 401 — el momento en
que un CISO escéptico debería enderezarse — pierde la exclusividad que la hacía
aterrizar.

**Autoría:** dos de estos son míos, agregados antes en esta misma sesión (costo
del gateway, pasos de identidad). Introduje deriva en el sistema sobre el que
ahora reporto.

**Corregido.** `affirm` es ahora el 401 y nada más - un solo uso en todo
`src/`. No se introdujo ningún token nuevo, porque el sistema ya tenía la
respuesta: §4.5 asigna el acento al "estado live y las acciones primarias", así
que Running, Azure en vivo, un control aplicado y el costo propio del gateway
pertenecen ahí, y Simulación pasó a `illustrative-fg`, que es lo que es. Los
tramos de backend se repliegan a tinta atenuada.

La tabla de arriba estaba **incompleta**: Observabilidad tenía el mismo
costo-de-gateway-en-verde en tres sitios más (las barras por salto, la cascada
de spans, el estado sub-400), que esta auditoría no vio y que encontró la
implementación. Ahora coinciden exactamente con el camino En vivo.

---

## F5. La señal de honestidad "no habilitado" viaja sobre opacidad

`OperationsStop` renderiza los controles *disponibles pero no configurados* con
`opacity-60` sobre `ink-muted`. Compuesto, eso queda cerca de 2,6:1 — por
debajo del 4,5:1 que necesita el texto de cuerpo.

**Por qué importa aquí.** Esto es una señal de honestidad, no decoración: la
separación entre "activo en este despliegue" y "disponible, no habilitado" es,
según §1.6, la resolución de toda la banda roja. La opacidad es la codificación
menos robusta que existe frente a un proyector — es lo primero que destruyen la
curva de contraste de un proyector y una foto de la pantalla. La señal es
correcta y puede no sobrevivir a la sala.

**No corregido aquí.** El reemplazo (tratamiento de borde, o una píldora
explícita con el vocabulario de la pestaña Referencia) es un cambio estructural
de esa pantalla. Ver P2.

---

## F6. No existe un "reiniciar al estado inicial"

§4.4 lista "reset al estado inicial" entre los instrumentos del presentador.
`Escape` vuelve a la pantalla de inicio, pero el store conserva `lastAskId`,
`targetAgent` y los tiempos del journey. Una segunda demo abre entonces con el
camino de la petición de la demo anterior ya dibujado y sus números en pantalla.

**Corrección, registrada en vez de editada en silencio.** La afirmación
principal de arriba era **falsa**, y implementarla es lo que lo demostró.
`App.tsx` hace `view === "landing" ? <LandingPage /> : <AppShell />` — volver a
la pantalla de inicio *desmonta la consola*, y con ella el historial del
copiloto y los tiempos del journey; además `startDemonstration` ya limpiaba
`lastAskId`. Una segunda demostración **no** abre mostrando el camino de la
petición de la primera.

Lo que sí sobrevivía a ese viaje eran tres banderas, y una se portaba mal:
`hasActiveConversation` se activa al usar el copiloto por primera vez y nunca
se desactivaba, así que la sesión siguiente abría con un `true` obsoleto y le
pedía al presentador confirmar la pérdida de una conversación ya desmontada.
`targetAgent` y `accessControlRunToken` también persistían.

**Corregido** como `resetDemoState()`, enganchado en las dos rutas hacia una
demostración nueva y expuesto como botón explícito. El problema residual real
nunca fueron los datos obsoletos — era que la única forma de reiniciar era un
viaje completo a la pantalla de inicio: cuatro acciones y un reinicio visible
delante del cliente.

---

## F7. Alcanzar el piso declarado de 16 px

El ajuste de token de F1 mejora la legibilidad sin reestructurar nada. Honrar
§4.5 de verdad implica auditar los 135 sitios, promover a 16 px los que cargan
argumento (los cuatro números por salto, las leyendas de los nodos APIM, los
cuerpos de las capacidades) y reflujar los layouts que entonces desborden —
bajo una regla dura de no-scroll a 1366×768. Sustancial, y mejor hecho
deliberadamente que como efecto secundario. Ver P2.

---

## Lo que se revisó y está bien

Se reporta para que la auditoría no se lea como una lista de todo lo que se
podría decir:

- **El contraste de color a nivel de token pasa**, en ambos temas: `ink`
  17,4:1 / 15,2:1, `ink-muted` 5,33:1 / 6,76:1, `accent` 5,38:1 / 5,66:1,
  `affirm` 5,29:1 / 7,99:1 sobre sus superficies. Solo la opacidad compuesta de
  F5 se queda corta.
- **El sistema de procedencia se aplica sin excepción.** Cada superficie con
  datos lleva exactamente una insignia; no se encontró ningún número sin
  etiquetar.
- **La separación de la pestaña Referencia es genuinamente estructural** — stop
  propio, marco punteado, banner permanente, píldoras por capacidad — y
  sobrevive a una lectura rápida, verificado esta sesión en ambos temas.
- **La navegación entre secciones es plana y recuperable.** Cuatro secciones
  siempre visibles, sin anidamiento más allá de una sub-pestaña. Un presentador
  perdido está a un clic de cualquier sitio.
- **`EmptyState` es un único componente compartido**, a tamaño de cuerpo y
  centrado — la decisión correcta, y el modelo que debería seguir el estado de
  error de F2.

---

# Fase 2 — Prioridad

## Alto impacto / bajo esfuerzo — hechos en esta pasada

| | Hallazgo | Cambio |
|---|---|---|
| F1 | 13 px carga la aplicación | `--text-caption` 13 → 14 px |
| F2 | Errores crudos del broker proyectados | Componente de error compartido, detalle tras un desplegable |
| F3 | Atajos invisibles | Lista de atajos en el cajón de Configuración |

## Alto impacto / alto esfuerzo

F4, F5 y F6 se aprobaron e implementaron después de escribir esta auditoría;
F5 y F6 quedan descritos arriba con su desenlace. F7 sigue pospuesto a una
sesión propia, por el riesgo anotado abajo.



| | Hallazgo | Por qué necesita decisión |
|---|---|---|
| F7 | Alcanzar el piso real de 16 px | 135 sitios, reflujo de layout, bajo restricción de no-scroll. El ítem de mayor valor de esta lista y el que más probablemente rompa algo ya verificado. |

## Bajo impacto — anotados, sin actuar

- El "10 resources" del encabezado es un número sin significado para la
  audiencia; prueba que *algo* está desplegado sin decir qué.
- `text-display` (32 px) se usa exactamente una vez. O la escala tiene un
  tamaño que no necesita, o hay pantallas que deberían usarlo y no lo hacen.
- `text-ink-muted/50` en la pantalla de inicio es decorativo, pero sienta un
  precedente de opacidad-como-jerarquía que F5 demuestra frágil.
