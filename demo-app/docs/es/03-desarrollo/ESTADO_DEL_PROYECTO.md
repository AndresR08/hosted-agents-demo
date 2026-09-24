# Estado del proyecto

Fotografía puntual del trabajo de la aplicación de presentador en este laboratorio, actualizada por última vez el 2026-08-03 y luego complementada con hechos verificados en sesiones posteriores; debe seguir actualizándose en cada hito futuro en lugar de dejarse como una foto congelada.

| | |
|---|---|
| **Última actualización (documento base)** | 2026-08-03 |
| **Último hito (documento base)** | **Pase visual.** Se reelaboraron la jerarquía tipográfica, la medida de lectura y el espaciado para una ejecución de cara al cliente. Sin cambios narrativos, de arquitectura ni de paneles |
| **Despliegue** | `{resource-group}` · `swedencentral` · sufijo `{suffix}` |
| **Preparación de la demo (al 2026-08-03)** | **Guion completo sobre datos reales.** Ambos agentes en vivo. **Nunca se vio en un navegador** y nunca se cronometró contra un reloj |
| **Autoridad de producto** | El documento de arquitectura de experiencia de producto. La Fase 1 estaba completa; este hito entregaba partes de la Fase 2 (2.2, 2.3, 2.9) y los ítems 1, 2 y 5 de la prueba de aceptación de su §11 |

---

## 0. Extracción del repositorio (2026-08-10)

El proyecto se extrajo de dentro de la copia de trabajo clonada de `Azure-Samples/AI-Gateway` a su **propio repositorio independiente**, que contiene `demo-app/` y `broker/` juntos, más los archivos de comunidad y `assets/` en la raíz. El laboratorio oficial de Microsoft **no** se copió, ni se bifurcó (fork), ni se modificó — sigue siendo un requisito previo externo, ahora referenciado solo por URL.

Cambios de esta pasada:

- Todos los enlaces relativos al laboratorio (`../README.md`, `../main.bicep`, el notebook) reemplazados por enlaces verificados a `Azure-Samples/AI-Gateway`.
- Referencias obsoletas a documentos de diseño consolidados (`PROJECT_CONTEXT.md`, `DEMO_DESIGN.md`, `UI_BLUEPRINT.md`, `PRODUCT_ARCHITECTURE.md`, `AZURE_INTEGRATION.md`) reescritas a sus equivalentes actuales en 30 archivos fuente. Los números de sección se eliminaron en lugar de adivinarse.
- Nuevos `README.md` / `README.es.md` bilingües en la raíz como puerta de entrada del repositorio; el par anterior en `demo-app/` quedó superado y se eliminó.
- Corregidos los comentarios de código que afirmaban que el broker "aún no está implementado" — existe desde el hito de integración.
- **Modo Simulación documentado con honestidad.** La documentación pública lo describía como una red de seguridad offline. No lo es: el cargador de capturas de ensayo no está construido y el servicio devuelve valores `PLACEHOLDER`.
- `npm run lint` eliminado de `demo-app/package.json` — no había configuración ni dependencia de ESLint, así que el script solo podía fallar.
- Archivos `.env.example` reescritos según las variables que el código realmente lee; solo marcadores de posición.
- Barrido de seguridad: el nombre real del grupo de recursos se reemplazó por `{resource-group}` en toda la documentación **y se redactó en dos capturas** (`01-landing.png`, `05-plataforma.png`), donde era visible como píxeles y por tanto invisible para grep.

Verificado desde un clon limpio simulado (128 archivos rastreados): `npm ci` + `typecheck` + `build` pasan para `demo-app`; `npm ci` + `typecheck` pasan para `broker`. Se confirmó que `CLAUDE.md`, `.env`, `node_modules/`, `dist/` y `*.tsbuildinfo` están ignorados por git.

---

## 1. Trabajo completado (al 2026-08-03)

