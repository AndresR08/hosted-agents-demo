# Estado del proyecto — hosted-agents-demo + automatización del lab

> Fuente de verdad de "en qué estado quedó el proyecto de automatización/demo".
> El notebook oficial (`ai-foundry-hosted-agents-custom-framework.ipynb`) y su
> `main.bicep` siguen siendo la fuente de verdad del **laboratorio**. Este
> archivo no la reemplaza.

Última actualización: **2026-08-31**. Repo autosuficiente (lab vendorizado y
fijado, más un parche local documentado), lab oficial externo limpio,
invocación de agentes verificada automáticamente en cada despliegue.

## 1. Objetivo

Convertir el laboratorio oficial `ai-foundry-hosted-agents-custom-framework`
(notebook manual, paso a paso) en un script de PowerShell repetible
(`deploy.ps1`) que despliegue la infraestructura, registre los Hosted Agents, y
además levante una demo web (`hosted-agents-demo/broker` + `demo-app`) servida
desde un único Azure App Service, para poder mostrarla en preventa/clientes con
un solo comando y sin exponer secretos en el navegador.

## 2. Arquitectura actual (real, en disco)

```
hosted-agents-demo/                    ← este repo, AUTOSUFICIENTE
├── broker/                            demo backend (Express)
├── demo-app/                          demo frontend (Vite/React)
├── vendor/ai-gateway/                 ← lab oficial vendorizado (MIT), PINNED
│   ├── NOTICE.md · LICENSE.md
│   ├── labs/…-custom-framework/       main.bicep, políticas, notebooks, agentes
│   ├── modules/                       los 12 módulos Bicep del cierre transitivo
│   └── shared/utils.py
├── labs/…-automation/                 ← AUTOMATIZACIÓN
│   ├── config/lab.defaults.psd1
│   ├── scripts/{deploy,teardown,sync-vendor}.ps1 + modules/*.ps1
│   ├── scripts/local/                 herramientas SOLO locales (nunca desplegadas)
│   ├── docs/01..05
│   └── out/                           git-ignored: outputs.json, key, paquete
└── .github/workflows/sync-vendor.yml  refresco del vendor vía PR, sin auto-merge
```

**El repositorio ya no depende de tener `Azure-Samples/AI-Gateway` clonado al
lado.** `deploy.ps1` resuelve el lab desde `vendor/` por defecto; los dos
candidatos hermanos externos se conservan después, y `-LabPath` sigue siendo el
override explícito.

La ubicación de la automatización (`hosted-agents-demo/labs/…`, un nivel más
adentro y no hermana directa de `broker/`) se mantiene y se da por buena.

## 3. Estado por fase

| Fase | Estado | Evidencia |
|---|---|---|
| 1 — Auditoría del notebook | ✅ | `docs/01-notebook-audit.md` |
| 2 — Comparación con revisión previa | 🚫 Omitida | La revisión ofrecida describía otro laboratorio, con otra arquitectura. No se trasladó nada estructural; sí dos lecciones técnicas, resumidas en `docs/03-implementation-report.md` §2.5 |
| 3 — Implementación del script | ✅ | `docs/03-implementation-report.md`, 8→14 archivos `.ps1`, parseo sin errores |
| 4 — Registro del Hosted Agent (paso roto) | ✅ **Confirmado en Azure real** | `pydantic-agent:5` y `strands-agent:2`, ambos `status: active`. Ver §4 |
| 5 — Validación de invocación (directa + APIM) | ✅ **Confirmada manualmente** (2026-08-26) | El mantenedor verificó que los agentes responden. `Validate.ps1` automatiza la misma prueba; sus campos en `out/outputs.json` siguen en `null` sólo porque el último run se saltó ese bloque |
| 6 — Manejo de errores / reintentos | ✅ | `Invoke-Az`, reintentos ARM transitorios, `Get-CleanErrorText` — descrito en `03-implementation-report.md` §8 |
| 7 — Polling de estado del agente | ✅ | Ambos agentes alcanzaron `active`, y el script no avanza sin ese polling ⇒ el bucle funcionó contra el servicio real |
| 8 — Validación offline / dry-run | ✅ | `-ValidateOnly` corrido con éxito (exit 0), parcheo de 3 bugs reales encontrados ejecutando el script |
| 9 — Decisión y automatización de App Service | ✅ Desplegado y sirviendo | `az webapp show`: `state: Running`, `NODE\|22-lts`, identidad system-assigned. `GET /api/health` → 200, `GET /` sirve el bundle, `GET /api/agents` devuelve los dos agentes reales |
| 10 — Documentación final / cierre | ⚠️ | README y docs existen y están detallados; este archivo se agrega ahora como índice persistente |

