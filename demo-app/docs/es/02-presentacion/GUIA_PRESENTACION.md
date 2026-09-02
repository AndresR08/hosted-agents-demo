# Guía de presentación

Guion completo para presentar la demo frente a un cliente. Antes de leer esto, si no lo has hecho, lee [`PROPOSITO_DEMO.md`](../01-general/PROPOSITO_DEMO.md) — esta guía asume que ya sabes que la aplicación es una herramienta de preventa, no un producto ni un reemplazo de Azure AI Foundry.

Duración sugerida: **12–15 minutos** de recorrido + preguntas. Es un guion, no un guion rígido — el poder real de esta demo es que cada dato es real, así que puedes desviarte para responder lo que la sala pregunte y volver sin perder credibilidad. Para una vista rápida de tiempos y mensajes clave sin el texto completo, ver [`FLUJO_PRESENTACION.md`](FLUJO_PRESENTACION.md).

---

## Antes de empezar (checklist del presentador)

- [ ] Modo **Azure Live** activo (no Simulación) — es el modo por defecto, confírmalo abajo en el riel izquierdo, donde el punto y la región están de forma permanente.
- [ ] Abre el cajón de configuración (engranaje, abajo en el riel) → **Mantenimiento**, la primera sección, y ejecuta al menos:
  - **Comprobar broker** (`ping`) — confirma que el backend local responde.
  - **Precalentar agente** (`warm-agent`) — el primer arranque de un contenedor puede tardar 10–17s; hacerlo antes evita ese silencio incómodo en vivo.
- [ ] Confirma que los dos agentes (`pydantic-agent`, `strands-agent`) aparecen como *Running* en la sección Agentes.
- [ ] Ten una pregunta de respaldo lista para el copiloto en caso de que quieras mostrarlo (ver sección "El copiloto" más abajo).
- [ ] Si vas a presentar sin conexión confiable a internet, ten Simulación como red de seguridad — pero avisa que es rehearsal, nunca la presentes como datos reales.

**Navegación:** las cuatro secciones viven en el riel oscuro del costado izquierdo — haz clic para moverte entre ellas, en el orden que prefieras. Dos de ellas llevan sub-pestañas en su propia fila de encabezado, que es donde está en realidad la mayor parte de la consola: **nueve destinos, no cuatro.** Aprende el mapa de abajo antes de presentar; es la diferencia entre mostrar el argumento y saltárselo.

El riel se pliega a una tira de íconos de 64px cuando abres el copiloto a 1366×768, y vuelve al cerrarlo. Nada se mueve — los íconos quedan en el mismo orden y el mismo sitio.

Atajos de teclado útiles durante la presentación:
- `C` — abrir/cerrar el copiloto integrado.
- `S` — ejecutar la prueba de las tres credenciales **y saltar a la pestaña que muestra el resultado**. Es la ruta más rápida al 401; ver Beat 3.
- `L` — alternar entre Azure Live y Simulación.
- `Esc` — cerrar el copiloto, o volver a la pantalla de inicio.

### El mapa — nueve destinos

| # | Sección → pestaña | La pregunta que responde | No te la saltes |
|---|---|---|---|
| 1 | **Agentes** → Resumen | ¿Qué hay desplegado y en qué estado? | |
| 2 | Agentes → Versiones | ¿Qué se ha publicado y cuándo? | |
| 3 | Agentes → Ejecutar | Preguntar directo a este agente | |
| 4 | **Gateway** → En vivo | ¿Cómo llegan los clientes al agente? | Los dos saltos por APIM |
| 5 | **Gateway → Credenciales** | ¿Qué credenciales se aceptan? | **El 401. Ver Beat 3.** |
| 6 | Gateway → Referencia | ¿Qué más puede hacer API Management? | Se desplaza — ver abajo |
| 7 | **Observabilidad** → Registro | ¿Qué se preguntó y qué se respondió? | |
| 8 | Observabilidad → Mediciones | ¿Cuánto costó esta solicitud? | La cascada por salto |
| 9 | **Plataforma** | ¿Qué está desplegado y qué administra el equipo de operaciones? | |

