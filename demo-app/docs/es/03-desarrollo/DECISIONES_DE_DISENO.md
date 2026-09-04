# Decisiones de diseño

Este documento consolida la filosofía, el posicionamiento y las decisiones de diseño tomadas durante el desarrollo de esta demo. Es un documento técnico dirigido a quienes se incorporen al proyecto como desarrolladores o diseñadores: explica no solo *qué* se construyó, sino *por qué*, incluyendo una corrección de rumbo real que vale la pena entender antes de tocar el código.

---

## 1. Filosofía y principios de diseño

### 1.1 Rol y contexto original

La aplicación se diseñó desde el rol de un Cloud Solution Architect de Microsoft, para el laboratorio `labs/ai-foundry-hosted-agents-custom-framework`, con una audiencia deliberadamente enterprise: banca, seguros, salud, retail — sectores regulados donde la revisión de seguridad, no el caso de negocio, es lo que mata una propuesta de IA.

### 1.2 Qué se vende (y la corrección posterior sobre esto)

La tesis de diseño original afirmaba que el cliente no compra un agente — cualquier proveedor puede mostrar un chatbot respondiendo una pregunta — sino **la capacidad de poner agentes en producción sin perder el control sobre ellos**. La idea a transmitir era:

> Entre el usuario y el modelo, y entre el agente y el modelo, hay un punto de control que la empresa posee. Ninguna credencial llega al cliente. Ninguna credencial llega al agente. Cada llamada queda registrada. Cada agente está versionado, es atribuible y tiene privilegios mínimos.

En la formulación original, el patrón de doble gateway (API Management apareciendo dos veces en un mismo request) no era un detalle de implementación a esconder — **era el producto**, y la demo se construyó alrededor de hacerlo visible.

Esta afirmación concreta — "eso es el producto" — resultó ser el error de enfoque inicial del proyecto. La sección 2 de este documento cuenta esa historia completa: por qué se tomó esa decisión, por qué no era descabellada, y por qué se corrigió a "Foundry primero, gateway segundo". El resto de esta sección 1 (principios, bandas de honestidad, arquitectura de host local) sigue vigente sin cambios; lo que cambió fue *cuál* protagonista se pone en el centro de esos principios, no los principios en sí.

### 1.3 Principios de diseño rectores

| Principio | Consecuencia para la aplicación |
|---|---|
| **La verdad por encima del pulido** | Cada número lleva su procedencia etiquetada. Nada se inventa. Donde el laboratorio no puede mostrar algo, la aplicación lo dice en pantalla. |
| **Una idea por pantalla/superficie** | Cada región de la interfaz tiene un titular único; un ejecutivo debe poder resumir su conclusión en una frase. |
| **Divulgación progresiva** | Los ejecutivos ven la conclusión. El arquitecto empresarial en la sala hace clic en "mostrar detalle" y ve el XML de política en vivo, la tabla de RBAC, el JSON crudo. Ambas audiencias quedan servidas sin saturar la vista principal. |
| **Vivo donde importa, honesto donde no** | Las pantallas de seguridad y gobernanza son 100% en vivo — ahí es donde vive el escepticismo. La pantalla de costos es explícitamente ilustrativa y está marcada visualmente como tal. |
| **Segura para demo por construcción** | Nada que tome más de ~15 segundos corre en vivo durante la sesión. El despliegue, la construcción de imágenes y el registro de agentes ocurren antes de que el cliente esté en la sala. |

### 1.4 Qué NO es esta aplicación

- **No es una herramienta de desarrollador.** Sin editor de código, sin constructor de requests, sin explorador de esquemas, sin "probar la API".
- **No es una consola de operaciones.** No reemplaza Azure Portal y no debe pretender ser un producto de monitoreo de producción.
- **No es un producto de chat.** La superficie conversacional existe solo como evidencia de que la plataforma funciona.

### 1.5 Mapa de audiencia y las cinco preguntas

| Persona | Su pregunta |
|---|---|
| CIO / CDO | ¿Realmente podemos llevar esto a producción? |
| CISO / Arquitecto de seguridad (persona crítica) | ¿Dónde viven las credenciales? |
| Responsable de IA / dueño de la plataforma | ¿Cómo gestiono cincuenta de estos? |
| Arquitecto empresarial | Muéstrame la ruta real. |
| Riesgo / Cumplimiento / Riesgo de modelo | ¿Qué queda registrado y qué puedo demostrarle al regulador? |
| FinOps | ¿Cuánto cuesta esto por departamento? |

El CISO es la persona crítica: en industrias reguladas, una propuesta de plataforma de IA muere en la revisión de seguridad, no en el caso de negocio. Esto es lo que justifica que el bloque de Acceso e Identidad reciba el mayor presupuesto de tiempo del guion (ver §5).

La aplicación debe responder, en orden, cinco preguntas: ¿funciona? · ¿qué está pasando ahora mismo? · ¿es seguro? · ¿puedo controlar mis agentes de IA? · ¿por qué es valioso esto?

### 1.6 El sistema de bandas de honestidad de datos

Este es el mecanismo central que gobierna toda afirmación que la aplicación tiene permitido hacer: un inventario honesto de lo que este laboratorio específico puede y no puede producir. Cada elemento de datos en pantalla se clasifica en una de tres bandas, y cada componente de datos lleva una insignia de procedencia visible — **nunca hay un número sin etiquetar en la aplicación**.

| Banda | Significado | Tratamiento visual |
|---|---|---|
| 🟢 **LIVE (en vivo)** | Datos reales de Azure, recuperables en segundos, confiables en una demo | Insignia "Live" con marca de tiempo |
| 🟡 **LIVE — DELAYED / VERIFY (en vivo, retrasado o por confirmar)** | Genuinamente real, pero sujeto a latencia de ingesta o pendiente de confirmación en ensayo | Insignia "Live · delayed" mostrando la antigüedad del dato |
| 🔴 **NOT AVAILABLE (no disponible)** | No se puede obtener de este laboratorio. Se omite o se muestra como ilustración claramente marcada | Panel visualmente distinto, con etiqueta explícita "Illustrative" |

**Regla de oro: nunca se inventa una solución para lo que cae en la banda roja.** Cada elemento no disponible se omite o se declara explícitamente como ilustración.

#### Qué es genuinamente 🟢 en vivo

Texto de respuesta del agente y latencia extremo a extremo; códigos de estado HTTP bajo credenciales variadas; el XML de política de API Management leído en vivo desde ARM; el ID de objeto y las audiencias de la managed identity; nombre/versión/estado/imagen/CPU/memoria/claves de variables de entorno del agente; repositorios, tags y digests de Azure Container Registry; inventario de recursos; configuración del despliegue del modelo y su política de RAI; configuración de diagnósticos.

Un hallazgo importante, producto de una auditoría de telemetría completa realizada el 2026-08-02, **reclasificó varios elementos de "no disponible" a genuinamente en vivo** — cada uno verificado consultando directamente el workspace desplegado:

- **Conteo de tokens** (prompt, completion, total) — se puebla en el salto de inferencia (la llamada al modelo), corroborado de forma independiente por la instrumentación OpenTelemetry del propio contenedor del agente (valores coincidentes exactos, p. ej. 423/643 desde ambas fuentes).
- **Tiempo por salto del gateway** — dos filas por interacción, una por API. El costo de procesamiento del gateway (`TotalTime − BackendTime`) resultó ser de **1–5 ms** frente a requests de varios segundos: la respuesta directa a "¿un gateway no nos va a hacer más lentos?".
- **Traza distribuida** — 7 a 10 spans reales de padre/hijo a través del runtime de Foundry, el contenedor del agente y API Management, incluyendo la adquisición del token de managed identity como span propio.
- Versión exacta del modelo, IDs de correlación, ID de sesión del agente, versiones del runtime del servidor.

#### Qué es 🟡 en vivo pero retrasado o pendiente de verificación

Conteo de requests, tasa de éxito y percentiles de latencia desde Application Insights (retraso de ingesta de 1–3 minutos); distribución de códigos de estado; texto de prompt y completion registrados en Log Analytics (`ApiManagementGatewayLlmLog`) — verificado que el prompt sí se captura, pero en al menos una verificación el campo de la completion llegó vacío, por lo que la aplicación imprime "(no capturado en el gateway para este request)" en lugar de inventar uno; la correlación entre los dos saltos de gateway en una sola traza distribuida (el agente sí propaga `traceparent`, pero el salto norte-sur de API Management no tiene diagnóstico en Application Insights, así que los dos saltos se asocian por ventana de tiempo y la interfaz lo etiqueta como aproximación, no como medición única); visibilidad de ejecución de herramientas (`get_weather`) — la ejecución es real y los logs del contenedor sí llegan a Application Insights, pero al momento de la auditoría no se había observado ningún span de tool-call porque ninguna pregunta de ensayo lo había disparado; streaming SSE a través de API Management (el buffering del gateway puede afectar el renderizado token a token); rechazo por filtro de contenido (real, porque la política RAI `Microsoft.DefaultV2` está adjunta, pero desaconsejado por defecto en un entorno ejecutivo).

#### Qué es 🔴 no disponible — y por qué

| No se puede mostrar | Por qué | Decisión |
|---|---|---|
| Costo/gasto real | Azure Cost Management tiene 8–24h de latencia; un grupo de recursos de demo es demasiado joven | Panel ilustrativo, marcado como modelo de precios públicos, no como factura |
| Chargeback por departamento/consumidor | El laboratorio despliega una sola suscripción de API Management | No simular múltiples departamentos; presentar como capacidad arquitectónica. Aprovisionar 2–3 suscripciones extra antes de la demo la convertiría en algo genuinamente en vivo (recomendado) |
| Rate limiting / throttling en acción | Ninguna política contiene `llm-token-limit`, `azure-openai-token-limit` ni `rate-limit-by-key` | No simular un evento de throttling; presentar en el Catálogo de Controles como "disponible en este punto de política, no habilitado en este despliegue" |
| Caché semántico | Sin política de caché, sin Redis | Solo en el Catálogo de Controles |
| Balanceo de carga / circuit breaker en acción | El bicep de inferencia soporta un pool, pero el bicep principal solo pasa un servicio de IA, así que el pool nunca se crea | Solo en el Catálogo de Controles |
| Tendencias históricas (7/30/90 días) | El grupo de recursos es nuevo, no existe historial | Ninguna línea de tendencia en ningún lado |
| Uptime / SLA histórico | Sin historial operativo | Omitir por completo |
| Redes privadas / aislamiento de red | `publicNetworkAccess: 'Enabled'` en las cuentas de Foundry y ACR | Solo en el Catálogo de Controles, como brecha |
| Failover multi-región | Región única (`swedencentral`), SKU Basicv2 sin zonas | Omitir |
| Evaluaciones de Foundry, red teaming, scorecards de seguridad | El laboratorio no configura ninguno de estos aunque el README los menciona | No construir una pantalla de evaluaciones; mostrar fabricar un puntaje de evaluación a un equipo de riesgo de modelo en un banco sería activamente dañino |
| Autoescalado de agentes bajo carga | Sin generación de carga, sin telemetría de escalado expuesta | Omitir |
| Segundo framework de agente compitiendo en vivo | El laboratorio registra un agente por vez | Pre-registrar ambos agentes (`strands-agent` y `pydantic-agent`) antes de la demo — recomendado, pero no realizado en la primera verificación de 2026-08-01 |
| Tabla completa de asignaciones RBAC | **Reclasificada desde 🟢 el 2026-08-01.** `az role assignment list` devuelve vacío bajo la identidad del presentador, que carece del permiso `Microsoft.Authorization/roleAssignments/read` a nivel de grupo de recursos | No presentar como en vivo. El diseño de RBAC es real y está documentado, pero debe aparecer como una afirmación de configuración documentada, nunca con una insignia "Live" |

