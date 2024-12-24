const express = require("express");
const router = express.Router();

router.get('/', async (req, res) => {
    res.send('Servidor corriendo...');
});

module.exports = router;