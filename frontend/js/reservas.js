// ─── Estado de la reserva ────────────────────────────────────────────
const reserva = {
  cancha: null,
  horario: null,
  fecha: null,
  petos: null,
};

// ─── Al cargar la página ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const usuario = verificarSesion('usuario');
  if (!usuario) return;

  document.getElementById('navNombre').textContent = `👤 ${usuario.nombre} ${usuario.apellido}`;

  // Fecha mínima: hoy
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('fechaReserva').min = hoy;

  cargarCanchas();
  cargarPetos();
});

// ─── Navegación entre pasos ──────────────────────────────────────────
function irPaso(num) {
  document.querySelectorAll('.step-content').forEach(s => s.classList.remove('activo'));
  document.getElementById(`step-${num}`).classList.add('activo');

  document.querySelectorAll('.paso').forEach((p, i) => {
    p.classList.remove('activo', 'completo');
    if (i + 1 < num) p.classList.add('completo');
    if (i + 1 === num) p.classList.add('activo');
  });

  document.querySelectorAll('.paso-linea').forEach((l, i) => {
    l.classList.toggle('completo', i + 1 < num);
  });

  if (num === 4) llenarResumen();
}

// ─── PASO 1: Cargar canchas ──────────────────────────────────────────
async function cargarCanchas() {
  const contenedor = document.getElementById('lista-canchas');
  contenedor.innerHTML = '<p style="color:var(--texto-gris)">Cargando canchas...</p>';

  try {
    const res = await fetch(`${API}/canchas`);
    const canchas = await res.json();

    contenedor.innerHTML = '';
    canchas.forEach(c => {
      const div = document.createElement('div');
      div.className = 'cancha-item';
      div.innerHTML = `
      <div class="cancha-info">
      <span class="cancha-nombre">${c.nombre_cancha}</span>
      <span class="cancha-detalles">${c.nombre_tipo} · ${c.nombre_jugadores} jugadores · ${c.dimensiones}</span>
      <span class="cancha-detalles">⚽ ${c.tipo_cesped} · ⚽ ${c.nombre_sede || 'Sin sede'}</span>
      </div>
      <span class="cancha-precio">$${Number(c.precio_por_hora).toLocaleString('es-CO')}/hr</span>
      `;
      div.onclick = () => seleccionarCancha(c, div);
      contenedor.appendChild(div);
    });
  } catch {
    contenedor.innerHTML = '<p style="color:var(--error)">Error al cargar canchas.</p>';
  }
}

function seleccionarCancha(cancha, el) {
  document.querySelectorAll('.cancha-item').forEach(i => i.classList.remove('seleccionado'));
  el.classList.add('seleccionado');
  reserva.cancha = cancha;
  setTimeout(() => irPaso(2), 300);
}

// ─── PASO 2: Cargar horarios ─────────────────────────────────────────
async function cargarHorarios() {
  const fecha = document.getElementById('fechaReserva').value;
  if (!fecha || !reserva.cancha) return;

  reserva.fecha = fecha;
  const contenedor = document.getElementById('lista-horarios');
  contenedor.innerHTML = '<p style="color:var(--texto-gris)">Cargando horarios...</p>';

  try {
    const res = await fetch(`${API}/horarios/${reserva.cancha.id_cancha}/${fecha}`);
    const horarios = await res.json();

    contenedor.innerHTML = '';
    if (horarios.length === 0) {
      contenedor.innerHTML = '<p style="color:var(--texto-gris)">No hay horarios disponibles para este día.</p>';
      return;
    }

    horarios.forEach(h => {
      const div = document.createElement('div');
      const libre = h.libre === 1;
      div.className = `horario-item ${libre ? '' : 'ocupado'}`;
      div.textContent = `${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)}`;
      if (libre) {
        div.onclick = () => seleccionarHorario(h, div);
      }
      contenedor.appendChild(div);
    });
  } catch {
    contenedor.innerHTML = '<p style="color:var(--error)">Error al cargar horarios.</p>';
  }
}

function seleccionarHorario(horario, el) {
  document.querySelectorAll('.horario-item').forEach(i => i.classList.remove('seleccionado'));
  el.classList.add('seleccionado');
  reserva.horario = horario;
  reserva.fecha = document.getElementById('fechaReserva').value;
  setTimeout(() => irPaso(3), 300);
}

// ─── PASO 3: Petos ───────────────────────────────────────────────────
async function cargarPetos() {
  try {
    const res = await fetch(`${API}/petos`);
    const petos = await res.json();
    const select = document.getElementById('petosSelect');

    petos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id_inventario;
      opt.textContent = `${p.color} - Talla ${p.talla} (${p.cantidad_disponible} disponibles)`;
      opt.dataset.max = p.cantidad_disponible;
      select.appendChild(opt);
    });
  } catch {
    console.error('Error cargando petos');
  }
}

function seleccionarPeto(quiere) {
  document.getElementById('opt-si').classList.toggle('seleccionado', quiere);
  document.getElementById('opt-no').classList.toggle('seleccionado', !quiere);
  document.getElementById('petos-detalle').style.display = quiere ? 'block' : 'none';

  if (!quiere) reserva.petos = null;
}

function actualizarCantidadMax() {
  const select = document.getElementById('petosSelect');
  const opt = select.options[select.selectedIndex];
  if (opt && opt.dataset.max) {
    document.getElementById('petosCantidad').max = opt.dataset.max;
  }
}

