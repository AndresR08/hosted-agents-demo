# Reporte de integración con Azure

Evidencia consolidada de qué se integró y verificó contra Azure real durante el desarrollo de la demo, más el estado de consistencia de la documentación que resultó de esa verificación.

---

## Cómo se recopiló esta evidencia

El broker (`broker/`) se inició en limpio (`npm run dev`, un proceso en ejecución, no un cambio de archivo) contra el grupo de recursos real desplegado `{resource-group}` (`swedencentral`), y luego cada endpoint se ejercitó con `curl`, capturando la respuesta HTTP cruda. Los archivos fuente se releyeron desde disco, no de memoria, para cada número de línea citado. El único secreto involucrado (la clave de suscripción de APIM) se referencia solo por su longitud, nunca se imprime, ni en este documento ni en los comandos que la usaron.

**Entorno en el momento de la verificación:**

```
$ az account show --query "{user:user.name, subscription:name, tenant:tenantDisplayName}"
{
  "subscription": "<nombre-de-suscripción>",
  "tenant": "<nombre-de-organización>",
  "user": "<usuario>@<dominio>"
}
```

*(Valores de suscripción, tenant y usuario anonimizados para esta publicación — la verificación original se hizo contra una suscripción real, no simulada.)*

---

## 1. Asistente de IA — conversación real

| | |
|---|---|
| **Archivo** | `broker/src/routes/ask.ts` |
| **Endpoint llamado** | `POST {APIM_GATEWAY_URL}/hosted-agent-responses/agents/{agentName}/endpoint/protocols/openai/responses?api-version=v1` (línea 23, 26–33) |
| **Recurso Azure** | `apim-{suffix}` → enruta a `foundry-agents-{suffix}` / `default-foundry-agents` |
| **Autenticación** | Encabezado `api-key` tomado de `config.apimSubscriptionKey` (línea 29), leído de `broker/.env` (ignorado por git, nunca registrado en logs) |
| **Qué sigue siendo simulado** | Nada para esta llamada en sí. Las *respuestas de escenario predefinidas* (`assistant.suggestion.*.response` en `demo-app/src/i18n/translations.ts`) existen solo para el modo Simulación — el modo Live siempre muestra la respuesta real, según `demo-app/src/features/assistant/AIAssistantPanel.tsx` líneas ~130–140 ("llamada real — la respuesta predefinida del prompt sugerido se ignora aquí a propósito"). |

**Comando:**
```
curl -s -i -X POST http://localhost:4000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Verification test: name the Azure service that sits between the client and the Foundry agent, in five words or fewer.","agentName":"pydantic-agent"}'
```

**Resultado: `HTTP/1.1 200 OK`**

```json
{
  "askId": "caresp_18ca6fe4530eea16002iUak3kbEG2Num4F3Ic0hjNNWK6ZpCNz",
  "answerText": "Azure Application Gateway",
  "agentName": "pydantic-agent",
  "agentVersion": ":3",
  "latencyMs": 16809,
  "httpStatus": 200,
  "provenance": { "band": "live", "asOf": "2026-08-01T04:22:29.991Z" }
}
```

**Por qué esto es evidencia sólida y no un fixture predefinido:** la respuesta del modelo es factualmente incorrecta — debió decir API Management, no Application Gateway. Ningún mock escrito a mano en este código produciría una respuesta incorrecta; eso solo ocurre cuando un modelo real genera una respuesta genuina. `latencyMs: 16809` también es tiempo de solicitud real (el agente estaba en frío — ver §8), no un valor redondeado de relleno. No se corrigió ni se ocultó; se incluye tal cual porque una respuesta equivocada es una prueba de "en vivo" más convincente que una correcta.

**Nota sobre logs del lado del servidor:** el broker no hace logging de acceso por solicitud (solo se registran errores — `broker/src/index.ts` línea 33). La evidencia de que esto llegó a Azure es el contenido mismo de la respuesta: un `askId` en el formato de ID propio de Foundry (`caresp_…`), un `agentVersion` que coincide con la versión real registrada (`:3`, confirmada independientemente en §3), y una latencia en el rango de varios segundos consistente con una llamada real a un modelo, no con una simulada (que es instantánea).

---

## 2. Recorrido de la solicitud — estructura real, tiempo por salto NO implementado

