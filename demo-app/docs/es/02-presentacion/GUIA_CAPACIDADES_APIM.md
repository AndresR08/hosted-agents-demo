# Guía: la pantalla de referencia de API Management

Módulo de cierre opcional, de **4–6 minutos**, para después del recorrido de [`GUIA_PRESENTACION.md`](GUIA_PRESENTACION.md). Léela primero: esta guía asume el guion completo y no lo repite.

Sirve para pasar de *"esto es lo que construimos"* a *"esto es todo lo que la plataforma permite si lo necesitan"* — sin romper la única regla que le da credibilidad a toda la demo.

---

## ⚠️ Antes que nada: qué es y qué no es esta pantalla

**Es material de referencia sobre el producto Azure API Management. No es una lectura de este despliegue.**

De las ocho capacidades que lista, este laboratorio configura tres. Las otras cinco están ahí porque son parte del producto que el cliente estaría comprando, no porque estén encendidas ahora mismo.

La pantalla se defiende sola: vive en su propia pestaña (Gateway → **Referencia**), lleva la insignia `Illustrative` en lugar de `Live`, tiene un banner permanente que lo dice, y cada capacidad muestra una píldora **"Se usa aquí"** o **"No en este lab"**.

Aun así, **la responsabilidad de decirlo en voz alta es tuya**. La frase que resuelve esto, y que conviene decir *antes* de mostrar la pantalla:

> "Cambio de registro un momento. Todo lo anterior fue en vivo. Esto que sigue es catálogo de producto — les voy a marcar explícitamente qué está encendido en el laboratorio y qué no."

Si dices eso, la pantalla trabaja a tu favor. Si no lo dices, estás presentando un folleto como si fuera un despliegue, que es justo lo que el resto de la demo se negó a hacer.

---

## Cuándo usarlo (y cuándo no)

**Úsalo cuando:**
- La sala es técnica y ya preguntó "¿y esto qué más hace?".
- El cliente ya tiene APIM y quiere saber qué está desaprovechando.
- Te sobran 5 minutos después del cierre y hay apetito por más.

**Sáltatelo cuando:**
- La audiencia es ejecutiva y la conversación es de valor de negocio, no de capacidades.
- Vas corto de tiempo. El cierre de `GUIA_PRESENTACION.md` §5 es un final mejor que un catálogo a medias.
- Ya te hicieron una pregunta concreta sobre una capacidad — respóndela ahí mismo, en la sección que corresponda, en vez de reservarla para este módulo.

---

## Guion por sección

Una o dos frases por capacidad. **Foco en el problema que resuelve, no en el nombre de la característica** — el cliente no compra "rate limiting", compra "que un consumidor no me tumbe el servicio".

### Gestión de tráfico
> "Límites por consumidor: cuántas llamadas por minuto, cuántas por mes. Sirve para que un equipo interno que se equivoca en un bucle no le consuma el presupuesto de tokens al resto. Y el circuit breaker deja de mandarle tráfico a un backend que empezó a fallar, en vez de insistir."

### Seguridad y autenticación
> "Aquí está el ancla real: lo que acaban de ver funcionando son dos de estos esquemas — la clave revocable de entrada y la identidad administrada de salida. La lista completa incluye OAuth2 con validación de JWT, certificados de cliente, filtrado por IP. Se combinan por API, así que la credencial del que llama y la del backend no tienen por qué ser la misma cosa."

*(Esta es la única sección donde puedes apuntar a algo en vivo: la política real está en la pestaña **En vivo**, en el visor de políticas.)*

### Transformación
> "El contrato que publican a sus consumidores no tiene que ser el contrato del backend. Pueden exponer JSON sobre un backend que habla XML, o reescribir encabezados y rutas. Este laboratorio ya lo hace en pequeño: reescribe tres encabezados para hablar con Foundry."

### Múltiples backends
> "Un mismo endpoint, varios backends detrás: balanceo, versiones, y despliegues canary — mandar el 5% del tráfico a la versión nueva y ver cómo se comporta antes de mover al resto. El cliente no se entera ni cambia nada."

### Caché de respuestas
> "Si la misma pregunta llega dos veces, la segunda no tiene por qué llegar al modelo. En un backend que cobra por token, eso no es solo latencia — es factura."

### Portal de desarrolladores
> "Si mañana quieren exponer estos agentes a otras áreas del banco, o a un socio externo, hay un portal self-service donde el consumidor descubre la API, lee la documentación y pide su propia suscripción. No hay que construirlo."