Esta última reclasificación (RBAC de 🟢 a 🔴) y las reclasificaciones inversas de tokens/timing (de 🔴 o 🟡 a 🟢) son la evidencia de que este sistema de bandas se toma en serio: las afirmaciones se ajustan cuando la verificación en vivo contradice el supuesto original, en cualquier dirección.

**La resolución para toda la columna de "no disponible" es el Catálogo de Controles**: en lugar de fabricar telemetría, un inventario honesto de dos estados — *activo en este despliegue* frente a *disponible en este punto de control, no habilitado* — que no puede ser contradicho por nadie que después lea la configuración, y que los arquitectos empresariales encuentran más persuasivo que un 429 falso. El contenido de este catálogo se detalla en §4.

### 1.7 Modo Live / Replay: red de seguridad, no engaño

Se diseñó un alternador persistente de dos modos:

- **Live** — cada llamada es real, contra el despliegue en ejecución.
- **Replay** — cada pantalla se renderiza desde una captura grabada durante el ensayo contra ese mismo despliegue real.

El modo Replay preserva la honestidad: la insignia cambia en cada panel, nunca se presenta contenido simulado como si fuera en vivo. Protege contra el wifi del recinto, un agente frío o un token expirado, y asegura que la demo nunca falle frente a un cliente. Todo componente debe renderizarse correctamente en ambos modos.

**Tal como se construyó, hay dos desviaciones respecto al diseño original:**

1. Los modos se etiquetan **"Azure Live"** y **"Simulation"** en el cajón de configuración (Settings), no "Live / Replay", y el alternador vive en Settings y en el menú de presentador (`L`) en lugar de un switch visible en el encabezado.
2. **Simulation renderiza contenido simulado escrito a mano, no una captura de ensayo.** La propiedad de honestidad se mantiene — los paneles cambian de insignia y nada simulado se presenta como en vivo — pero la afirmación de "capturado contra el mismo despliegue real" todavía no es cierta. Grabar una captura real quedó pendiente.

### 1.8 Por qué esto no puede ser una aplicación de navegador puro

Dos restricciones duras del laboratorio obligan a una arquitectura específica:

1. **CORS.** Ni el gateway de API Management ni el endpoint del proyecto de Foundry emiten cabeceras CORS para un origen de navegador arbitrario. Un `fetch()` directo desde una página del navegador a cualquiera de los dos falla — incluyendo, críticamente, la comparación "la llamada directa evita API Management" que es uno de los momentos más fuertes de la demo.
2. **Manejo de credenciales.** La clave de suscripción de API Management y el token de Entra del presentador no deben incrustarse en script del lado del cliente, ni siquiera para una demo.

**Decisión de diseño:** la aplicación corre como una **aplicación de presentador alojada localmente** — un proceso ligero en la máquina del CSA que mantiene el contexto de Entra (`az login` / `DefaultAzureCredential`), lee los outputs del despliegue, intermedia todas las llamadas a Azure y sirve la interfaz al navegador o proyector. El cliente nunca necesita su propia suscripción de Azure y ningún secreto sale de la máquina del presentador.

Esto se materializó como dos procesos separados: `broker/` (Express/TypeScript, mantiene el contexto de Entra, lee `broker/.env`, intermedia cada llamada a Azure) y `demo-app/` (Vite/React, la interfaz servida al navegador). Ningún archivo original del laboratorio (notebook, Bicep, políticas, `src/`) fue modificado; todo el trabajo nuevo es aditivo.

Restricciones adicionales igualmente vinculantes: todo componente debe renderizarse correctamente en ambos modos (Live y Replay); sin scroll a 1920×1080, con compresión elegante a 1366×768 (resolución común en salas de juntas); las llamadas al SDK de Foundry necesitan `allow_preview=True`; nada que tome más de ~15 s puede correr en vivo durante la sesión.

---

## 2. Evolución del posicionamiento del producto

Esta sección documenta, de forma deliberadamente honesta, una corrección real de rumbo del proyecto: de "el gateway dual es el producto" a "Foundry primero, gateway segundo". No se oculta que hubo un error de enfoque inicial — es información valiosa para quien continúe el proyecto, porque el razonamiento detrás del error y de la corrección sigue siendo relevante para futuras decisiones.

### 2.1 La tesis original

En el primer hito del proyecto, la sección de "problema de negocio" del contexto del proyecto afirmaba textualmente que la respuesta del laboratorio era un **patrón de doble gateway**, y cerraba con la frase: *"Eso es el producto. Todo lo demás en pantalla lo respalda."* Esa frase, escrita temprano y nunca reevaluada, terminó guiando cada decisión posterior de diseño: la Request Journey se convirtió en el panel héroe, Access Control recibió el mayor presupuesto de tiempo del guion, la línea "dos puntos de control, no uno" se convirtió en la tesis de la demo, y la cifra de observabilidad más destacada fue la sobrecarga de latencia de API Management.

**¿Fue un error descabellado?** No del todo, y la distinción importa:

- **Defendible:** el repositorio padre es `AI-Gateway` y su README se presenta como "APIM ❤️ AI Foundry". Un enfoque centrado en API Management no es ajeno a ese material, y el salto este-oeste (agente → API Management → modelo) es estructuralmente real — el `AZURE_OPENAI_ENDPOINT` del agente efectivamente apunta a API Management.
- **Accidental:** se elevó a "el producto" el único componente que el propio laboratorio marca como **opcional** (`main.bicep:33` — `enableHostedAgentResponsesApi bool = false` por defecto), y nunca se preguntó qué hace *distinto* a este laboratorio frente a los demás laboratorios del mismo repositorio. La historia del punto de control de API Management es, en gran medida, común a todo ese repositorio. Los frameworks personalizados sobre Foundry Hosted Agents es lo distintivo de este laboratorio en particular, y es la parte que se trató como reparto de apoyo.

### 2.2 La autocrítica: la auditoría de posicionamiento

Una revisión de posicionamiento, realizada releyendo el README del laboratorio raíz, el README de `src/frameworks/`, las celdas de markdown del propio notebook y el `main.bicep`, llegó a un hallazgo central sin ambigüedad:

> **Construimos la demostración alrededor de API Management. El laboratorio trata sobre Foundry Hosted Agents ejecutando frameworks personalizados.**

La evidencia: el frontmatter y el título del README del laboratorio hablan de "AI Foundry Hosted Agents with Custom Frameworks"; las seis razones que el propio README da para justificar el laboratorio (§Why) son, las seis, propiedades de Foundry — ninguna es de API Management; y el notebook describe el laboratorio como el despliegue de "un agente de framework personalizado".

#### Las seis propuestas de valor del laboratorio, evaluadas honestamente

| # | Afirmación del laboratorio | Qué mostrábamos | Veredicto |
|---|---|---|---|
| 1 | Observabilidad, trazas y monitoreo integrados | Traza completa, tokens, timing por salto, atributos GenAI | ✅ Superado — lo demostramos mejor que el propio laboratorio |
| 2 | Identidad de agente y RBAC por defecto ("privilegio mínimo... en vez de secretos embebidos") | Span de managed identity como evidencia; tabla de RBAC no recuperable | ⚠️ Débil, e incómodo (ver §2.3 más abajo) |
| 3 | Guardrails y gobernanza de Foundry | Solo política RAI a nivel de modelo | ⚠️ Parcial — los guardrails a nivel de *agente* de Foundry no están configurados en este laboratorio |
| 4 | Descubrimiento mediante Agent365 | Nada | ❌ Ausente |
| 5 | Evaluación nativa y pruebas de riesgo | Nada | ❌ Ausente, correctamente — fabricar puntajes de evaluación sería dañino |
| 6 | Plano de control y operaciones de plataforma | Versiones inmutables, digest de imagen (enterrado en un diálogo) | ⚠️ Parcial y sub-expuesto |

El resultado: aproximadamente **1.5 de 6** en las razones que el propio laboratorio da para existir — mientras se puntuaba muy alto en una séptima propuesta (la gobernanza del gateway) que el laboratorio mismo no destaca.

#### El caso incómodo: identidad de agente frente a la clave en texto plano

La razón #2 del laboratorio es específicamente "acceso de privilegio mínimo a recursos de Azow downstream mediante RBAC **en vez de** secretos embebidos". Esta implementación hace exactamente lo contrario en su ruta más visible: la clave de suscripción de API Management se inyecta en el contenedor del agente como **variable de entorno en texto plano**, y el agente Strands incluso expone una herramienta `show_internal_environment_variables` que la devolvería a cualquier invocador. La aplicación ya volvía a mencionar esto honestamente, lo cual es correcto — pero la consecuencia de posicionamiento es más sutil: **el salto saliente del propio agente es el único salto de esta arquitectura que no usa Agent Identity**, y el framing de "doble gateway" convertía justamente esa debilidad en la pieza central, celebrando como diferenciador el salto que, según el propio sistema de valores del laboratorio, es el que todavía no se ha hecho correctamente.

La versión más fuerte y alineada con el laboratorio es: *"el agente sostiene hoy una suscripción de gateway; la Agent Identity de Foundry que ya tiene es lo que reemplazará esa clave, y aquí está el modelo de RBAC esperándola."* Eso es a la vez más preciso y más útil para un arquitecto. La corrección propuesta no es ocultar la clave, sino reencuadrar el salto este-oeste como **una ruta de migración hacia Agent Identity**, no como el destino final.

#### Revisión panel por panel (resumen)

La auditoría examinó cada panel existente contra lo que el laboratorio realmente enseña. Los hallazgos recurrentes:

- **AI Assistant** explicaba mejor la arquitectura del gateway que el runtime del agente — divergencia accidental, corregible reequilibrando la base de conocimiento hacia el runtime y mostrando la procedencia del contenedor en cada respuesta.
- **Request Journey** tenía como remate la latencia del gateway, cuando el remate del laboratorio para el mismo diagrama es el **enrutamiento de agentes por ruta de URL** (una API de API Management sirve a N agentes) — nunca se mostraba la URL.
- **Access Control** solo mostraba la ruta directa *fallando*, cuando el laboratorio la documenta como la línea base de troubleshooting que **debería tener éxito** con un token de Entra — se invirtió una herramienta de diagnóstico en un susto de seguridad.
- **Active Agents** demostraba la mitad de la historia: que los frameworks son intercambiables bajo la misma gobernanza, pero nunca que son **específicamente distintos** — que es la razón de ser del laboratorio para soportar frameworks personalizados. Identificado como **la oportunidad perdida más grande de toda la aplicación**.
- **Observability** era fuerte, pero su KPI principal era la sobrecarga del gateway (una métrica de API Management) en un panel de observabilidad de *agentes*; la comparación de trazas entre runtimes (Strands muestra spans de su bucle de eventos, Pydantic AI una traza plana) ya estaba capturada y nunca se mostraba.
- **Controls/Governance** listaba casi exclusivamente controles de API Management; la gobernanza del lado de Foundry (Agent Identity, RBAC de agente, evaluaciones, red teaming) estaba apenas representada.
- El **nombre de la aplicación**, "Enterprise AI Gateway", posicionaba la inversión desde el primer segundo — el laboratorio se llama "AI Foundry Hosted Agents (Custom Frameworks)".
- La aplicación no ofrecía **ningún puente de vuelta al notebook**, que es el artefacto reproducible real y el punto de partida oficial del laboratorio.

