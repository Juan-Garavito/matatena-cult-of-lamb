# Especificación Técnica de Reglas: Matatena (Knucklebones)

Este documento define las reglas lógicas y mecánicas del juego Matatena, adaptado del título *Cult of the Lamb*, diseñado para ser procesado por un agente de IA para tareas de simulación, desarrollo de lógica de juego o análisis de estrategias.

## 1. Estructura del Tablero
- **Jugadores:** 2 (Jugador A y Jugador B).
- **Tableros:** Cada jugador posee una cuadrícula independiente de **3x3** (3 columnas, 3 filas).
- **Capacidad:** Cada columna puede albergar un máximo de 3 dados. Total por tablero: 9 dados.

## 2. Componentes de Juego
- **Dado:** 1 dado estándar de 6 caras (D6) con valores enteros $[1, 6]$.

## 3. Ciclo de Juego (Game Loop)
1. **Lanzamiento:** El jugador activo lanza el dado.
2. **Acción (Única):** El jugador debe seleccionar una columna (0, 1 o 2) que tenga al menos un espacio vacío.
3. **Colocación:** El dado se posiciona en la posición disponible más baja de la columna elegida.
4. **Resolución de Interacción (Eliminación):** Ver sección 4.
5. **Cálculo de Puntuación:** Ver sección 5.
6. **Cambio de Turno:** El control pasa al oponente.

## 4. Regla de Interacción: Eliminación de Dados
Cuando el Jugador A coloca un dado de valor $V$ en la Columna $C$:
- Se debe verificar la Columna $C$ del **Jugador B**.
- Si el Jugador B tiene uno o más dados con el valor $V$ en esa columna específica, todos esos dados son **eliminados inmediatamente**.
- Los dados restantes en la columna del Jugador B se desplazan para llenar los huecos (compactación).

## 5. Lógica de Puntuación (Algoritmo)
La puntuación total es la suma de los puntajes de las 3 columnas. El puntaje de cada columna se calcula mediante multiplicadores de frecuencia:

Sea $V$ el valor de un dado y $n$ el número de veces que ese valor se repite en la misma columna:
- Si $n = 1$: Puntuación $= V$
- Si $n = 2$: Puntuación $= (V + V) \\times 2$
- Si $n = 3$: Puntuación $= (V + V + V) \\times 3$

### Ejemplo de Columna:
Si una columna contiene dados $[6, 4, 6]$:
- El valor 6 se repite 2 veces: $(6 + 6) \\times 2 = 24$.
- El valor 4 aparece 1 vez: $4$.
- **Total Columna:** $24 + 4 = 28$.

## 6. Condición de Terminación
El juego finaliza inmediatamente cuando **cualquiera de los dos jugadores** llena las 9 casillas de su tablero. No es necesario que ambos terminen.

## 7. Determinación del Ganador
Al finalizar, se comparan las puntuaciones totales:
- Ganador: El jugador con el mayor puntaje acumulado.
- Empate: Si las puntuaciones son idénticas.

## 8. Consideraciones para la IA (Heurísticas Sugeridas)
- **Prioridad de Ataque:** Valorar la colocación de dados que eliminen dados de alto valor o combos del oponente.
- **Maximización de Combos:** Priorizar la creación de parejas o tríos en columnas propias, preferiblemente con valores $\\ge 4$.
- **Control de Tiempo:** Identificar cuándo cerrar el tablero propio si se tiene ventaja de puntos para evitar que el oponente recupere terreno.
