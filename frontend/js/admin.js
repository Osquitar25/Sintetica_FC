// ─── Al cargar ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const usuario = verificarSesion('administrador');
  if (!usuario) return;

  document.getElementById('adminNombre').textContent = `👤 ${usuario.nombre}`;
  cargarReservas();
});

// ─── Navegación entre secciones ──────────────────────────────────────
function cambiarSeccion(nombre, el) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activo'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('activo'));

  document.getElementById(`sec-${nombre}`).classList.add('activo');
  el.classList.add('activo');

  if (nombre === 'reservas') cargarReservas();
  if (nombre === 'canchas')  cargarCanchasAdmin();
  if (nombre === 'usuarios') cargarUsuarios();
  if (nombre === 'petos')    cargarPetosAdmin();
}

// ─── Headers con token ───────────────────────────────────────────────
function headers() {
  return {
    'Content-Type': 'application/json',
    'authorization': localStorage.getItem('token')
  };
}

// ─── RESERVAS ────────────────────────────────────────────────────────
async function cargarReservas() {
  const contenedor = document.getElementById('tabla-reservas');
  const filtro = document.getElementById('filtroEstado').value;
  contenedor.innerHTML = '<div class="vacio">Cargando...</div>';

  try {
    const res = await fetch(`${API}/admin/reservas`, { headers: headers() });
    let data = await res.json();

    if (filtro) data = data.filter(r => r.nombre_estado === filtro);

    if (data.length === 0) {
      contenedor.innerHTML = '<div class="vacio">No hay reservas.</div>';
      return;
    }

    contenedor.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Cancha</th>
            <th>Fecha</th>
            <th>Horario</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r => `
            <tr>
              <td>#${r.id_reserva}</td>
              <td>
                <div>${r.nombre} ${r.apellido}</div>
                <div style="font-size:11px;color:var(--texto-gris)">${r.email}</div>
              </td>
              <td>
                <div>${r.nombre_cancha}</div>
                <div style="font-size:11px;color:var(--texto-gris)">${r.nombre_tipo}</div>
              </td>
              <td>${new Date(r.fecha_reserva).toLocaleDateString('es-CO')}</td>
              <td>${r.hora_inicio.slice(0,5)} - ${r.hora_fin.slice(0,5)}</td>
              <td>$${Number(r.monto_total).toLocaleString('es-CO')}</td>
              <td><span class="badge badge-${r.nombre_estado.toLowerCase()}">${r.nombre_estado}</span></td>
              <td>
                ${r.nombre_estado === 'Pendiente' ? `
                  <button class="btn-accion btn-confirmar" onclick="cambiarEstadoReserva(${r.id_reserva}, 2)">Confirmar</button>
                  <button class="btn-accion btn-cancelar" onclick="cambiarEstadoReserva(${r.id_reserva}, 3)">Cancelar</button>
                ` : ''}
                ${r.nombre_estado === 'Confirmada' ? `
                  <button class="btn-accion btn-completar" onclick="cambiarEstadoReserva(${r.id_reserva}, 4)">Completar</button>
                  <button class="btn-accion btn-cancelar" onclick="cambiarEstadoReserva(${r.id_reserva}, 3)">Cancelar</button>
                ` : ''}
                ${r.nombre_estado === 'Cancelada' || r.nombre_estado === 'Completada' ? '<span style="color:var(--texto-gris);font-size:12px">—</span>' : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch {
    contenedor.innerHTML = '<div class="vacio">Error al cargar reservas.</div>';
  }
}

async function cambiarEstadoReserva(id, estado) {
  try {
    await fetch(`${API}/admin/reservas/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ id_estado_reserva: estado })
    });
    cargarReservas();
  } catch {
    alert('Error al actualizar reserva');
  }
}

