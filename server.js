const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'frontend')));

const JWT_SECRET = 'sintetica_2026';

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Elcrack2512+',
  database: process.env.DB_NAME || 'sintetica'
});

db.connect((err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    return;
  }
  console.log('✅ Conectado a MySQL correctamente');
});

// token
function verificarToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ mensaje: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch {
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
}

// registro
app.post('/api/registro', async (req, res) => {
  const { nombre, apellido, email, telefono, password } = req.body;

  if (!nombre || !apellido || !email || !password) {
    return res.status(400).json({ mensaje: 'Faltan campos obligatorios' });
  }

  
  db.query('SELECT id_usuario FROM usuario WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error en el servidor' });
    if (results.length > 0) return res.status(400).json({ mensaje: 'El email ya está registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      'INSERT INTO usuario (id_tipo_usuario, nombre, apellido, email, telefono, password, fecha_registro) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [2, nombre, apellido, email, telefono, hashedPassword], // 2 = usuario normal
      (err) => {
        if (err) return res.status(500).json({ mensaje: 'Error al registrar usuario' });
        res.json({ mensaje: '✅ Usuario registrado correctamente' });
      }
    );
  });
});

// consulta loguin
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ mensaje: 'Email y contraseña requeridos' });
  }

  db.query(
    `SELECT u.*, tu.nombre_tipo AS tipo 
     FROM usuario u 
     JOIN tipo_usuario tu ON u.id_tipo_usuario = tu.id_tipo_usuario 
     WHERE u.email = ?`,
    [email],
    async (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error en el servidor' });
      if (results.length === 0) return res.status(401).json({ mensaje: 'Usuario no encontrado' });

      const usuario = results[0];
      const passwordOk = await bcrypt.compare(password, usuario.password);
      if (!passwordOk) return res.status(401).json({ mensaje: 'Contraseña incorrecta' });

      const token = jwt.sign(
        { id: usuario.id_usuario, email: usuario.email, tipo: usuario.tipo },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      res.json({
        mensaje: '✅ Login exitoso',
        token,
        usuario: {
          id: usuario.id_usuario,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          email: usuario.email,
          tipo: usuario.tipo
        }
      });
    }
  );
});

app.get('/api/perfil', verificarToken, (req, res) => {
  res.json({ mensaje: 'Acceso autorizado', usuario: req.usuario });
});
// ─── CANCHAS ────────────────────────────────────────────────────────
app.get('/api/canchas', (req, res) => {
  db.query(
    `SELECT c.id_cancha, c.nombre_cancha, c.descripcion, c.precio_por_hora,
            c.tipo_cesped, s.nombre_sede,
            tc.nombre_tipo, tc.nombre_jugadores, tc.dimensiones,
            ec.nombre_estado
     FROM cancha c
     JOIN tipo_cancha tc ON c.id_tipo_cancha = tc.id_tipo_cancha
     JOIN estado_cancha ec ON c.id_estado_cancha = ec.id_estado_cancha
     LEFT JOIN sede s ON c.id_sede = s.id_sede
     WHERE ec.nombre_estado = 'Disponible'`,
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener canchas' });
      res.json(results);
    }
  );
});
// ─── HORARIOS POR CANCHA Y FECHA ────────────────────────────────────
app.get('/api/horarios/:id_cancha/:fecha', (req, res) => {
  const { id_cancha, fecha } = req.params;
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sábado'];
  const diaSemana = dias[new Date(fecha).getDay()];

  db.query(
    `SELECT h.id_horario, h.hora_inicio, h.hora_fin, h.disponible,
            CASE WHEN EXISTS (
              SELECT 1 FROM reserva r 
              WHERE r.id_cancha = ?
              AND r.fecha_reserva = ?
              AND r.hora_inicio = h.hora_inicio
              AND r.id_estado_reserva IN (1,2)
            ) THEN 0 ELSE 1 END AS libre
     FROM horario_disponible h
     JOIN dia_semana d ON h.id_dia_semana = d.id_dia_semana
     WHERE h.id_cancha = ? AND d.nombre_dia = ?
     ORDER BY h.hora_inicio`,
    [id_cancha, fecha, id_cancha, diaSemana],
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener horarios' });
      res.json(results);
    }
  );
});

// ─── PETOS DISPONIBLES ───────────────────────────────────────────────
app.get('/api/petos', (req, res) => {
  db.query(
    `SELECT id_inventario, color, talla, cantidad_disponible
     FROM inventario_peto
     WHERE estado = 'Disponible' AND cantidad_disponible > 0
     ORDER BY color, talla`,
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener petos' });
      res.json(results);
    }
  );
});

