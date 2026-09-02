# Adopción del lenguaje visual de Foundry IQ

Fase 0 (extracción) y Fase 1 (propuesta de navegación) para llevar demo-app al
lenguaje visual de la referencia `foundry-iq-dashboard` — un dashboard en
Flask + JS vanilla de otro proyecto.

**Nada de esto está implementado.** Este es el documento a aprobar o rechazar
antes de tocar cualquier componente conectado a datos reales.

La referencia se leyó únicamente como `static/index.html` y `static/js/script.js`.
Su `.env` nunca se extrajo, leyó ni referenció: contiene credenciales vivas de
un sistema ajeno y no tiene relación con una auditoría visual.

---

# Fase 0 — Qué es realmente la referencia

## 0.1 El dato más importante sobre ella

**La referencia no tiene tema oscuro.** Una búsqueda de `prefers-color-scheme`
o cualquier variante dark no devuelve nada. Es un dashboard solo-claro con una
barra lateral permanentemente oscura.

demo-app tiene un sistema claro/oscuro completo, y `DECISIONES_DE_DISENO.md`
§4.5 lo hace requisito, no preferencia: *"Se requiere una variante oscura,
porque la iluminación de una sala de juntas varía y esa preferencia no nos
corresponde asumirla."*

Así que esto no es una extracción. **La mitad de la paleta no existe en la
referencia y habría que diseñarla.** Todos los colores de abajo son valores de
modo claro sin contraparte oscura, y esa mitad es trabajo original que la
referencia no puede validar.

## 0.2 Paleta

| Referencia | Valor | Token existente más cercano | Veredicto |
|---|---|---|---|
| `--bg` | `#F5F7FB` | `--color-canvas` `#fafafa` | **Adoptar.** Tinte frío a la misma luminosidad; respeta la regla §4.5 de "nunca blanco puro". |
| `--card` | `#FFFFFF` | `--color-surface` `#ffffff` | Idéntico. Sin cambio. |
| `--border` | `#E7ECF3` | `--color-border` `#e5e5e5` | **Adoptar.** Mismo peso, más frío. |
| `--ink-900` | `#0F2547` | `--color-ink` `#1a1a1a` | **Adoptar.** Negro-azulado en vez de neutro; más producto, menos terminal. |
| `--ink-500` | `#6B7A99` | `--color-ink-muted` `#6b6b6b` | **Adoptar**, pero verificando contraste — ver abajo. |
| `--ink-300` | `#A4AFC3` | *(ninguno)* | **Token nuevo** si se adopta el sub-texto del KPI. Falla contraste como texto de cuerpo; solo admisible para texto no esencial. |
| `--blue-500` | `#2F6FED` | `--color-accent` `#0f6cbd` | **No adoptar.** El nuestro pasa 5,38:1 sobre blanco; el suyo ~4,0:1. Conservar el nuestro es lo correcto. |
| `--green-500` | `#16C784` | `--color-affirm` `#0e7a5f` | **No adoptar** — ver §0.6. |
| `--amber-500` | `#F2A93B` | *(ninguno)* | **Rechazar** — ver §0.6. |
| `--red-500` | `#EF4444` | *(ninguno)* | **Rechazar de plano** — ver §0.6. |
| `--radius` | `14px` | `rounded-lg` `8px` | **Adoptar.** Más suave y actual. Riesgo bajo. |
| `--shadow` | dos capas, hasta 24px de desenfoque | *(ninguno — solo bordes)* | **Rechazar** — ver §0.5. |

Verificación de contraste de los dos valores de tinta propuestos, contra
`#FFFFFF`:

| | Ratio | Veredicto |
|---|---|---|
| `#0F2547` (ink-900) | 14,5:1 | Pasa holgado |
| `#6B7A99` (ink-500) | 4,16:1 | **Falla el 4,5:1 de texto de cuerpo** |

`--ink-500` es el caballo de batalla de la referencia para etiquetas y texto
secundario. A 4,16:1 no cumple AA, y nuestro `#6b6b6b` actual (5,33:1) sí. Si
adoptamos el tono frío hay que oscurecerlo hasta cerca de `#5A6884` para pasar.
Esto es justo lo que la referencia no puede decirnos, porque nunca se auditó
para un proyector.

## 0.3 Tipografía

La referencia carga tres familias: **Inter** (texto), **Space Grotesk**
(valores KPI), **JetBrains Mono** (valores técnicos). demo-app usa una hoy:
Segoe UI Variable.

