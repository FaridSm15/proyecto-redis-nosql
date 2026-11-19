require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexión a Redis Cloud
const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.error('Error en Redis:', err));

(async () => {
  await redisClient.connect();
  console.log('Servidor conectado a Redis Cloud');
})();

// Tiempo de vida por defecto para los carritos: 10 minutos (600 segundos)
const TTL_SEGUNDOS = 600;

// 1. READ (Leer carrito y su tiempo de vida restante TTL)
app.get('/api/carrito/:usuario', async (req, res) => {
  try {
    const clave = `carrito:${req.params.usuario}`;
    // HGETALL obtiene todos los productos guardados en el Hash
    const datos = await redisClient.hGetAll(clave);
    // TTL obtiene cuántos segundos le quedan antes de borrarse solo
    const ttl = await redisClient.ttl(clave);

    const productos = Object.entries(datos).map(([nombre, info]) => ({
      nombre,
      ...JSON.parse(info)
    }));

    res.json({ usuario: req.params.usuario, ttl, productos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. CREATE / UPDATE (Agregar producto o actualizar cantidad)
app.post('/api/carrito/:usuario', async (req, res) => {
  try {
    const { nombre, precio, cantidad } = req.body;
    const clave = `carrito:${req.params.usuario}`;

    // HSET crea el campo o lo sobrescribe si ya existe
    await redisClient.hSet(clave, nombre, JSON.stringify({
      precio: Number(precio),
      cantidad: Number(cantidad)
    }));

    // EXPIRE reinicia el temporizador de autodestrucción
    await redisClient.expire(clave, TTL_SEGUNDOS);

    res.json({ mensaje: 'Producto guardado en Redis Cloud', ttl: TTL_SEGUNDOS });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. UPDATE ESPECIALIZADO (Renovar el tiempo de expiración TTL manualmente)
app.put('/api/carrito/:usuario/renovar', async (req, res) => {
  try {
    const clave = `carrito:${req.params.usuario}`;
    const existe = await redisClient.exists(clave);

    if (!existe) {
      return res.status(404).json({ error: 'El carrito ya expiró o está vacío' });
    }

    await redisClient.expire(clave, TTL_SEGUNDOS);
    res.json({ mensaje: 'Tiempo de sesión renovado', ttl: TTL_SEGUNDOS });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4A. DELETE (Eliminar un producto específico del carrito)
app.delete('/api/carrito/:usuario/:producto', async (req, res) => {
  try {
    const clave = `carrito:${req.params.usuario}`;
    const { producto } = req.params;

    await redisClient.hDel(clave, producto);
    res.json({ mensaje: `Producto "${producto}" eliminado` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4B. DELETE (Vaciar todo el carrito completo)
app.delete('/api/carrito/:usuario', async (req, res) => {
  try {
    const clave = `carrito:${req.params.usuario}`;

    await redisClient.del(clave);
    res.json({ mensaje: 'Carrito eliminado por completo de la nube' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Aplicación corriendo en http://localhost:${PORT}`);
});