| | |
|---|---|
| **Archivo** | `broker/src/routes/journey.ts` |
| **Endpoint llamado** | Ninguno directamente — lee del mapa en memoria de `broker/src/askStore.ts`, poblado por `recordAsk()` en `ask.ts` línea 57 |
| **Recurso Azure** | Ninguno (por diseño — ver abajo) |
| **Autenticación** | N/A |
| **Qué sigue siendo simulado** | El tiempo por salto individual (hop 1 de APIM vs. hop 2 por separado). El propio comentario del archivo (líneas 17–24) explica por qué: requeriría correlación de `requests`/`dependencies` de Application Insights por ID de operación, y esos datos tienen un retraso de ingesta documentado de 1–3 minutos — para una solicitud que acaba de completarse, todavía no es consultable. |

**Comando:**
```
curl -s -i http://localhost:4000/api/journey/caresp_18ca6fe4530eea16002iUak3kbEG2Num4F3Ic0hjNNWK6ZpCNz
```

**Resultado: `HTTP/1.1 200 OK`**

```json
{
  "askId": "caresp_18ca6fe4530eea16002iUak3kbEG2Num4F3Ic0hjNNWK6ZpCNz",
  "totalLatencyMs": 16809,
  "provenance": { "band": "live", "asOf": "2026-08-01T04:22:41.450Z" },
  "hops": [ /* 5 nodos, cada uno con un string estático de credentialFact, sin campo durationMs por salto */ ]
}
```

`totalLatencyMs: 16809` coincide exactamente con la respuesta de `/api/ask` — prueba de que se trata de una correlación real, no de dos mocks independientes que casualmente concuerdan. Ningún salto del arreglo lleva un valor `durationMs`, lo cual es consistente con la afirmación de "no implementado" en lugar de contradecirla — el campo simplemente está ausente, no presente-y-falso.

**Clasificación: parcialmente en vivo.** La latencia total y la estructura del flujo son reales; el tiempo por salto está honestamente ausente.

---

## 3. Agentes activos — real, e incompleto a propósito

| | |
|---|---|
| **Archivo** | `broker/src/routes/agents.ts` |
| **Endpoint llamado** | `GET {FOUNDRY_AGENTS_PROJECT_ENDPOINT}/agents?api-version=v1` (línea 36); ACR vía `az acr manifest list-metadata` (líneas 83–90, invocado como subproceso) |
| **Recurso Azure** | `foundry-agents-{suffix}` / `default-foundry-agents`; `acr{suffix}` |
| **Autenticación** | Token Bearer, scope `https://ai.azure.com/.default` (`azureAuth.ts` `SCOPES.foundry`); las llamadas a ACR usan la misma sesión de `az login` con la que se inició el broker |
| **Qué sigue siendo simulado** | Nada para `pydantic-agent`. `strands-agent` no se devuelve — porque no está registrado, no porque se filtre. |

**Comando 1:**
```
curl -s -i http://localhost:4000/api/agents
```
**Resultado: `HTTP/1.1 200 OK`**
```json
[{"name":"pydantic-agent","version":":3","framework":"Pydantic AI","status":"Running"}]
```

**Comando 2:**
```
curl -s -i http://localhost:4000/api/agents/pydantic-agent/provenance
```
**Resultado: `HTTP/1.1 200 OK`**
```json
{
  "agentName": "pydantic-agent",
  "imageUri": "acr{suffix}.azurecr.io/pydantic-agent:3",
  "imageDigest": "sha256:b4d03d1a20ebc09b22a69adb537882e6877325733b646cc6f0a12c1569c3cfca",
  "pushedAt": "2026-07-30T18:35:54.6128372Z",
  "versionCreatedAt": "2026-07-30T18:37:54.000Z",
  "environmentVariableKeys": ["AZURE_OPENAI_ENDPOINT","AZURE_OPENAI_API_VERSION","AZURE_OPENAI_DEPLOYMENT","APIM_SUBSCRIPTION_KEY","LOG_LEVEL"],
  "provenance": { "band": "live", "asOf": "2026-08-01T04:23:20.740Z" }
}
```

**Comando 3 (evidencia de caso negativo — prueba que esto lee un registro en vivo, no una lista fija):**
```
curl -s -i http://localhost:4000/api/agents/strands-agent/provenance
```
**Resultado: `HTTP/1.1 404 Not Found`**
```json
{"error":"Agent strands-agent is not registered"}
```

**Confirmación independiente de que `strands-agent` genuinamente no existe en este despliegue:**
```
$ az acr repository list --name acr{suffix} -o table
Result
--------------
pydantic-agent
```

**Clasificación: verificado en vivo** (para lo que devuelve), con la brecha reflejada honestamente — un agente real, no dos.

---

## 4. Control de acceso — prueba real de tres vías + política real en vivo