**Recomendación: adoptar una de las tres, no la jerarquía.**

- **Inter → rechazar.** No aporta nada sobre Segoe UI Variable y cuesta una
  fuente web en una máquina que puede estar presentando sin conectividad
  confiable. El App Service ya sirve el bundle; añadir Google Fonts introduce
  un modo de fallo que una sala de juntas puede disparar.
- **Space Grotesk para valores KPI → rechazar.** Una tipografía de display
  para números es convención de dashboard, y esto no es un dashboard (§4.1:
  *"un escenario, no un dashboard"*). El peso y el tamaño ya cargan ese
  énfasis.
- **JetBrains Mono → adoptar, con condición.** demo-app ya renderiza contenido
  monoespaciado — XML de políticas, digests de imagen, claves de variables de
  entorno, la plantilla de ruta del agente — sin familia mono declarada, así
  que cae en lo que el sistema operativo provea. Eso es un hueco real, y es el
  único punto donde la referencia resuelve un problema que también tenemos.
  Empaquetarla localmente, no desde un CDN.

**La escala tipográfica es el problema serio.** La referencia corre entre
10,5px y 13,5px para casi todo, con 22px reservado a los valores KPI:

| Elemento de la referencia | Tamaño |
|---|---|
| `.kpi-sub` | 10,5px |
| `.badge`, `.kpi-trend` | 10,5px |
| `.kpi-label` | 11,5px |
| `.data-table td` | 12,5px |
| `.nav-item` | 13,5px |
| `.kpi-value` | 22px |

`DECISIONES_DE_DISENO.md` §4.5 fija **16px como piso de proyector: nunca
menos**. La referencia está diseñada para un monitor de escritorio a distancia
de brazo. Adoptar su escala llevaría a demo-app de estar *por debajo* del piso
(F1 midió 14px cargando el 83% del uso) a estar *muy* por debajo, y haría F7 —
el trabajo pendiente para llegar a 16px — sustancialmente más difícil.

**Adoptar las proporciones de la referencia, no sus tamaños absolutos.** Su
relación etiqueta-valor (aproximadamente 1:2) es sensata; aplicada a nuestro
piso da una etiqueta de 16px y un valor de 32px, que son `--text-body` y
`--text-display` — tamaños que ya tenemos y apenas usamos.

## 0.4 La tarjeta KPI

El patrón de la referencia es: ícono (cuadro tintado) · tendencia · etiqueta ·
valor grande · sub-línea mono.

**Adoptar la forma. Eliminar el elemento de tendencia por completo.**

`DECISIONES_DE_DISENO.md` §1.6 clasifica las tendencias históricas en banda
roja: *"Tendencias históricas (7/30/90 días) — El grupo de recursos es nuevo,
no existe historial — Ninguna línea de tendencia en ninguna parte."* El
elemento `.kpi-trend` (`+12%` en verde) no tiene de dónde sacar un número real.
Una tarjeta diseñada alrededor de un espacio de tendencia, con ese espacio
vacío, es peor que una diseñada sin él.

Dónde el patrón restante sí tiene números reales hoy:

| KPI | Fuente | Banda |
|---|---|---|
| Costo propio del gateway | `/api/journey` `totalGatewayOverheadMs` | live-delayed, con edad |
| Latencia extremo a extremo | `/api/ask` `latencyMs` | live |
| Tokens de prompt / completion | `ApiManagementGatewayLlmLog` | live-delayed |
| Agentes registrados | `/api/agents` | live |
| Controles aplicados vs disponibles | `/api/controls` | live |
| Conteo de recursos | `/api/environment` | live |

Son seis KPIs reales — suficientes para que el patrón se gane su lugar sin un
solo número de relleno. La sub-línea mono es el hogar natural de la insignia de
procedencia, y eso sí es una mejora de presentación: le da a la insignia una
posición consistente y esperable en vez de una por componente.

**El costo está deliberadamente ausente de esa lista.** La tarjeta principal de
la referencia es el costo acumulado. §1.6 pone el gasto real en banda roja
(Cost Management tiene 8–24h de latencia, el grupo es demasiado joven) y la
resolución es un panel ilustrativo etiquetado como modelo de precios, nunca una
factura. Un KPI de costo con el mismo estilo que cinco reales sería lo más
peligroso de toda esta adopción.

## 0.5 Tarjetas y elevación

