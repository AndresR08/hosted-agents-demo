# Historial de desarrollo

Historial cronológico, por hitos, del desarrollo de esta demo. Complementa a [`ESTADO_DEL_PROYECTO.md`](ESTADO_DEL_PROYECTO.md) (la foto del estado actual) y a [`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md) (el porqué de cada decisión) — este documento es el orden en que ocurrió todo.

## 1. Fase de diseño (previa a escribir código)

Cinco documentos de diseño escritos antes de tocar `demo-app/` o `broker/`: contexto del proyecto, arquitectura del laboratorio, diseño de la demo (filosofía y reglas de honestidad), plano de UI, y flujo de presentación. Esta fase estableció la tesis original de que "el patrón de doble gateway es el producto" — una tesis que más adelante se revisaría (ver punto 6).

## 2. Implementación inicial

Se construyeron `demo-app/` (React 19 · TypeScript · Vite · Tailwind v4 · Fluent UI v9 · Zustand) y `broker/` (Express/TS, con 19 endpoints, autenticación vía `DefaultAzureCredential`/`az login`, tres audiencias de token distintas, CORS fijado a `localhost:5173`). Durante la construcción, dos decisiones del diseño original se reemplazaron por instrucción explícita del presentador: el layout de una sola columna apilada se convirtió en una composición de dos columnas, y el "Ask" de un solo turno se convirtió en un asistente conversacional multi-turno.

## 3. Verificación de integración con Azure (2026-08-01)

Cada endpoint del broker se probó con `curl` contra el grupo de recursos real desplegado, capturando la respuesta HTTP cruda como evidencia — no solo lectura de código. Se verificó en vivo: invocación de agente (round trip completo APIM → Foundry → APIM → `gpt-5-mini`), pruebas de credenciales (200/401/401 reales), XML de política leído desde ARM, registro de Foundry y digest de ACR, telemetría de `ApiManagementGatewayLlmLog` y trazas de Application Insights, tiempo por salto, y entorno ARM. Detalle completo en [`REPORTE_INTEGRACION_AZURE.md`](REPORTE_INTEGRACION_AZURE.md).

## 4. Auditoría de consistencia de documentación (2026-08-01)

Los seis documentos de diseño se releyeron contra el código real, no contra la memoria de lo planeado. Cinco se actualizaron con notas "As built" / "Overridden" donde la implementación había divergido del diseño original; el sexto (estado del proyecto) ya estaba al día y no necesitó cambios. Se encontraron y corrigieron dos errores factuales preexistentes en el documento de arquitectura (un conteo de outputs de Bicep incorrecto, entre otros).

## 5. Observabilidad ejecutiva (2026-08-02)

Se confirmó que los conteos de tokens son reales y están corroborados por dos fuentes independientes (los logs de APIM y la instrumentación OpenTelemetry del propio contenedor). Se confirmó que el tiempo por salto es real — `TotalTime − BackendTime` da 1–5 ms de costo propio de APIM frente a solicitudes de 11–13 segundos. Se confirmó que el trazado distribuido funciona de extremo a extremo: `X-Request-ID` es literalmente el `OperationId` de Application Insights, con 7–10 spans reales atravesando el runtime de Foundry, el contenedor y APIM.

## 6. Reposicionamiento del producto — Fase 1 (2026-08-03)

Corrección de rumbo real, no solo un ajuste de redacción: una autocrítica (`PRODUCT_POSITIONING_REVIEW`, ahora consolidada en [`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md) §2) encontró que la demo se había construido alrededor de API Management cuando el foco real del laboratorio es Foundry Hosted Agents. Se retiró explícitamente la tesis "el patrón de doble gateway es el producto" y se reemplazó por "Foundry primero, gateway segundo". Los frameworks se promovieron a protagonistas, se añadió la capacidad de "Ask both" (preguntar a ambos agentes a la vez), y Controles se fusionó dentro de Operaciones.

## 7. Recorrido guiado de cinco paradas (2026-08-03)

La aplicación dejó de ser un dashboard de una sola pantalla y pasó a un recorrido de cinco "paradas" secuenciales (Frameworks, Agentes Alojados, API Management, Observabilidad, Operaciones), una en escena a la vez, en el orden en que el propio laboratorio se construye. Se añadió la parada "Agentes Alojados" (la brecha más grande contra el laboratorio hasta ese momento) y se fusionaron Control de Acceso y Política dentro de API Management. El chat dejó de ser protagonista y se convirtió en un copiloto colapsable disponible en cada parada.

## 8. Pase visual (2026-08-03)

Ajustes de UX puros, sin cambios narrativos ni de arquitectura: jerarquía tipográfica (una sola cosa a 16px por superficie), medida de lectura (contenido limitado a 1200px), consolidación de la insignia de procedencia en una sola ubicación por parada, y ajuste de layout para pantallas de 1366×768.

## 9. Consola de cuatro secciones — Agentes, Gateway, Observabilidad, Plataforma (sesión actual)

