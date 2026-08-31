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
