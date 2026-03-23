import express from 'express';
import sqlite3 from 'sqlite3'; // Asegúrate de haber ejecutado: npm install sqlite3
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// En el endpoint de guardado:
const query = 'INSERT INTO historial (origen_dir, destino_dir, distancia_km, duracion_min) VALUES ($1, $2, $3, $4)';
await pool.query(query, [geoO.display_name, geoD.display_name, d_km, t_min]);

const app = express();
const PORT = process.env.PORT || 3000;

// User-Agent requerido por la política de uso de Nominatim [cite: 33, 101]
const UA = 'Lab02UCSM/1.0 (laboratorio academico)'; 

// 1. Configuración de la Base de Datos Local
const db = new sqlite3.Database('./historial.db', (err) => {
    if (err) console.error('Error al abrir BD:', err.message);
    else console.log('Conectado a la base de datos SQLite.');
});

// Crear la tabla para el historial si no existe
db.run(`CREATE TABLE IF NOT EXISTS historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origen_dir TEXT,
    destino_dir TEXT,
    distancia_km REAL,
    duracion_min REAL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

app.use(express.json()); 
app.use(express.static('public')); 

/* ── Helper: fetch con User-Agent ── */
const osmFetch = url =>
    fetch(url, { headers: { 'User-Agent': UA } }).then(r => r.json()); 

/* ── Endpoint 1: Geocodificación inversa (Nominatim) ── */
app.get('/api/geocode', async (req, res) => {
    const { lat, lon } = req.query; 

    if (!lat || !lon) {
        return res.status(400).json({ error: 'Se requieren lat y lon' });
    }
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`; 
        const data = await osmFetch(url); 

        res.json({
            direccion: data.display_name, 
            ciudad: data.address?.city || data.address?.town,
            pais: data.address?.country, 
        });
    } catch (e) {
        res.status(500).json({ error: e.message }); 
    }
});

/* ── Endpoint 2: Ruta entre dos puntos (OSRM) ── */
app.get('/api/ruta', async (req, res) => {
    const { oLat, oLon, dLat, dLon } = req.query; 

    if (!oLat || !oLon || !dLat || !dLon) {
        return res.status(400).json({ error: 'Se requieren coordenadas de origen y destino' }); 
    }
    try {
        // Consultar nombres de direcciones para la BD
        const geoO = await osmFetch(`https://nominatim.openstreetmap.org/reverse?lat=${oLat}&lon=${oLon}&format=json`);
        const geoD = await osmFetch(`https://nominatim.openstreetmap.org/reverse?lat=${dLat}&lon=${dLon}&format=json`);

        // Calcular ruta en OSRM (orden lon, lat) [cite: 73, 129]
        const url = `https://router.project-osrm.org/route/v1/driving/${oLon},${oLat};${dLon},${dLat}?overview=false`; 
        const data = await osmFetch(url); 

        if (data.code !== 'Ok') {
            return res.status(502).json({ error: data.code }); 
        }

        const ruta = data.routes[0]; 
        const d_km = (ruta.distance / 1000).toFixed(2);
        const t_min = (ruta.duration / 60).toFixed(1);

        // 2. Guardar en la Base de Datos Local
        db.run(
            `INSERT INTO historial (origen_dir, destino_dir, distancia_km, duracion_min) VALUES (?, ?, ?, ?)`,
            [geoO.display_name, geoD.display_name, d_km, t_min],
            (err) => { if (err) console.error('Error al guardar:', err.message); }
        );

        res.json({
            distancia_km: d_km,
            duracion_min: t_min,
            origen: geoO.display_name,
            destino: geoD.display_name
        });
    } catch (e) {
        res.status(500).json({ error: e.message }); 
    }
});

// 3. Endpoint Nuevo: Ver historial guardado
app.get('/api/historial', (req, res) => {
    db.all(`SELECT * FROM historial ORDER BY fecha DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});