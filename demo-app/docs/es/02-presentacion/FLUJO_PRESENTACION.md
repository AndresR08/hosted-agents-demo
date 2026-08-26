# Flujo de presentación — vista rápida

Referencia de una página: tiempos, qué mostrar en pantalla y el mensaje que cada tramo debe dejar. Para el guion palabra por palabra, ver [`GUIA_PRESENTACION.md`](GUIA_PRESENTACION.md).

Duración total sugerida: **12–15 minutos** + preguntas.

| Tiempo | Tramo | Pregunta del cliente | Acción en pantalla | Mensaje clave |
|---|---|---|---|---|
| 0:00–1:30 | **Introducción** | — | Pantalla de inicio → clic en "Iniciar demostración ejecutiva" | Todo lo que sigue es real y conectado a Azure en vivo; nada es una maqueta. |
| 1:30–4:00 | **Agentes** | ¿Qué tengo desplegado, y en qué estado está? | Lista de agentes → pestaña Resumen → Versiones → (opcional) Ejecutar en vivo | Dos frameworks distintos, el mismo tipo de activo gobernado: un Foundry Hosted Agent. |
| 4:00–8:00 | **Gateway** (la sección más larga — "el cierre del trato") | ¿Cómo llegan los clientes al agente, y quién controla eso? | Ruta del agente → prueba de tres credenciales (`S`) → política XML en vivo | API Management aparece dos veces en el mismo camino: hacia el agente y desde el agente hacia el modelo. |
| 8:00–10:30 | **Observabilidad** | ¿Qué evidencia genera la plataforma? | Registro de auditoría → línea de tiempo de spans expandida | Trazabilidad real de extremo a extremo, con dos fuentes independientes que coinciden. |
| 10:30–12:30 | **Plataforma** | ¿Qué está desplegado, y qué administra el equipo de operaciones? | Entorno real → catálogo de controles (activo / disponible / ausente) → (opcional) acción de mantenimiento en vivo | Lo que no está encendido es una decisión de configuración explicada, no una carencia oculta. |
| 12:30–14:00 | **Cierre** | — | Recapitulación verbal, sin clics | Cada respuesta vino con evidencia de Azure detrás, no con una afirmación de marketing. |

## Navegación durante la presentación

Las cuatro secciones son pestañas en la parte superior de la consola — clic para moverte entre ellas, en cualquier orden. Atajos de teclado disponibles en cualquier momento:

| Tecla | Acción |
|---|---|
| `C` | Abrir/cerrar el copiloto integrado |
| `S` | Ejecutar la prueba de las tres credenciales (sección Gateway) |
| `L` | Alternar entre Azure Live y Simulación |
| `Esc` | Cerrar el copiloto, o volver a la pantalla de inicio |

## Ver también

- [`GUIA_PRESENTACION.md`](GUIA_PRESENTACION.md) — el guion completo, con el texto sugerido para cada tramo.
- [`PREGUNTAS_FRECUENTES.md`](PREGUNTAS_FRECUENTES.md) — respuestas a las preguntas difíciles típicas.