| | |
|---|---|
| **Archivo** | `broker/src/routes/accessControl.ts` (prueba), `broker/src/routes/policy.ts` (política) |
| **Endpoints llamados** | La misma URL de hosted-agent-responses de §1, invocada de 3 formas: con la clave de suscripción, sin ella, y directamente contra `{FOUNDRY_AGENTS_PROJECT_ENDPOINT}/agents/pydantic-agent/...` sin encabezado de autorización (`accessControl.ts` líneas 21–39). Política: `GET https://management.azure.com/.../apis/hosted-agent-responses-api/policies/policy?api-version=2022-08-01&format=xml` (`policy.ts` líneas 27–30) |
| **Recurso Azure** | `apim-{suffix}`; `foundry-agents-{suffix}` (rama de bypass directo); ARM |
| **Autenticación** | Rama 1: `api-key`. Rama 2: ninguna (deliberadamente). Rama 3: ninguna (deliberadamente — ese es el punto de la prueba). Obtención de política: token Bearer, scope `https://management.azure.com/.default` |
| **Qué sigue siendo simulado** | Nada. Las tres ramas y la obtención de política son en vivo. |

**Comando 1:**
```
curl -s -i -X POST http://localhost:4000/api/access-control-test
```
**Resultado: `HTTP/1.1 200 OK`**
```json
{
  "attempts": [
    {"id":"with-subscription-key","credentialPresented":"Subscription key","httpStatus":200,"outcome":"success"},
    {"id":"without-subscription-key","credentialPresented":"(none)","httpStatus":401,"outcome":"rejected"},
    {"id":"direct-to-foundry","credentialPresented":"Direct to Foundry, no Entra token","httpStatus":401,"outcome":"rejected"}
  ],
  "provenance": {"band":"live","asOf":"2026-08-01T04:23:43.523Z"}
}
```

**Comando 2:**
```
curl -s -i "http://localhost:4000/api/policy/hosted-agent-responses-api"
```
**Resultado: `HTTP/1.1 200 OK`** — XML real proveniente de ARM, con indentación por tabulaciones (el formato propio de ARM, distinto de la copia con indentación por espacios en el archivo `.xml` del repositorio — prueba de que esto vino de la API en vivo, no de leer un archivo local):

```xml
<policies>
	<inbound>
		<base />
		<!-- Get managed identity token for Foundry Responses API -->
		<authentication-managed-identity resource="https://ai.azure.com" output-token-variable-name="managed-id-access-token" ignore-error="false" />
		<!-- Set bearer token in Authorization header -->
		<set-header name="Authorization" exists-action="override">
			<value>@("Bearer " + (string)context.Variables["managed-id-access-token"])</value>
		</set-header>
		...
```

**Clasificación: verificado en vivo.**

---

## 5. Registro de auditoría — consulta real a Log Analytics

| | |
|---|---|
| **Archivo** | `broker/src/routes/auditRecord.ts` |
| **Endpoint llamado** | `POST https://api.loganalytics.io/v1/workspaces/{workspaceId}/query` (líneas 34–41), texto de la consulta en líneas 30–32 |
| **Recurso Azure** | `workspace-{suffix}`, tabla `ApiManagementGatewayLlmLog` |
| **Autenticación** | Token Bearer, scope `https://api.loganalytics.io/.default` |
| **Qué sigue siendo simulado** | Nada estructuralmente — pero `ResponseMessages` llegó vacío para la fila capturada abajo, y el código (líneas 87–96) devuelve `"(not captured at the gateway for this request)"` en lugar de inventar una respuesta. Ese texto de reserva es en sí mismo evidencia de que se sigue la restricción de honestidad, no evidencia de una brecha en la integración. |

**Comando:**
```
curl -s -i http://localhost:4000/api/audit-record
```
**Resultado: `HTTP/1.1 200 OK`**
```json
{
  "timestamp": "2026-08-01T04:22:24.6244752Z",
  "subscriptionName": "subscription1",
  "modelName": "gpt-5-mini",
  "prompt": "user: Verification test: name the Azure service that sits between the client and the Foundry agent, in five words or fewer.",
  "completion": "(not captured at the gateway for this request)",
  "provenance": {"band":"live-delayed","ageSeconds":102.271}
}
```

**Por qué esto es evidencia decisiva:** el campo `prompt` es palabra por palabra la pregunta hecha en §1 en la llamada a `/api/ask`, dos minutos antes (`ageSeconds: 102.271` — consistente con el tiempo real transcurrido entre ambas llamadas curl en esta sesión). Esto no es un fixture; es Log Analytics devolviendo la fila real que escribió la solicitud de prueba.