La referencia usa una sombra de dos capas con hasta 24px de desenfoque. §4.5 es
explícito: *"tarjetas definidas por un borde de 1px en vez de una sombra — las
tarjetas muy sombreadas se leen como plantilla web, las líneas finas se leen
como producto."*

**Rechazar la sombra; adoptar el radio.** La esquina de 14px es la mayor parte
de lo que hace que la referencia se sienta actual; la sombra es lo que nos haría
parecer una plantilla. No cuesta nada y la intención de diseño sobrevive.

## 0.6 Semántica de color — las colisiones directas

La referencia asigna color por salud. Nosotros por tipo de afirmación. Son
incompatibles, y la nuestra se decidió hace dos commits en F4.

| Significado en la referencia | Su color | Qué hacemos |
|---|---|---|
| Sano / ok / tendencia al alza | verde | **El verde es solo el 401.** F4 lo quitó de otros cinco usos; volver a meter "sano" desharía eso de un golpe. |
| Advertencia | ámbar | **Sin ámbar.** No tenemos estado de advertencia — §4.5: *"no hay estado de fallo que deba comunicarse visualmente."* |
| Error | rojo | **Sin rojo en ninguna parte.** §4.5, y verificado tras F4: cero archivos contienen rojo. |
| Inactivo | gris | Compatible. Mapea a `ink-muted`. |
| Tintes genéricos de ícono KPI | azul / ámbar / verde | **Solo azul.** Un cuadro de ícono tintado está bien; tres tintes por categoría reintroducirían exactamente la sobrecarga que F4 eliminó. |

El conjunto de badges (`ok` / `warning` / `error` / `idle`) no mapea a nuestros
estados en absoluto. Los nuestros son de *procedencia* — live, live-delayed,
replay, illustrative — más los del catálogo de controles: *aplicado / no
habilitado / no desplegado*. Ambos ya están implementados y verificados. **El
vocabulario de badges de la referencia no debe adoptarse en ninguna forma.**

## 0.7 Gráficos

La referencia usa ApexCharts 3.45.1 para donas y líneas.

**No añadir una librería de gráficos.** Tres razones, por peso:

1. No tenemos datos con forma de gráfico que sean reales. Las tendencias son
   banda roja, el desglose por consumidor necesita varias suscripciones de APIM
   que el lab no despliega, y los conteos de tokens son un número por petición,
   no una serie. Una librería de gráficos llegaría sin nada honesto que dibujar.
2. El bundle ya está en 678KB con avisos de minificación. ApexCharts añade unos
   500KB.
3. Este proyecto ya construyó dos veces SVG propio en vez de tomar una
   dependencia — el camino animado de la petición y la secuencia de identidad —
   y una vez rechazó lucide-react por lo mismo. El precedente está establecido y
   ha aguantado.

Si más adelante aparece una serie genuinamente real, el diagrama del camino
demuestra que el SVG a mano alcanza a esta escala.

## 0.8 Barra lateral

La única parte de la referencia que es directamente buena y no choca con
nuestro sistema.

```
.sidebar   fondo #0B1220, 250px fijo, columna flex
.brand     ícono 38px, degradado, bloque de dos líneas
.nav-item  13,5px, radio 10px, #B9C2D6
           :hover  fondo #141D30, color #fff
           .active fondo var(--blue-500), color #fff
.sidebar-footer  margin-top:auto, borde superior 1px
.statusbar       un badge-dot más una etiqueta
```

**Adoptar estructuralmente.** Dos ajustes:

- La barra oscura permanece oscura en **ambos** temas. Es lo que hace la
  referencia, se lee como deliberado y no como un fallo de tema, y le da a la
  consola un ancla fija que no se mueve si el presentador cambia de tema a
  mitad de sesión.
- El espacio de estado del pie es donde debe vivir nuestro indicador Live /
  Simulación. Hoy está en el encabezado y se pierde de vista; una posición
  persistente en el pie significa que la sala siempre ve qué modo está activo,
  lo que refuerza el sistema de honestidad en vez de solo reubicarlo.

## 0.9 Tablas

`.data-table` — encabezados en mayúsculas a 10,8px, celdas a 12,5px, hover de
fila, clase `.mono` para columnas técnicas. Estructura sensata, tamaños
rechazados según §0.3.

Vale notar que tenemos muy pocas tablas: la comparación de tiers en Referencia
y el historial de versiones del agente. Este patrón nos aporta poco.

---

# Fase 1 — Propuesta de restructuración de navegación

