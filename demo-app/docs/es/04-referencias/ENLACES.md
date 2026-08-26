# Enlaces de referencia

## El laboratorio oficial

- [`README.md`](https://github.com/Azure-Samples/AI-Gateway/blob/main/labs/ai-foundry-hosted-agents-custom-framework/README.md) (laboratorio oficial, externo) — la descripción oficial de Microsoft: qué despliega, qué contiene, cómo ejecutarlo.
- `ai-foundry-hosted-agents-custom-framework.ipynb` (laboratorio oficial, externo) — el notebook end-to-end: despliega la infraestructura con Bicep, construye la imagen del framework elegido, la registra como Hosted Agent y la prueba directo y a través de API Management.
- Repositorio [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway) en GitHub — el repositorio que contiene este laboratorio junto con otros labs relacionados de API Management + IA.

## Documentación de Microsoft (referencia externa)

- [Documentación de Azure API Management](https://learn.microsoft.com/azure/api-management/) — el gateway que gobierna ambos saltos de cada solicitud en este laboratorio.
- [Documentación de Azure AI Foundry](https://learn.microsoft.com/azure/ai-foundry/) — la plataforma que aloja los agentes.
- [Documentación de Azure Monitor / Log Analytics](https://learn.microsoft.com/azure/azure-monitor/) — el destino de la telemetría que la sección Observabilidad de la demo lee en vivo.

## Mapa de la documentación de esta demo

Ver el índice completo en [`../README.md`](../README.md). Resumen rápido:

| Documento | Para qué sirve |
|---|---|
| [`../01-general/PROPOSITO_DEMO.md`](../01-general/PROPOSITO_DEMO.md) | Por qué existe esta aplicación, qué es y qué no es |
| [`../01-general/ARQUITECTURA_DEMO.md`](../01-general/ARQUITECTURA_DEMO.md) | Arquitectura técnica del despliegue que la demo visualiza |
| [`../01-general/DESPLIEGUE_Y_COSTOS.md`](../01-general/DESPLIEGUE_Y_COSTOS.md) | Qué debe ejecutarse, cuánto cuesta operarlo, opciones de hosting y escalabilidad futura |
| [`../01-general/CONTEXTO_COPILOTO.md`](../01-general/CONTEXTO_COPILOTO.md) | Instrucciones y límites del asistente integrado |
| [`../02-presentacion/GUIA_PRESENTACION.md`](../02-presentacion/GUIA_PRESENTACION.md) | Guion completo para presentar la demo |
| [`../02-presentacion/FLUJO_PRESENTACION.md`](../02-presentacion/FLUJO_PRESENTACION.md) | Vista rápida de tiempos y mensajes clave |
| [`../02-presentacion/PREGUNTAS_FRECUENTES.md`](../02-presentacion/PREGUNTAS_FRECUENTES.md) | Respuestas sugeridas a preguntas difíciles de cliente |
| [`../03-desarrollo/DECISIONES_DE_DISENO.md`](../03-desarrollo/DECISIONES_DE_DISENO.md) | Filosofía, posicionamiento y decisiones de diseño (técnico) |
| [`../03-desarrollo/REPORTE_INTEGRACION_AZURE.md`](../03-desarrollo/REPORTE_INTEGRACION_AZURE.md) | Qué se verificó contra Azure real y cómo |
| [`../03-desarrollo/ESTADO_DEL_PROYECTO.md`](../03-desarrollo/ESTADO_DEL_PROYECTO.md) | Estado actual del proyecto (snapshot vivo) |
| [`../03-desarrollo/HISTORIAL.md`](../03-desarrollo/HISTORIAL.md) | Historial cronológico del desarrollo |
