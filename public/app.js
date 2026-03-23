// ===== MAPA =====
let map;
let marcadorOrigen, marcadorDestino, lineaRuta;

window.onload = () => {
    map = L.map('map').setView([-16.4090, -71.5375], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    cargarHistorial();
};

// ===== CONSULTAR RUTA =====
async function consultar() {

    const oLat = document.getElementById('oLat').value;
    const oLon = document.getElementById('oLon').value;
    const dLat = document.getElementById('dLat').value;
    const dLon = document.getElementById('dLon').value;

    try {
        const res = await fetch(`/api/ruta?oLat=${oLat}&oLon=${oLon}&dLat=${dLat}&dLon=${dLon}`);
        const data = await res.json();

        document.getElementById('dist').textContent = data.distancia_km;
        document.getElementById('tiempo').textContent = data.duracion_min;

        dibujarMapa(oLat, oLon, dLat, dLon);
        cargarHistorial();

    } catch (e) {
        alert("Error");
    }
}

// ===== DIBUJAR MAPA =====
async function dibujarMapa(oLat, oLon, dLat, dLon) {

    if (marcadorOrigen) map.removeLayer(marcadorOrigen);
    if (marcadorDestino) map.removeLayer(marcadorDestino);
    if (lineaRuta) map.removeLayer(lineaRuta);

    marcadorOrigen = L.marker([oLat, oLon]).addTo(map).bindPopup("Origen");
    marcadorDestino = L.marker([dLat, dLon]).addTo(map).bindPopup("Destino");

    const url = `https://router.project-osrm.org/route/v1/driving/${oLon},${oLat};${dLon},${dLat}?overview=full&geometries=geojson`;

    const res = await fetch(url);
    const data = await res.json();

    const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

    lineaRuta = L.polyline(coords).addTo(map);

    map.fitBounds(lineaRuta.getBounds());
}

// ===== HISTORIAL =====
async function cargarHistorial() {
    const res = await fetch('/api/historial');
    const data = await res.json();

    const tabla = document.getElementById('tablaHistorial');

    tabla.innerHTML = data.map(row => `
        <tr>
            <td>${row.origen_dir.substring(0,30)} → ${row.destino_dir.substring(0,30)}</td>
            <td>${row.distancia_km} km</td>
            <td>${new Date(row.fecha).toLocaleString()}</td>
        </tr>
    `).join('');
}