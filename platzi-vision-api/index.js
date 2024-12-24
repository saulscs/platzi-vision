const express = require('express'); // Importa el framework Express

const app = express(); // Crea una instancia de Express
const PORT = 5001; // Define el puerto en el que correrá el servidor

const cors = require("cors");

app.use(cors());

// Ruta base para verificar que el servidor funciona
app.use('/api/chat', require('./api/chat'));

// Inicia el servidor y escucha en el puerto especificado
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