// ─── CANCHAS ─────────────────────────────────────────────────────────
async function cargarCanchasAdmin() {
  const contenedor = document.getElementById('tabla-canchas');
  contenedor.innerHTML = '<div class="vacio">Cargando...</div>';

  try {
    const res = await fetch(`${API}/admin/canchas`, { headers: headers() });
    const data = await res.json();

    if (data.length === 0) {
      contenedor.innerHTML = '<div class="vacio">No hay canchas.</div>';
      return;
    }

    contenedor.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Cancha</th>
            <th>Tipo</th>
            <th>Jugadores</th>
            <th>Dimensiones</th>
            <th>Precio/hr</th>
            <th>Estado</th>
            <th>Acciones</th>
            <th>Sede</th>
            <th>Cesped</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(c => `
            <tr>
              <td>#${c.id_cancha}</td>
              <td>${c.nombre_cancha}</td>
              <td>${c.nombre_tipo}</td>
              <td>${c.NOMBRE_JUGADORES}</td>
              <td>${c.dimensiones}</td>
              <td>$${Number(c.precio_por_hora).toLocaleString('es-CO')}</td>
              <td><span class="badge badge-${c.nombre_estado.toLowerCase()}">${c.nombre_estado}</span></td>
              <td>
                ${c.id_estado_cancha !== 1 ? `<button class="btn-accion btn-habilitar" onclick="cambiarEstadoCancha(${c.id_cancha}, 1)">Habilitar</button>` : ''}
                ${c.id_estado_cancha === 1 ? `<button class="btn-accion btn-deshabilitar" onclick="cambiarEstadoCancha(${c.id_cancha}, 2)">Mantenimiento</button>` : ''}
                ${c.id_estado_cancha !== 3 ? `<button class="btn-accion btn-cancelar" onclick="cambiarEstadoCancha(${c.id_cancha}, 3)">Inhabilitar</button>` : ''}
              </td>
              <td>${c.nombre_sede || '—'}</td>
              <td>${c.tipo_cesped || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch {
    contenedor.innerHTML = '<div class="vacio">Error al cargar canchas.</div>';
  }
}

async function cambiarEstadoCancha(id, estado) {
  try {
    await fetch(`${API}/admin/canchas/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ id_estado_cancha: estado })
    });
    cargarCanchasAdmin();
  } catch {
    alert('Error al actualizar cancha');
  }
}

// ─── USUARIOS ────────────────────────────────────────────────────────
async function cargarUsuarios() {
  const contenedor = document.getElementById('tabla-usuarios');
  contenedor.innerHTML = '<div class="vacio">Cargando...</div>';

  try {
    const res = await fetch(`${API}/admin/usuarios`, { headers: headers() });
    const data = await res.json();

    if (data.length === 0) {
      contenedor.innerHTML = '<div class="vacio">No hay usuarios.</div>';
      return;
    }

    contenedor.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Tipo</th>
            <th>Registro</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(u => `
            <tr>
              <td>#${u.id_usuario}</td>
              <td>${u.nombre} ${u.apellido}</td>
              <td>${u.email}</td>
              <td>${u.telefono || '—'}</td>
              <td><span class="badge ${u.nombre_tipo === 'administrador' ? 'badge-confirmada' : 'badge-pendiente'}">${u.nombre_tipo}</span></td>
              <td>${new Date(u.fecha_registro).toLocaleDateString('es-CO')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch {
    contenedor.innerHTML = '<div class="vacio">Error al cargar usuarios.</div>';
  }
}

// ─── PETOS ───────────────────────────────────────────────────────────
async function cargarPetosAdmin() {
  const contenedor = document.getElementById('tabla-petos');
  contenedor.innerHTML = '<div class="vacio">Cargando...</div>';

  try {
    const res = await fetch(`${API}/admin/petos`, { headers: headers() });
    const data = await res.json();

    if (data.length === 0) {
      contenedor.innerHTML = '<div class="vacio">No hay préstamos registrados.</div>';
      return;
    }

    contenedor.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Peto</th>
            <th>Cantidad</th>
            <th>Fecha reserva</th>
            <th>Fecha préstamo</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((p, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${p.nombre} ${p.apellido}</td>
              <td>${p.color} - Talla ${p.talla}</td>
              <td>${p.cantidad_prestada}</td>
              <td>${new Date(p.fecha_reserva).toLocaleDateString('es-CO')}</td>
              <td>${new Date(p.fecha_prestamo).toLocaleDateString('es-CO')}</td>
              <td><span class="badge badge-${p.nombre_estado.toLowerCase()}">${p.nombre_estado}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch {
    contenedor.innerHTML = '<div class="vacio">Error al cargar petos.</div>';
  }
}

