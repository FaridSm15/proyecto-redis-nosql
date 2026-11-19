require('dotenv').config();
const { createClient } = require('redis');

async function poblarBaseDeDatos() {
  // 1. Creamos el cliente conectándonos a Redis Cloud usando tu .env
  const client = createClient({
    url: process.env.REDIS_URL
  });

  client.on('error', (err) => console.error('Error de conexión Redis:', err));

  await client.connect();
  console.log('Conectado exitosamente a Redis Cloud.');

  // 2. Definimos la clave (namespace:id)
  const claveCarrito = 'carrito:usuario_demo';

  // Limpiamos si existía algo previo en esa clave
  await client.del(claveCarrito);

  // 3. Guardamos productos usando una estructura HASH (HSET)
  // Cada campo es el nombre del producto y su valor es un JSON con precio y cantidad
  await client.hSet(claveCarrito, {
    'Laptop Gamer': JSON.stringify({ precio: 18500, cantidad: 1 }),
    'Mouse Inalámbrico': JSON.stringify({ precio: 450, cantidad: 2 })
  });

  // 4. Aplicamos la consulta especializada: TTL (Time-To-Live) de 900 segundos (15 min)
  await client.expire(claveCarrito, 900);

  console.log(`Datos iniciales cargados en "${claveCarrito}" con expiración de 900 segundos.`);
  await client.quit();
}

poblarBaseDeDatos();