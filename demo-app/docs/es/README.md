# Documentación de la demo

**[🇬🇧 Read this in English →](../en/README.md)**

> **Aviso importante:** esta demo **complementa** el laboratorio oficial de Microsoft "AI Foundry Hosted Agents with Custom Frameworks" — **no reemplaza a Azure AI Foundry** ni a ninguna herramienta oficial de Microsoft. Ver [`01-general/PROPOSITO_DEMO.md`](01-general/PROPOSITO_DEMO.md) para el detalle completo.

Índice de toda la documentación propia de esta aplicación de demostración (`demo-app`). Todo aquí está en español y describe la **demo** — no el laboratorio oficial de Microsoft, cuya documentación vive en el repositorio externo [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway) y no se toca desde aquí.

Si eres nuevo en el proyecto, este es el orden de lectura recomendado:

1. [`01-general/PROPOSITO_DEMO.md`](01-general/PROPOSITO_DEMO.md) — por qué existe esta aplicación.
2. [`01-general/ARQUITECTURA_DEMO.md`](01-general/ARQUITECTURA_DEMO.md) — qué arquitectura de Azure visualiza.
3. [`02-presentacion/GUIA_PRESENTACION.md`](02-presentacion/GUIA_PRESENTACION.md) — cómo se presenta, paso a paso.
4. El resto, según lo que necesites — ver el mapa completo abajo.

## 01 — General

Fundamentos del proyecto: qué es, cómo está construido, y cómo se comporta el asistente integrado.

| Documento | Contenido |
|---|---|
| [`PROPOSITO_DEMO.md`](01-general/PROPOSITO_DEMO.md) | Objetivo, alcance, audiencia y filosofía de la demo. Por qué existe y qué no es. |
| [`ARQUITECTURA_DEMO.md`](01-general/ARQUITECTURA_DEMO.md) | Arquitectura técnica completa del despliegue de Azure que la demo visualiza: API Management, Microsoft Foundry, identidad administrada, observabilidad. |
| [`DESPLIEGUE_Y_COSTOS.md`](01-general/DESPLIEGUE_Y_COSTOS.md) | Qué tiene que ejecutarse para que la demo funcione, cuánto cuesta operarla, cómo se comporta el copiloto como infraestructura, opciones de hosting, y cuándo RAG pasaría a tener sentido. Hechos, estimaciones y recomendaciones van etiquetados por separado. |
| [`CONTEXTO_COPILOTO.md`](01-general/CONTEXTO_COPILOTO.md) | Instrucciones y límites del asistente integrado — su tono, su frontera de honestidad, y la regla de que nunca se presenta como un reemplazo de Azure AI Foundry. |

## 02 — Presentación

Todo lo necesario para presentar la demo frente a un cliente.

| Documento | Contenido |
|---|---|
| [`GUIA_PRESENTACION.md`](02-presentacion/GUIA_PRESENTACION.md) | Guion completo, palabra por palabra: introducción, las cuatro secciones, cierre. |
| [`FLUJO_PRESENTACION.md`](02-presentacion/FLUJO_PRESENTACION.md) | Vista rápida de una página: tiempos, acciones en pantalla y mensaje clave de cada tramo. |
| [`PREGUNTAS_FRECUENTES.md`](02-presentacion/PREGUNTAS_FRECUENTES.md) | Respuestas sugeridas a las preguntas difíciles típicas de un cliente. |

## 03 — Desarrollo

Documentación técnica para quien mantenga o extienda la demo — decisiones de diseño, verificación contra Azure, y estado del proyecto.

| Documento | Contenido |
|---|---|
| [`DECISIONES_DE_DISENO.md`](03-desarrollo/DECISIONES_DE_DISENO.md) | Filosofía de diseño, evolución del posicionamiento del producto, arquitectura de experiencia y sistema visual. |
| [`REPORTE_INTEGRACION_AZURE.md`](03-desarrollo/REPORTE_INTEGRACION_AZURE.md) | Qué se verificó contra Azure real durante el desarrollo, y con qué método. |
| [`ESTADO_DEL_PROYECTO.md`](03-desarrollo/ESTADO_DEL_PROYECTO.md) | Snapshot vivo del estado actual — qué está cerrado, qué queda como deuda técnica documentada. |
| [`HISTORIAL.md`](03-desarrollo/HISTORIAL.md) | Historial cronológico del desarrollo, por hitos. |

## 04 — Referencias

| Documento | Contenido |
|---|---|
| [`ENLACES.md`](04-referencias/ENLACES.md) | Enlaces al laboratorio oficial, al repositorio y a documentación externa de Microsoft. |

## Convenciones

- Toda la documentación de esta carpeta está en **español**. Los nombres propios de servicios de Azure (API Management, Microsoft Foundry, Log Analytics…) se mantienen en inglés, como los usa Azure.
- Los documentos de `01-general/` y `02-presentacion/` están escritos para una audiencia de preventa (arquitectos, consultores, clientes) — sin jerga de código.
- Los documentos de `03-desarrollo/` están escritos para quien mantenga el proyecto — sí incluyen detalle técnico.
- El laboratorio oficial de Microsoft (su README, el notebook, Bicep y `src/frameworks/`) vive en [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/ai-foundry-hosted-agents-custom-framework) — una fuente externa e independiente que este repositorio ni contiene ni gestiona.