- **Fase de diseño (5 documentos).** Contexto del proyecto · Arquitectura · Diseño de la demo (su §3 gobierna todo lo que la aplicación puede afirmar) · Plano de UI · Flujo de presentación.
- **Frontend `demo-app/`** — React 19 · TypeScript · Vite · Tailwind v4 · Fluent UI v9 · Zustand. **Broker `broker/`** — Express/TS, 19 endpoints, `DefaultAzureCredential` → `az login`, tres audiencias de token, CORS fijado a `localhost:5173`.
- **Cableado real a Azure**, verificado endpoint por endpoint con HTTP capturado en el [Reporte de integración con Azure](REPORTE_INTEGRACION_AZURE.md). En vivo: invocación de agente (round trip completo APIM → Foundry → APIM → `gpt-5-mini`) · pruebas de credenciales (200/401/401 reales + XML de política real desde ARM) · registro de Foundry + digest de ACR · `ApiManagementGatewayLlmLog` + trazas de App Insights · tiempo por salto desde `ApiManagementGatewayLogs` · entorno ARM. Parcial: controles (6/7; RBAC documentado pero no verificado).
- **Observabilidad ejecutiva (2026-08-02).** Los tokens son reales y están corroborados por dos fuentes independientes. El tiempo por salto es real: `TotalTime − BackendTime` da el costo propio de APIM, **1–5 ms frente a solicitudes de 11–13 s**. El trazado distribuido funciona — `X-Request-ID` *es* el `OperationId` de App Insights; 7–10 spans reales a través del runtime de Foundry, el contenedor y APIM.
- **Fase 1 — reposicionada sobre el laboratorio (2026-08-03).** Se renombró con foco en Foundry primero; los frameworks se promovieron a protagonistas; se añadió "Ask both"; la procedencia quedó marcada en cada respuesta; Controles se fusionó en Operaciones; se nombró el protocolo Responses; se retiró la tesis del "dual-gateway... *es el producto*" del §3 del Contexto del proyecto, con nota de revisión.
- **Recorrido guiado (2026-08-03, este hito).** La aplicación dejó de ser un dashboard.
  - **Cinco paradas, una en escena a la vez**, en el orden de construcción propio del laboratorio — Frameworks · Agentes Alojados · API Management · Observabilidad · Operaciones — con un riel que mantiene visible toda la ruta. Las flechas del teclado o el riel avanzan por ella; `C` alterna el copiloto.
  - **El chat dejó de ser el protagonista.** Es un copiloto colapsable, disponible en cada parada, con `display:none` cuando está cerrado para que no cueste layout, y conserva su historial entre cierres. Sigue siendo una llamada genuinamente en vivo, sigue marcada con framework/contenedor/versión.
  - **Un panel, una pregunta — impuesto estructuralmente.** Cada parada se renderiza a través de `StopFrame`, que lee exactamente una clave `stop.<id>.question`.
  - **② Agentes Alojados es nueva** y cierra la brecha más grande contra el laboratorio: la cadena propia del notebook — origen → `az acr build` → imagen + digest + hora de push → `create_version` → versión inmutable → en ejecución — con el envelope de recursos y las claves de variables de entorno, todo leído en vivo desde Foundry y ACR.
  - **③ API Management muestra la URL enrutada**, con `{agentName}` resaltado. El broker la construye con la misma función que usa para *llamar* a un agente, de modo que la URL en pantalla no puede desviarse de la URL solicitada. Las pruebas de credenciales y la política en vivo se fusionaron aquí.
  - **Observabilidad y Operaciones se separaron** del antiguo panel con pestañas — la evidencia de una solicitud es una pregunta distinta de lo que administra un equipo de plataforma.
  - **Eliminado:** la franja de métricas de sesión y su plumbing de store · dos KPI tiles que eran etiquetas, no mediciones · tres botones de la barra del copiloto (uno era un duplicado literal) · `SectionLabel` · ~29 claves de i18n huérfanas. EN/ES verificados idénticos clave por clave (454 cada uno).
  - **Base de conocimiento del copiloto ampliada** al laboratorio y al notebook, cubriendo registrar un agente, añadir un framework, cómo se obtiene la observabilidad, cómo manejar el recorrido guiado, y las paradas nuevas.
  - `npm run typecheck` + `npm run build` pasaban en `demo-app/`; `npm run typecheck` pasaba en `broker/`.
- **Pase visual (2026-08-03, este hito).** Solo UX — sin cambios narrativos, de arquitectura ni de paneles.
  - **Jerarquía tipográfica.** La escala tiene cuatro tamaños (32/24/16/13) y casi todo caía por defecto en 13px, así que una parada que ahora ocupa todo el escenario no tenía jerarquía interna. Cada superficie promueve exactamente una cosa a 16px — la línea de posicionamiento del framework, el título del paso, el registro de auditoría, el nombre del control, la respuesta del copiloto — y 13px vuelve a su función: etiquetas y metadatos.
  - **Medida de lectura.** El contenido se limita a 1200px y se centra dentro de la tarjeta, el shell a 1600px; encabezado, cuerpo y pie comparten un mismo margen izquierdo. Sin esto, el texto corría ~200 caracteres por línea a 1920 y la aplicación se leía como una página web estirada.
  - **La procedencia está en un solo lugar** — abajo a la derecha de cada parada, vía una prop de `StopFrame`. Antes estaba dispersa en tres ubicaciones distintas, y una parada la renderizaba dos veces.
  - **Eliminado:** el botón flotante del copiloto (competía con el recorrido guiado y se superponía al pie de la parada) — el toggle ahora es chrome del encabezado; el badge de framework redundante en ②; la variante `elevated` muerta de `Surface`; el cuarto clúster de información del encabezado (el modo se fusionó en la línea de entorno). **Corregido:** `divide-y` en una grilla de dos columnas dibujaba separadores entre celdas lado a lado en la consola de Operaciones.
  - **`EmptyState` y `Skeleton` compartidos** para que los tres estados vacíos y los tres estados de carga dejaran de ser tres tratamientos distintos de la misma condición.
  - **Ajuste a 1366×768:** los tres resultados de credenciales pasaron de apilados a una fila (~96px recuperados); el registro de auditoría a dos columnas; la convergencia a tres; prompt/completion recortados a 280 caracteres.
  - **~16 textos de cara a la audiencia acortados** en ambos idiomas; EN/ES seguían idénticos clave por clave.

## 2. Cierre de las cuatro secciones de la consola (confirmado en sesiones posteriores)

Las cuatro secciones de la consola — Agentes, Gateway, Observabilidad y Plataforma — están completas, auditadas contra Azure real, y cerradas. Cada una pasó: verificación de tipos (typecheck), build, verificación en vivo contra Azure real, y limpieza de código. No quedaron bugs sin resolver, con dos excepciones documentadas deliberadamente como deuda técnica, no corregidas:

- **(a)** Un patrón de manejo de errores en `AuditRecordSection.tsx` (sección de Observabilidad) que traga errores silenciosamente. Documentado, diferido a una tarea futura.
- **(b)** El diálogo de detalle de Observabilidad se cierra silenciosamente si el broker falla mientras el diálogo está abierto. Reportado, no corregido, pendiente de una decisión.

