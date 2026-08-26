# Propósito de esta demo

## En una frase

Esta aplicación es una **herramienta de preventa**: una consola visual e interactiva que ayuda a explicar, en una reunión con un cliente, el laboratorio oficial de Microsoft **"AI Foundry Hosted Agents with Custom Frameworks"** (repositorio [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway)) — sin que nadie tenga que leer una notebook de Jupyter en pantalla.

No es un producto. No es un reemplazo de Azure AI Foundry. Es un narrador.

## Qué problema resuelve

El laboratorio oficial es excelente para lo que fue construido: un ingeniero, paso a paso, en una notebook, desplegando infraestructura real con Bicep, construyendo una imagen de contenedor, registrándola como Hosted Agent y probándola contra Azure. Es la fuente de verdad técnica y el camino de reproducción.

Pero una notebook no es un buen vehículo para una conversación de 15 minutos con un CIO, un CISO o un arquitecto líder de una empresa regulada. Nadie va a leer celdas de Python en una sala de juntas, y explicar "arquitectura de gateway dual" con un diagrama estático no deja ver que el sistema realmente funciona, es seguro y es gobernable.

Esta demo traduce ese mismo laboratorio — desplegado, real, sin datos falsos — a una narrativa clicable que un arquitecto de soluciones o un consultor preventa puede presentar sin escribir una sola línea de código en vivo.

## Qué es

- Una **capa de presentación** sobre los recursos reales que el laboratorio despliega: Azure API Management, dos cuentas de Microsoft Foundry, un despliegue de `gpt-5-mini`, Azure Container Registry, Log Analytics y Application Insights.
- Una aplicación que **lee** esos recursos en vivo — nunca los reemplaza, nunca los administra, nunca inventa lo que muestra.
- Un instrumento pensado para **una sola persona presentando**, con una audiencia que observa y pregunta, no un tablero de operaciones para uso diario.
- Un copiloto integrado que responde preguntas de arquitectura en el momento, hablando desde dentro de la misma solución que se está mostrando (ver [`CONTEXTO_COPILOTO.md`](CONTEXTO_COPILOTO.md)).

## Qué NO es

- **No es Azure AI Foundry.** No reemplaza el portal de Foundry ni el Portal de Azure. Registrar agentes, cambiar políticas, operar el día a día — todo eso sigue sucediendo en esas herramientas, no aquí.
- **No es un producto de Microsoft ni un artefacto soportado.** Es un activo de preventa construido sobre un laboratorio de código abierto.
- **No es una consola de operaciones.** No sustituye Azure Portal, Azure Monitor ni ninguna herramienta de gestión real.
- **No es un chat genérico.** El copiloto existe como evidencia de que la plataforma funciona — cada respuesta que da viaja por el mismo camino real (APIM → agente alojado → modelo) que el resto de la demo está explicando.
- **No es un benchmark.** Los dos frameworks de agentes (Pydantic AI y Strands) se muestran lado a lado por razones de ingeniería, nunca como una comparación de "cuál es mejor".

## Audiencia

**Quién presenta:** ingenieros de ventas de Microsoft, arquitectos de soluciones en la nube (CSA), consultores partner.

**Quién observa:** arquitectos empresariales, CIOs/CISOs, equipos de riesgo y cumplimiento — típicamente en sectores regulados (banca, seguros, salud, retail) donde "¿esto es seguro y auditable?" es la pregunta que decide si la conversación continúa.

## Alcance — las cuatro secciones

La consola tiene cuatro secciones, cada una respondiendo la pregunta que un cliente empresarial realmente hace en esta etapa de la conversación:

| Sección | Pregunta del cliente | Qué demuestra |
|---|---|---|
| **Agentes** | "¿Qué tengo desplegado, y en qué estado está?" | Dos frameworks distintos (Pydantic AI, Strands) corriendo como el mismo tipo de activo gobernado: un Foundry Hosted Agent. Registro en vivo, versiones inmutables, invocación real. |
| **Gateway** | "¿Cómo llegan los clientes al agente, y quién controla eso?" | Azure API Management como punto de control único, dos veces en el mismo camino de una solicitud (hacia el agente y desde el agente hacia el modelo). Autenticación por clave de suscripción, no credenciales de Azure. |
| **Observabilidad** | "¿Qué evidencia genera la plataforma?" | Trazabilidad real de extremo a extremo: logs de APIM, Application Insights, Log Analytics — no una simulación de logs. |
| **Plataforma** | "¿Qué está desplegado, y qué administra el equipo de operaciones?" | El entorno real (región, grupo de recursos, conteo de recursos) y un catálogo de controles en tres estados: activo (evidenciado), disponible (configurable, no encendido) y ausente (fuera de alcance de este laboratorio). |