**Clasificación: verificado en vivo.**

---

## 6. Controles — mixto: en vivo donde los permisos de la credencial lo permiten

| | |
|---|---|
| **Archivo** | `broker/src/routes/controls.ts` |
| **Endpoints llamados** | `GET .../Microsoft.ApiManagement/service/{apim}/providers/Microsoft.Insights/diagnosticSettings` (línea ~41); `GET .../Microsoft.CognitiveServices/accounts/{foundryModels}/deployments` (línea ~50) |
| **Recurso Azure** | `apim-{suffix}`; `foundry-models-{suffix}` |
| **Autenticación** | Token Bearer, scope `https://management.azure.com/.default` |
| **Qué sigue siendo simulado** | Enumeración completa de asignaciones RBAC — ver abajo, reverificado en esta sesión. |

**Comando:**
```
curl -s -i http://localhost:4000/api/controls
```
**Resultado: `HTTP/1.1 200 OK`** — nótese `"RAI Microsoft.DefaultV2"` incrustado en vivo en la respuesta, y `"diagnostic settings confirmed live"` en el texto del ítem de logging de auditoría:
```json
{
  "active": [
    {"id":"subscriptionKey","name":"Subscription-key authentication, per-consumer revocation"},
    {"id":"managedIdentity","name":"Managed-identity brokering, both hops"},
    {"id":"headerEnforcement","name":"Header enforcement and preview feature gating"},
    {"id":"auditLogging","name":"Full prompt / completion audit logging (diagnostic settings confirmed live)"},
    {"id":"diagnostics","name":"Diagnostics to Log Analytics and App Insights"},
    {"id":"contentFiltering","name":"Content filtering at the model (RAI Microsoft.DefaultV2)"},
    {"id":"registryRbac","name":"Least-privilege, repository-scoped registry RBAC"}
  ],
  "available": [ /* 6 ítems, lista estática sin cambios */ ],
  "provenance": {"band":"live","asOf":"2026-08-01T04:24:09.376Z"}
}
```

**La brecha, reverificada esta sesión:**
```
$ az role assignment list --resource-group "{resource-group}" -o json
[]
```
Vacío — no es un error, es un resultado de autorización vacío. La identidad con la sesión iniciada puede leer políticas, configuraciones de diagnóstico y despliegues en este grupo de recursos, pero no asignaciones de rol. `registryRbac` en la lista activa de arriba es, por lo tanto, la única línea en toda esta integración que está *documentada*, no *verificada en vivo*.

**Clasificación: parcialmente en vivo** — 6 de 7 ítems activos están verificados en vivo; la línea de RBAC es un hecho estático, exacto, pero no verificado.

---

## 7. Encabezado / entorno

| | |
|---|---|
| **Archivo** | `broker/src/routes/environment.ts` |
| **Endpoint llamado** | `GET https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/resources?api-version=2021-04-01` |
| **Recurso Azure** | El propio grupo de recursos (ARM) |
| **Autenticación** | Token Bearer, scope `https://management.azure.com/.default` |

**Comando:**
```
curl -s -i http://localhost:4000/api/environment
```
**Resultado: `HTTP/1.1 200 OK`**
```json
{"region":"swedencentral","resourceGroupName":"{resource-group}","resourceCount":8,"provenance":{"band":"live","asOf":"2026-08-01T04:24:09.759Z"}}
```

`resourceCount: 8` deliberadamente *no* es 21 (el número que el documento de arquitectura del laboratorio documentaba) — este es un conteo de recursos de nivel superior de ARM en vivo, que no enumera sub-recursos (asignaciones de rol, operaciones de API, configuraciones de diagnóstico) como sí lo hace un inventario manual. La discrepancia es esperada y es en sí misma evidencia de que no es un 21 fijo.

**Clasificación: verificado en vivo.**

---

## 8. Arquitectura del broker

### Flujo de solicitud

```
Navegador (fetch) → App Express (index.ts) → middleware cors → express.json() → manejador de ruta
                                                                                       │
                                                                      fetch() a Azure REST / APIM
                                                                                       │
Navegador ← Respuesta JSON ← manejador de ruta ← Respuesta de Azure, adaptada al contrato de DemoDataService
```

Concretamente, `demo-app/src/services/azure/azureService.ts` línea 26 — cada método pasa por un único helper `brokerFetch()` que llama a `${env.brokerBaseUrl}${path}`. `env.brokerBaseUrl` por defecto es `http://localhost:4000` (`demo-app/src/config/env.ts`). No hay ninguna otra llamada de red en todo el código del frontend.

