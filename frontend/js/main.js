const API = 'https://sinteticafc-production.up.railway.app/api';

// ─── Mostrar mensaje en formulario ─────────────────────────────────
function mostrarMsg(id, texto, tipo) {
  const el = document.getElementById(id);
  el.textContent = texto;
  el.className = 'msg ' + tipo;
}

// ─── LOGIN ──────────────────────────────────────────────────────────
async function login() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPwd').value;

  if (!email || !password) {
    return mostrarMsg('loginMsg', 'Por favor completa todos los campos.', 'error');
  }

  try {
    const res  = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      return mostrarMsg('loginMsg', data.mensaje || 'Error al iniciar sesión.', 'error');
    }

    // Guardar token y datos del usuario en localStorage
    localStorage.setItem('token',   data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));

    mostrarMsg('loginMsg', '✅ Ingresando...', 'ok');

    // Redirigir según el rol
    setTimeout(() => {
      if (data.usuario.tipo === 'administrador') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'reserva.html';
      }
    }, 500);

  } catch (e) {
    mostrarMsg('loginMsg', 'No se pudo conectar con el servidor.', 'error');
  }
}

// ─── REGISTRO ───────────────────────────────────────────────────────
async function registro() {
  const nombre   = document.getElementById('regNombre').value.trim();
  const apellido = document.getElementById('regApellido').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const telefono = document.getElementById('regTelefono').value.trim();
  const password = document.getElementById('regPwd').value;

  if (!nombre || !apellido || !email || !password) {
    return mostrarMsg('regMsg', 'Nombre, apellido, email y contraseña son obligatorios.', 'error');
  }

  if (password.length < 6) {
    return mostrarMsg('regMsg', 'La contraseña debe tener al menos 6 caracteres.', 'error');
  }

  try {
    const res  = await fetch(`${API}/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, apellido, email, telefono, password })
    });
    const data = await res.json();

    if (!res.ok) {
      return mostrarMsg('regMsg', data.mensaje || 'Error al registrarse.', 'error');
    }

    mostrarMsg('regMsg', '✅ Cuenta creada. Ahora inicia sesión.', 'ok');

    // Volver al login después de 1.5s
    setTimeout(() => {
      volver();
      mostrar('loginScreen');
    }, 500);

  } catch (e) {
    mostrarMsg('regMsg', 'No se pudo conectar con el servidor.', 'error');
  }
}

// ─── Proteger páginas (llamar al inicio de reserva.html y admin.html) ──
function verificarSesion(rolRequerido = null) {
  const token   = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

  if (!token || !usuario) {
    window.location.href = 'formulario.html';
    return null;
  }

  if (rolRequerido && usuario.tipo !== rolRequerido) {
    window.location.href = 'formulario.html';
    return null;
  }

  return usuario;
}

// ─── Cerrar sesión ──────────────────────────────────────────────────
function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'formulario.html';
}