## 4. El paso roto del registro del Hosted Agent

- **Diagnóstico del notebook:** cell 13 (`project.agents.create_version`, SDK
  `azure-ai-projects==2.3.0`) falla con `400 BadRequest — "API version not
  supported"`, y el output guardado en el notebook es en realidad un
  `KeyboardInterrupt` (la llamada se colgó).
- **Solución implementada:** llamada REST directa vía `az rest` contra
  `POST {projectEndpoint}/agents/{name}` (creación) /
  `POST {projectEndpoint}/agents/{name}/versions` (versiones siguientes), con
  `--resource https://ai.azure.com`, verificada campo por campo contra la
  documentación oficial de Microsoft (no contra el broker, que se usó solo como
  pista). Implementado en `scripts/modules/FoundryAgent.ps1`.
- **¿Validado contra Foundry real? SÍ — CONFIRMADO.** Consulta de solo lectura
  contra el servicio real, 2026-08-18:

  ```
  GET {projectEndpoint}/agents?api-version=v1  --resource https://ai.azure.com

  Agent           Version  Status   Image
  strands-agent   2        active   <registry>.azurecr.io/strands-agent:<tag>
  pydantic-agent  5        active   <registry>.azurecr.io/pydantic-agent:<tag>
  ```

  Ambos agentes existen, están en `active`, y su definición contiene las cinco
  variables de entorno exactamente como las arma `deploy.ps1`. `pydantic-agent`
  llegó a la versión 5, lo que implica varios registros exitosos sucesivos.
  **El paso que estaba roto en el notebook está resuelto y probado en
  producción.** La ruta REST reemplaza correctamente al SDK de Python.

- **⚠️ Corrección de documentos previos.** `docs/03-implementation-report.md`
  §2, §10 y §11 declaran este paso como "NOT VERIFIED AGAINST A LIVE
  ENVIRONMENT" y "no lab resources were deployed". **Eso quedó obsoleto:** ese
  informe se escribió antes del primer despliegue real y nunca se actualizó (su
  propia §12 pedía justamente eso). Una versión anterior de este mismo archivo
  repetía el error y añadía uno propio: concluía que no se podía confirmar el
  registro, leyendo `out/outputs.json` como si fuera el estado del sistema. No
  lo es — es el registro del último run, que fue parcial. **La fuente de verdad
  es Azure, no `out/outputs.json`.**

- **Invocación confirmada (2026-08-26).** El mantenedor verificó manualmente que
  los agentes responden. Queda cerrado también ese extremo de la cadena.

- **Origen real del `404 Subdomain does not map to a resource`.** No era un
  fallo del lab: el notebook local había sido modificado para usar
  `project.get_openai_client()` del SDK en lugar del REST documentado que
  upstream trae, con su header `Foundry-Features: HostedAgents=V1Preview`. El
  notebook ya fue revertido a upstream. `Validate.ps1` siempre usó la ruta REST
  con ese header, así que la automatización nunca estuvo afectada.

## 5. Archivos clave y su propósito