### Middleware (`broker/src/index.ts`)

| Orden | Middleware | Propósito |
|---|---|---|
| 1 | `cors({ origin: config.corsOrigin })` (línea 14) | Restringe qué orígenes del navegador pueden leer la respuesta — ver Modelo de seguridad abajo |
| 2 | `express.json()` (línea 15) | Parsea los cuerpos de solicitud para `POST /api/ask` y similares |
| 3 | 8 routers de ruta, cada uno montado en `/api` (líneas 17–24) | Un archivo por necesidad de datos — ver §1–§7 |
| 4 | Middleware de manejo de errores (líneas 31–35) | Captura cualquier excepción reenviada por `asyncHandler` y devuelve un `502` limpio en lugar de colgar el proceso o la solicitud |

### Enrutamiento

Un `express.Router()` por área de responsabilidad (`routes/ask.ts`, `routes/journey.ts`, `routes/agents.ts`, `routes/accessControl.ts`, `routes/policy.ts`, `routes/auditRecord.ts`, `routes/controls.ts`, `routes/environment.ts`), cada uno exportando un router montado bajo el prefijo compartido `/api`. Ninguna ruta toca directamente la llamada a Azure de otra ruta — el único estado compartido es el mapa en memoria de `askStore.ts`, leído por `journey.ts` y escrito por `ask.ts`, que es cómo `totalLatencyMs` pasa de un endpoint al otro (verificado como real en §2).

### Modelo de seguridad

1. **La clave de suscripción nunca sale del proceso del broker.** Se lee una sola vez de `broker/.env` (`config.ts` línea 19), se adjunta como encabezado saliente en exactamente dos lugares (`ask.ts` línea 29, la rama "con clave" de `accessControl.ts`), y nunca se incluye en ningún JSON que el broker devuelve. Verificado en esta sesión:
   ```
   $ curl -s http://localhost:4000/api/agents/pydantic-agent/provenance | grep -c "$KEY"
   0
   ```
   (`$KEY` fue el valor real de 32 caracteres leído directamente de `.env`; cero ocurrencias en una respuesta que legítimamente incluye los *nombres* de las otras variables de entorno de ese agente — `APIM_SUBSCRIPTION_KEY` aparece como nombre de clave en `environmentVariableKeys`, nunca como valor).

2. **El frontend no tiene forma de llamar a Azure aunque quisiera.** `demo-app/package.json` no contiene ningún paquete de Azure (solo `@fluentui/*`, `react`, `zustand`). `broker/package.json` sí contiene `@azure/identity`. Este es un hecho estructural, no un comportamiento en tiempo de ejecución que pudiera regresionar silenciosamente — el bundle del navegador no puede construir una credencial ni llamar a un método del SDK de Azure que no existe en él.

3. **CORS restringe qué orígenes pueden leer las respuestas del broker.** `cors({ origin: config.corsOrigin })` siempre responde con el único origen configurado (`http://localhost:5173`) en `Access-Control-Allow-Origin`, sin importar qué encabezado `Origin` haya enviado el llamador:
   ```
   $ curl -s -i http://localhost:4000/api/environment -H "Origin: http://evil-site.example"
   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: http://localhost:5173
   ```
   **Salvedad, expresada con precisión:** `curl` no hace cumplir CORS — solo lo hacen los navegadores, al leer este encabezado de respuesta del lado del cliente y descartar la respuesta si no coincide con su propio origen. Esta prueba demuestra que el *contenido del encabezado* es correcto (nunca refleja un origen arbitrario de la solicitud); no demuestra por sí misma que un navegador fue bloqueado, porque no se usó un navegador para probarlo.

4. **Ninguna credencial es configurable desde el navegador.** Todo valor `AZURE_*` y `APIM_*` vive en `broker/.env`, confirmado como ignorado por git:
   ```
   $ git check-ignore -v broker/.env
   broker/.gitignore:3:.env	labs/.../broker/.env
   ```
   El único ajuste del frontend relacionado con el broker es `VITE_BROKER_BASE_URL`, una URL, no una credencial.

### Por qué el navegador nunca recibe secretos — resumen

No es una política que el código elige seguir — es una propiedad estructural de dónde vive la credencial (§8.1) combinada con que el frontend no tiene ninguna ruta de código capaz de llamar directamente a Azure (§8.2, verificado por ausencia de dependencias, no por inspección de intención).

---

## 9. Veredicto consolidado