// ─── CREAR RESERVA ───────────────────────────────────────────────────
app.post('/api/reservas', verificarToken, (req, res) => {
  const { id_cancha, fecha_reserva, hora_inicio, hora_fin, monto_total, petos } = req.body;
  const id_usuario = req.usuario.id;

  // Validar que la fecha no sea pasada
  const hoy = new Date().toISOString().split('T')[0];
  if (fecha_reserva < hoy) {
    return res.status(400).json({ mensaje: 'No puedes reservar en una fecha pasada' });
  }

  // Validar que todos los campos lleguen
  if (!id_cancha || !fecha_reserva || !hora_inicio || !hora_fin || !monto_total) {
    return res.status(400).json({ mensaje: 'Faltan datos de la reserva' });
  }

  // Verificar que el horario no esté ya reservado
  db.query(
    `SELECT id_reserva FROM reserva 
     WHERE id_cancha = ? AND fecha_reserva = ? AND hora_inicio = ? 
     AND id_estado_reserva IN (1,2)`,
    [id_cancha, fecha_reserva, hora_inicio],
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error en el servidor' });
      if (results.length > 0) return res.status(400).json({ mensaje: 'Ese horario ya está reservado' });

      // Verificar disponibilidad de petos
      if (petos && petos.id_inventario) {
        db.query(
          'SELECT cantidad_disponible FROM inventario_peto WHERE id_inventario = ?',
          [petos.id_inventario],
          (err, results) => {
            if (err) return res.status(500).json({ mensaje: 'Error verificando petos' });
            if (results.length === 0) return res.status(400).json({ mensaje: 'Peto no encontrado' });
            if (results[0].cantidad_disponible < petos.cantidad) {
              return res.status(400).json({ mensaje: `Solo hay ${results[0].cantidad_disponible} petos disponibles` });
            }
            crearReserva(id_usuario, id_cancha, fecha_reserva, hora_inicio, hora_fin, monto_total, petos, res);
          }
        );
      } else {
        crearReserva(id_usuario, id_cancha, fecha_reserva, hora_inicio, hora_fin, monto_total, null, res);
      }
    }
  );
});

function crearReserva(id_usuario, id_cancha, fecha_reserva, hora_inicio, hora_fin, monto_total, petos, res) {
  db.query(
    `INSERT INTO reserva (id_usuario, id_cancha, id_estado_reserva, fecha_reserva, hora_inicio, hora_fin, monto_total, fecha_creacion)
     VALUES (?, ?, 1, ?, ?, ?, ?, NOW())`,
    [id_usuario, id_cancha, fecha_reserva, hora_inicio, hora_fin, monto_total],
    (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al crear reserva' });
      const id_reserva = result.insertId;

      if (petos && petos.id_inventario) {
        // Registrar préstamo y descontar del inventario
        db.query(
          `INSERT INTO prestamo_peto (id_reserva, id_inventario, id_estado_prestamo, cantidad_prestada, fecha_prestamo)
           VALUES (?, ?, 1, ?, NOW())`,
          [id_reserva, petos.id_inventario, petos.cantidad],
          (err) => {
            if (err) return res.status(500).json({ mensaje: 'Error al registrar petos' });

            // Descontar del inventario
            db.query(
              'UPDATE inventario_peto SET cantidad_disponible = cantidad_disponible - ? WHERE id_inventario = ?',
              [petos.cantidad, petos.id_inventario],
              (err) => {
                if (err) return res.status(500).json({ mensaje: 'Error actualizando inventario' });
                res.json({ mensaje: '✅ Reserva creada con petos', id_reserva });
              }
            );
          }
        );
      } else {
        res.json({ mensaje: '✅ Reserva creada', id_reserva });
      }
    }
  );
}
// ─── ADMIN: Todas las reservas ───────────────────────────────────────
app.get('/api/admin/reservas', verificarToken, (req, res) => {
  db.query(
    `SELECT r.id_reserva, r.fecha_reserva, r.hora_inicio, r.hora_fin, r.monto_total,
            u.nombre, u.apellido, u.email, u.telefono,
            c.nombre_cancha, tc.nombre_tipo,
            er.nombre_estado
     FROM reserva r
     JOIN usuario u ON r.id_usuario = u.id_usuario
     JOIN cancha c ON r.id_cancha = c.id_cancha
     JOIN tipo_cancha tc ON c.id_tipo_cancha = tc.id_tipo_cancha
     JOIN estado_reserva er ON r.id_estado_reserva = er.id_estado_reserva
     ORDER BY r.fecha_creacion DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener reservas' });
      res.json(results);
    }
  );
});

// ─── ADMIN: Cambiar estado reserva ──────────────────────────────────
app.put('/api/admin/reservas/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  const { id_estado_reserva } = req.body;
  db.query(
    'UPDATE reserva SET id_estado_reserva = ? WHERE id_reserva = ?',
    [id_estado_reserva, id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al actualizar reserva' });
      res.json({ mensaje: '✅ Reserva actualizada' });
    }
  );
});

// ─── ADMIN: Todas las canchas ────────────────────────────────────────
app.get('/api/admin/canchas', verificarToken, (req, res) => {
  db.query(
    `SELECT c.id_cancha, c.nombre_cancha, c.descripcion, c.precio_por_hora,
            c.tipo_cesped, c.id_sede, c.id_estado_cancha,
            tc.nombre_tipo, tc.nombre_jugadores, tc.dimensiones,
            ec.nombre_estado, s.nombre_sede
     FROM cancha c
     JOIN tipo_cancha tc ON c.id_tipo_cancha = tc.id_tipo_cancha
     JOIN estado_cancha ec ON c.id_estado_cancha = ec.id_estado_cancha
     LEFT JOIN sede s ON c.id_sede = s.id_sede`,
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener canchas' });
      res.json(results);
    }
  );
});

// ─── ADMIN: Cambiar estado cancha ────────────────────────────────────
app.put('/api/admin/canchas/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  const { id_estado_cancha } = req.body;
  db.query(
    'UPDATE cancha SET id_estado_cancha = ? WHERE id_cancha = ?',
    [id_estado_cancha, id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al actualizar cancha' });
      res.json({ mensaje: '✅ Cancha actualizada' });
    }
  );
});

// ─── ADMIN: Usuarios ─────────────────────────────────────────────────
app.get('/api/admin/usuarios', verificarToken, (req, res) => {
  db.query(
    `SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.telefono, 
            u.fecha_registro, tu.nombre_tipo
     FROM usuario u
     JOIN tipo_usuario tu ON u.id_tipo_usuario = tu.id_tipo_usuario
     ORDER BY u.fecha_registro DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener usuarios' });
      res.json(results);
    }
  );
});