| Ruta | Propósito |
|---|---|
| `scripts/deploy.ps1` | Orquestador principal, un solo comando |
| `scripts/teardown.ps1` | Borra el resource group (equivalente a `clean-up-resources.ipynb`) |
| `scripts/modules/Common.ps1` | Logging, wrapper único de `az`, wrapper REST de Foundry |
| `scripts/modules/Preflight.ps1` | Valida CLI, auth, suscripción, config, ubicación del lab |
| `scripts/modules/Infra.ps1` | Resource group, parámetros Bicep, despliegue ARM, lectura de outputs |
| `scripts/modules/AgentImage.ps1` | ACR readiness, política del registro, `az acr build` |
| `scripts/modules/FoundryAgent.ps1` | Registro del Hosted Agent vía REST + polling de estado |
| `scripts/modules/Validate.ps1` | Pruebas de invocación directa y vía APIM |
| `scripts/modules/AppService.ps1` | Build, sitio, RBAC, app settings, deploy y health-check de la demo |
| `config/lab.defaults.psd1` | Configuración fija del lab (de la notebook), sin datos de suscripción |
| `docs/01-notebook-audit.md` | Fase 1: qué hace realmente el notebook |
| `docs/03-implementation-report.md` | Reporte de implementación, bugs encontrados, pruebas ejecutadas |
| `docs/04-app-service-decision.md` | Decisión de arquitectura App Service (1 sitio vs 2 vs SWA), RBAC, redeploys |
| `docs/05-upstream-issue-deployments-bicep.md` | Bug de upstream que mantiene el vendor fijado; borrador de issue para GitHub |
| `out/` (git-ignored) | `outputs.json`, `params.generated.json`, `apim-subscription-key.txt`, `appservice-package/` |
| `broker/src/acr.ts` | Reemplaza `azCli.ts`: lookup de ACR vía REST (Linux App Service no tiene Azure CLI) |

## 6. Decisiones de diseño ya tomadas (no reabrir sin razón nueva)

- **PowerShell + Azure CLI como única vía**, sin Python ni Bash auxiliar
  (justificado en `03-implementation-report.md` §9 y §2.5).
- **REST (`az rest`) en vez del SDK de Python** para el registro del agente:
  el SDK es el camino roto en el notebook, y REST reutiliza la sesión de
  `az login` sin credencial adicional.
- **Fase 2 omitida deliberadamente**: la revisión previa ofrecida como
  comparación describía otro laboratorio, con otra arquitectura. No se usó
  ningún dato estructural de ella; solo dos lecciones técnicas, ahora en
  `docs/03-implementation-report.md` §2.5.
- **Un solo App Service** (no dos, no Static Web App + App Service): elimina
  CORS, identidad duplicada y dependencia circular de URLs; único requisito
  cumplido de "todo con Azure CLI puro" (`docs/04-app-service-decision.md`).
- **Resource group reutilizado por defecto** entre corridas (no uno nuevo por
  run), para no reprovisionar APIM (el recurso más caro) cada vez.
- El directorio de módulos se llama `scripts/modules/` (no `scripts/lib/`)
  porque `lib/` estaba en el `.gitignore` raíz del repo del lab oficial y
  ocultaba 6 de 8 archivos `.ps1` de git.
- **APIM `Basicv2` sigue siendo el default; `Consumption` NO.** Consumption se
  desplegó y validó completo (más barato: ~$0 en reposo frente a ~$197/mes, e
  instala en ~14 min en vez de ~25-35), pero **la primera petición tras 35
  minutos de reposo tardó 54 s**, medidos sobre el gateway solo: una llamada sin
  API key que APIM rechaza con `401` sin llegar a ningún backend, sin generar un
  token. La siguiente tardó 0,36 s. Eso descarta Consumption para cualquier
  sesión con cliente en vivo. Sigue soportado y recomendado para entornos
  desechables. **El dato y las dos formas de medirlo mal están en
  `docs/06-apim-consumption.md`** — leerlo antes de volver a proponerlo, para no
  repetir el experimento: con 12 min de reposo la penalización parece de ~1,4 s
  porque la instancia sigue caliente, y una llamada de calentamiento es
  necesaria pero no suficiente (una pausa larga durante la propia demo la vuelve
  a dormir). El keep-alive se consideró y se descartó: su modo de fallo es
  silencioso.