### Funcionalidad nueva: eliminar agentes desde la UI

Se añadió la capacidad de eliminar agentes desde la interfaz — un botón junto al de crear agente, en la sección Agentes — con confirmación exigiendo que el usuario escriba exactamente el nombre del agente antes de proceder. Implementado tanto en el broker (`DELETE /api/agents/:name`) como en el frontend. Verificado en vivo contra Azure real: creación, eliminación, y reintento posterior confirmando un 404 correcto.

### Base de conocimiento del copiloto: aclaración de posicionamiento

Se agregó una entrada nueva a `broker/src/demoKnowledge.ts` para que el asistente conversacional nunca presente esta aplicación como un reemplazo de Azure AI Foundry. Verificado en vivo tanto en inglés como en español.

### Reorganización de la documentación

Completada. Toda la documentación del proyecto se consolidó en `demo-app/docs/`, con estructura paralela en inglés (`docs/en/`) y español (`docs/es/`), más archivos de comunidad en la raíz (`LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ACKNOWLEDGEMENTS.md`, `CHANGELOG.md`) y una carpeta `assets/` para el banner, el diagrama del laboratorio y las capturas — dejando el proyecto listo para publicarse como repositorio open source.

## 3. Trabajo pendiente (según el documento base, 2026-08-03)

1. **Verificación visual — seguía siendo el mayor riesgo a esa fecha.** Seis hitos de UI se habían escrito y verificado por tipos, pero nunca se habían visto en un navegador; en esa sesión se declinó usar herramientas de navegador. Cada proporción se había razonado a partir de la escala de tokens y aritmética medida, no observada. Se necesitaba una revisión humana a 1920×1080 y 1366×768 en las cinco paradas, comprobando específicamente: si ② Agentes Alojados y ⑤ Operaciones hacían scroll interno (se esperaba que sí, y eran las dos con más riesgo de sentirse apretadas); si la franja de KPI de seis tiles y los tres resultados de credenciales se sostenían a 1366 sin envolver; si la medida de 1200px dentro de un shell de 1600px se leía como deliberada a 1920 o como una tarjeta vacía; y modo claro **y** oscuro, ya que solo el claro se había razonado hasta ese momento.
2. **Confirmar visibilidad de llamadas a herramientas** — nunca se había observado un span de `get_weather` porque ninguna pregunta lo había disparado.
3. **Cronometrar "Ask both" contra el reloj** — se razonaba que dos agentes en paralelo se mantenían dentro del techo de ~15 s, sin medición real.
4. **Captura de Replay** — Simulación seguía siendo mocks escritos a mano, no una grabación.
5. **Localizar respuestas del broker** — `/api/controls`, evidencia de gobernanza y resultados de mantenimiento seguían solo en inglés, sin pasar por `i18n/translations.ts`.
6. **Que la atribución sobreviva reinicios** — el store de asks seguía en memoria.
7. **Verificación en vivo de RBAC** — requiere el permiso `Microsoft.Authorization/roleAssignments/read`.
8. **Re-argumentar el presupuesto de diez minutos** — el Flujo de presentación seguía describiendo la construcción de seis paneles y le daba su mayor momento a Control de Acceso sobre la base de la tesis ya retirada. La Guía del Presentador dentro de la propia aplicación era la referencia precisa.
9. **Restaurar la llamada directa autorizada** (Fase 2.6) — el laboratorio enseña la ruta directa como línea base de troubleshooting que *debería* tener éxito; en la aplicación solo se mostraba fallando.

## 4. Limitaciones conocidas (según el documento base)

- Toda la telemetría de Azure tiene un retraso de 1–3 minutos; los paneles muestran "ingesta pendiente", nunca un cero.
- El hop 1 y el hop 2 llevan IDs de correlación distintos y se asocian por contención de timestamp — es una asociación, no una transacción medida como una sola unidad, y tanto la UI como el guion lo dicen así.
- Los tokens miden la llamada al modelo, que es lo que factura el gateway, no la invocación del agente.
- `apim-request-id` no puede usarse para hacer join (verificado: cero coincidencias en Log Analytics).
- La correlación de observabilidad es en memoria — un reinicio del broker resuelve los asks pasados a un 404 honesto.
- `az role assignment list` devuelve `[]` bajo la identidad usada — una brecha de permisos, no un error.
- Arranque en frío de ~10–17 s en el primer Ask. CORS verificado con `curl`, no con un navegador.
- `CORS_ORIGIN` acepta exactamente un origen. Una lista separada por comas se devuelve entera en `Access-Control-Allow-Origin`, cosa que los navegadores rechazan, mientras el preflight sigue respondiendo 204 — así que `curl` pasa y solo falla el navegador. Apuntar un broker desplegado a un frontend local implica reemplazar el valor, no añadirlo. Ver `broker/.env.example`.
- Nunca disponible, nunca fabricado: costo/facturación interna · throttling en acción · caché semántico · balanceo de carga · tendencias históricas · uptime/SLA · redes privadas · failover multi-región · evaluaciones / red teaming / puntajes de seguridad.
- Los frameworks nunca se comparan por rendimiento. Ninguna cifra de latencia, conteo de tokens o throughput se renderiza por framework en ningún lugar, incluido "Ask both", que descarta la latencia real que devuelven ambas llamadas. Las diferencias entre los dos agentes son variancia de un mismo modelo compartido.
- La matriz de capacidades es código fuente, no telemetría — se lee de `src/frameworks/*/main.py`, es verdad sobre el código, no una medición de los contenedores en ejecución. El único diferenciador vivo es "Ask both".