### Analítica y observabilidad
> "Esto sí lo vieron en vivo, hace dos minutos, en la sección de Observabilidad. Todo lo que se midió ahí sale del gateway, sin instrumentar el backend."

### Multinube e híbrido
> "El mismo gateway corre como contenedor en su centro de datos o en otra nube, administrado desde el mismo plano de control. Un solo juego de políticas sobre backends que no están en Azure — que suele ser la realidad."

### Comparación de tiers
> "Y un ejemplo de que estas decisiones tienen consecuencias medibles, no teóricas. Nosotros probamos los dos tiers en esta misma arquitectura. Consumption cuesta prácticamente cero en reposo, pero medimos 54 segundos en la primera llamada después de 35 minutos sin uso. Para un entorno de pruebas que se crea y se borra el mismo día, es la elección correcta. Para una sesión como esta, con ustedes mirando, no lo es."

**Por qué esta sección vale más que todas las anteriores:** es el único dato de la pantalla que no está en la documentación de Microsoft. Es medición propia, sobre la arquitectura que están viendo. Ese es el tipo de cosa que distingue a alguien que desplegó esto de alguien que leyó la hoja de producto.

### Cómo se decide el modelo
Ver la sección siguiente — es una pregunta recibida, no un ítem de catálogo.

---

## Preguntas frecuentes anticipadas

### "¿Cómo sabe APIM qué modelo usa cada agente?"

**Pregunta real, ya recibida de un arquitecto de soluciones.** La suposición intuitiva —que APIM enruta por agente— es incorrecta, y dejarla pasar lleva al cliente a diseñar reglas de enrutamiento que no necesita.

**Respuesta para decir en voz alta:**

> "No lo sabe, y no lo decide. Cuando registramos el agente le inyectamos el nombre del deployment como variable de entorno; el framework lo pone en la URL de la petición, y APIM actúa como proxy genérico: lee de la URL a dónde va, le inyecta el token de identidad administrada y lo reenvía. No hay lógica de 'este agente usa este modelo' en ningún lado del gateway."

Si quieren el detalle, la cadena completa es: `deploy.ps1` inyecta `AZURE_OPENAI_DEPLOYMENT` y `AZURE_OPENAI_ENDPOINT` → el framework (Pydantic AI / Strands) arma la ruta al estilo compatible con OpenAI → APIM proxea. Está dibujada en la pantalla.

### "¿Entonces puedo cambiar el modelo sin redesplegar el agente?"

Seguimiento probable de la anterior. **La respuesta honesta es no**, y conviene darla sin adornos:

> "No en caliente. La variable de entorno es parte de la definición de la versión del agente, así que cambiar de modelo significa crear una versión nueva con el valor actualizado. Es una operación de segundos y el registro te queda versionado, pero no es un interruptor en tiempo de ejecución."

*(Si preguntan si eso se puede resolver: sí, con enrutamiento en el gateway — que es precisamente una de las capacidades de "múltiples backends" de esta pantalla. Pero este laboratorio no lo hace, y decir que sí sería inventar.)*

### "¿Y el rate limiting / la caché lo puedo ver funcionando?"

> "En este laboratorio no está configurado, así que no se lo puedo mostrar funcionando aquí — y prefiero decírselo a improvisar una pantalla. Es configuración de política, no un cambio de arquitectura. Si les interesa, se los muestro en un laboratorio aparte o sobre la documentación, con su equipo."

**Nunca** abras el portal de Azure a improvisar una política en vivo. Un error de sintaxis delante del cliente cuesta más que la demostración.

### "¿Esto ya lo tengo si compré APIM?"

Depende del tier, y ahí la tabla de la pantalla es la respuesta corta: el portal de desarrolladores y el gateway autohospedado no están en todos los niveles. Si no estás seguro, dilo y confírmalo después — es una pregunta comercial con respuesta pública, no vale la pena adivinar.

---

## Ver también

- [`GUIA_PRESENTACION.md`](GUIA_PRESENTACION.md) — el guion completo del recorrido.
- [`PREGUNTAS_FRECUENTES.md`](PREGUNTAS_FRECUENTES.md) — las preguntas difíciles del resto de la demo.
- `labs/…-automation/docs/06-apim-consumption.md` (repositorio) — la medición completa de arranque en frío, incluidas las dos formas de medirla mal.