// ─── ADMIN: Petos e inventario ───────────────────────────────────────
app.get('/api/admin/petos', verificarToken, (req, res) => {
  db.query(
    `SELECT p.id_prestamo, p.cantidad_prestada, p.fecha_prestamo, p.fecha_devolucion,
            i.color, i.talla, i.cantidad_disponible,
            ep.nombre_estado,
            r.fecha_reserva, u.nombre, u.apellido
     FROM prestamo_peto p
     JOIN inventario_peto i ON p.id_inventario = i.id_inventario
     JOIN estado_prestamo ep ON p.id_estado_prestamo = ep.id_estado_prestamo
     JOIN reserva r ON p.id_reserva = r.id_reserva
     JOIN usuario u ON r.id_usuario = u.id_usuario
     ORDER BY p.fecha_prestamo DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener petos' });
      res.json(results);
    }
  );
});

// ─── MIS RESERVAS ────────────────────────────────────────────────────
app.get('/api/mis-reservas', verificarToken, (req, res) => {
  const id_usuario = req.usuario.id;

  db.query(
    `SELECT r.id_reserva, r.fecha_reserva, r.hora_inicio, r.hora_fin, r.monto_total,
            c.nombre_cancha, tc.nombre_tipo,
            er.nombre_estado,
            pp.cantidad_prestada, ip.color, ip.talla
     FROM reserva r
     JOIN cancha c ON r.id_cancha = c.id_cancha
     JOIN tipo_cancha tc ON c.id_tipo_cancha = tc.id_tipo_cancha
     JOIN estado_reserva er ON r.id_estado_reserva = er.id_estado_reserva
     LEFT JOIN prestamo_peto pp ON pp.id_reserva = r.id_reserva
     LEFT JOIN inventario_peto ip ON pp.id_inventario = ip.id_inventario
     WHERE r.id_usuario = ?
     ORDER BY r.fecha_creacion DESC`,
    [id_usuario],
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener reservas' });
      res.json(results);
    }
  );
});

// ─── CANCELAR MI RESERVA ─────────────────────────────────────────────
app.put('/api/mis-reservas/:id/cancelar', verificarToken, (req, res) => {
  const id_usuario = req.usuario.id;
  const { id } = req.params;

  db.query(
    `UPDATE reserva SET id_estado_reserva = 3 
     WHERE id_reserva = ? AND id_usuario = ? AND id_estado_reserva = 1`,
    [id, id_usuario],
    (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al cancelar' });
      if (result.affectedRows === 0) return res.status(400).json({ mensaje: 'No se puede cancelar esta reserva' });
      res.json({ mensaje: '✅ Reserva cancelada' });
    }
  );
});
app.get('/', (req, res) => {
  res.redirect('/formulario.html');
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});