- **`vendor/` es upstream más un delta conocido y revisable, no upstream
  intacto.** Consumption exige `sku.capacity: 0` y el `apim.bicep` vendorizado
  fija `1` sin exponerlo como parámetro, así que la plantilla vendorizada tiene
  que cambiar. En vez de editarla a mano —que la siguiente sincronización
  descartaría en silencio— el cambio vive en `patches/` y `sync-vendor.ps1` lo
  aplica en cada sync, antes del build check, **fallando la sincronización** si
  algún parche deja de aplicar. Es una personalización nuestra, no un bug de
  upstream: no se reporta a Microsoft (contraste con `docs/05`, que sí lo es).

## 7. Pendientes, en orden de prioridad

1. **⚠️ `out/outputs.json` no es un artefacto de estado fiable.** Cada run lo
   sobrescribe entero, así que un run parcial (con `-Skip*`) **borra** los
   datos de un run completo anterior y deja `null` donde antes había valores
   reales. Un `demoHealthCheckPassed: true` conviviendo con
   `directInvocationVerified: null` sugiere éxito verificado donde solo hay
   liveness. **Para saber el estado real hay que consultar Azure.**
2. **`/api/health` es más débil de lo que su nombre sugiere.** Es literalmente
   `res.json({ok:true})` (`broker/src/index.ts:35`): estado de proceso, no toca
   ningún recurso de Azure. `AppService.ps1` lo compensa con dos sondas más
   (documento raíz y `/api/environment`), pero ni las tres juntas prueban que
   la cadena APIM → Hosted Agent → gpt-5-mini funcione.
3. Riesgos de RBAC/timing ya identificados y aún vigentes (de
   `03-implementation-report.md` §11 y `04-app-service-decision.md`):
   propagación de RBAC de ACR sin medir, dependencia de `deployer().objectId`
   si el deploy y el `az acr build` corren bajo principals distintos, cuota de
   `gpt-5-mini` en `swedencentral` no verificada, ventana de retención de 48h
   (APIM/Foundry) / 14 días (Log Analytics) al recrear el mismo resource group.
4. **`docs/03-implementation-report.md` está desactualizado en la dirección
   pesimista.** Sus §2, §10 y §11 declaran no verificado lo que Azure confirma
   como funcionando. Debe actualizarse o marcarse como documento histórico.

   Mientras tanto, **el estado real vive aquí**, no en ese informe:

   | Para saber… | Mirar |
   |---|---|
   | Qué decisiones están tomadas y no se reabren | §6 de este archivo |
   | Qué se cerró y cuándo | §7b de este archivo |
   | Qué revisión de upstream está vendorizada, y con qué parches | `vendor/ai-gateway/NOTICE.md` |
   | El tier de APIM y por qué no es `Consumption` | [`docs/06-apim-consumption.md`](docs/06-apim-consumption.md) |
   | Qué cambió y cuándo, en formato de bitácora | `CHANGELOG.md` (raíz del repo) |
   | Si el lab desplegado funciona **ahora** | Azure. Ningún documento sustituye una consulta en vivo (ver pendiente 1) |

   Lo que el informe sí sigue siendo es el registro de **por qué** la
   automatización se construyó como se construyó: §2 (el paso roto del
   notebook), §2.5, §9 y la justificación de REST sobre el SDK siguen siendo
   válidos y no están duplicados en ningún otro sitio. El desfase está en sus
   afirmaciones de *estado*, no en las de *diseño*.