**Qué mantener sin cambios**, según esta misma auditoría: la arquitectura de honestidad (campos observables, procedencia, la división activo/disponible/no-configurado, la negativa a fabricar puntajes de evaluación); el pipeline de observabilidad; la prueba de credenciales de tres vías y el visor de política en vivo; los dos agentes registrados y conmutables; y las herramientas de presentador.

### 2.3 La corrección: "Foundry primero, gateway segundo"

La corrección de rumbo, fechada 2026-08-03, se articuló en tres documentos sucesivos, cada uno explícitamente construido sobre el anterior:

1. **`PRODUCT_POSITIONING_REVIEW.md`** — el diagnóstico (resumido arriba).
2. **`PRODUCT_REDESIGN.md`** — la primera propuesta de rediseño, con la interrogación panel por panel. Quedó **superseded** (reemplazado) por el documento siguiente el mismo día, y se conserva solo como historia — donde ambos discrepan, gana el documento posterior.
3. **La arquitectura de experiencia de producto** — el documento definitivo, "el que hay que construir", que se detalla en la sección 3 de este documento.

El contexto del proyecto se corrigió explícitamente: se retiró la frase "eso es el producto", no se suavizó. El material del gateway dual en sí es preciso, está bien construido y permanece en pantalla — lo que cambia es la afirmación que carga:

> **El producto es la primera frase; el gateway es la segunda.** Foundry convierte al agente en un activo gestionado; API Management es el perímetro alrededor de él. Una demostración del perímetro no es una demostración del activo — que es en lo que se había convertido la aplicación, y lo que esta corrección arregla.

La frase que el cliente debe llevarse, reformulada:

> *"Puedo construir agentes con el framework que mis equipos prefieran, y Azure me da una sola plataforma para desplegar, gobernar, observar y operar todos ellos."*

#### El rol de Foundry, en términos de negocio

Foundry es **la plataforma que convierte el código de agente de un equipo en un activo corporativo gestionado**:

| Necesidad de negocio | Qué hace Foundry | Evidencia en este laboratorio |
|---|---|---|
| "No quiero reescribir nuestros agentes para encajar en el runtime de un proveedor" | Ejecuta **tu contenedor**, sin cambios, detrás de un contrato estándar | Protocolo Responses v1.0.0; dos SDKs distintos, mismo contrato |
| "Necesito saber exactamente qué corre en producción" | **Versiones inmutables** — publicar crea `:2`, nunca muta `:1` | `pydantic-agent` ya está en `:3` |
| "Necesito probar qué build respondió qué request" | Versión anclada a un **digest de imagen** en ACR | Digest real, timestamp real de push |
| "No quiero otra cosa que operar" | Foundry es dueño del **ciclo de vida de hosting, escalado, salud, enrutamiento** | Documentado en el README del framework Strands |
| "Cada equipo instrumenta distinto y no puedo comparar nada" | Un solo modelo de telemetría **sin importar el framework** | Ambos runtimes emiten spans OpenTelemetry GenAI a un mismo workspace |
| "Secretos por todas partes" | Los agentes obtienen una **Agent Identity** para RBAC hacia recursos downstream | Parcialmente realizado en este laboratorio — ver §2.2 |

#### El rol de API Management, en términos de negocio

API Management es **la frontera empresarial alrededor de esos activos** — importante, estructural, pero no el protagonista:

- Los consumidores sostienen **una sola clave de suscripción**, nunca una credencial de Azure — dar de alta a un consumidor es emitir una clave, no aprovisionar identidad.
- El gateway realiza **intercambio de credenciales por request** — tokens de managed identity, emitidos al momento, nunca almacenados, en ambos saltos.
- **Una API sirve a N agentes** por ruta de URL — el décimo agente no cambia nada.
- Captura completa de prompt/completion y medición de tokens en un punto que posee el equipo de plataforma.
- Todo esto por **1–5 ms**, medido.

Y el límite honesto, desde el propio laboratorio: `main.bicep:33` fija `enableHostedAgentResponsesApi = false` por defecto, y ambos README de framework llaman "opcional" a la integración con API Management. El laboratorio funciona sin el gateway norte-sur. Eso no vuelve irrelevante a API Management — lo vuelve **la capa empresarial que se añade**, lo cual es una historia mejor y más vendible que "la cosa sin la cual nada funciona". El objetivo de proporción: API Management debería poseer aproximadamente **un acto de cinco** y un panel del dashboard — no el lugar de héroe, el mayor presupuesto de tiempo, ni la métrica principal.

### 2.4 Consecuencia práctica: qué se mantiene, qué se modifica, qué se elimina

**Se mantiene sin cambios:** el broker y toda la integración con Azure (endpoints, modelo de correlación, consultas de telemetría); la arquitectura de honestidad (campos observables, insignias de procedencia, la división de tres estados de gobernanza); la capa de datos de observabilidad (validación cruzada de tokens, timing por salto, traza distribuida); la prueba de credenciales de tres vías y el visor de política en vivo; las herramientas de presentador (guía, diagnósticos de mantenimiento, modelo de teclado, modo Simulation); el asistente en lenguaje natural y su base de conocimiento (solo cambia el *balance* del contenido hacia el runtime).

**Se modifica:** el nombre de la aplicación y el encuadre de la landing page, para liderar con Foundry; el panel de agentes, elevado a superficie héroe con capacidades y posicionamiento de cada framework; la Request Journey, re-centrada en el contenedor, nombrando el protocolo y el enrutamiento; Observability, que absorbe el catálogo de controles, lidera con métricas de agente y añade la comparación entre runtimes; Access Control, reducido, más la ruta directa autorizada; el asistente, con respuestas selladas con la procedencia del contenedor y base de conocimiento reequilibrada.

**Se elimina:** el panel de Controls como superficie independiente (se fusiona, no se descarta el contenido); la afirmación "el patrón de doble gateway... es el producto"; "dos puntos de control, no uno" como subtítulo permanente de la Journey (queda como línea de presentador, no como etiqueta fija); la primera posición de la sobrecarga del gateway en el orden de KPIs de Operations (se mantiene la métrica, se degrada su posición).

**Advertencia explícita contra la sobrecorrección**, registrada en el propio proceso de rediseño: no demover el material del gateway por despecho hacia el diagnóstico — es el contenido más fuerte para la persona que puede vetar el trato (el CISO), y el objetivo es dejar de *afirmar* que es de lo que trata el laboratorio, no dedicarle menos tiempo. Tampoco se debe fabricar ninguna diferencia de framework que no exista en el código fuente, ni simular Agent Identity en el salto del modelo — ambos agentes documentan explícitamente que usan autenticación por API key, no managed identity, para las llamadas al modelo; la versión honesta ("aquí es donde Agent Identity reemplazaría la clave") es mejor conversación de arquitectura que una afirmación falsa.

---

## 3. Arquitectura de experiencia de producto

Este es el documento definitivo — el que hay que construir contra él. Su linaje es claro: la auditoría de posicionamiento es el diagnóstico, el primer rediseño es la propuesta inicial (superada), y este es la definición de producto vigente.

### 3.1 La narrativa en cinco actos

La aplicación cuenta cinco actos, con el agente como protagonista en todos ellos y el trabajo propio del cliente visible desde el primer acto:

1. **"Ese es mi agente."** La aplicación abre sobre el agente que el cliente registró: nombre, versión inmutable, el digest de imagen que subió, el framework que eligió, corriendo. Le pregunta algo y responde. El reconocimiento es inmediato y personal.
2. **"Y este no se le parece en nada."** Existe un segundo agente: un framework distinto, con capacidades genuinamente distintas — herramientas distintas, manejo distinto del historial de conversación, uno acepta imágenes y el otro no. No es una variante — es software distinto.
3. **"A ninguno de los dos hubo que decirle nada sobre gobernanza."** Ambos cruzan el mismo punto de aplicación de políticas. Ningún contenedor sostiene una credencial de Azure. El enrutamiento es por ruta de URL, así que un décimo agente no requiere cambios en el gateway. Cuatro líneas de política lo logran, y el cliente puede leerlas, en vivo.
4. **"Y no instrumenté nada."** Ambos runtimes aterrizan en una sola superficie operativa. Mismo conteo de tokens, misma trazabilidad, mismo registro de auditoría. Las trazas incluso revelan sus internos distintos — Strands muestra su bucle de agente, Pydantic AI muestra una llamada plana — que es la prueba de que la plataforma no necesitó saber qué había adentro.
5. **"Así que esto es lo que tengo."** Qué está aplicado hoy, qué ofrece el punto de control que no está encendido, qué añade un endurecimiento de producción. Configuración, no reconstrucción.

Esa es la sección "§Why" del propio README del laboratorio, en orden, experimentada en vez de leída. El mensaje que el cliente debe recordar es la misma frase citada en §2.3.

**Un matiz sobre el orden narrativo:** el flujo propuesto no es un único agente que introduce tarde al segundo, sino **dos equipos, dos frameworks desde la premisa** — plantear la pluralidad como punto de partida hace que cada paso siguiente demuestre convergencia en vez de solo describirla.

### 3.2 Por qué los frameworks existen — y cómo difieren realmente

Este es el mayor déficit identificado: la razón de ser del laboratorio, y donde la aplicación estaba casi en silencio. Ambos README de framework responden "por qué elegiría este", y nunca se había expuesto ninguno de los dos:

- **Strands** — un toolkit de código abierto centrado en construir agentes de producción con flexibilidad de modelo/proveedor, gestión de contexto integrada, límites de ejecución, observabilidad y control de runtime basado en hooks. Buen encaje para automatización de flujos con muchas herramientas, para dirigir el comportamiento del runtime con hooks, y cuando la visibilidad y el control operativo del bucle del agente son la prioridad.
- **Pydantic AI** — el agente es la abstracción primaria: un contenedor de instrucciones, herramientas/toolsets, tipado de salida estructurada, tipado de dependencias, configuración de modelo y capacidades reutilizables. Buen encaje cuando la forma y validación de la salida importan a sistemas downstream, cuando se necesitan dependencias tipadas y retroalimentación de un chequeador estático, y para componer comportamiento reutilizable.

Esa es una distinción real de decisión de ingeniería — **control de runtime frente a seguridad de tipos y contratos de salida** — exactamente el tipo de decisión que discuten los equipos de plataforma.

Las diferencias reales, verificadas directamente en el código fuente de ambos frameworks:

| Capacidad | Strands | Pydantic AI |
|---|---|---|
| Herramientas expuestas | `get_weather` **+** `show_internal_environment_variables` | `get_weather` únicamente |
| Ejecución de herramientas | Bucle de agente de Strands, del lado del servidor | `@tool_plain` |
| Historial de conversación | `Messages` nativo, `SlidingWindowConversationManager(20)` | **Aplanado a un prompt de texto** (`"role: text"`) |
| Entrada de imagen | **Soportada** — URLs `data:` inline → bytes crudos | No implementada |
| Streaming | `agent.stream_async()` | `run_stream()` + diferenciación de prefijos |
| Cancelación | Vinculada a `agent.cancel()` | Interrupción cooperativa del bucle |
| Forma de la traza observada | `invoke_agent → execute_event_loop_cycle → chat → chat gpt-5-mini` | Plana: `chat gpt-5-mini` |

