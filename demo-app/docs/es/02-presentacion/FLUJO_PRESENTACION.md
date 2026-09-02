# Flujo de presentación — vista rápida

Referencia de una página: tiempos, qué mostrar en pantalla y el mensaje que cada tramo debe dejar. Para el guion palabra por palabra, ver [`GUIA_PRESENTACION.md`](GUIA_PRESENTACION.md).

Duración total sugerida: **12–15 minutos** + preguntas.

| Tiempo | Tramo | Pregunta del cliente | Acción en pantalla | Mensaje clave |
|---|---|---|---|---|
| 0:00–1:30 | **Introducción** | — | Pantalla de inicio → clic en "Iniciar demostración ejecutiva" | Todo lo que sigue es real y conectado a Azure en vivo; nada es una maqueta. |
| 1:30–4:00 | **Agentes** | ¿Qué tengo desplegado, y en qué estado está? | Lista de agentes → pestaña Resumen → Versiones → (opcional) Ejecutar en vivo | Dos frameworks distintos, el mismo tipo de activo gobernado: un Foundry Hosted Agent. |
| 4:00–6:15 | **Gateway → En vivo** | ¿Cómo llegan los clientes al agente? | URL enrutada → diagrama de la ruta con los tiempos por salto | API Management aparece dos veces en el mismo camino: hacia el agente y desde el agente hacia el modelo. |
| 6:15–8:00 | **Gateway → Credenciales** ⚠️ **beat obligatorio** | ¿Quién tiene permiso de llamar al agente? | `S` desde cualquier sitio → los tres intentos → política XML en vivo | Dos rechazos 401 reales. Es el único verde de la consola, y la prueba de que el perímetro funciona. |
| 8:00–10:30 | **Observabilidad** (2 pestañas) | ¿Qué evidencia genera la plataforma? | Registro (prompt/respuesta) → Mediciones (cascada por salto) → Detalles técnicos | Trazabilidad real de extremo a extremo, con dos fuentes independientes que coinciden. |
| 10:30–12:30 | **Plataforma** | ¿Qué está desplegado, y qué administra el equipo de operaciones? | Catálogo de controles (activo / disponible / ausente) → clic en un control para ver su evidencia | Lo que no está encendido es una decisión de configuración explicada, no una carencia oculta. |
| 12:30–14:00 | **Cierre** | — | Recapitulación verbal, sin clics | Cada respuesta vino con evidencia de Azure detrás, no con una afirmación de marketing. |

## Navegación durante la presentación

Las cuatro secciones viven en el riel oscuro de la izquierda — clic para moverte entre ellas, en cualquier orden. **Dos de ellas llevan sub-pestañas, nueve destinos en total**; el mapa completo está en el checklist del presentador de [`GUIA_PRESENTACION.md`](GUIA_PRESENTACION.md). Una pantalla, Gateway → Referencia, es más larga que el viewport a propósito y se puede desplazar con calma (`DECISIONES_DE_DISENO.md` §4.9); todas las demás caben sin scroll.

Atajos de teclado disponibles en cualquier momento:

| Tecla | Acción |
|---|---|
| `C` | Abrir/cerrar el copiloto integrado |
| `S` | Ejecutar la prueba de las tres credenciales **y saltar a Gateway → Credenciales**. El atajo más útil de la demo: es la ruta directa al 401. |
| `L` | Alternar entre Azure Live y Simulación |
| `Esc` | Cerrar el copiloto, o volver a la pantalla de inicio |

## Ver también

- [`GUIA_PRESENTACION.md`](GUIA_PRESENTACION.md) — el guion completo, con el texto sugerido para cada tramo.
- [`PREGUNTAS_FRECUENTES.md`](PREGUNTAS_FRECUENTES.md) — respuestas a las preguntas difíciles típicas.
