const express = require('express'); // Importa el framework Express
const cors = require("cors");
const app = express(); // Crea una instancia de Express

const PORT = 5001; // Define el puerto en el que correrá el servidor

// Configura CORS correctamente
app.use(cors({
  origin: 'http://localhost:3000', // Permite solicitudes desde este origen
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Cabeceras permitidas
}));

// Middleware para manejar solicitudes preflight (OPTIONS)
app.options('*', cors()); // Asegura que todas las solicitudes preflight sean manejadas correctamente
// Ruta base para verificar que el servidor funciona

app.use(express.json()); // Procesa solicitudes con payload JSON

app.use('/api/chat', require('./api/chat'));

// Inicia el servidor y escucha en el puerto especificado
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