// ─── PASO 4: Resumen ─────────────────────────────────────────────────
function llenarResumen() {
  const c = reserva.cancha;
  const h = reserva.horario;

  document.getElementById('res-cancha').textContent  = c ? c.nombre_cancha : '—';
  document.getElementById('res-tipo').textContent    = c ? c.nombre_tipo : '—';
  document.getElementById('res-fecha').textContent   = reserva.fecha ? new Date(reserva.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  document.getElementById('res-horario').textContent = h ? `${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)}` : '—';

  // Petos
  const quierePetos = document.getElementById('opt-si').classList.contains('seleccionado');
  if (quierePetos) {
    const select = document.getElementById('petosSelect');
    const cantidad = document.getElementById('petosCantidad').value;
    const texto = select.options[select.selectedIndex]?.textContent || '';
    document.getElementById('res-petos').textContent = `${cantidad} x ${texto}`;
    reserva.petos = {
      id_inventario: select.value,
      cantidad: parseInt(cantidad)
    };
  } else {
    document.getElementById('res-petos').textContent = 'No';
    reserva.petos = null;
  }

  const total = c ? Number(c.precio_por_hora) : 0;
  document.getElementById('res-total').textContent = `$${total.toLocaleString('es-CO')}`;
}

// ─── Confirmar reserva ───────────────────────────────────────────────
async function confirmarReserva() {
  const token = localStorage.getItem('token');

  if (!reserva.cancha || !reserva.horario || !reserva.fecha) {
    return mostrarMsg('confirmMsg', 'Faltan datos de la reserva.', 'error');
  }

  try {
    const res = await fetch(`${API}/reservas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': token
      },
      body: JSON.stringify({
        id_cancha:    reserva.cancha.id_cancha,
        fecha_reserva: reserva.fecha,
        hora_inicio:  reserva.horario.hora_inicio,
        hora_fin:     reserva.horario.hora_fin,
        monto_total:  reserva.cancha.precio_por_hora,
        petos:        reserva.petos
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return mostrarMsg('confirmMsg', data.mensaje || 'Error al crear reserva.', 'error');
    }

    mostrarMsg('confirmMsg', `✅ ¡Reserva confirmada! ID: ${data.id_reserva}`, 'ok');

    setTimeout(() => {
      // Reiniciar wizard
      reserva.cancha = null;
      reserva.horario = null;
      reserva.fecha = null;
      reserva.petos = null;
      irPaso(1);
      cargarCanchas();
    }, 500);

  } catch {
    mostrarMsg('confirmMsg', 'No se pudo conectar con el servidor.', 'error');
  }
}
// ─── MIS RESERVAS ────────────────────────────────────────────────────
function verMisReservas() {
  document.getElementById('mis-reservas-panel').style.display = 'block';
  document.querySelector('.reserva-container').style.display = 'none';
  cargarMisReservas();
}

function volverAReservar() {
  document.getElementById('mis-reservas-panel').style.display = 'none';
  document.querySelector('.reserva-container').style.display = 'block';
}

async function cargarMisReservas() {
  const contenedor = document.getElementById('lista-mis-reservas');
  const token = localStorage.getItem('token');
  contenedor.innerHTML = '<div style="padding:20px;color:var(--texto-gris)">Cargando...</div>';

  try {
    const res = await fetch(`${API}/mis-reservas`, {
      headers: { 'authorization': token }
    });
    const data = await res.json();

    if (data.length === 0) {
      contenedor.innerHTML = '<div style="padding:40px;text-align:center;color:var(--texto-gris)">No tienes reservas aún.</div>';
      return;
    }

    contenedor.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Cancha</th>
            <th>Fecha</th>
            <th>Horario</th>
            <th>Petos</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r => `
            <tr>
              <td>#${r.id_reserva}</td>
              <td>
                <div>${r.nombre_cancha}</div>
                <div style="font-size:11px;color:var(--texto-gris)">${r.nombre_tipo}</div>
              </td>
              <td>${new Date(r.fecha_reserva).toLocaleDateString('es-CO')}</td>
              <td>${r.hora_inicio.slice(0,5)} - ${r.hora_fin.slice(0,5)}</td>
              <td>${r.cantidad_prestada ? `${r.cantidad_prestada} x ${r.color} (${r.talla})` : 'No'}</td>
              <td>$${Number(r.monto_total).toLocaleString('es-CO')}</td>
              <td><span class="badge badge-${r.nombre_estado.toLowerCase()}">${r.nombre_estado}</span></td>
              <td>
                ${r.nombre_estado === 'Pendiente' ? `
                  <button class="btn-accion btn-cancelar" onclick="cancelarReserva(${r.id_reserva})">Cancelar</button>
                ` : '—'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch {
    contenedor.innerHTML = '<div style="padding:20px;color:var(--error)">Error al cargar reservas.</div>';
  }
}

async function cancelarReserva(id) {
  if (!confirm('¿Seguro que quieres cancelar esta reserva?')) return;
  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API}/mis-reservas/${id}/cancelar`, {
      method: 'PUT',
      headers: { 'authorization': token }
    });
    const data = await res.json();
    alert(data.mensaje);
    cargarMisReservas();
  } catch {
    alert('Error al cancelar');
  }
}