## 1.1 Jerarquía de la barra lateral

```
┌─ 250px ─────────────┐
│  ▣  Foundry          │   bloque de marca
│     Hosted Agents    │
│                      │
│  ⬡  Agentes          │   ← cuatro ítems de primer nivel,
│  ⛨  Gateway          │      sin cambio respecto a hoy
│  ∿  Observabilidad   │
│  ▤  Plataforma       │
│                      │
│         ⋮            │
│                      │
├──────────────────────┤
│  ● Azure en vivo     │   ← movido desde el encabezado
│  swedencentral · 10  │
└──────────────────────┘
```

**Las cuatro secciones siguen en primer nivel.** Son objetos, no pasos, y la
estructura plana es una de las cosas que la auditoría UX encontró sólidas: *"un
presentador perdido está a un clic de cualquier sitio."* Anidarlas cambiaría eso
por nada.

**Las pestañas En vivo / Referencia del Gateway no se mueven a la barra.** Son
dos vistas de un objeto, no dos destinos, y la distinción entre ellas es
estructural — Referencia es conceptual, En vivo es medida. Promover Referencia
a par de la barra la haría parecer una quinta sección de igual rango que cuatro
pantallas que leen datos reales de Azure, que es precisamente la confusión que
el marco punteado y el banner existen para evitar. Se quedan como el par de
sub-pestañas dentro de la pantalla Gateway.

## 1.2 Controles de tema y modo

Ambos viven hoy en el cajón de Configuración, accesible desde un engranaje en
el encabezado.

**Propuesta: el cajón se queda exactamente donde está**, accesible desde un
engranaje fijado al pie de la barra lateral, junto a la línea de estado. Nada
de su contenido cambia.

El razonamiento es el mismo de §4.2: *"un panel rotulado 'controles de demo' le
dice a la audiencia que está viendo una demo."* El pie de la barra lateral es
la región menos expuesta a la audiencia del nuevo layout, lo que la convierte
en el hogar correcto de los controles privados del presentador — el mismo
argumento que puso la lista de atajos y el botón de reset en ese cajón durante
la auditoría.

El **indicador** Live / Simulación es distinto de su *control*. El indicador se
vuelve persistente en el pie de la barra (§0.8); el interruptor se queda en el
cajón y en `L`.

## 1.3 El presupuesto de 1366×768 — medido, no asumido

§4.7 exige que no haya scroll de página a 1366×768. Una barra lateral fija es
un impuesto directo al presupuesto horizontal, así que aquí están los números.

| | Hoy | Con barra lateral |
|---|---|---|
| Viewport | 1366 | 1366 |
| Barra lateral | — | 250 |
| Padding horizontal | 96 (48×2) | 52 (26×2) |
| **Ancho de contenido** | **1270** | **1064** |

Una pérdida de **206px, o 16%**. Contra lo más ancho que renderizamos:

| Elemento | Ancho mínimo | ¿Cabe en 1064? |
|---|---|---|
| Secuencia de identidad (6 carriles × 132) | 792 | Sí |
| Diagrama del camino de la petición | 760 | Sí |
| Tabla de comparación de tiers | 540 | Sí |
| Rejilla de capacidades (2 columnas) | fluida | Sí |
| Camino de la petición **con el copiloto abierto** (≈380) | 760 | **No — quedan 684** |

**La última fila es el hallazgo real.** El camino de la petición ya se desplaza
horizontalmente dentro de su contenedor cuando el copiloto está abierto — eso
fue una corrección deliberada durante el trabajo del diagrama, elegida para que
sobrevivan las leyendas de política de APIM en vez del encaje. Con barra
lateral se desplazaría *más*, y el copiloto abierto es el estado normal de
presentación.

Dos opciones, y querría tu decisión:

- **Barra más angosta a ≤1440px.** Colapsar a un riel de íconos de 64px, con
  etiquetas al pasar el cursor. Recupera 186px, mantiene la estructura, cuesta
  las etiquetas justo cuando el presentador menos puede buscarlas.
- **Barra superpuesta en vez de empujar a ≤1440px.** El contenido conserva su
  ancho completo; la barra se desliza por encima a demanda. Mejor para el
  contenido, peor para la orientación — el ancla persistente es la mayor parte
  del valor de una barra lateral.

Ninguna es gratis, y el mockup no da guía porque nunca se diseñó para 1366 con
un panel lateral abierto.

## 1.4 ¿Debe combinarse con F7?