### Verificado en vivo
- **① Asistente de IA** — round trip real APIM → Foundry → APIM → `gpt-5-mini` (§1)
- **③ Control de acceso** — las tres pruebas de credenciales, XML de política real desde ARM (§4)
- **④ Agentes activos** — lectura real del registro para `pydantic-agent`; correctamente ausente para `strands-agent` (§3)
- **⑥ Registro de auditoría** — consulta real a Log Analytics, verificada por correlación de texto del prompt (§5)
- **Encabezado / entorno** — conteo de recursos y región real de ARM (§7)

### Parcialmente en vivo
- **② Recorrido de la solicitud** — latencia total y estructura del flujo reales; tiempo por salto no intentado, honestamente ausente en lugar de estimado (§2)
- **⑤ Controles** — 6 de 7 ítems activos son verificaciones ARM en vivo; el RBAC del registro es un hecho documentado, no verificado, debido a una brecha real de permisos en la identidad actual (§6)

### Todavía simulado (solo en modo Simulación, o no implementado en absoluto)
- Texto de respuesta predefinida de escenarios sugeridos (`assistant.suggestion.*.response`) — solo se usa en modo Simulación; el modo Live siempre muestra la respuesta real del modelo (§1)
- `strands-agent` — no se simula como una segunda fila; simplemente está ausente, porque nunca se registró en este despliegue (§3)
- Desglose de tiempo por salto de APIM — no implementado en ningún modo; todavía no existe ninguna ruta de código que produzca este valor
- Enumeración completa de asignaciones RBAC para Controles — no consultable con la credencial actual; la línea de la lista activa es exacta pero estática
- Localización de las respuestas del broker — el texto de `/api/controls` es solo en inglés sin importar el idioma configurado por el presentador

---

## Auditoría de consistencia de la documentación

Tras los hitos de UI e integración con Azure, se realizó una auditoría de consistencia de seis documentos del proyecto contra lo efectivamente implementado en `demo-app/` y `broker/`, con las siguientes reglas: actualizar solo lo que se había vuelto factualmente incorrecto, no reescribir decisiones de diseño, no cambiar la arquitectura, no modificar código de la aplicación.

**Método.** Los seis documentos se leyeron por completo, y luego se estableció la verdad de referencia a partir de la implementación misma — `AppShell.tsx`, `AIAssistantPanel.tsx`, `useKeyboardShortcuts.ts`, `state/types.ts`, `config/env.ts`, `i18n/translations.ts`, `PresenterMenu.tsx`, `main.bicep`, `broker/.env`, y ambos archivos `.env.example` — no a partir de los resúmenes del hito anterior. Donde un documento y el código discrepaban, el código se trató como autoridad.

**Principio de edición.** El texto de diseño original y su razonamiento se preservaron en todas partes. Las divergencias se registraron como notas en línea marcadas ("Overridden in implementation", "As built", "⚠️"), nunca borrando el razonamiento. Esto mantiene cada documento utilizable como el registro de *por qué* se tomó una decisión, a la vez que lo hace preciso sobre *qué existe*.

### Documentos actualizados

| Documento | Veredicto |
|---|---|
| Contexto del proyecto | **Actualizado** — fuertemente. Su estado, la tabla de componentes y el orden de construcción estaban todos equivocados |
| Diseño de la demo | **Actualizado** — reclasificación de bandas en §3, versiones de agentes, nomenclatura de modos |
| Plano de UI | **Actualizado** — el documento más divergente; el layout y el panel ① fueron reemplazados durante la construcción |
| Flujo de presentación | **Actualizado** — tres momentos ("beats") asumían datos que no existen |
| Documento de arquitectura | **Actualizado** — dos correcciones factuales menores, ambas preexistentes, no causadas por la integración |
| Estado de sesión | **Sin cambios** — escrito el 2026-08-01 a partir de la evidencia de verificación; seguía siendo exacto |

### Por qué cada uno estaba desactualizado, y qué cambió

**Contexto del proyecto.** Se había escrito antes de la implementación y nunca se revisó. Afirmaba "implementación no iniciada — a la espera de aprobación para construir" y "ningún código escrito, ningún archivo del repositorio modificado", lo cual llevaría a una sesión nueva a creer que `demo-app/` y `broker/` no existen. Se cambió: la línea de estado (ahora construido, modo Live conectado a Azure real, con puntero al estado de sesión); se eliminó la tabla completa de RBAC de la lista de cosas "genuinamente en vivo" y se registró por qué se reclasificó (la identidad del presentador no puede leer asignaciones de rol); el modo se etiqueta ahora como Azure Live / Simulación, donde Simulación renderiza contenido simulado en lugar de una captura del despliegue real; se reemplazó la tabla de componentes de 12 columnas por el layout de dos columnas tal como se construyó; se corrigió el conteo de atajos de teclado (siete enlaces, no seis); la tabla de documentos se amplió; se reescribió para describir el estado real y registrar los dos overrides ocurridos durante la implementación; se describió como construida la aplicación de presentador alojada localmente, y se anotó que pre-registrar ambos agentes (un prerrequisito declarado) **no** se ha hecho; el orden de construcción se convirtió en una tabla de estado, y el pie de página ya no dice "a la espera de aprobación".