Todo lo que hay en esta consola está en una de esas nueve pantallas. Si te encuentras buscando algo en medio de la demo, está en esta tabla.

**Dónde quedaron el entorno y el indicador de modo.** En el pie del riel, de forma permanente: el agente actual, el punto Live/Simulación con la región y el grupo de recursos, y el engranaje. Ya no tienes que salir de una pantalla para comprobar en qué despliegue estás, y la sala tampoco.

**El cajón de configuración** (engranaje, abajo en el riel) abre con **Mantenimiento primero** — ocho acciones, entre ellas `ping`, `warm-agent`, `test-apim` y `reload-policies`. Las dos últimas estaban en la pantalla de Gateway; son instrumentos del presentador, así que ahora están en el menú del presentador.

**Una pantalla se desplaza, y solo una.** Gateway → Referencia es material de referencia sobre API Management como producto, no una lectura de este despliegue, y es más larga que una pantalla a propósito. Puedes desplazarla con calma frente a la sala — es una excepción declarada (`DECISIONES_DE_DISENO.md` §4.9), no un fallo de layout. Todas las demás pantallas caben sin scroll a 1366×768; si alguna deja de caber, eso sí es un defecto que conviene reportar, no algo que se pasa desplazando.

---

## 0. Introducción (0:00 – 1:30)

**En pantalla:** la pantalla de inicio, antes de hacer clic en "Iniciar demostración ejecutiva".

**Guion:**

> "Lo que van a ver a continuación no es una maqueta ni un diagrama. Es una consola conectada en vivo a una suscripción real de Azure, donde tenemos desplegados dos agentes de IA construidos con dos frameworks distintos — Pydantic AI y Strands — corriendo como el mismo tipo de activo gobernado dentro de Microsoft Foundry, con Azure API Management como punto de control.
>
> Todo lo que van a ver — las respuestas de los agentes, las políticas de seguridad, la telemetría — es real. No hay datos de muestra escondidos detrás. Si algo no está disponible, se los voy a decir explícitamente en lugar de improvisar un número."

Haz clic en **"Iniciar demostración ejecutiva"**.

**Por qué importa:** establece la regla del juego desde el primer segundo — todo lo que sigue gana credibilidad porque se dijo, en voz alta, que nada está fabricado.

---

## 1. Agentes (1:30 – 4:00)

**Pregunta del cliente que responde esta sección:** *"¿Qué tengo desplegado, y en qué estado está?"*

**En pantalla:** la lista de agentes registrados, con `pydantic-agent` y `strands-agent`.

**Guion:**

> "Aquí tenemos el registro en vivo de Microsoft Foundry — no una lista fija en el código de esta aplicación, sino lo que Foundry realmente tiene registrado en este momento. Dos agentes, cada uno construido con un framework distinto."

Selecciona `pydantic-agent`, muestra la pestaña **Resumen**:

> "Este es el objeto que Foundry conoce del agente: la imagen del contenedor, la versión — inmutable, publicar de nuevo crea una versión nueva, nunca sobrescribe — CPU, memoria, y las claves de las variables de entorno que usa. Los valores nunca se muestran aquí, solo las claves, porque una de ellas es la credencial de acceso al gateway."

Cambia a la pestaña **Versiones** brevemente:

> "Cada publicación queda registrada como una versión propia. Esto es lo que permite decir, con certeza, exactamente qué build respondió una solicitud dada — algo que un equipo de auditoría va a preguntar."

Cambia a la pestaña **Ejecutar** y, si el tiempo lo permite, invoca al agente en vivo con una pregunta simple:

> "Puedo invocar al agente directamente desde aquí — esto llama al mismo endpoint que usaría cualquier cliente real, a través del mismo camino gobernado que vamos a ver en la siguiente sección."

**Mensaje clave para cerrar la sección:**

> "El punto no es que tengamos dos agentes. El punto es que cualquier framework que el equipo de un cliente ya use — no solo estos dos — puede convertirse en este mismo tipo de activo gobernado, sin reescribirlo."

*(Opcional, si la sala pregunta por gestión del ciclo de vida): la consola también permite crear y eliminar agentes de prueba en vivo desde los íconos "+" y de papelera junto al listado — útil para mostrar que el registro responde de inmediato, pero no es necesario para el guion estándar.)*