**Mi recomendación: combinarlos, y quiero ser explícito en que esto es lo
contrario de mi consejo habitual en este proyecto.**

A favor de combinar:

- Tocan el mismo código. F7 promueve cadenas de 14px a 16px y reflúa lo que
  desborde; esta restructuración cambia cuánto ancho hay hacia donde desbordar.
  Hacerlos por separado significa hacer el trabajo de reflujo **dos veces**,
  contra dos anchos distintos, y la primera pasada se mediría contra un layout
  que estamos por descartar.
- §0.3 es el argumento más fuerte de este documento para *no* adoptar la
  referencia al pie de la letra, y es un argumento sobre tamaño de tipografía.
  Adoptar el lenguaje de tarjetas y barra lateral de la referencia mientras
  seguimos por debajo del piso de proyector fijaría los supuestos de monitor de
  escritorio justo en el momento en que tenemos el layout abierto.
- El presupuesto de 1064px de §1.3 está calculado contra los 14px de hoy. A
  16px cada ancho mínimo de esa tabla crece cerca de 14%. **El análisis de
  encaje de arriba es inválido salvo que F7 se decida en un sentido u otro**,
  que es la razón más filosa de que no sean realmente separables.

En contra, y es real: convierte un cambio grande en uno más grande, y F7 se
pospuso precisamente por ser el ítem con más probabilidad de romper algo ya
verificado contra Azure real.

**Cómo lo desriesgaría:** secuenciar el trabajo para que el sistema de
honestidad y la ruta de datos nunca estén en vuelo al mismo tiempo que el
layout. Primero tokens y escala tipográfica, verificado. Luego el armazón de la
barra lateral con las pantallas actuales metidas dentro sin cambios,
verificado. Luego reflujo por pantalla, un commit por pantalla, repitiendo la
comparación numérica del Gateway en la que la tiene. Eso son cuatro o cinco
puntos de control verificables en vez de uno.

---

# Riesgos y objeciones

Dichos con claridad, como pediste, antes de cualquier aprobación.

**1. La referencia es un dashboard y decidimos no serlo.** §4.1 se titula *"la
metáfora organizadora: un escenario, no un dashboard"* y argumenta que una
superficie que se monitorea y una que se dirige son productos distintos. La
referencia es inequívocamente lo primero: rejilla KPI, pares de gráficos,
tablas de datos, porcentajes de tendencia. Adoptar su lenguaje *visual* es
defendible y creo que vale la pena. Adoptar su lenguaje *informacional* —
llenar una rejilla KPI de cuatro porque la rejilla pide cuatro — revertiría en
silencio una decisión de posicionamiento documentada. La sección KPI lista seis
números reales para que esto no tenga que pasar, pero la tentación estará en
cada pantalla con un hueco.

**2. Media paleta no existe.** El tema oscuro es trabajo original sin
referencia contra la cual contrastarlo, y la iluminación de sala es justamente
por lo que §4.5 lo hace obligatorio. Hay que presupuestar diseñarlo, no
extraerlo.

**3. `--ink-500` falla AA con 4,16:1** y es el color de texto más usado de la
referencia. Adoptar la paleta fielmente regresaría el contraste en las mismas
pantallas que la auditoría acaba de arreglar.

**4. Tres de los cinco colores semánticos de la referencia son inusables** —
rojo, ámbar y verde-como-sano chocan con decisiones ya tomadas, dos de ellas
hace 48 horas en F4. Lo que queda por adoptar es la paleta *neutra* y el
lenguaje de *layout*, que sigue valiendo la pena, pero es una adopción menor de
lo que "adoptar el lenguaje visual" sugiere.

**5. Nada de esto está verificado contra un proyector, ni siquiera lo
nuestro.** Tanto la escala de la referencia como nuestros 14px actuales son
juicios de monitor de escritorio. F7 es el único ítem de ambos documentos que
ataca la restricción realmente declarada, lo que es parte de por qué §1.4
recomienda incorporarlo.

**6. Producción está correcta hoy y este es un cambio grande.** El despliegue
en `hosted-agents-demo-f76df303` está verificado de extremo a extremo, con
números por salto contrastados dígito a dígito contra la API en tres ocasiones
distintas. Según tu instrucción nada se despliega hasta que apruebes; añadiría
que el orden sensato es mantener producción en el bundle actual durante toda la
restructuración y desplegar una sola vez, tras una revisión completa, en vez de
incrementalmente.