**Diseño de la demo.** La sección que gobierna qué puede afirmar la aplicación tenía tres ítems que la verificación en vivo movió de banda, y el documento seguía diciendo "sin implementación". Se cambió: el encabezado de estado (aprobado e implementado, con puntero a que la estructura de cinco pantallas fue reemplazada por el Plano de UI *antes* de la implementación, no por esta auditoría); se tachó la tabla completa de asignaciones RBAC de la banda 🟢 EN VIVO; `ApiManagementGatewayLlmLog` se actualizó de "confirmar en ensayo" a verificado para **prompts**, con la salvedad de completions vacíos declarada; las duraciones de APIM por salto se marcaron como **no implementadas** en ningún modo; se añadieron dos filas (RBAC reclasificado 🔴 con la razón, y un marcador de **NO HECHO** en la recomendación de pre-registrar ambos agentes); se registró que el toggle se implementó como Azure Live / Simulación en Ajustes en lugar de un interruptor de encabezado Live / Replay, y que Simulación es contenido simulado, no una captura de ensayo; las versiones de agente se actualizaron de `:2` a `:3`, con una advertencia de que la segunda fila de agente no existe.

**Plano de UI.** El documento más divergente. Dos de sus decisiones fueron deliberadamente reemplazadas durante la implementación por instrucción explícita — el layout y el Ask de un solo turno — y el documento no describía ninguna de las dos. Varios valores concretos estaban obsoletos. Se cambió: encabezado de estado con una tabla que declara ambos cambios de entrada, más la página de inicio y el panel de ajustes como adiciones no especificadas; se marcó como reemplazada la decisión de un asistente de un solo turno, describiendo el asistente multi-turno real, conservando el argumento original porque el riesgo que nombra (la sala debatiendo la calidad de la respuesta) sigue teniendo que gestionarse verbalmente; se añadió la composición real de dos columnas como diagrama ASCII; se marcó que el panel de Respuesta ya no existe como región separada; se agregaron notas de override para el panel fusionado; se actualizaron las versiones de agente a `:3` y se añadió el rango medido de arranque en frío (10–17 s) frente al aspiracional "1.8 s"; se tacharon las duraciones por salto y el tiempo interno del agente derivado como **no implementados**; se advirtió que solo una fila de agente se renderiza; se documentó que la lista activa de Controles tiene siete ítems, que la línea de RBAC del registro está documentada pero no verificada en vivo, y que el texto de ese panel es solo en inglés; se registró que "Warm agent" y "Refresh telemetry" están deshabilitados en el menú del presentador; la tabla de atajos se amplió a los siete enlaces reales con sus condiciones de guarda.

**Flujo de presentación.** El de mayor riesgo operativo de los cuatro. El guion instruía al presentador a señalar tiempos por salto, un segundo agente y un campo de completion — ninguno de los cuales está actualmente en pantalla. Un presentador que lo siguiera al pie de la letra describiría cosas que la audiencia no puede ver. Se cambió: encabezado de estado con una tabla que nombra los tres momentos cuyos supuestos ya no se sostienen; el arranque en frío se cuantificó en 10–17 s y se marcó la advertencia del ítem "warm agent" **deshabilitado**; un ítem se marcó pendiente; otro se reformuló (el historial de versiones se satisface en `:3`); otro se dividió entre prompt confirmado y completion no confirmado; otro se marcó como aún no hecho; un momento se actualizó a `:3`, con el asistente en la columna izquierda y la instrucción de leer la versión que esté en pantalla en lugar de memorizar un número; otro momento se reescribió porque la respuesta honesta cambió: no hay cifras por salto que defender; otro momento recibió un marcador de parada con tres opciones explícitas (registrar Strands / correr en Simulación / cortar el argumento) y la instrucción de no describir un agente que no está en pantalla, quitando RBAC de la lista de recursos en vivo; otro momento recibió la indicación de verificar de antemano la captura de completion y ajustar el texto en lugar de señalar un campo "(no capturado…)" a mitad de frase; la sección de recuperación se renombró de Replay a Simulación, con el texto corregido a "una captura local" ya que no existe ninguna grabación de este despliegue; se tachó la tabla completa de RBAC de la expansión de 20 minutos; se documentaron `P` y `Esc` como atajos fuera de guion, y se registró que los momentos no se han cronometrado contra un reloj.