**Qué debe demostrar la aplicación — y qué explícitamente no:**

- **No es un benchmark.** Nada de "más rápido", "mejor" ni puntajes. Las diferencias de latencia observadas son varianza del modelo, no calidad de framework, y presentarlas como calidad sería deshonesto.
- **Sí: son software distinto.** Capacidades distintas, visibles.
- **Sí: Azure no obliga a elegir.** Ambos registrados, ambos corriendo, ambos alcanzables.
- **Sí: la gobernanza es idéntica.** Misma política, mismo modelo de identidad, misma auditoría, misma forma de telemetría — y ningún contenedor se modificó para obtenerlo.

El momento de mayor valor disponible para esta demo, y el que no estaba construido: preguntarle lo mismo a ambos agentes y mostrar una capacidad que uno tiene y el otro no. Esa es la tesis del laboratorio en una sola interacción.

### 3.3 Las cinco superficies del panel

Interrogando honestamente los seis paneles existentes con la pregunta: *¿hace visible una capacidad del laboratorio, o existe porque seguíamos agregando cosas?* — el panel de Controls resultó ser el artefacto más claro de "lo agregamos porque estábamos agregando cosas": duplicaba la pestaña de Governance del panel de Observability, que hace el mismo trabajo con evidencia por request. Eliminarlo no cuesta nada y libera el espacio que necesita la historia de frameworks.

La estructura resultante — seis paneles se convierten en cinco, nombrados por lo que enseñan y no por el servicio de Azure detrás de ellos:

| # | Superficie | Responde | Reemplaza |
|---|---|---|---|
| ① | **Your Agent** | ¿Mi contenedor está corriendo, y funciona? — la conversación, siempre sellada con qué contenedor, framework y versión respondió | AI Assistant |
| ② | **Frameworks** *(héroe)* | ¿Por qué dos, y qué difiere realmente? — ambos agentes lado a lado: posicionamiento de framework, versión, digest de imagen, protocolo, herramientas declaradas, matriz de capacidades, estado en vivo | Active Agents, ampliado |
| ③ | **Request Path** | ¿Cómo llega un request a mi contenedor, y qué añade la plataforma? — protocolo Responses, enrutamiento por ruta, los dos saltos de gobernanza con su costo medido | Request Journey, re-centrada |
| ④ | **Enterprise Boundary** | ¿Quién puede alcanzarlo, y en qué términos? — los tres resultados de credenciales, la ruta directa autorizada, la política de cuatro líneas en vivo | Access Control, reducido |
| ⑤ | **Operations** | ¿Cómo opero una flota de estos? — telemetría entre runtimes, tokens, trazabilidad, registro de auditoría, y el catálogo de gobernanza a través de **ambos** planos | Observability + Controls fusionados |

### 3.4 Inventario de capacidades

Resumen de qué demuestra la aplicación de lo que el laboratorio realmente ofrece (leyenda: ✅ demostrado · 🟡 parcial · ❌ el laboratorio lo nombra pero no lo implementa · 🚧 implementable con trabajo adicional sobre lo ya desplegado):

**Foundry Hosted Agents (la plataforma):** el concepto de Hosted Agent 🟡 (nombre y versión mostrados, la idea nunca explicada visualmente); el protocolo Responses v1.0.0 🚧 (nunca mencionado en la interfaz, siendo el contrato que hace conectable cualquier framework); la cadena de suministro de imagen ACR 🟡 (digest y timestamp existen, enterrados en un diálogo); el versionado inmutable 🟡 (`:3` visible, la propiedad de inmutabilidad nunca se explicita); `az acr build` sin Docker local 🚧 (beneficio real para el practicante que el README destaca); el flujo de despliegue/registro ❌ como capacidad de la app (ocurre en el notebook; la app no muestra rastro de él).

**Runtime de framework (el tema del laboratorio):** dos frameworks coexistiendo ✅; por qué existe cada framework 🚧; diferencias de capacidad entre frameworks 🚧 (herramientas, historial, entrada de imagen — todo real, todo en el código fuente, nada mostrado); llamadas a herramientas 🚧 (ambos exponen `get_weather`, nunca ejercitado); entrada de imagen (solo Strands) 🚧; multi-turno con `conversation_id` 🚧; streaming SSE 🚧.

**Gobernanza e identidad:** políticas de API Management en vivo desde ARM ✅; managed identity en ambos saltos ✅; aplicación de credenciales (401s) ✅; enrutamiento multi-agente por ruta 🚧 (arquitectónicamente real, nunca mostrado); Agent Identity para RBAC downstream 🟡/❌ (Foundry la otorga, pero ambos agentes documentan que usan API key para llamadas al modelo — real como capacidad de Foundry, no ejercitada en esta ruta); asignaciones de rol RBAC ❌ (no recuperable con la identidad del presentador; solo diseño documentado, nunca afirmación en vivo); guardrails a nivel de agente de Foundry ❌ (solo la RAI del despliegue del modelo está configurada).