## 4b. Pantalla de referencia de APIM (2026-08-31)

Una segunda pantalla en la sección Gateway, `apimCapabilities`, que describe el
producto Azure API Management y no este despliegue: ocho capacidades, una
comparación de tiers, y cómo se decide el modelo de un agente.

Es material de referencia, y la separación de los datos en vivo es estructural,
no una leyenda — su propio stop tras un par de pestañas En vivo/Referencia, la
banda `illustrative` (§1.6), un banner permanente, y una píldora por capacidad
que dice si este laboratorio la configura (tres de ocho lo hacen).

El único valor en vivo de la pantalla es el tier de APIM, que el broker ahora
expone desde el listado de ARM que `/api/environment` ya consultaba. No resalta
nada cuando el broker no lo reporta, y no se lee en modo Simulación.

La comparación de tiers lleva la medición propia de este proyecto — Basicv2
frente a Consumption, 54 s de arranque en frío tras 35 minutos de reposo — en
vez de guía de hoja de producto. Ver `labs/…-automation/docs/06-apim-consumption.md`.

Guion para el presentador: [`GUIA_CAPACIDADES_APIM.md`](../02-presentacion/GUIA_CAPACIDADES_APIM.md).

## 4c. Marca de presentador en el riel (2026-09-07)

La marca de "Controles Empresariales" ahora aparece en el pie del riel de
navegación — solo la marca geométrica, compuesta contra transparencia, no el
lockup completo con logotipo (sin contraste contra el fondo oscuro fijo del
riel en ningún tema). Las nueve pantallas de escenario se volvieron a medir a
1366×768 antes y después: sin cambios al presupuesto de 0px de contenido
oculto. Desplegado a producción con un redespliegue de solo código
(infraestructura, imágenes de agentes y registro de agentes, todos omitidos) y
verificado en vivo. Detalle completo en
[`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md) §4.12 y
[`HISTORIAL.md`](HISTORIAL.md) punto 15.

## 4d. Paleta del riel, y la marca promovida al bloque de marca (2026-09-10)

El riel de navegación tomó una paleta aportada — fondo ciruela `#17132b`,
rosa `#e2196f` para la sección activa, índigo `#4f46e5` para "en vivo" — y la
marca del presentador pasó del pie del riel al bloque de marca de arriba,
redimensionada a un lockup compacto de una sola fila, con el eslogan de
posicionamiento reubicado al pie del riel. `Sidebar.tsx` y el bloque
`--color-rail-*` son todo el cambio; ningún otro color de la consola se tocó.

El ítem activo pasó brevemente a índigo a mitad de sesión, por una lectura de
colisión de tono entre el rosa y el carmesí de la marca del presentador
(15.9° de separación, ΔE2000 10.3 — correcta como medida de tono). Una
captura de la aplicación desplegada de la que realmente viene esta paleta
anuló esa lectura: corre los mismos dos colores a la misma distancia y se lee
bien, porque un símbolo de 34px junto a dos líneas de texto no compite con
una píldora de navegación rellena 30px más abajo del modo en que sí lo hacía
un lockup apilado de 150px. **El ítem activo vuelve a ser rosa** (`#e2196f`,
3.95:1 sobre el fondo del riel, superando la barra que el 2.87:1 del índigo no
lograba); lo que realmente cambió fue el tamaño y layout del bloque de marca,
no su color. Secuencia completa en
[`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md) §4.13–§4.14.

El verde no se importó del mockup de referencia: `affirm` sigue siendo
**exactamente un uso** en el código (`StatusPill.tsx`, el 401), verificado por
censo en las tres revisiones. Un valor de la paleta no se adoptó literal —
`#4f46e5` mide 2.87:1 sobre el fondo del riel y se usa a `#7b74ec` (4.77:1)
para las dos marcas (el punto Live, el glifo del agente) que se apoyan
directamente sobre él. Las nueve pantallas remedidas a 1366×768, ambos
estados del riel y ambos modos, tres veces (rosa → índigo → rosa de nuevo):
32 mediciones por pasada, todas idénticas a la línea base previa al cambio.

**No desplegado.** Retenido por instrucción del presentador a la espera de la
revisión de las capturas.

## 4e. `.env.local` y el valor por defecto de este repo apuntaban a un grupo de recursos que ya no existe — el que está vivo es `-v2` (corregido 2026-09-10)

**Corrigiendo la entrada que esto reemplaza.** Decía que el modo En vivo no
tenía backend en absoluto. Eso era incorrecto en la mitad que importa: existe
un despliegue en vivo, solo que no el que la configuración de este repo
nombraba.

`az` sí responde `ResourceGroupNotFound` para `lab-hosted-agents-demo`, y
`hosted-agents-demo-f76df303.azurewebsites.net` — el host en
`demo-app/.env.local`, y el `ResourceGroupName` por defecto propio de
`deploy.ps1` en `config/lab.defaults.psd1` — es NXDOMAIN. Pero un `az webapp
list` más amplio encontró `hosted-agents-demo-ba8fb6d3` en el grupo de
recursos `lab-hosted-agents-demo-v2`, `Running`, `/api/health` respondiendo
`{"ok":true}`, `/api/environment` devolviendo datos reales de ARM. El
despliegue se recreó bajo un sufijo nuevo en algún momento y nada en este
repo — `.env.local`, el `ResourceGroupName` por defecto de
`lab.defaults.psd1`, la propia §6 de este documento — se actualizó para
reflejarlo.

**Lo que realmente es cierto:** el modo En vivo tiene un backend real, en
`https://hosted-agents-demo-ba8fb6d3.azurewebsites.net`, en
`lab-hosted-agents-demo-v2`.

**Resuelto, un campo cada uno.** `demo-app/.env.local` (git-ignorado, usado
solo para desarrollo independiente del frontend contra un broker remoto)
queda corregido al host y grupo de recursos `-v2`. El `ResourceGroupName` por
defecto de `lab.defaults.psd1` **se deja apuntando deliberadamente al grupo
muerto** — no es un descuido, se decidió y se confirmó con el presentador.
Ese mismo campo es también el default de `teardown.ps1` cuando se omite
`-ResourceGroupName`: desactualizado, falla de forma inofensiva; corregido a
`-v2`, un `teardown.ps1` sin argumentos apuntaría al despliegue en vivo. El
razonamiento completo vive como comentario sobre el propio campo en
`config/lab.defaults.psd1`, específicamente para que una pasada futura no lo
"corrija" de vuelta a algo que sí resuelve. Toda invocación de
`deploy.ps1` / `teardown.ps1` contra `-v2` en este proyecto, de aquí en
adelante, pasa `-ResourceGroupName lab-hosted-agents-demo-v2` explícito —
como hizo el propio redespliegue de esta sesión. La
§6 y el [`REPORTE_INTEGRACION_AZURE.md`](REPORTE_INTEGRACION_AZURE.md) siguen
registrando cifras verificadas contra el despliegue *anterior*; nada en esta
entrada las revalida contra `-v2`.

## 4f. A `-v2` le faltaba Reader sobre el APIM compartido — arreglado y verificado en vivo (2026-09-11)

Dos acciones de Configuración → Mantenimiento ("Recargar políticas",
"Actualizar información del despliegue") daban 403. La causa raíz tenía
exactamente la forma de §4e un nivel más abajo: la identidad del App Service
es nueva cada vez que se recrea el propio App Service, y `Grant-
DemoAppServiceRoles` en `deploy.ps1` nunca ha concedido nada sobre el gateway
compartido — la concesión Reader que este documento ya registra en
[`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md) (2026-09-07) se aplicó a
mano, una vez, contra la identidad vieja, y nunca se codificó en la
automatización. Confirmado directamente: 0 asignaciones para el principal
actual (`a29165e4-…`) sobre el APIM compartido antes de este arreglo; la
concesión de la identidad vieja (`c15d914a-…`) sigue ahí, huérfana.

**Arreglado**: la misma concesión Reader, mismo alcance estrecho (el recurso
APIM, no el resource group), reaplicada a la identidad actual vía `az rest`
(los subcomandos `az role assignment` devolvieron `MissingSubscription`
contra este scope exacto, de forma reproducible — una rareza del CLI,
resuelta con la llamada REST cruda). **Verificado en vivo**, no solo
concedido: ambas acciones se hicieron clic de verdad contra la consola
desplegada inmediatamente después, ambas `200` con datos reales de APIM.
Detalle completo, incluyendo los comandos exactos y la verificación del
conteo aditivo, en
[`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md#la-concesión-de-reader-de-arriba-nunca-se-codificó-en-deployps1-y-recrear-el-app-service-la-perdió-en-silencio-2026-09-11).

**Actualización, mismo día: la parte "se deja abierto" también se cerró.**
`Grant-DemoAppServiceRoles` en `AppService.ps1` concede este Reader por sí
sola ahora, como una quinta concesión junto a las cuatro que ya hacía — sin
más paso manual tras la próxima recreación del App Service. Construida sobre
una `Grant-RoleIfMissingRest` nueva (mismo contrato idempotente/de reintento
que la `Grant-RoleIfMissing` existente, pero sobre `az rest` en vez de `az
role assignment`, porque el scope del APIM compartido es exactamente donde
vive la rareza de `MissingSubscription` de ese subcomando) —
`Grant-RoleIfMissing` en sí queda intacta, ya que sus otras tres llamadas
nunca mostraron el problema. Verificado de tres maneras contra el despliegue
`-v2` en vivo: `-ValidateOnly` sigue pasando (la comprobación débil — nunca
llega a este código); una llamada directa a `Grant-DemoAppServiceRoles` con
los valores reales de `-v2` reportó las cinco concesiones `(already
granted)`, reconociendo correctamente el Reader aplicado a mano horas antes;
y la rama de creación en sí se ejercitó contra un principal real e inofensivo
(la identidad propia del gateway compartido, con AcrPull concedido
temporalmente, confirmado presente, y luego eliminado y reconfirmado
ausente). Detalle completo en
[`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md#la-brecha-se-cerró-grant-demoappserviceroles-ahora-concede-el-reader-del-apim-compartido-por-sí-sola-2026-09-11).

## 4g. Arranque en frío desglosado con telemetría real — solo diagnóstico, no se cambió nada (2026-09-11)

"8–17 s medidos" (§6, el ítem #1 del registro de riesgos) es ahora un
desglose real, no un rango. Tres invocaciones reales contra `pydantic-agent`
— un precalentamiento (respuesta de una palabra), y dos preguntas abiertas
(respuesta corta y larga) — cruzadas contra dos fuentes de telemetría
independientes (`ApiManagementGatewayLogs` y `union AppRequests,
AppDependencies`, las mismas tablas que ya consultan `journey.ts`/
`observability.ts`):

| | espera fija antes de que arranque `invoke_agent` | `invoke_agent` en sí | — de eso, la llamada al modelo |
|---|---|---|---|
| precalentamiento (una palabra) | 7,30 s | 4,98 s | 1,98 s |
| respuesta corta | 6,67 s | 5,45 s | 2,85 s |
| respuesta larga | 6,40 s | 10,28 s | 8,34 s |

**El costo dominante es una espera de 6,4–7,3 s *antes* de que arranque el
propio código instrumentado del agente** (`invoke_agent`, el primer span que
emite la telemetría de cualquiera de los dos frameworks) — no escala con la
longitud de la respuesta, que es la firma de un costo fijo y no de trabajo
del agente. Nada del código de este repositorio está en posición de ver
dentro de esa espera, mucho menos de acortarla: está por encima del broker,
la consola y los contenedores de agente por igual, en la propia plataforma de
Foundry Hosted Agents. El overhead del gateway se confirma otra vez
despreciable (2–14 ms). Lo que sí escala correctamente es la propia llamada
al modelo (1,98 s → 8,34 s con la longitud de la respuesta). Desglose
completo, metodología, y el costo más pequeño del lado del framework que vale
la pena distinguir de la espera fija, en
[`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md#la-latencia-tiene-un-desglose-real-ahora-no-solo-un-rango-medido-2026-09-11).

**No se cambió nada** — ni código de agente, ni tamaño de contenedor, ni
cadencia de precalentamiento. Se alcanzó a propósito solo como diagnóstico.

## 4h. La referencia de Figma adoptada; una pantalla se rompió y se recompró (2026-09-11)

Adoptada en las cuatro secciones: barra superior de 56px, migas de pan, banda
de contexto de una línea, un subtítulo en el ítem activo del riel, la
cosmética de tarjetas de la referencia en Agentes, `#D4003B` como rojo de
marca canónico, el riel unificado a `#1C1C1C`, y la página de inicio
eliminada. Seis commits, cifrados en `ADOPCION_FIGMA.md` antes de escribir
nada.

**Desplegado el 2026-09-16, 15:59 UTC** en `hosted-agents-demo-ba8fb6d3`,
aprobado con el conjunto completo de capturas. `deploy.ps1
-SkipInfrastructure -SkipAgent -SkipImageBuild -ImageTag 20260909195303
-SkipValidation` — infraestructura, imágenes y agentes alojados intactos;
solo se reconstruyó y republicó el paquete de consola + broker. Verificado
contra el sitio real, no solo en local:

- `/api/health` → `{"ok":true}`, HTTP 200.
- El fingerprint del bundle servido, `index-BUMK9Hjm.js` /
  `index-gfjESNQv.css`, coincide con el build que produjo este despliegue.
- Los tres estados que importan para el fix del recuento, contra
  producción con `/api/environment` interceptado en el navegador real: Live
  respondiendo → un recuento real; Live forzado a fallar (500) → "recuento
  no disponible", nunca `21`; Simulación → sin recuento.
- Se confirmó que `opacity-70` (el fix de contraste de la atribución en
  `b513ed2`) no está en el bundle desplegado.

**Presupuesto de layout, 1366×768, medido contra el backend real tras el
cambio:**

| pantalla | contenido | presupuesto | margen |
|---|---|---|---|
| Agentes / Resumen | 415 | 550 | +135 |
| Agentes / Versiones | 403 | 550 | +147 |
| Agentes / Ejecutar | 329 | 550 | +221 |
| Gateway / En vivo | 328 | 510 | +182 |
| Gateway / Credenciales | 122 | 510 | +388 |
| Observabilidad / Registro | 421 | 550 | +129 |
| Observabilidad / Mediciones | 132 | 510 | +378 |
| Plataforma | 491 | 510 | **+19** |

Ocho de nueve con 0px oculto. La novena es Gateway/Referencia, que scrollea
por diseño (§4.9). Plataforma/Live había caído a −15px y se recuperó del
relleno y las separaciones del marco compartido; la banda costó 48px donde el
plan predecía ~30px. Tres pantallas tienen ahora *más* sitio que antes de que
existiera la barra superior.

**La eliminación de la página de inicio se verificó haciendo clic, no
compilando:** diez comprobaciones contra el backend real — arranca en una
sección, Home levanta el diálogo de confirmación con una conversación viva,
confirmar limpia el copiloto sin recargar, una segunda demostración completa
corre en la misma carga de página, Escape reinicia en sitio.

**Sistema de honestidad tras la adopción:** `<ProvenanceBadge>` 13,
`<StatusPill>` 1, `text-affirm` 1, `bg-affirm` 0, `border-affirm` 0,
`border-dashed` 6, `tone="reference"` 1, nada de verde. El punto
Live/Simulación se desduplicó de tres copias a una y ambas ramas se
confirmaron en ejecución.

**Corregido aquí:** la cifra de 457px de contenido del §4.11 para
Plataforma/Live está obsoleta — hoy son 491px, también en la línea base previa
al cambio, así que la pantalla derivó con el despliegue y no con ningún cambio
de UI.

**Sigue abierto, sin cambios:** Plataforma/Simulación, ahora en −26px frente a
los −51px del §4.11. Siguen siendo los nombres de control sin traducir en la
ruta live, no un defecto de maquetación, y deliberadamente no corregido aquí.

**También abierto, nuevo:** en Plataforma la banda de contexto y el párrafo
introductorio propio de la pantalla quedan ahora adyacentes — dos frases de
preámbulo antes del contenido. Trabajo de composición en cinco pantallas, no
un defecto de maquetación.

**Retomado y re-verificado, 2026-09-16.** La sesión que escribió lo anterior
se cerró mientras tomaba las capturas para aprobación (cuatro en tema claro,
ninguna en oscuro). Todo se volvió a ejecutar contra HEAD y el backend real en
lugar de darlo por bueno:

- Presupuesto de las nueve pantallas: idéntico al píxel a la tabla de arriba.
- Reinicio: las diez comprobaciones vuelven a pasar. Su paso 5 solo probaba
  una navegación tras el reinicio, así que se añadió una verificación más
  estricta — una segunda demostración completa (todas las secciones, todas
  las pestañas, una pregunta nueva al copiloto) en la misma carga de página,
  sin rastro de la primera conversación, cero recargas, cero errores. 35/35.
  Escape *nunca* descarta una conversación viva (cierra el copiloto y luego no
  hace nada); solo Home, que confirma, lo hace. Esa guarda es anterior a este
  trabajo y es intencionada.
- Censo de honestidad: sin cambios respecto a las cifras de arriba; nada de
  verde, sin insignia de versión.
- Dos commits añadidos. `0945395` elimina lo que dejó la página de inicio (un
  tipo `View` sin uso, una animación fade-out sin uso, y un docstring de
  `resetDemoState` que aún describía el mecanismo de desmontaje que
  reemplazó). `b513ed2` corrige la atribución del presentador: `opacity-70`
  sobre `rail-ink-muted` componía 4,07:1 antes de la adopción y 3,94:1
  después — bajo AA ambas veces, y ni §4.12 ni `ecd1059` lo habían medido.
  Ahora 6,65:1.
- AA auditado sobre contraste *renderizado* (cada nodo de texto visible
  compuesto sobre su fondo real, nueve pantallas, ambos temas) y comparado A/B
  con el commit previo a la adopción `7d93794`. Tras `b513ed2` el único fallo
  es `pydantic-agent` en Gateway/En vivo (4,12 claro / 4,23 oscuro), idéntico
  en la línea base.
- Dieciocho capturas tomadas, con tema, sección y modo comprobados antes de
  cada una.

**Encontrado, preexistente, no corregido aquí:** (1) el recuento de recursos
de la barra superior cae a un `21` fijo; si `getEnvironmentContext()` falla en
Live, la barra dice "Azure en vivo · … · 21" — un número inventado bajo la
etiqueta de en vivo, una infracción del §1.6 que pasó del pie del riel a la
barra superior con este trabajo. **Corregido en `b9c4c9a`:** también mostraba
21 mientras cargaba y durante toda la Simulación, y el broker respondía `0`
ante un listado de ARM rechazado; los fallos dicen ahora "recuento no
disponible", y la carga y la Simulación no muestran recuento. (2) Las etiquetas de `ProvenanceBadge`
("Live", "Illustrative") están fijas en inglés. (3) El diagrama de flujo de la
solicitud recorta su último nodo ("gpt-5-mir…"), menos que en la línea base.
(4) Texto por debajo de 16px en insignias Fluent (10px) y botones pequeños
(12–14px), idéntico en la línea base.

## 4i. Ejecutar alimenta el diagrama del gateway; tiempos por salto medidos por las propias políticas de APIM, con la respuesta (2026-09-24)

Dos problemas que hacían la pantalla del Gateway poco práctica en una reunión.
Ambos verificados con invocaciones reales contra un broker local con la
configuración del App Service; **todavía no se desplegó nada al App Service** —
producción sigue con el broker anterior, que ignora los nuevos encabezados.

**Agentes → Ejecutar ahora anima el diagrama.** Ejecutar siempre fue una
llamada real a través de APIM (el mismo `invokeHostedAgent()`, la misma
`hosted-agents-responses-api` que el copiloto), pero solo escribía en
`runStore`, y el diagrama busca las peticiones en `askStore` por `lastAskId`,
que Ejecutar a propósito nunca fijaba. Una ejecución correcta ahora se
registra en ambos y fija `lastAskId`, así que Gateway y Observabilidad la
muestran exactamente igual que una pregunta del copiloto.

**El salto 1 es inmediato.** Nuestra copia de la política de la API de
respuestas (`labs/.../policies/hosted-agents-responses-policy.xml`; el archivo
vendorizado no se tocó) acota la sección backend con `context.Elapsed` y
devuelve `x-hosted-agents-backend-ms` / `x-hosted-agents-gateway-ms`.
Comparado con `ApiManagementGatewayLogs` en 8 invocaciones secuenciales (4 por
agente): backend entre +0,5 y +1,1 ms (el log redondea a ms enteros); gateway
0,4–0,5 ms según la política frente a 1–2 ms en el log, política ≤ log en 8/8.
El log cuenta además el envío del cuerpo después de que la política se
ejecuta, así que ≤ es la relación esperada, no una discrepancia.

**Salto 2, solo pydantic-agent, y solo su costo de gateway es inmediato.** La
respuesta del salto 2 va al contenedor, no al broker. pydantic-agent propaga
la traza W3C del salto 1 (verificado: la llamada al modelo de cada invocación
200 comparte el trace id del salto 1; strands-agent: 0 de 11), así que nuestra
política de la API de inferencia deja sus cifras en la caché interna de APIM
bajo `hosted-agents-hop2:{traceId}` (`caching-type="internal"`, TTL de 120 s,
sin caché externa en el gateway, los otros equipos solo usan caché de
respuestas) y la política de respuestas las devuelve. Tasa de aciertos en esta
sesión: 12/12 invocaciones de pydantic; 0/8 invocaciones de strands trajeron
encabezados del salto 2, según lo diseñado.

**Hallado durante la verificación — la duración del modelo no puede venir de la
política.** Ambos agentes llaman al modelo en streaming (`IsStreamCompletion =
true`), y outbound se ejecuta con el primer byte: el "backend" de la política
para el salto 2 fue 2491 ms frente a 3026 ms del log (257 tokens) y 8424 frente
a 9414 (950 tokens). Por eso el costo de gateway del salto 2 (0,8–0,9 ms, ≤ log
en 4/4) y su asociación por trace id son inmediatos; la duración del modelo, y
con ella el tiempo derivado del agente, siguen en `live-delayed` hasta que llega
el log (~140–150 s medidos) y nunca se estiman mientras tanto. strands-agent
mantiene el salto 2 completo en el log.

**Cómo se vincula el salto 2 al 1 ahora se declara por petición**, en la nota
del diagrama y en el texto de correlación de Observabilidad: "vinculado por el
trace id W3C que llevaban ambas peticiones" cuando el gateway lo devolvió,
"asociado por contención de marcas de tiempo" (con el motivo) cuando no.

**Gateway compartido:** solo cambiaron las políticas de
`hosted-agents-responses-api` y `hosted-agents-inference-api` — snapshot
completo de los 299 recursos del gateway (APIs, operaciones, productos,
backends, suscripciones, named values, loggers, diagnósticos, diagnostic
settings) antes y después de cada escritura; cada diff mostró exactamente
nuestras líneas de política. XML de rollback conservado.
`shared-apim-registration.bicep` ahora carga nuestros dos archivos de
política, así que un redespliegue los mantiene. Capturas:
`demo-app/captures/gateway-timing/`.

**Pendiente:** desplegar broker/consola al App Service (pendiente de
aprobación); el texto de correlación de Observabilidad lo genera el broker en
inglés, igual que el anterior; un sondeo fallido de Observabilidad borra los
datos ya mostrados (comportamiento previo).

## 5. Arquitectura actual

```
Navegador (demo-app, :5173) ──REST/JSON──▶ Broker (Express, :4000) ──▶ APIM · Foundry · ARM · LA · ACR
```

El navegador nunca toca Azure — estructuralmente imposible, no tiene SDK de Azure. El broker guarda la clave de suscripción de APIM (`broker/.env`, ignorado por git) y el contexto de `az login`, y su llamada saliente al agente pasa *a través de* APIM exactamente como lo haría un cliente real. El único bypass deliberado es la rama "directo a Foundry", pensada para fallar con 401.

El tema de la demo es **frameworks personalizados corriendo como activos gestionados de la plataforma**: dos contenedores en dos SDKs, registrados como Foundry Hosted Agents detrás de un único contrato de protocolo Responses, versionados de forma inmutable y anclados por digest. El **patrón de doble gateway** es el perímetro empresarial alrededor de ellos — APIM dos veces en una sola ruta, inyectando tokens de identidad administrada para `https://ai.azure.com` y `https://cognitiveservices.azure.com`. Ambas cosas son ciertas; el orden es la corrección de la Fase 1.

El frontend intercambia `simulationService` / `azureService` detrás de un único contrato `DemoDataService`; cada método de `azureService` pasa por un único `brokerFetch()`.

## 6. Estado de Azure al 2026-08-03

Grupo de recursos en vivo y saludable. APIM `apim-{suffix}` (Basicv2) · `foundry-agents-…` + `foundry-models-…` con proyectos · `gpt-5-mini` (GlobalStandard, RAI `Microsoft.DefaultV2`) · `acr{suffix}` · `workspace-{suffix}` + App Insights. ARM reportaba 8 recursos de nivel superior. La lectura de asignaciones de rol estaba denegada para la identidad usada en la verificación.

## 7. Próximo hito recomendado (según el documento base)

**Ensayo — a esa fecha, ya atrasado por cinco hitos.** Correr el pre-flight del Flujo de presentación a través de Herramientas del Presentador → Mantenimiento, recorrer las cinco paradas a 1920×1080 y 1366×768, abrir y cerrar el copiloto en cada una, correr "Ask both" y cronometrarlo, hacer una pregunta sobre el clima para determinar si aparecen spans de llamadas a herramientas, y grabar la captura de replay mientras se hace. Una sola sesión cerraría a la vez las brechas visual, de tiempos, de llamadas a herramientas y de captura.

**No tratar el guion de 10:00 como vigente** — ver el ítem 8 de la sección de trabajo pendiente.

---

*Nota: las secciones 1, 3, 4, 5, 6 y 7 reflejan el estado documentado al 2026-08-03. La sección 2 incorpora hechos confirmados en sesiones posteriores. Este documento debe seguir actualizándose en cada hito nuevo.*

## Ver también

- [`REPORTE_INTEGRACION_AZURE.md`](REPORTE_INTEGRACION_AZURE.md) — el detalle de verificación endpoint por endpoint.
- [`HISTORIAL.md`](HISTORIAL.md) — el historial cronológico completo del desarrollo.
- [`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md) — la filosofía y las decisiones detrás de este estado.