---

## 2. Gateway → En vivo (4:00 – 6:15) — los dos saltos

**Pregunta del cliente que responde esta sección:** *"¿Cómo llegan los clientes al agente, y quién controla eso?"*

Esta es, en la mayoría de las conversaciones, la sección que decide si el cliente sigue interesado. Tómate el tiempo.

**En pantalla:** la sección Gateway, mostrando cómo se direcciona al agente.

**Guion:**

> "Aquí está la idea central de toda esta arquitectura: Azure API Management aparece **dos veces** en el mismo camino de una sola solicitud. La primera vez, al frente — el cliente nunca habla directamente con el agente, habla con APIM. La segunda vez, cuando el propio agente necesita llamar al modelo — esa llamada también pasa por APIM antes de llegar a `gpt-5-mini`.
>
> La mayoría de las arquitecturas gobiernan solo la puerta de entrada y dejan sin control el tráfico que el agente genera hacia el modelo. Aquí, las dos direcciones cruzan el mismo punto de control que el equipo de plataforma ya posee."

Señala la URL enrutada encima del diagrama:

> "El nombre del agente es un segmento de esa URL. Por eso una sola API sirve a cualquier número de agentes — desplegar el décimo no cambia ni una línea de configuración del gateway."

**Mensaje clave para cerrar este beat:**

> "Todo esto agrega, en esta implementación, un costo de latencia de milisegundos de un solo dígito por salto — comparado con varios segundos que toma la generación del modelo. Poner un punto de control gobernado en el camino no cuesta rendimiento perceptible."

Y luego di la frase que te lleva al siguiente beat, para que no llegues al
cierre habiéndotelo saltado:

> "Eso es *a dónde* va la solicitud. La otra mitad de la pregunta es *quién tiene permiso de enviarla* — y eso se los puedo mostrar en vivo en vez de describirlo."

---

## 3. Gateway → Credenciales (6:15 – 8:00) — el 401, y el único verde de la consola

> **Este beat no es opcional, y tiene pestaña propia por una razón.**
>
> La prueba de las tres credenciales estaba al final de la pantalla En vivo. Ya
> no: en el piso de 16px de proyector, En vivo y Credenciales no caben en una
> sola pantalla — medido, dos veces, bajo dos layouts distintos
> (`DECISIONES_DE_DISENO.md` §4.8). La ganancia es una pantalla que cabe. El
> costo es que **el 401 ahora es un destino al que hay que ir**, y un
> presentador que olvide que la pestaña existe terminará la sección de Gateway
> sin haber mostrado lo más persuasivo de toda la demo.
>
> Dos formas de no olvidarlo: es el **#5 del mapa** en el checklist de arriba, y
> pulsar **`S` desde cualquier sitio** ejecuta los tres intentos *y* te lleva
> allí. Si te vas a acordar de un solo atajo en toda la demo, que sea este.

**Pregunta del cliente que responde este beat:** *"¿Quién tiene permiso de llamar al agente, y qué le pasa a todos los demás?"*

**En pantalla:** Gateway → **Credenciales**.

**Guion:**

> "El cliente solo necesita una clave de suscripción de API Management — no una credencial de Azure AD, no una clave de Foundry, no una clave de modelo. APIM intercambia esa clave por un token de identidad administrada, generado por solicitud y nunca almacenado."

**Demostración en vivo — la prueba de las tres credenciales** (`Ejecutar los tres`, o atajo `S`):

> "Voy a intentar tres formas de llegar al agente en este momento, en vivo."

Ejecuta la prueba y narra el resultado mientras aparece. Baja el ritmo aquí:
los tres resultados caen en segundo y medio, y la sala necesita leerlos:

> "Con la clave de suscripción: 200, funciona. Sin la clave: 401, rechazado por APIM antes de que la solicitud llegue a Foundry. Yendo directo al endpoint de Foundry, sin pasar por el gateway: también 401, porque no hay token de Azure AD. Esos dos rechazos son el resultado esperado, no un error — es la prueba de que el perímetro realmente hace su trabajo."