## Filosofía — reglas que no se negocian

1. **La verdad por encima del pulido.** Cada dato mostrado indica su origen. Nada se inventa. Si Azure no lo devuelve, la aplicación dice "no disponible" — nunca rellena el vacío con una cifra creíble.
2. **En vivo donde importa, honesto donde no.** El modo por defecto (*Azure Live*) llama a la infraestructura real en cada panel. El modo *Simulación* existe solo como red de seguridad para rehearsal — cada panel se re-etiqueta visiblemente cuando el modo cambia, así que nunca se presenta un dato simulado como si fuera real.
3. **Lo que no está activo se explica, no se oculta.** Un control disponible pero no encendido (rate limiting, caché semántica, redes privadas, etc.) se presenta como una decisión de configuración en un punto de control que la empresa ya posee — nunca como una carencia de la arquitectura.
4. **Nada que tarde más de ~15 segundos corre en vivo sin red de seguridad.** El diseño asume que esto se presenta frente a un cliente, no en un entorno de desarrollo tolerante a fallos.
5. **La demo nunca se presenta a sí misma como el producto.** El producto es Microsoft Foundry gobernado por Azure API Management. Esta aplicación es la manera de contarlo bien.

## Relación con el laboratorio oficial

Esta aplicación no reemplaza la notebook `ai-foundry-hosted-agents-custom-framework.ipynb` — depende de que alguien ya la haya ejecutado. El laboratorio sigue siendo la única fuente autorizada de *cómo desplegar* esto: infraestructura vía Bicep, construcción de imagen en ACR, registro del Hosted Agent vía el SDK de datos de Foundry. Esta consola simplemente lee, en vivo, lo que ese despliegue produjo, y lo cuenta como una historia de 10-15 minutos en lugar de una ejecución de notebook de 30-45 minutos.

Si un cliente pide "quiero verlo funcionar en mi propia suscripción", la respuesta correcta es señalar al laboratorio — esta demo es la conversación que abre esa puerta, no el mecanismo que la construye.

## Cuándo usarla / cuándo no

**Úsala para:**
- Primeras conversaciones técnicas con un cliente sobre gobernanza de agentes de IA.
- Revisiones de arquitectura con un equipo de seguridad o cumplimiento.
- Briefings ejecutivos donde el tiempo es corto y el código en pantalla mataría el momento.

**No la uses para:**
- Operar o administrar un entorno real — no es una consola operativa.
- Como herramienta de soporte o troubleshooting.
- Como sistema de registro de nada — los datos que muestra son efímeros por diseño (ver [`ESTADO_DEL_PROYECTO.md`](../03-desarrollo/ESTADO_DEL_PROYECTO.md) y [`ARQUITECTURA_DEMO.md`](ARQUITECTURA_DEMO.md) para el detalle técnico de qué persiste y qué no).

## Ver también

- [`GUIA_PRESENTACION.md`](../02-presentacion/GUIA_PRESENTACION.md) — el guion completo, sección por sección, para presentarla.
- [`CONTEXTO_COPILOTO.md`](CONTEXTO_COPILOTO.md) — qué instrucciones sigue el asistente integrado y sus límites de honestidad.
- [`README.md`](https://github.com/Azure-Samples/AI-Gateway/blob/main/labs/ai-foundry-hosted-agents-custom-framework/README.md) (laboratorio oficial, externo) — la descripción oficial del laboratorio de Microsoft que esta demo visualiza.
- [`ARQUITECTURA_DEMO.md`](ARQUITECTURA_DEMO.md) — el detalle técnico completo de qué se despliega y cómo, para quien necesite profundizar más allá de lo comercial.
