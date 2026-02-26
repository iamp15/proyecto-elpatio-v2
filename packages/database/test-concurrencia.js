/**
 * Script de prueba de concurrencia atómica.
 *
 * Verifica que el sistema de transacciones garantice que dos intentos
 * simultáneos de gastar -7 piedras con saldo de 10 produzcan:
 *   - 1 transacción COMPLETED (quedan 3 piedras)
 *   - 1 error SALDO_INSUFICIENTE
 *   - Saldo final exactamente 3 piedras (nunca -4)
 *
 * Uso:
 *   node packages/database/test-concurrencia.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB, createTransaction, User, mongoose } = require('./index');

const TEST_USER_ID = 99999999; // ID de Telegram ficticio solo para esta prueba
const SALDO_INICIAL_SUBUNITS = 1000; // 10 piedras
const APUESTA_SUBUNITS = -700;       // -7 piedras

// ─── Helpers visuales ─────────────────────────────────────────────────────────

const OK   = '\x1b[32m✔\x1b[0m';
const FAIL = '\x1b[31m✘\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';

function log(icon, msg) { console.log(`  ${icon}  ${msg}`); }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error(`\n${FAIL} No se encontró MONGO_URI en las variables de entorno.`);
    console.error(`     Crea un archivo .env en la raíz del proyecto con MONGO_URI=...\n`);
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PRUEBA DE CONCURRENCIA — Transacciones Atómicas');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await connectDB(uri);

  // ── PASO 1: preparar usuario de prueba con saldo exacto ─────────────────────
  console.log('[ PASO 1 ] Preparar usuario de prueba\n');

  await User.findOneAndUpdate(
    { _id: TEST_USER_ID },
    { $set: { balance_subunits: SALDO_INICIAL_SUBUNITS, username: 'ConcurrencyTester' } },
    { upsert: true, new: true },
  );

  const antes = await User.findById(TEST_USER_ID).lean();
  log(OK, `Usuario #${TEST_USER_ID} listo. Saldo: ${antes.balance_subunits / 100} piedras (${antes.balance_subunits} sub-unidades)`);

  // ── PASO 2: dos transacciones simultáneas de -7 piedras ─────────────────────
  console.log('\n[ PASO 2 ] Lanzar 2 transacciones simultáneas de -7 piedras\n');
  log(INFO, 'Ejecutando Promise.all([tx1, tx2]) en paralelo...\n');

  const resultados = await Promise.allSettled([
    createTransaction({ userId: TEST_USER_ID, amount_subunits: APUESTA_SUBUNITS, type: 'BET' }),
    createTransaction({ userId: TEST_USER_ID, amount_subunits: APUESTA_SUBUNITS, type: 'BET' }),
  ]);

  const [r1, r2] = resultados;

  console.log('  Transacción 1:');
  if (r1.status === 'fulfilled') {
    log(OK, `COMPLETED — balance_after: ${r1.value.balance_after_subunits / 100} piedras`);
  } else {
    log(FAIL, `RECHAZADA — ${r1.reason.message}`);
  }

  console.log('\n  Transacción 2:');
  if (r2.status === 'fulfilled') {
    log(OK, `COMPLETED — balance_after: ${r2.value.balance_after_subunits / 100} piedras`);
  } else {
    log(FAIL, `RECHAZADA — ${r2.reason.message}`);
  }

  // ── PASO 3: verificar estado final ──────────────────────────────────────────
  console.log('\n[ PASO 3 ] Verificar resultado final\n');

  const completadas = resultados.filter(r => r.status === 'fulfilled').length;
  const rechazadas  = resultados.filter(r => r.status === 'rejected').length;
  const saldoInsuficiente = resultados.filter(
    r => r.status === 'rejected' && r.reason?.code === 'SALDO_INSUFICIENTE'
  ).length;

  const despues = await User.findById(TEST_USER_ID).lean();
  const saldoFinal = despues.balance_subunits;

  const pruebaCompletadas = completadas === 1;
  const pruebaRechazadas  = rechazadas === 1;
  const pruebaError       = saldoInsuficiente === 1;
  const pruebaSaldo       = saldoFinal === 300; // exactamente 3 piedras

  log(pruebaCompletadas ? OK : FAIL, `Transacciones completadas: ${completadas} (esperado 1)`);
  log(pruebaRechazadas  ? OK : FAIL, `Transacciones rechazadas:  ${rechazadas} (esperado 1)`);
  log(pruebaError       ? OK : FAIL, `Error SALDO_INSUFICIENTE:  ${saldoInsuficiente} (esperado 1)`);
  log(pruebaSaldo       ? OK : FAIL, `Saldo final: ${saldoFinal / 100} piedras (esperado 3, nunca -4)`);

  const todoPasó = pruebaCompletadas && pruebaRechazadas && pruebaError && pruebaSaldo;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (todoPasó) {
    console.log(`  ${OK}  \x1b[32mTODAS LAS PRUEBAS PASARON — El sistema es atómico.\x1b[0m`);
  } else {
    console.log(`  ${FAIL}  \x1b[31mALGUNA PRUEBA FALLÓ — Revisar la lógica de transacciones.\x1b[0m`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Limpieza: eliminar el usuario de prueba para no contaminar la DB
  await User.deleteOne({ _id: TEST_USER_ID });
  log(INFO, `Usuario de prueba #${TEST_USER_ID} eliminado.`);
}

main()
  .catch(err => {
    console.error(`\n${FAIL} Error inesperado:`, err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
    console.log(`\n  ${INFO}  Conexión cerrada.\n`);
    process.exit(0);
  });