5. **El escenario de teardown + redeploy con el mismo nombre nunca se ha
   probado** (ventana de soft-delete: ~48 h APIM/Foundry, hasta 14 días Log
   Analytics). `teardown.ps1` sí se ejecutó ya, contra un resource group
   descartable.

## 7b. Cerrado

- **Invocación de los agentes: confirmada manualmente por el mantenedor**
  (2026-08-26). Responden correctamente.
- **Lab oficial limpio.** Se eliminaron las copias obsoletas del 31-jul de
  `broker/` y `demo-app/` que vivían dentro de
  `ai-gateway/labs/ai-foundry-hosted-agents-custom-framework/`, junto con sus
  `.env`/`.env.local`. El único secreto real era una `APIM_SUBSCRIPTION_KEY`
  que apuntaba a un resource group ya destruido (`…-V2`) y a un APIM purgado:
  **no requirió rotación**, verificado por hash contra las claves vivas.
- **Notebook oficial revertido a upstream.** Contenía dos cambios de código
  reales, no solo salidas: una línea de depuración en la celda 13 y, en la
  celda 15, la sustitución del REST documentado (con el header
  `Foundry-Features: HostedAgents=V1Preview`) por `get_openai_client()` del
  SDK — que es lo que producía el `404 Subdomain does not map to a resource`
  atribuido durante meses al lab. `Validate.ps1` siempre usó la ruta REST
  correcta, así que la automatización nunca estuvo afectada.
- **`e5d99225` descartado.** Ver §6.

## 8. Próximo paso lógico recomendado

### Ya hecho: repositorio autosuficiente

La **migración a repositorio autosuficiente está implementada y en uso**, no en
diseño. Este párrafo describía una propuesta "pendiente de aprobación, nada
implementado todavía"; eso dejó de ser cierto hace tiempo y contradecía la
cabecera de este mismo archivo.

Lo que existe hoy:

- `vendor/ai-gateway/` contiene el lab oficial completo y el cierre transitivo
  de su `main.bicep`, bajo la licencia MIT de upstream (`LICENSE.md` intacto).
- Está **fijado** en el commit `561d7199` (upstream del 2026-07-24, vendorizado
  el 2026-08-27). Mover el pin es un acto deliberado, no un efecto secundario
  de sincronizar. El motivo de no haber pasado a `e5d99225` está en §6 y en
  [`docs/05-upstream-issue-deployments-bicep.md`](docs/05-upstream-issue-deployments-bicep.md).
- `scripts/sync-vendor.ps1` reconstruye ese árbol desde cero, verifica que
  compile antes de publicarlo, y aplica los parches de `patches/` fallando si
  alguno deja de aplicar (§6).
- `.github/workflows/sync-vendor.yml` lo ejecuta mensualmente y abre un pull
  request; nunca fusiona solo.
- `deploy.ps1` ya no depende de tener `Azure-Samples/AI-Gateway` clonado al
  lado: resuelve el lab desde `vendor/` y solo cae a las ubicaciones hermanas
  históricas si se le pasa `-LabPath`.

También quedó cerrada la validación de invocación que este apartado
recomendaba como siguiente paso: `Validate.ps1` comprueba en **cada**
despliegue que ambos agentes responden, por la ruta directa a Foundry y a
través de APIM, y así ocurrió en los despliegues del 2026-08-27.

### Siguiente paso real

**Resolver el pendiente 4**: decidir si `docs/03-implementation-report.md` se
actualiza o se marca como documento histórico. Es el único documento que hoy
afirma cosas falsas sobre el estado —en dirección pesimista, que es la que hace
perder tiempo reverificando lo que ya funciona— y arreglarlo no cuesta
infraestructura ni dinero.

Después, por orden de valor: el pendiente 1 (`out/outputs.json` no es un
artefacto de estado fiable) y el 5 (teardown + redespliegue con el mismo
nombre, nunca probado), que ahora es más barato de ensayar porque
`teardown.ps1` purga los recursos en soft-delete en vez de dejarlos reteniendo
el nombre 48 h.