Si quieres dejar una sola frase en la sala, que sea esta:

> "Nada de lo que hay en esta pantalla está escenificado. Son tres solicitudes HTTPS reales hechas hace un segundo, y la puerta de enlace decidió cada una."

**Revelar la política XML** (`Mostrar la política en vivo`):

> "Esta es la política que está corriendo en el gateway en este momento — no un archivo de ejemplo, sino lo que Azure Resource Manager devuelve ahora mismo. Aquí es donde se adquiere el token de identidad administrada y se sobrescribe el encabezado de autorización antes de reenviar la solicitud."

**Una nota sobre lo que estás viendo, si presentas seguido:** el verde aparece
exactamente una vez en toda la consola, y es el escudo de esos rechazos. Todo
lo demás que está "encendido" — un agente corriendo, el estado en vivo, un
control aplicado — es azul. Es deliberado: cuando la sala ve verde, significa
que algo fue *rechazado*, y no debería significar ninguna otra cosa.

**Si alguien pregunta "¿qué más puede hacer API Management?"** — eso es la
pestaña **Referencia**, la tercera. Di claramente que es material de capacidades
de producto y no una lectura de este despliegue; la consola también lo dice, con
marco punteado, banner y una píldora "se usa aquí / no en este lab" en cada
elemento. Es además la única pantalla que puedes desplazar con calma (§4.9).

---

## 4. Observabilidad (8:00 – 10:30)

**Pregunta del cliente que responde esta sección:** *"¿Qué evidencia genera la plataforma?"*

**En pantalla:** Observabilidad → **Registro**. Esta sección tiene dos pestañas y el beat usa las dos — Registro responde *qué se preguntó y qué se respondió*, Mediciones responde *cuánto costó*. Están separadas porque vienen de consultas distintas y le importan a gente distinta: una función de cumplimiento quiere la primera, un arquitecto quiere la segunda.

**Un detalle de tiempos que conviene saber antes de presentar.** Log Analytics ingesta los registros del gateway entre uno y tres minutos después de la respuesta. Si llegas aquí inmediatamente después de preguntar, los números por salto dirán honestamente que aún no están disponibles en vez de estimarlos — eso es la consola funcionando bien. Haz tu pregunta durante el beat de Agentes y esta sección ya estará poblada cuando llegues.

**Guion:**

> "Ninguno de estos datos fue agregado escribiendo código adicional dentro del agente. El despliegue de Bicep ya crea el workspace de Log Analytics y Application Insights, y conecta API Management a ambos — así que el propio gateway escribe el prompt completo, la respuesta completa, el conteo de tokens y la duración de cada salto."

Cambia a la pestaña **Mediciones** y muestra la cascada por salto; luego abre `Detalles técnicos` para la línea de tiempo de spans:

> "Esto es una traza distribuida real, no una reconstrucción a partir de marcas de tiempo. Se puede seguir una sola solicitud a través del gateway, del runtime de Foundry y del contenedor del agente — incluyendo el momento exacto en que se adquiere el token de identidad administrada, que aparece aquí como su propio span."

**Mensaje clave para cerrar la sección:**

> "Para una función de cumplimiento o de riesgo, esto es lo que realmente importa: no una promesa de que se está registrando todo, sino la evidencia de que ya se está registrando, con dos fuentes independientes — el gateway y la instrumentación del propio contenedor — que coinciden entre sí."

---

## 5. Plataforma (10:30 – 12:30)

**Pregunta del cliente que responde esta sección:** *"¿Qué está desplegado, y qué administra el equipo de operaciones?"*

**En pantalla:** la sección Plataforma, mostrando el catálogo de controles.

**Guion** — señala el pie del riel en vez del escenario, porque ahí es donde vive ahora el entorno, de forma permanente y en todas las pantallas:

> "Aquí está el entorno real, y ha estado en pantalla todo este rato: región, grupo de recursos, y el conteo de recursos que Azure Resource Manager devuelve en este momento — no una cifra documentada de forma manual."

Muestra el catálogo de controles, destacando las tres categorías:

> "Este catálogo tiene tres estados, y esa distinción es deliberada. **Activo** son controles evidenciados por la solicitud que acabamos de hacer — haz clic en cualquiera y cita la observación exacta que lo demuestra, abajo en la franja bajo la lista. **Disponible** son controles que este mismo punto de control soporta pero que no están encendidos en este entorno — límite de tasa, caché semántica, redes privadas, autenticación exclusiva con Entra, gestión de secretos con Key Vault. Encenderlos es un cambio de configuración en un gateway que la empresa ya posee, no una reconstrucción.
>
> Y lo que no está en esta lista en absoluto, se los digo directamente en lugar de dejarlos adivinar."

Si el tiempo lo permite, ejecuta una de las acciones de mantenimiento en vivo desde el cajón de configuración (engranaje al pie del riel — por ejemplo, **Actualizar estado de Azure**):

> "Estas son las mismas comprobaciones que un ingeniero correría antes de una sesión — aquí están al alcance de un clic, contra la infraestructura real."

---

## 6. Cierre (12:30 – 14:00)

**Guion:**

> "Recapitulando lo que acabamos de ver, en las palabras de las cinco preguntas que cualquier arquitecto empresarial hace: ¿funciona? Sí, lo acaban de ver responder en vivo. ¿Qué está pasando ahora mismo? Cada salto, medido. ¿Es seguro? Tres intentos de acceso, dos rechazados exactamente como se esperaba, y la política que lo prueba, leída en vivo. ¿Puedo controlar mis agentes de IA? Un registro versionado e inmutable, y un catálogo de controles que no oculta lo que falta. ¿Por qué es valioso? Porque cada una de esas respuestas viene con la evidencia de Azure detrás, no con una afirmación de marketing.
>
> Todo lo que vieron corre sobre el laboratorio oficial de Microsoft 'AI Foundry Hosted Agents with Custom Frameworks' — está publicado, es reproducible, y el siguiente paso natural es que su equipo lo despliegue en su propia suscripción y lo revise línea por línea."

**Llamado a la acción sugerido:** ofrecer walkthrough del notebook técnico con su equipo de ingeniería, o una sesión de arquitectura enfocada en su caso de uso específico.

---

## El copiloto

En cualquier momento de la presentación puedes abrir el asistente integrado (`C`, o el ícono de chat en el encabezado) y hacerle una pregunta en vivo — la respuesta viaja por el mismo camino real que se está explicando (APIM → agente alojado → modelo), así que usarlo es, en sí mismo, una demostración más.

Está instruido para responder como un arquitecto de soluciones de Azure experimentado, en el idioma de la pregunta, y para nunca presentar esta aplicación como un reemplazo de Azure AI Foundry (ver [`CONTEXTO_COPILOTO.md`](../01-general/CONTEXTO_COPILOTO.md) para el detalle completo). Úsalo con confianza para preguntas que no cubriste en el guion — es más creíble que el presentador lo use en vivo que que lo evite.

---

## Ver también

- [`GUIA_CAPACIDADES_APIM.md`](GUIA_CAPACIDADES_APIM.md) — módulo de cierre opcional de 4–6 minutos sobre lo que ofrece API Management más allá de este laboratorio. Material de referencia, explícitamente no una lectura de este despliegue.
- [`PROPOSITO_DEMO.md`](../01-general/PROPOSITO_DEMO.md) — el objetivo, alcance y filosofía completos.
- [`CONTEXTO_COPILOTO.md`](../01-general/CONTEXTO_COPILOTO.md) — las instrucciones exactas que sigue el asistente integrado.
- [`PREGUNTAS_FRECUENTES.md`](PREGUNTAS_FRECUENTES.md) — respuestas sugeridas a las preguntas difíciles típicas de un cliente.
- [`FLUJO_PRESENTACION.md`](FLUJO_PRESENTACION.md) — vista rápida de tiempos y mensajes clave, sin el texto completo del guion.
- [`README.md`](https://github.com/Azure-Samples/AI-Gateway/blob/main/labs/ai-foundry-hosted-agents-custom-framework/README.md) (laboratorio oficial, externo) — la descripción oficial del laboratorio de Microsoft.