**Documento de arquitectura.** Documenta el laboratorio (Bicep, notebook, contenedores de agentes), que el trabajo de la demo no tocó — así que casi todo seguía siendo correcto. Surgieron dos errores factuales durante la verificación. Ambos son preexistentes y no fueron causados por la integración; se corrigieron aquí porque la auditoría los verificó directamente contra `main.bicep`. Se cambió: "los 13 outputs" se corrigió a **12** (`main.bicep` contiene exactamente doce declaraciones `output` y la tabla ya listaba doce filas); se anotó que el grupo de recursos desplegado es `{resource-group}` con `{suffix}`, y que el inventario manual de 21 filas y el conteo de nivel superior de ARM (8) miden cosas distintas. Ningún contenido arquitectónico se alteró.

### Inconsistencias restantes (no corregidas deliberadamente)

Cada una está fuera del alcance declarado o necesita una decisión.

**Código de la aplicación — fuera de alcance por instrucción.** Quedan tres comentarios/valores obsoletos en el código: un comentario en la configuración del frontend que dice que nada en los servicios de Azure está conectado todavía (ya no es cierto), y el nombre del grupo de recursos por defecto sin coincidir con el desplegado; un cargador de outputs de despliegue que sigue devolviendo valores de relleno para los trece campos y cuyo comentario cita "los 13 outputs" (son 12) — el encabezado ahora obtiene valores reales de `/api/environment`, por lo que este cargador parece sin uso, aunque no se verificó exhaustivamente; un comentario de un hook de atajos de teclado que dice que no llama a Azure, "eso pertenece al hito del broker", lo cual ya ocurrió; y el archivo de ejemplo de variables de entorno del frontend, que describe el broker como "aún no implementado" y "no parte de este scaffold".

**`demo-app/README.md`** (no el README del laboratorio oficial) — a la fecha de esta verificación seguía diciendo "solo fundamento de arquitectura. Sin lógica de negocio, sin conectividad Azure." Rotundamente incorrecto para ese momento. No estaba dentro del conjunto auditado por este reporte, así que se dejó sin tocar en su momento — **desde entonces fue reescrito por completo** como parte de la reorganización de documentación de la que este mismo archivo forma parte; ver [`../../../../README.md`](../../../../README.md) para la versión vigente.

**Preguntas factuales sin resolver**, que la documentación no puede zanjar: si `ApiManagementGatewayLlmLog` captura completions en absoluto en esta superficie, o si el `ResponseMessages` vacío fue específico de esa fila; si las reglas de degradación a 1366×768 se sostienen en el nuevo layout de dos columnas — las reglas originales están escritas contra la grilla de 12 columnas y no se re-derivaron; si el sistema visual tal como se construyó coincide con los tokens y la escala tipográfica del diseño — no auditado, eso necesita la aplicación en ejecución, no una lectura de archivos.

**Tensión de diseño/implementación conocida, registrada, no resuelta:** el Plano de UI argumentaba que una transcripción invita a la sala a debatir la calidad de la respuesta, y la implementación ahora tiene una. El reemplazo fue instruido y no se re-discute aquí, pero el riesgo que la sección nombra es real, y el Flujo de presentación sigue llevando la única mitigación — el presentador redirigiendo una vez, con firmeza.

**Reemplazado antes de la implementación, dejado tal cual:** la estructura de cinco pantallas y la navegación de riel izquierdo del Diseño de la demo, y su orden de ejecución de 12–15 minutos (contra los 10:00 del Flujo de presentación). Estos fueron reemplazados durante el diseño, no por la construcción, y ambos documentos ya hacen referencia cruzada al cambio. Reescribirlos borraría historia de diseño sin ninguna ganancia factual.

## Ver también

- [`ESTADO_DEL_PROYECTO.md`](ESTADO_DEL_PROYECTO.md) — el estado consolidado y actualizado del proyecto.
- [`DECISIONES_DE_DISENO.md`](DECISIONES_DE_DISENO.md) — la filosofía y las decisiones de diseño referenciadas aquí.
- [`HISTORIAL.md`](HISTORIAL.md) — el historial cronológico completo del desarrollo.