El recorrido de cinco paradas evolucionó a una consola de **cuatro secciones de nivel superior** (`SectionNav`: Agentes, Gateway, Observabilidad, Plataforma), navegadas por pestañas en vez de por avance secuencial — Agentes absorbió las antiguas paradas de Frameworks y Agentes Alojados en una sola sección con pestañas internas (Resumen, Versiones, Ejecutar).

Cada sección se auditó y cerró de forma independiente, siguiendo el mismo proceso en las cuatro: auditoría estática primero, luego typecheck, luego build, luego verificación en vivo contra Azure real, y solo se corrigió código cuando se demostró un bug real con evidencia:

- **Agentes** — cerrada, sin cambios de código necesarios más allá de una limpieza menor durante el propio desarrollo.
- **Gateway** — auditada, sin bugs encontrados.
- **Observabilidad** — auditada en tres historias (registro de auditoría, telemetría de sesión, diálogo de detalle). Se encontró y corrigió un bug real (un mensaje de "pendiente" engañoso mostrado en escenarios de fallo genuino). Quedaron documentadas dos deudas técnicas **no corregidas intencionalmente**:
  1. Un patrón de manejo de errores en `AuditRecordSection.tsx` que traga errores silenciosamente — deferido explícitamente a una tarea futura independiente.
  2. El diálogo de detalle de Observabilidad se cierra silenciosamente si el broker falla mientras el diálogo está abierto — reportado, pendiente de decisión.
- **Plataforma** — auditada, sin bugs demostrados en vivo (dos sospechas iniciales sobre manejo de errores resultaron ser el mismo patrón ya aceptado en Gateway, no un bug nuevo).

## 10. Funcionalidad nueva: eliminar agentes (sesión actual)

Se añadió la capacidad de eliminar agentes desde la interfaz — un botón de papelera junto al de crear agente, en la sección Agentes — con confirmación exigiendo que el usuario escriba exactamente el nombre del agente antes de proceder. Implementado en el broker (`DELETE /api/agents/:name`, que cascada a todas las versiones del agente en Foundry) y en el frontend. Verificado en vivo contra Azure real: creación de un agente descartable, bloqueo del botón de confirmación con un nombre incorrecto, eliminación exitosa, y un reintento posterior confirmando un 404 correcto.

## 11. Aclaración de posicionamiento en el copiloto (sesión actual)

Se agregó una entrada nueva a la base de conocimiento del copiloto (`broker/src/demoKnowledge.ts`) para que el asistente conversacional nunca presente esta aplicación como un reemplazo de Azure AI Foundry o del Portal de Azure. Verificado en vivo, en inglés y en español, contra el agente real a través del camino completo API Management → Foundry → modelo.

## 12. Reorganización de la documentación a español

Toda la documentación propia de la demo — previamente dispersa en la raíz del repositorio, en inglés — se consolidó dentro de `demo-app/docs/`, traducida y organizada en cuatro carpetas temáticas (`01-general/`, `02-presentacion/`, `03-desarrollo/`, `04-referencias/`). Se reescribió `demo-app/README.md` en español para reflejar la consola de cuatro secciones actual. El `README.md` del laboratorio oficial, en la raíz del repositorio, no se tocó.

## 13. Preparación bilingüe para publicación open source

La documentación se reestructuró de nuevo para quedar bilingüe: `docs/es/` (el contenido del hito anterior, movido tal cual) y un nuevo `docs/en/`, con los once documentos traducidos al inglés manteniendo fidelidad técnica total. Se agregaron los archivos de comunidad estándar de un repositorio open source (`LICENSE` con licencia MIT, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ACKNOWLEDGEMENTS.md`, `CHANGELOG.md`) y una carpeta `assets/` con un banner propio, una copia local del GIF de arquitectura del laboratorio oficial (reutilizado con atribución bajo su licencia MIT) y las capturas de pantalla. `README.md` pasó a ser la versión principal en inglés, con `README.es.md` como espejo en español. Durante esta reorganización se encontraron y anonimizaron datos sensibles reales que habían quedado en la documentación técnica (correo, nombre de suscripción y tenant, y un sufijo de recursos de Azure repetido en varios documentos).

## 14. Revisión final previa a publicación

Última pasada de calidad antes de publicar: se reemplazó el placeholder de copyright en `LICENSE`, se revisaron ambos README (estructura, navegación, tabla de contenidos, badges enlazados, y una sección "Why this project exists" ampliada) verificando que transmitan el mismo mensaje en los dos idiomas sin ser traducciones literales, se verificaron de nuevo todos los enlaces e imágenes, se corrigieron un par de inconsistencias reales encontradas en `docs/` (texto de estado desactualizado que aún decía "en curso" sobre una reorganización ya completada, y una cita mal escrita al repositorio oficial), y se repitió el barrido de datos sensibles sin encontrar nada nuevo.

## Ver también

- [`ESTADO_DEL_PROYECTO.md`](ESTADO_DEL_PROYECTO.md) — dónde quedó cada cosa, hoy.
- [`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md) — por qué se tomó cada decisión mencionada aquí.
- [`REPORTE_INTEGRACION_AZURE.md`](REPORTE_INTEGRACION_AZURE.md) — la evidencia detallada detrás del punto 3.