**Observabilidad y operaciones:** medición de tokens ✅; timing por salto de gateway ✅ (1–5 ms medidos); trazabilidad distribuida ✅ (7–10 spans reales); comparación de trazas entre runtimes 🚧 (recolectada, nunca expuesta — la mejor prueba disponible de la propuesta de valor #1 del laboratorio); Application Insights / Log Analytics 🟡 (usados constantemente, nunca nombrados en pantalla); registro de auditoría completo ✅; comportamiento de cold start/escalado 🚧 (8–17 s medidos).

**Nombrado por el laboratorio, no implementado por él (declarar como capacidades de plataforma, nunca como demostraciones):** descubrimiento vía Agent365 ❌; evaluaciones/red teaming ❌ (correctamente ausente — fabricar un puntaje para una audiencia de riesgo de modelo sería activamente dañino); flujos de estimación de costos ❌.

**Resumen:** de las seis propuestas de valor propias del laboratorio, se demuestra completamente **una** (observabilidad), parcialmente **tres**, y no se pueden demostrar **dos** sin inventar cosas — lo cual no se hará.

### 3.5 La prueba de aceptación

Un arquitecto de Microsoft que acaba de correr el notebook abre la aplicación y, sin que se le indique nada:

1. ve **su propio agente** — nombre, versión, imagen — en cinco segundos;
2. ve el **segundo framework** y puede enunciar una diferencia real entre ambos en una frase;
3. entiende que **ningún contenedor fue modificado** para obtener gobernanza, identidad o telemetría;
4. puede leer las **cuatro líneas de política** que lo hacen exigible;
5. sabe **qué haría falta** para correr esto en producción;
6. puede **volver al notebook**.

Cuando las seis se cumplen, la frase objetivo llega sola: *"Sí. Esto demuestra exactamente lo que vale el laboratorio."*

---

## 4. Sistema de diseño visual (UI)

### 4.1 La metáfora organizadora: un escenario, no un panel de control

Un dashboard es una superficie que se *monitorea*. Un escenario es una superficie que se *dirige*. La aplicación es un escenario: la página no se queda ahí mostrando todo a la vez — empieza en silencio, y los componentes se iluminan en secuencia mientras el presentador conduce la historia. La atención de la audiencia se guía, no se dispersa. Esa única decisión es lo que permite que una sola página cargue una narrativa de cinco actos sin convertirse en un volcado de información.

De ahí se desprende todo lo demás: los componentes tienen **estados**, no solo contenido; el orden del layout **es** el orden del argumento; y nada es visible antes de ser relevante.

**Qué significa "producto premium de Microsoft" aquí:** no cromo, ni degradados, ni una imagen héroe. Significa: **confianza** (espacio en blanco generoso — un producto que necesita llenar cada píxel es un producto inseguro de su valor); **contención** (un solo color de acento, dos niveles de elevación, sin movimiento decorativo); **precisión** (una escala tipográfica y de espaciado estricta, alineación óptica); **honestidad** (cada cifra lleva procedencia, ningún número sin etiquetar); **calma** (nada parpadea, gira ni pulsa salvo donde eso comunique algo). El punto de referencia son las superficies de administración de Microsoft 365 y Fluent 2 — limpio, tipográfico, de baja saturación — **no** Azure Portal; el lenguaje visual debe decir eso mismo en el primer segundo.

**Nota de evolución del diseño:** el diseño original proponía cinco pantallas secuenciales. Se decidió que una sola página es el instrumento mejor para una sesión de diez minutos — navegar cuesta segundos, rompe el contacto visual y le da a la audiencia la oportunidad de "resetearse". Los cinco actos sobreviven intactos; se convierten en **regiones de una página, reveladas en orden**, en lugar de destinos separados. Esta decisión de "una página" es independiente de — y anterior a — la corrección de posicionamiento descrita en la sección 2; lo que cambió después no fue el principio de página única, sino cuál de las regiones ocupa el lugar de héroe.

### 4.2 Decisiones de componentes: qué se mantuvo, qué se eliminó, qué se añadió

| Componente | Veredicto original | Razonamiento |
|---|---|---|
| Chat | Mantener, reducido radicalmente a "Ask": una pregunta, una respuesta, sin transcripción | Un chat invita a la audiencia a evaluar la calidad de la respuesta del modelo — una conversación de commodity que no se puede ganar en una sala de juntas |
| Request Journey | Mantener, promovido a héroe (en el diseño original) | El patrón de doble gateway era, en ese momento, "el producto" — ver sección 2 sobre cómo cambió este razonamiento |
| Governance Summary | Mantener, reencuadrado como "Controls": activo vs. disponible, en vez de un "resumen" vago | Un inventario concreto es más persuasivo que una afirmación genérica |
| Active Agents | Mantener, pequeño en el diseño original | "Dos frameworks bajo un mismo modelo de gobernanza" es un hecho poderoso — es un *hecho*, no un dashboard, y debía dimensionarse así |
| Azure Resources Status | **Eliminar** | Recrea Azure Portal (prohibido explícitamente); sin valor ejecutivo; invita a desviarse del guion; telemetría de un grupo de recursos recién creado no cuenta ninguna historia |
| Recent Requests | **Eliminar** — un elemento rescatado | Un log de requests es un artefacto de desarrollador y el componente con más probabilidad de avergonzar en vivo (Application Insights tiene 1–3 min de retraso de ingesta, así que durante la demo estará vacío o desactualizado justo cuando el presentador apunte a él). Lo rescatable: el **registro de auditoría** — un prompt y una completion reales capturados en el gateway, el artefacto que una función de cumplimiento de un banco realmente quiere |
| Demo Controls | Mantener, casi invisible | Necesario (Live/Replay, reset, selección de agente) pero corrosivo si es visible — un panel etiquetado "Demo Controls" le dice a la audiencia que está viendo una demo y no un sistema |
| Access Control | **Añadido**, no estaba en la lista original de candidatos | El componente más importante de la página: la prueba de credenciales de tres vías es el momento en que un CISO escéptico cambia de postura, es 100% en vivo y visualmente inequívoco |

### 4.3 Composición del layout, tal como se construyó

El diseño original especificaba una cuadrícula de 12 columnas apilada de arriba hacia abajo. Durante la implementación, por instrucción explícita del presentador, se reemplazó por una **composición de dos columnas**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HEADER — marca del producto · región · conteo de recursos · ● Live       │
├────────────────────────┬─────────────────────────────────────────────────┤
│                        │  REQUEST JOURNEY                     (héroe)    │
│  AI ASSISTANT          ├──────────────────────────┬──────────────────────┤
│  ~35%, full height     │  ACCESS CONTROL          │  AGENTS              │
│  multi-turno           ├──────────────────────────┼──────────────────────┤
│                        │  AUDIT RECORD            │  CONTROLS            │
└────────────────────────┴──────────────────────────┴──────────────────────┘
```

Dos desviaciones respecto al diseño original, ambas por instrucción explícita del presentador, ninguna de las cuales cambió la arquitectura, la separación de capas de servicio ni el límite de "nada de Azure en el navegador":

1. **Layout** — la cuadrícula de 12 columnas apilada verticalmente se convirtió en la composición de dos columnas de arriba (AI Assistant a ~35% en la izquierda, a toda la altura; las visualizaciones apiladas a ~65% en la derecha).
2. **Ask → AI Assistant** — el "Ask" deliberadamente de un solo turno se convirtió en un asistente persistente multi-turno, con historial desplazable, timestamps por mensaje y escenarios sugeridos. El riesgo que el diseño original quería evitar (la sala debatiendo la calidad de la respuesta) sigue siendo real y el presentador debe seguir gestionándolo verbalmente.

El presupuesto vertical de la composición original de una sola columna se ajustaba con margen a 1080 px de alto; el layout de dos columnas mantiene la misma regla de "sin scroll de página" fijando el contenedor externo al viewport, con una única excepción intencional: el historial de mensajes del asistente se desplaza dentro de su propio panel.

Posteriormente, la arquitectura de experiencia de producto (§3.3) redefinió qué región ocupa el lugar de héroe — de Request Journey a Frameworks — y fusionó Controls dentro de Operations. Ver §2.4 y la nota de la sección 5 sobre el estado de esta migración.

### 4.4 Qué debe demostrar cada superficie (resumen funcional)

Cada componente se especificó originalmente contra nueve atributos (propósito, posición, tamaño, información mostrada, recurso de Azure, en vivo/simulado, frecuencia de actualización, interacciones, mensaje de negocio). Los detalles pixel-a-pixel se omiten aquí; lo que sigue es el propósito y el mensaje de negocio de cada una, que es lo que sobrevive a cualquier reordenamiento de layout:

- **AI Assistant (antes Ask/Answer)** — probar que la plataforma responde y nada más; existe para comprarse el derecho de hablar de gobernanza durante el resto de la sesión. Mensaje de negocio: *"Esto es un sistema funcionando, no una diapositiva."* En Live, cada mensaje es un round-trip real API Management → Foundry → API Management → `gpt-5-mini`; los prompts sugeridos envían siempre una pregunta guionizada pero renderizan siempre la respuesta real del agente — el texto de respuesta enlatado solo existe en modo Simulation.

- **Request Journey / Request Path** — hacer visible e intuitiva la arquitectura de doble gateway. Cinco nodos en una traza horizontal (Cliente → API Management → Agente → API Management → `gpt-5-mini`), cada uno con una etiqueta y un hecho de credencial de una línea, iluminándose en secuencia mientras el request se ejecuta. El énfasis originalmente caía en el paso 4 (el agente no llama al modelo directamente, llama al gateway de inferencia) bajo la tesis "dos puntos de control, no uno"; la arquitectura de experiencia posterior pide re-centrar el nodo del agente y mostrar la ruta de enrutamiento por URL. El timing por salto (🟡, con retraso de Application Insights) y el procesamiento interno del agente (derivado, nunca medido directamente) deben etiquetarse explícitamente como tales; si un ensayo muestra que los dos saltos no correlacionan en una sola traza distribuida, se asocian por ventana de tiempo y la interfaz lo marca como aproximación, nunca como una transacción medida como una sola unidad.

- **Access Control / Enterprise Boundary** — probar la seguridad por demostración, no por afirmación. Tres resultados en vivo, ejecutados en secuencia: con clave de suscripción (200 OK), sin clave (401, rechazado en el gateway), directo a Foundry sin token de Entra (401, rechazado por Foundry). Un "ledger de credenciales" resume lo que el cliente sostiene (una clave de suscripción de API Management, ninguna credencial de Azure AD), lo que API Management añade (un token de managed identity minteado por request, audiencia `https://ai.azure.com`, nunca almacenado), y lo que el agente sostiene para llamadas al modelo (una clave de suscripción al gateway de inferencia, no una clave de modelo). **Inversión de color crítica:** un 401 se renderiza como resultado **afirmativo**, nunca como error — un escudo o candado, nunca un triángulo de advertencia; el rojo no aparece en ningún lugar de esta página. Es la decisión semántica más importante de todo el sistema visual. Mensaje de negocio: *"El cliente sostiene una sola clave. Nunca toca Azure."*

- **Active Agents / Frameworks** — mover la conversación de un agente a una flota, y desactivar la objeción de vendor lock-in antes de que se plantee. Registro de agentes (nombre, versión inmutable, estado, framework, recursos), cadena de procedencia (origen → imagen ACR + tag + digest + timestamp de push → versión de agente → instancia corriendo), identidad y permisos (tabla de RBAC en vivo, cuando es recuperable), configuración (claves de variables de entorno, valores enmascarados) y guardrails (política RAI leída en vivo). Mensaje de negocio: *"Tus equipos eligen su framework. Tú mantienes un solo modelo de gobernanza."*

- **Controls / Operations (gobernanza fusionada)** — convertir "gobernanza de IA" de una aspiración en un inventario. Dos columnas: lo **activo en este despliegue** (verificado en vivo desde la configuración corriendo) y lo **disponible mas no habilitado aquí** (declarado explícitamente como no configurado). La segunda columna no es una debilidad — es la hoja de ruta, y presentarla honestamente vale más que un evento de throttling fabricado. Mensaje de negocio: *"Ya posees el punto de control. Encender esto es configuración, no una reconstrucción."*

- **Audit Record** — entregarle a la función de cumplimiento el artefacto que realmente necesita. Un único registro real capturado en el gateway (`ApiManagementGatewayLlmLog`), mostrado completo en vez de veinte filas truncadas. Mensaje de negocio: *"Cada interacción de IA en tu organización queda registrada centralmente — sin importar qué equipo construyó el agente o qué framework eligió."* Es también el momento correcto para nombrar, sin que se pregunte, que el laboratorio registra al 100% de muestreo con captura completa de mensajes — una decisión de gobernanza de datos que el cliente debe tomar conscientemente.

- **Header (chrome)** — establecer en una sola línea que esto es infraestructura real de Azure: región, conteo de recursos, grupo de recursos, estado de conexión (Live con timestamp, o Simulation). Sirve la necesidad legítima detrás del panel eliminado de "Azure Resources Status" a 1/40 del costo visual.

- **Menú de presentador (chrome, casi invisible)** — instrumentos del presentador deliberadamente retirados de la atención de la audiencia: alternador Live/Replay (implementado como "Azure Live"/"Simulation"), reset al estado inicial, selección de agente objetivo, calentar agente, refrescar telemetría. Controlado principalmente por atajos de teclado para que el presentador nunca rompa el contacto visual.

### 4.5 Sistema visual: principios (no valores pixel-a-pixel)

Los valores exactos de tipografía y espaciado (familia Segoe UI Variable, cuatro tamaños de fuente, escala de 4 px, cuadrícula de 12 columnas con canaletas de 24 px y márgenes de 48 px) están documentados en el código y no se reproducen aquí. Lo que sí vale la pena preservar es el razonamiento detrás de cada decisión:

- **Tipografía:** cuatro tamaños, sin más — ningún peso por debajo de 400, porque los pesos finos se desintegran en proyectores. El cuerpo base (16 px) es el "piso de proyector": nunca más pequeño.
- **Color:** lienzo en gris muy claro, nunca blanco puro (el blanco puro genera reflejo en proyectores); un único color de acento reservado para estado "en vivo" y acciones primarias; un color "afirmativo" distinto del acento, reservado para los rechazos de seguridad (los 401); contenido ilustrativo en un tratamiento visiblemente atenuado, para que la distinción sobreviva incluso a una fotografía de la pantalla. Se requiere una variante oscura, porque la iluminación de la sala de juntas varía y esa preferencia no es nuestra para adivinar.
- **La inversión de color** (ya descrita en §4.4): un 401 en Access Control es éxito, no error. Ningún rojo ni triángulo de advertencia aparece en ninguna parte de la página — no hay ningún estado de fallo que se quiera comunicar visualmente; una caída real recae en el modo Replay en lugar de renderizar un error.
- **Elevación y forma:** solo dos niveles (lienzo y superficie); tarjetas definidas por un borde de 1 px en vez de sombra — las tarjetas con mucha sombra se leen como plantilla web, las líneas finas se leen como producto.
- **Movimiento:** solo donde comunica significado — la iluminación secuencial de los pasos de la Journey, el ritmo de la secuencia de pruebas de Access Control, la expansión de detalle. Nada más se mueve: sin shimmer de esqueleto, sin puntos pulsantes, sin spinners de más de un segundo (un spinner en un proyector se lee como fallo).
- **Insignias de procedencia (no negociable):** todo componente que muestra datos lleva exactamente una — `● Live · 14:32`, `◐ Live · delayed 2m`, `◑ Replay · 29 Jul`, `○ Illustrative`. Esta es la expresión visual del principio de honestidad de §1.6, y es lo que le permite al presentador mantenerse relajado frente a una pregunta hostil.

### 4.6 Estados de página

La página es un escenario con cuatro estados de iluminación: **Opening** (carga o reset — el header y el punto de entrada a plena presencia, el resto atenuado, la página visiblemente "esperando"); **Executing** (disparado un Ask — la Journey se ilumina de izquierda a derecha, la respuesta se transmite); **Resolved** (respuesta completa — la respuesta, procedencia y tiempos por salto se asientan, la banda inferior sube a plena presencia porque la conversación de gobernanza ya está disponible); **Interrogated** (cualquier detalle expandido — la tarjeta expandida se eleva, el resto retrocede al 60%, se está examinando una sola cosa). El estado Opening es lo que hace funcionar una sola página: la audiencia no ve todo el argumento antes de que el presentador lo haya expuesto.

### 4.7 Restricciones y degradación

**No es una herramienta de desarrollador:** ausentes por diseño los constructores de requests, editores de cabeceras, exploradores de esquema, selectores de endpoint, configuración de entorno, muestras de código, "copiar como cURL", o inspectores de respuesta más allá de una vista cruda colapsada.

**No es Azure Portal:** sin árbol de recursos, sin blades, sin breadcrumbs, sin conjunto de íconos por tipo de recurso, sin grid de salud. El lenguaje visual no debe confundirse con el portal a primera vista — esa confusión haría que la aplicación se sienta como una versión peor de algo que el cliente ya tiene.

**Degradación de resolución:** diseñada para 1920×1080 sin scroll; escala proporcional a 1600×900; a 1366×768 (resolución común en salas de juntas) la Journey se reduce, la banda inferior se comprime y el Audit Record colapsa a una línea resumen expandible — pero **sigue sin haber scroll**; por debajo de 1366 no hay soporte, el presentador debe usar una pantalla adecuada.

Esta regla tiene exactamente una excepción declarada — la pestaña Referencia del Gateway, que es un documento y no una pantalla de escenario. Ver §4.9 para la excepción y, sobre todo, para la prueba que impide que se propague a una segunda pantalla.

---

### 4.8 La pestaña Credenciales del Gateway — medida dos veces, y se queda

**Estado: RESUELTO en CP3 (2026-09-02). La pestaña se queda. Se reevaluó bajo el nuevo cromo tal como esta sección exigía, y la medición de abajo es la razón por la que ya no es provisional.**

**La reevaluación, paso a paso, como §4.8 la especificó originalmente.**

*Paso 1 — volver a medir bajo el cromo del sidebar.* El riel de navegación
eliminó la cabecera de entorno de 72px y la fila de secciones de 48px, llevando
el presupuesto vertical de 411px a 507px. La pantalla Gateway "En vivo", medida
con datos reales cargados, tiene 423px de contenido en ese presupuesto de 507px:
**84px de margen**. Por sí sola ahora cabe con holgura, que es precisamente la
condición que hacía que valiera la pena reabrir la pregunta.

*Paso 2 — ¿cabe el test de credenciales de vuelta en la pantalla en vivo, con
margen real?* **No.** No estimado: el cuerpo de credenciales se injertó en la
pantalla en vivo en un navegador en ejecución y se midió.

| | px |
|---|---|
| Pantalla en vivo sola | 423 |
| Cuerpo de credenciales + su título de sección | 138 |
| **Fusionadas** | **561** |
| Presupuesto | 507 |
| **Oculto** | **54** |

Y eso es el test de credenciales en su estado *vacío*. Una vez ejecutados los
tres intentos —el estado en el que el presentador está de verdad cuando el 401
importa— el cuerpo crece a 132px, así que la pantalla fusionada oculta **64px**.
Los 96px extra de presupuesto que dio el riel son reales, y aun así se quedan
64px cortos de lo que cuesta la reintegración.

*Paso 3 — decidir vecindad en vez de dejarla por defecto.* La pestaña se queda
entre **En vivo** y **Referencia**, y ese orden ahora es deliberado y no
incidental. En vivo y Credenciales son ambas lecturas de este despliegue;
Referencia no lo es. Poner Credenciales después de Referencia colocaría una
pantalla medida al otro lado de la frontera que el marco punteado, el banner y
las píldoras existen para trazar, que es la única disposición que este conjunto
de pestañas no debe tener.

**Lo que esto cuesta, dicho igual de claro.** El rechazo 401 está a un clic en
vez de en pantalla. Es el beat más importante de la historia del gateway y el
único verde de la consola. Eso no ha dejado de ser un costo porque la medición
saliera en contra de la reintegración — simplemente es un costo sin alternativa
más barata, y lo honesto es mitigarlo, no fingir que no existe:

- El atajo `S` ejecuta los tres intentos *y* navega a esta pestaña. La
  separación original lo rompió —ponía `stop` en `"gateway"` y por tanto
  navegaba fuera de los resultados que acababa de disparar— y se corrigió cuando
  el fallo apareció al ejecutarlo.
- La guía del presentador debería llevar la pestaña Credenciales como beat
  numerado propio, para que no pueda saltarla quien olvide que existe.

**Qué reabriría esto.** No una preferencia, y no rediseñar el diagrama de flujo
para arañar 64px. Solo un cambio que quite un argumento de la pantalla en vivo
por una razón propia, o que una resolución superior a 1366×768 pase a ser el
piso. Sin ninguna de las dos, esto queda cerrado: se midió dos veces, bajo dos
cromos distintos, y las dos veces la reintegración no cupo.

---

<details>
<summary>El registro provisional original, tal como se escribió</summary>


Medida contra el piso de 1366×768 con el método corregido (alto de contenido leído
de `panel.firstElementChild.offsetHeight`, presupuesto derivado como `728 −
(innerHeight − panel.clientHeight)`), la pantalla Gateway "En vivo" tenía **595px
de contenido en un presupuesto de 375px — 220px de ellos bajo la línea de
plegado**, y por tanto invisibles para la sala. Era la pantalla más afectada de la
consola, y a diferencia de las demás no se podía llevar a cumplimiento por
reflujo: después de todos los cambios que movían o compactaban sin eliminar un
argumento, seguía desbordando 79px.

Gateway cargaba tres argumentos donde cada otra pantalla carga uno: *la
dirección* (la URL enrutada), *el recorrido* (el diagrama de flujo y sus tiempos
medidos) y *los términos* (qué credenciales acepta la puerta de enlace). Dos
cambios lo resolvieron:

- **La dirección y el recorrido se fusionaron bajo un solo título.** No es
  provisional. Siempre fueron un mismo argumento enunciado dos veces — la URL
  dice que el nombre del agente es un segmento de la ruta, el diagrama muestra la
  solicitud recorriendo esa ruta — y dos títulos pedían a la sala mantener
  separadas las dos mitades de un solo punto.
- **Los términos pasaron a pestaña propia** (`gatewayCredentials`, entre En vivo
  y Referencia). Esta sí es provisional.

**Lo que cuesta la separación, dicho sin rodeos.** Hasta ahora el rechazo 401
estaba en pantalla sin que el presentador navegara a ningún sitio. Eso importa
más que un genérico "un clic más": el 401 es el beat más importante de toda la
historia del gateway, y es el único verde de la consola entera — `affirm` está
reservado para él y para nada más (§4.4, §4.5). Un presentador que olvide que la
pestaña existe terminará la sección de gateway sin haberlo mostrado nunca. Es una
regresión real de la demo, aceptada por una razón real.

**Por qué aun así se aceptó.** La alternativa eran 79px de contenido
permanentemente oculto en la pantalla más argumentada de la consola, que es un
fallo peor: una barra de desplazamiento a 1366 incumple §4.7 de plano, y el
contenido bajo el pliegue es contenido que la sala no ve nunca. Entre "a un clic"
e "invisible", gana un clic. También es cierto que el test de credenciales ya es
un beat separado en el guion del presentador, así que la pestaña no corta la
narrativa como sí lo habría hecho separar la dirección del recorrido.

**Qué revisar en CP3, en concreto.** La reestructuración del sidebar cambia cuánto
presupuesto vertical tiene una pantalla. Cuando llegue:

1. Volver a medir la pantalla Gateway "En vivo" bajo el nuevo cromo, con el mismo
   método.
2. Si el presupuesto ya admite el test de credenciales de vuelta en la pantalla en
   vivo *con margen real* — no el mínimo exacto; Plataforma y Agentes mostraron
   ambas por qué un margen de 0px no es una solución — entonces reintegrarlo y
   eliminar esta pestaña.
3. Si no lo admite, preguntarse en cambio si la vecina adecuada es la pestaña de
   *referencia* o la de *en vivo*, y si la guía del presentador debería convertir
   la pestaña de credenciales en un beat numerado explícito para que no se pueda
   saltar.

No concluir que la pestaña es correcta solo porque siga ahí. Resolvió un problema
de espacio el 2026-09-02; nunca se argumentó por sus propios méritos.

</details>

---

### 4.9 La regla de no-scroll de §4.7 no aplica a la pestaña Referencia del Gateway

**Estado: una excepción declarada, no un descuido. Exactamente una pantalla está exenta.**

Medida en el piso de 1366×768 con el mismo método usado en todas las demás, la
pestaña Referencia contiene **1939px de contenido en un presupuesto de 409px**.
Cada otra pantalla de la consola está en 0px oculto con margen real. Esta no lo
está, nunca lo estuvo, y no va a estarlo — lo cual es una decisión, y las
decisiones de ese tamaño no pueden vivir como un hueco silencioso en una tabla.

**Por qué existe la regla.** §4.7 prohíbe el scroll porque las cuatro pantallas
del escenario son cosas sobre las que un presentador *habla*. Su contenido es una
lectura en vivo de este despliegue — latencias medidas, la URL enrutada, los
resultados de credenciales, el catálogo de controles — y el presentador argumenta
a partir de ellas en tiempo real, ante una sala que mira el proyector y no las
manos del presentador. El contenido bajo el pliegue en esas pantallas es
contenido que la sala no ve nunca, y el presentador no tiene forma de saber que
se perdió. Ahí el scroll no es una molestia: borra en silencio parte del
argumento.

**Por qué no aplica aquí.** La pestaña Referencia no es una lectura de este
despliegue y no se narra por encima. Es material de referencia sobre API
Management como producto: ocho capacidades con su píldora "se usa aquí" / "no en
este lab", la comparación de niveles y la secuencia de identidad. De ahí se
siguen tres cosas, y las tres son lo contrario de la situación de las pantallas
del escenario:

- **Nada en ella es en vivo ni sensible al tiempo**, así que nada se pierde por
  alcanzarlo un momento después. Su único valor en vivo — el nivel de APIM —
  lleva su propia insignia `live` en línea y está cerca del inicio.
- **Se lee, no se narra.** El uso realista es un arquitecto de soluciones
  abriéndola para responder "¿qué más puede hacer?", recorriéndola con la sala, o
  enviando a un colega a ella después de la sesión. Eso es un documento, y los
  documentos se desplazan. Forzar 1939px de texto curado de capacidades dentro de
  409px significaría o recortar el catálogo a lo que quepa — haciendo que la
  plataforma parezca más pequeña de lo que es — o bajar del piso de 16px, que
  §4.5 no permite.
- **El sistema de honestidad no depende del layout aquí.** La separación entre
  referencia y vivo la sostienen el marco punteado `tone="reference"`, un banner
  permanente, un stop separado, y una píldora por capacidad. Ninguno de ellos se
  debilita cuando la página se desplaza; una píldora que quedó arriba no es una
  píldora que engañe, porque viaja pegada a la capacidad que califica.

**El límite de esta excepción, dicho para que no se propague.** Cubre la pestaña
Referencia del Gateway y nada más. La prueba para cualquier pantalla futura que
la reclame no es "¿esta pantalla es larga?" sino **"¿hay un presentador
argumentando sobre datos en vivo en ella mientras la sala mira?"**. Si la
respuesta es sí, §4.7 aplica por completo y la pantalla debe llegar a 0px oculto
con margen. Añadir material de lectura tipo referencia a una pantalla de
escenario no exime a esa pantalla — significa que el material pertenece a una
pantalla de referencia, que es la razón entera por la que existe esta pestaña.

---

### 4.10 La tarjeta KPI — seis fuentes reales, sin tendencia, y sobre todo sin costo

**Estado: definitiva. Las exclusiones de abajo son el punto de la sección — quien añada en el futuro una tarjeta de costo o de tendencia estaría deshaciendo una decisión, no llenando un hueco.**

CP4 adoptó la forma de tarjeta KPI de la referencia Foundry IQ en la única
pantalla que ya tenía seis mediciones reales que poner en ella: Observabilidad →
Mediciones. Ícono, etiqueta, valor grande, sub-línea mono. Lo que **no** adoptó
es justo lo que alguien intentará añadir de vuelta, y por eso existe esta
sección.

**Sin elemento de tendencia.** La tarjeta de la referencia está construida
alrededor de un hueco `+12%`. §1.6 pone las tendencias históricas en la banda
roja — el grupo de recursos es nuevo, no existe historia, no hay líneas de
tendencia en ninguna parte — así que ese hueco no tiene de dónde sacar un número
real. Una tarjeta diseñada alrededor de una tendencia, con la tendencia vacía o
inventada, es peor que una diseñada sin ella.

**Sin tarjeta de costo, y esta es la importante.** La tarjeta principal de la
referencia es el gasto acumulado. El costo también está en la banda roja: Cost
Management tiene 8–24h de latencia y el grupo de recursos es demasiado joven
para reportarlo. Una cifra de costo con el mismo estilo que cinco mediciones en
vivo sería lo más peligroso de toda esta adopción — heredaría su credibilidad
sin su evidencia. Si alguna vez se muestra costo, va en un panel ilustrativo
etiquetado como modelo de precios, nunca en esta rejilla.

**Las seis que sí son reales**, cada una imprimiendo en su sub-línea mono la
columna de Log Analytics de la que salió:

| Tarjeta | Fuente |
|---|---|
| Latencia | `ApiManagementGatewayLogs TotalTime` |
| Gateway | `ApiManagementGatewayLogs — TotalTime − BackendTime, both hops` |
| Latencia del modelo | `ApiManagementGatewayLogs TotalTime (inference-api)` |
| Tokens totales | `ApiManagementGatewayLlmLog TotalTokens` |
| Entrada | `ApiManagementGatewayLlmLog PromptTokens` |
| Salida | `ApiManagementGatewayLlmLog CompletionTokens` |

Esa sub-línea es la razón por la que valía la pena adoptar la tarjeta, y no un
adorno encima de ella. Todos los campos de esta pantalla ya llegan como
`{ value, source, available }`; el `source` se estaba obteniendo y luego solo se
mostraba dentro del diálogo de detalle. Imprimirlo bajo el número hace que cada
cifra diga de dónde vino, en la pantalla donde la sala la está mirando. Es el
sistema de honestidad ganando presentación, que es la única dirección en la que
se le permite moverse.

**Tres por fila, no seis.** Seis tarjetas en el escenario de 1020px posterior al
riel daban unos 160px a cada una — ya envolviendo las etiquetas, y sin sitio
alguno para el nombre de una columna de Log Analytics. Tres por fila dan ~330px,
que caben en una línea.

**Un cuadrado tintado, dos glifos.** §0.6 permite el cuadrado de ícono tintado y
lo restringe a azul; tres tintes por categoría reintroducirían exactamente la
sobrecarga de color que eliminó el hallazgo F4 de la auditoría. Los dos glifos —
un cronómetro para las tres duraciones, un signo de número para los tres conteos
de tokens — codifican una distinción real en los datos, en vez de decorar cada
tarjeta por separado.

**Una inexactitud que este cambio sacó a la luz y corrigió.** Un campo *ausente*
del payload y un campo presente con `available: false` son hechos distintos, y
la banda le estaba diciendo lo mismo a la sala sobre ambos. El segundo trae su
propia razón exacta ("Cost Management no puede reportar sobre un grupo de
recursos tan joven"). El primero simplemente aún no se ha ingestado — Log
Analytics va de uno a tres minutos por detrás — así que "No disponible en este
despliegue" era falso sobre él, y con seis tarjetas era falso tres veces a la
vez. Los campos pendientes ahora dicen que esperan la ingesta, que es lo que
`HopWaterfall`, justo debajo, venía diciendo correctamente todo el tiempo.

---

### 4.11 Los +28px de margen de Plataforma son prestados de una laguna de i18n, y traducir los nombres de control los devuelve

**Estado: hallazgo abierto, deliberadamente no corregido aquí. Esta sección
existe para que quien traduzca los nombres de control se encuentre con esto
antes de que se lo encuentre el layout.**

Medido el 2026-09-03 contra el bundle de producción, en el piso de 1366×768, con
la misma sonda usada en 4.8 y 4.9:

| Pantalla Plataforma | contenido | presupuesto | oculto | margen |
|---|---|---|---|---|
| Azure en vivo | 457px | 485px | 0px | **+28px** |
| Simulación | 536px | 485px | **51px** | −51px |

El número de Live es el que quedó registrado en CP2 ("28px de margen real en
lugar de exactamente cero"). El de Simulación es nuevo, y el primer instinto —
que Simulación desborda porque sus datos de marcador de posición son más
grandes — es falso. Live muestra *más* controles que Simulación (8 activos + 6
disponibles + 3 no presentes, contra 7 + 6). Son las etiquetas, no la cantidad.

**Los dos modos leen sus nombres de control de sitios distintos.** La ruta en
vivo los toma del broker, donde son cadenas en inglés escritas a mano
(`broker/src/routes/observability.ts`, `broker/src/routes/controls.ts`) que
viajan por el cable y se renderizan tal cual — nunca pasan por i18n. La ruta de
replay los toma de `demo-app/src/i18n/translations.ts`, donde sí están
traducidos. Así que en una sesión en español la pantalla Live muestra
"Subscription-key authentication" y la de Simulación muestra "Autenticación por
clave de suscripción, revocación por consumidor".

Medido: 31 caracteres de media en Live, 54 en Simulación. En el piso tipográfico
de 16px eso es la diferencia entre filas de control de una línea y filas de dos,
y a lo largo del catálogo son 79px de contenido — exactamente la distancia entre
457 y 536.

**Qué implica para quien lo cambie.** La ruta que está mal es la de Live: una UI
en español mostrando nombres de control en inglés es una inconsistencia con
todas las demás superficies de la consola. Pero el arreglo no es local.
Traducir esos nombres es un cambio de una línea por control que moverá el
contenido en vivo de Plataforma de 457px a unos 536px en un presupuesto de
485px, y §4.7 se romperá en la pantalla con menos espacio que ceder. Los dos
cambios son un solo cambio:

1. Traducir los nombres de control (las cadenas del broker a través de i18n, o
   mover el catálogo al frontend, donde las traducciones ya existen).
2. Volver a medir Plataforma a 1366×768 en **ambos** idiomas con la sonda de
   4.8, y reflujarla — CP2 ya gastó el espacio fácil de esta pantalla para
   llevarla de 612px a 411px, así que lo que queda es una decisión de
   composición, no un apriete.

No trate los +28px como holgura mientras tanto. No es margen que el diseño se
haya ganado; es margen que el diseño conserva sólo porque una superficie está
sin traducir, y está denominado en un idioma que la sala quizá no esté leyendo.

**Relacionado, misma pantalla, no el mismo defecto:** al cambiar Live →
Simulación queda el total en vivo anterior ("Total: 13.5 s") renderizado sobre
el diagrama de Gateway mientras el resto del panel ya cambió a texto ilustrativo.
Anotado aquí y no en §6 porque es la misma forma de "un cambio de modo no
reinicia del todo el estado derivado", y quien tome lo anterior estará en los
archivos correctos para verlo.

---

## 5. Coreografía de la demo, riesgos y preparación

El guion recomendado ocupa 12 a 15 minutos: abrir con un intercambio de pregunta/respuesta (~90 s, "eso es un agente gobernado en tu nube"), seguir con las tres pruebas de Access Control y la revelación de la política en vivo (~3:30, el momento pivote), continuar con Agent Governance — dos frameworks, un modelo de gobernanza, cadena de procedencia, RBAC en vivo (~3 min), animar los seis pasos de la Request Journey (~3 min), y cerrar con Platform Control — registro de auditoría real, catálogo de controles, encuadre honesto de costos (~3 min), dejando el catálogo de controles como el artefacto natural de la siguiente conversación.

**Preparación previa — nunca en vivo durante la sesión:** el despliegue de Bicep (~30–45 min, dominado por el aprovisionamiento de API Management Basicv2); `az acr build` para ambos frameworks (varios minutos cada uno); registrar ambos agentes (`pydantic-agent`, `strands-agent`); publicar una segunda versión de un agente para que el historial de versiones no esté vacío; opcionalmente añadir 2–3 suscripciones extra de API Management; **calentar el agente** (crítico, ver riesgo abajo); generar ~20 requests de calentamiento para poblar la telemetría, con al menos 5 minutos de antelación por la latencia de ingesta; grabar una captura completa de Replay como red de seguridad.

**Registro de riesgos:**

| Riesgo | Severidad | Mitigación |
|---|---|---|
| **Cold start del agente hospedado de Foundry** | **Alta** | El mayor riesgo en vivo de todo el laboratorio. Calentar inmediatamente antes de la sesión y mantener caliente con un request periódico durante el montaje; modo Replay como respaldo |
| Red del recinto bloquea endpoints de Azure | Alta | Modo Replay; tethering móvil como respaldo |
| Retraso de Application Insights deja la pantalla de telemetría escasa | Media | Generar tráfico de calentamiento con ≥5 min de antelación; el indicador de antigüedad de datos hace que la escasez se lea como honestidad, no como fallo |
| Streaming SSE bufferizado por API Management | Media | Ensayar; conservar el fallback sin streaming |
| Correlación entre saltos no disponible | Media | Recae en asociación por ventana de tiempo, etiquetada como aproximación |
| `ApiManagementGatewayLlmLog` no se puebla como se espera | Media | Confirmar en ensayo; si está ausente, recaer en los registros de Application Insights y que el presentador declare la limitación en vez de sustituir con contenido inventado |
| Token de `az` expirado a mitad de la demo | Media | Refrescar antes de la sesión; el proceso host expone el estado de autenticación en el header |
| Clave de suscripción visible en el proyector | **Alta** | Enmascarar a los últimos cuatro caracteres en todas partes, por construcción |
| Nombres de principal sin resolver (permiso de Graph) | Baja | Mapeo de nombres amigables para identidades conocidas; nunca fabricar un nombre |

**Todo modo de fallo se recupera declarando la limitación, nunca sustituyendo con contenido inventado.** El alternador a Replay es la recuperación universal; el cold start del agente es el riesgo #1.

---

## 6. Hallazgos técnicos y defectos conocidos del laboratorio

Registrados durante el análisis y documentados en vez de corregidos silenciosamente, porque volverlos visibles construye más credibilidad frente a una audiencia técnica que ocultarlos:

- **Tres defectos reales en el laboratorio, encontrados durante el análisis:**
  1. El output `hostedAgentResponsesApimPath` emite `…/hosted-agent-responses/responses`, que no es una ruta que la API expone — remanente de un diseño abandonado de `agent_reference` en el cuerpo del request.
  2. La documentación referencia `src/responses/agents/frameworks/…`; la ruta real es `src/frameworks/…`.
  3. `main.bicep` codifica en duro los literales de nombre `'-foundry-models'` / `'-foundry-agents'`, así que renombrar entradas en el `aiServicesConfig`, que por lo demás está parametrizado, rompe la plantilla.

- **Observaciones de seguridad para volunteer, no ocultar:** la clave de suscripción de API Management se inyecta en el contenedor del agente como variable de entorno en texto plano; el agente Strands expone una herramienta `show_internal_environment_variables` que devuelve todas las variables de entorno a quien la invoque; `disableLocalAuth` no está activado; la cuenta de administrador de ACR está habilitada; no existe ninguna política de rate-limiting.

- **El cold start del agente hospedado de Foundry** es el mayor riesgo de demo en vivo de todo el laboratorio (8–17 s medidos).

- **`az acr build`** construye en ACR Tasks — sin Docker local, y garantiza Linux/amd64.

---

## 7. Nota sobre el estado de implementación de esta corrección

Este documento consolida seis fuentes que no todas comparten la misma fecha ni el mismo estado de "aprobado e implementado". La tensión que dejaban planteada — si la migración de héroe (de Request Journey a Frameworks) y la fusión de Controls dentro de Operations llegaron a implementarse — **sí se verificó directamente contra el código real de `demo-app/` durante el desarrollo**, no solo contra estos documentos de diseño:

- **Controls se fusionó en Operations, confirmado.** La sección "Plataforma" de la consola construida (`src/features/operations/OperationsStop.tsx`) es una única superficie que combina el entorno desplegado, el catálogo de controles en sus tres estados (activo / disponible / ausente) y las acciones de mantenimiento — exactamente la fusión que describe la sección 4.4 bajo "Controls / Operations (gobernanza fusionada)".
- **La composición de "escenario de una sola página con regiones simultáneas" de la sección 4.3, sin embargo, no es la arquitectura final.** La consola tal como se construyó no es una sola página con paneles siempre visibles — es una navegación por **cuatro secciones de nivel superior** (Agentes, Gateway, Observabilidad, Plataforma), cada una su propia vista de pantalla completa, seleccionada mediante pestañas (`SectionNav`). Agentes es la primera sección, consistente con el reencuadre "Frameworks primero" de la sección 3, pero como sección propia, no como región héroe dentro de una composición de dos columnas. La metáfora de "escenario" y los estados de iluminación (4.6) sobreviven en espíritu — hay una jerarquía de atención deliberada — pero el mecanismo concreto es distinto al descrito en 4.3.

Quien continúe el proyecto puede tratar la sección 4.3 como el registro histórico de una decisión intermedia, no como la descripción vigente del layout — la fuente de verdad actual es el código de `demo-app/src/layout/` y `demo-app/src/features/`.

---

## 8. El lab dejó de desplegar su propio API Management y se unió a un gateway compartido

**Estado: hecho y verificado en producción el 2026-09-04. Lo que deliberadamente NO se hizo está al final, y es la mitad más importante de esta sección.**

### Por qué

Una instancia de API Management es lo más caro que crea este lab, y creaba una nueva en cada despliegue. Varios equipos ya comparten `apim-shared-pdcibwky2f5ms` (tier Developer, `rg-shared-apim-gateway-V2`) exactamente por eso. Este lab ahora se registra ahí.

El costo es una restricción real sobre cuántas veces se puede redesplegar; el riesgo es que un gateway compartido convierte cada error en problema de otros. Todo lo que sigue está moldeado por lo segundo.

### La regla que marcó la diferencia: todo nombre lleva prefijo del lab

Que ARM cree un recurso hijo que ya existe es una **actualización en sitio**, no un error. Así que un nombre sin prefijo se apropia en silencio del recurso de otro equipo.

No era hipotético. Este lab venía con el nombre de suscripción por defecto del notebook, `subscription1`. En el gateway compartido `subscription1` ya existe, pertenece al lab de FinOps, tiene alcance a su producto `finops-framework-platinum`, y lleva una **cuota de costo de 0,05 USD cableada a una Logic App que suspende la clave automáticamente**. Desplegar tal cual habría secuestrado su suscripción *y* puesto el tráfico de esta demo bajo una cuota que no controla. El reconocimiento que encontró esto es la razón por la que la migración empezó con un renombrado y no con bicep.

Por eso todo es `hosted-agents-*`: las dos APIs y sus paths, el backend, el producto, la suscripción y el diagnosticSetting.

### Por qué la separación vive aquí y no en `vendor/`

`vendor/` se mantiene byte-idéntico a upstream, con parches mínimos y documentados. Enseñar al `main.bicep` vendorizado a usar un gateway existente no es un parche de ese tamaño, por dos razones independientes:

1. **El gateway compartido está en otro resource group.** Un despliegue con scope de resource group no puede crear hijos de un servicio ajeno; eso exige un módulo con `scope` foráneo explícito. `main.bicep` no tiene ese concepto — busca el APIM con `existing` *por nombre en el grupo actual*.
2. **Upstream no tiene interruptor.** `modules/apim/v3/apim.bicep` crea el servicio sin condición alguna. Hay condiciones para el logger y el diagnosticSetting, ninguna para el servicio.

Un parche que cubriera ambas cosas serían unas 150 líneas por el medio del archivo, y chocaría en cada `sync-vendor.ps1`. El parche de Consumption existente son diez líneas en el borde. Así que la orquestación se movió a `labs/…-automation/bicep/`, y **no se añadió ningún parche nuevo a `vendor/`**.

Dos módulos de upstream resultaron reutilizables sin modificar, y por eso costó menos de lo temido:

- `foundry.bicep` ya concede `Cognitive Services User` al `apimPrincipalId` que se le pase. Pasarle el principal del gateway compartido concede exactamente el acceso necesario — escrito sobre **nuestras** cuentas Foundry, nunca sobre el gateway compartido.
- `inference-api.bicep` está totalmente parametrizado y **no crea ningún logger**; referencia `appinsights-logger` por `resourceId` en su propio scope de despliegue, que bajo scope foráneo resuelve al existente del gateway compartido.

Sólo hubo que duplicar la API de responses, porque upstream la mantiene inline en `main.bicep` en vez de en un módulo.

### Lo que deliberadamente NO se crea en el gateway compartido

`apim.bicep` crea tres recursos de nivel servicio que **ya existen** ahí: el `appinsights-logger`, el diagnostic `azuremonitor` y `apimDiagnosticSettings`. Ese módulo no se usa en absoluto en la ruta migrada. Recrear `appinsights-logger` habría redirigido **la telemetría de todos los demás labs** al Application Insights de este.

### Telemetría, y lo que le cuesta a todos

`/api/journey/:askId` lee `ApiManagementGatewayLogs`, que llega a un workspace únicamente a través de un diagnosticSetting **de nivel recurso**. Azure permite cinco por recurso; existían tres, así que este lab añadió un cuarto (`hosted-agents-demo-to-loganalytics`), dejando uno libre.

Dos consecuencias que conviene decir sin rodeos:

- Debe llevar `logAnalyticsDestinationType: 'Dedicated'`. Sin eso las filas caen en la tabla genérica `AzureDiagnostics` y la pantalla de Observabilidad espera para siempre datos que están llegando con otro nombre. La primera versión de este archivo lo omitió, y el fallo es completamente silencioso — no hay error en ningún sitio.
- Los logs de gateway **no se pueden filtrar por API**. El workspace de este lab ingiere por tanto el tráfico de gateway de todos los labs conectados, y el suyo ya ingiere el de este. Es una propiedad del gateway compartido, no algo que este repositorio pueda arreglar.

### El teardown es parte de esta decisión, no un añadido

Los recursos que este lab crea en el gateway compartido sobreviven a su resource group. `teardown.ps1` los elimina **antes** de borrar el grupo, en un orden que nunca deja una referencia colgando, y el diagnosticSetting va primero porque es el único que quedaría apuntando a un destino que ya no existe — algo que Microsoft advierte que puede re-aplicarse a un recurso recreado después con el mismo nombre.

Que falle su borrado es **fatal**: el teardown se detiene antes de tocar el resource group. Dejar nuestro propio grupo intacto es recuperable; dejar basura en el gateway de otro no nos toca deshacerlo a nosotros.

Dos cerrojos protegen el borrado, porque una lista blanca sola no basta — una edición equivocada de config simplemente se obedecería. Un nombre debe llevar el prefijo del lab; la única excepción legítima es la suscripción de nombre GUID que API Management genera para un producto publicado, y esa además debe ser confirmada **por Azure** como ligada al producto de este lab. Una versión temprana aceptaba cualquier nombre listado y habría borrado `subscription1` si la config lo hubiera dicho.

### Riesgos residuales aceptados

**La auto-suspensión de FinOps está a una fila de distancia, y no es nuestra.** Una Logic App en `lab-finops-framework-V24` hace `PATCH` contra `.../apim-shared-pdcibwky2f5ms/subscriptions/{nombre}` donde el nombre viene del payload de una alerta — no de una lista fija. Lo que hoy deja fuera a este lab es un inner join contra una tabla propia, `SUBSCRIPTION_QUOTA_CL`, que actualmente sólo contiene las cuatro suscripciones de aquel lab. **Si alguien añade una fila con `hosted-agents-subscription`, la clave de esta demo se suspende sola, sin avisarnos**, y ni la Logic App ni la tabla están bajo control de este repositorio. Aceptado, no mitigado — anotado aquí para que una demo que falle a mitad de sesión tenga un primer sitio donde mirar.

**Migrar un lab existente en sitio no es lo mismo que desplegar uno nuevo.** Upstream nombra sus asignaciones de rol con `guid(subscription, resourceGroup, config.name, roleDefinitionId)` — sin el principal id. Apuntar la misma asignación a otra identidad es por tanto una actualización que ARM rechaza (`RoleAssignmentUpdateNotPermitted`). Hubo que borrar antes las dos asignaciones del gateway viejo. Un despliegue en un resource group nuevo nunca ve esto.

**Los despliegues que tocan el gateway compartido no deben lanzarse desde Git Bash.** MSYS reescribe los argumentos que parecen rutas Unix, y un resource id de ARM que empieza por `/subscriptions/` se convirtió en una ruta de Windows antes de que `az` lo viera — dejando el gateway compartido a medio desplegar. La variable de entorno por sí sola es mal detector (la hereda también PowerShell, donde no se reescribe nada), así que sólo advierte; lo que realmente bloquea es una comprobación de forma sobre cada resource id justo antes de un despliegue de scope foráneo.

### El ahorro, materializado

`apim-7atp6hx2a4e7u` (BasicV2, ~197 USD/mes) se borró y purgó el 2026-09-04, una vez verificada de extremo a extremo la ruta compartida. ARM incremental no borra lo que una plantilla deja de declarar, así que tenía que ser un acto deliberado — y deliberadamente vino *después* de la verificación, no antes: una migración sin verificar más un fallback borrado es una demo sin vuelta atrás.

Se comprobó antes en vez de darlo por inactivo. Doce horas de `ApiManagementGatewayLogs` mostraron exactamente tres peticiones, todas `404` contra la raíz `/` con `ApiId` vacío — sondas que no encajan con ninguna API, no uso. Las dos cosas que aún podían depender de él se confirmaron por otra vía: el `APIM_GATEWAY_URL` del App Service apuntaba al gateway compartido, y que los agentes alcanzan el modelo a través de él quedó probado por una fila de hop 2 registrada bajo `hosted-agents-inference-api`.

**Aviso para quien piense en usar `teardown.ps1` aquí.** Borra el resource group entero. Cuando se quitó este APIM, el grupo contenía además las dos cuentas Foundry, el container registry, el workspace de Log Analytics que consulta la pantalla de Observabilidad, y el App Service con su plan — nueve recursos que debían sobrevivir. Quitar un recurso de un grupo vivo es un `az apim delete` dirigido seguido de `az apim deletedservice purge`; `teardown.ps1` es para desechar el laboratorio completo.

## Ver también

- [`../01-general/ARQUITECTURA_DEMO.md`](../01-general/ARQUITECTURA_DEMO.md) — la arquitectura de Azure que estas decisiones visualizan.
- [`ESTADO_DEL_PROYECTO.md`](ESTADO_DEL_PROYECTO.md) — el estado actual de implementación.
- [`HISTORIAL.md`](HISTORIAL.md) — el historial cronológico completo del desarrollo.
