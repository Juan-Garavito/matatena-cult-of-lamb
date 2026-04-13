# Matatena - Altar del Ritual 🎲🐑

Una implementación web del adictivo minijuego de dados **Matatena** (inspirado libremente en *Cult of the Lamb*, y otros juegos de dados de control de zonas). La aplicación presenta un diseño temático de manuscrito antiguo ("Parchment & Ink"), con animaciones inmersivas y soporte de juego multiplayer en tiempo real mediante WebSockets.

## 📜 Reglas del Ritual (Cómo jugar)
El objetivo es obtener una puntuación mayor que tu oponente al final de la partida. La partida se termina cuando uno de los dos adeptos (jugadores) llena completamente su tablero de 3x3 celdas con dados.

1. **Tu Turno**: Lanzas un dado de seis caras (d6) aleatoriamente.
2. **Colocación**: Debes colocar ese dado en una de tus tres columnas (presionando en la columna elegida).
3. **Puntuación y Multiplicador**: La puntuación de cada columna es la suma de sus dados. ¡Pero cuidado con la magia negra! Si logras **emparejar dos o tres dados con el mismo valor en la misma columna**, su valor se suma y se multiplica exponencialmente (por ejemplo, dos dados de valor 4 en la misma columna valen `(4+4) × 2 = 16 pts`). Estos dados brillarán con una sutil aura corrupta.
4. **Destrucción / Robo**: El caos reina. Si colocas un dado en tu columna, y resulta coincidir con el valor de uno o más dados en **la misma columna del tablero de tu oponente**, ¡los dados de tu oponente son destruidos (eliminados de su tablero)! Una estrategia clave es robar/borrar los multiplicadores altos del enemigo.

## 🛠 Tecnologías Utilizadas

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, y CSS3 (Variables CSS, Animaciones @keyframes, Flexbox/Grid) sin frameworks.
- **Backend**: Node.js, Express, TypeScript.
- **Tiempo Real**: Socket.IO (Eventos bidireccionales).
- **Validación de Datos**: Zod.
- **Entorno de Desarrollo**: `tsx` (TypeScript Execution).

## 🪬 Requisitos Previos
- [Node.js](https://nodejs.org/es/) (Versión 18+ recomendada)
- Un navegador web moderno.

## ⚙️ Configuración e Instalación

1. **Clonar el repositorio**:
   ```bash
   git clone <url-de-tu-repo>
   cd matatena
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Variables de Entorno**:
   El proyecto requiere algunas variables de entorno para funcionar. Copia el archivo de ejemplo para crear el tuyo propio:
   ```bash
   cp .env.example .env
   ```
   Abre el archivo `.env` recién creado y asegúrate de que el contenido sea el siguiente:
   ```env
   PORT=3000
   API_URL=http://localhost:3000
   ```
   *(Nota: `API_URL` es inyectado dinámicamente hacia el clíente web, lo que permite desplegar posteriormente el proyecto cambiando este valor).*

## ⚡ Levantar el Altar (Arrancar la App)

- **Modo Desarrollo (con auto-recarga)**:
  ```bash
  npm run dev
  ```
  Esto utilizará `tsx watch` para arrancar el servidor. Cualquier cambio en la carpeta `src/server/` recargará automáticamente la aplicación.

  Una vez el servidor avise: `Servidor corriendo en http://localhost:3000`, abre esa dirección en tu navegador.

- **Modo Producción**:
  Para construir el proyecto mediante el compilador de TypeScript (`tsc`) y ejecutar el compilado final en Vanilla Node.js:
  ```bash
  npm run build
  npm start
  ```

## 👥 Cómo Jugar en Red (Multiplayer)

1. Un jugador ingresa a la aplicación y en la pestaña **"Crear Sala"** introduce su nombre de adepto para erigir el altar.
2. Automáticamente será dirigido a la pantalla de juego en estado de espera, y se generará un **ID de Sala / Ritual**.
3. El segundo jugador (en otra computadora conectada, o en otra pestaña del navegador), utiliza la opción **"Unirse al Ritual"**. Deberá colocar un Nombre distinto e introducir el **ID** que el primer jugador le comparta.
4. ¡El juego comienza!
