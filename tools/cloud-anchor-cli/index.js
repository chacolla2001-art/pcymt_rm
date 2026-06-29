#!/usr/bin/env node
/**
 * index.js -- Administrador ARCore Cloud Anchors
 *
 * PCyMT RM -- Parque de las Culturas y la Madre Tierra
 * Mi Teleferico -- La Paz, Bolivia
 *
 * Solo operaciones via ARCore Management API (Google Cloud)
 */

'use strict';

require('dotenv').config();

const inquirer = require('inquirer');
const chalk    = require('chalk');

const backend      = require('./lib/backend');
const display      = require('./lib/display');
const auth         = require('./lib/auth');
const ArcoreClient = require('./lib/arcore');

const BACKEND_URL = process.env.BACKEND_URL  || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL  || 'chacolla43@gmail.com';
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'Cybercenter1';

// Estado de conexiÃ³n al backend (lazy)
let _backendConnected = false;

// =============================================================================
// INICIO
// =============================================================================

async function main() {
  console.clear();
  display.printBanner();

  if (!auth.isConfigured()) {
    display.printError('Service Account no configurada.');
    console.log(chalk.yellow('\n  Necesitas un archivo service-account.json en esta carpeta.'));
    console.log(chalk.gray('  Ver README.md para instrucciones de configuracion.'));
    process.exit(1);
  }

  const info = auth.getServiceAccountInfo();
  if (info) {
    display.printSuccess('Service Account: ' + chalk.white(info.email));
    display.printSuccess('Proyecto GCP:    ' + chalk.white(info.projectId));
  }

  console.log('');
  await mainMenu();
}

// =============================================================================
// MENU PRINCIPAL â€” Solo ARCore Management API
// =============================================================================

async function mainMenu() {
  while (true) {
    console.log('\n' + chalk.bgBlue.white.bold('  ARCore Management API â€” Google Cloud  '));

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Selecciona una opcion:',
      choices: [
        { name: '\u2601\uFE0F   Listar Cloud Anchors', value: 'api-list' },
        { name: '\u23F3  Extender TTL de Cloud Anchors', value: 'api-extend' },
        { name: '\u{1F5D1}\uFE0F   Eliminar anchor de ARCore Cloud', value: 'api-delete' },
        { name: '\u{1F504}  Sincronizar BD \u2194 ARCore Cloud', value: 'api-sync' },
        new inquirer.Separator(),
        { name: '\u{1F6AA}  Salir', value: 'exit' },
      ],
    }]);

    try {
      if      (action === 'api-list')   await cmdApiList();
      else if (action === 'api-extend') await cmdApiExtend();
      else if (action === 'api-delete') await cmdApiDelete();
      else if (action === 'api-sync')   await cmdApiSync();
      else if (action === 'exit') {
        console.log(chalk.cyan('\n!Hasta luego!\n'));
        process.exit(0);
      }
    } catch (err) {
      display.printError(err.message);
      if (process.env.DEBUG) console.error(chalk.gray(err.stack));
    }

    await pressEnter();
  }
}

// =============================================================================
// HELPER: conexion lazy al backend (solo para sync y limpieza de BD)
// =============================================================================

async function tryConnectBackend() {
  if (_backendConnected) return true;
  try {
    backend.init(BACKEND_URL);
    const ok = await backend.checkAvailable();
    if (!ok) throw new Error('No responde');
    await backend.login(ADMIN_EMAIL, ADMIN_PASS);
    _backendConnected = true;
    display.printSuccess('Backend conectado: ' + BACKEND_URL);
    return true;
  } catch (err) {
    display.printWarning('Backend no disponible: ' + err.message);
    return false;
  }
}

// =============================================================================

// MANAGEMENT API COMMANDS (Google ARCore Cloud)
// =============================================================================

/**
 * Helper: connect to ARCore Management API with service account.
 * Returns ArcoreClient or null if not configured.
 */
async function getArcoreClient() {
  if (!auth.isConfigured()) {
    display.printError('Service Account no configurada.');
    console.log(chalk.yellow('\n  Para usar la ARCore Management API necesitas:'));
    console.log(chalk.white('  1. Ir a ') + chalk.cyan('https://console.cloud.google.com/iam-admin/serviceaccounts'));
    console.log(chalk.white('  2. Crear una Service Account'));
    console.log(chalk.white('  3. Darle el rol ') + chalk.yellow('"Service Account Token Creator"'));
    console.log(chalk.white('  4. Crear una key JSON y descargarla'));
    console.log(chalk.white('  5. Colocar el archivo como ') + chalk.cyan('service-account.json') + chalk.white(' en esta carpeta'));
    console.log(chalk.white('     O definir ') + chalk.cyan('SERVICE_ACCOUNT_PATH') + chalk.white(' en .env'));
    console.log(chalk.gray('\n  Tambien asegurate de tener la API "ARCore" habilitada en tu proyecto:'));
    console.log(chalk.cyan('  https://console.cloud.google.com/apis/library/arcore'));
    return null;
  }

  const info = auth.getServiceAccountInfo();
  if (info) {
    console.log(chalk.gray('  Service Account: ' + info.email));
    console.log(chalk.gray('  Proyecto: ' + info.projectId));
  }

  console.log(chalk.gray('  Obteniendo token con scope arcore.management...'));
  const token = await auth.getAccessToken();
  return new ArcoreClient(token);
}

// â”€â”€ API: Listar Cloud Anchors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function cmdApiList() {
  display.printHeader('Cloud Anchors â€” ARCore Management API');
  console.log(chalk.gray('Conectando con Google ARCore Cloud...\n'));

  const client = await getArcoreClient();
  if (!client) return;

  display.printInfo('Obteniendo todos los Cloud Anchors del proyecto...');
  const anchors = await client.getAllAnchors();

  if (anchors.length === 0) {
    display.printInfo('No hay Cloud Anchors en el proyecto de Google Cloud.');
    display.printInfo('(Puede que todos hayan expirado o que nunca se hospedaron.)');
    return;
  }

  console.log(display.anchorTableRaw(anchors));

  const now = new Date();
  const expired = anchors.filter(a => new Date(a.expireTime) < now).length;
  const active = anchors.length - expired;

  console.log('\n  ' + chalk.bold('Resumen:'));
  console.log('  Total Cloud Anchors: ' + chalk.white.bold(anchors.length));
  console.log('  Activos:             ' + chalk.green.bold(active));
  console.log('  Expirados:           ' + (expired > 0 ? chalk.red.bold(expired) : chalk.gray('0')));

  if (expired > 0) {
    console.log(chalk.yellow('\n  Los anchors expirados ya no pueden resolverse desde la app.'));
    console.log(chalk.gray('  Usa "Eliminar anchor de ARCore Cloud" para limpiarlos.'));
  }
}

// â”€â”€ API: Extender TTL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function cmdApiExtend() {
  display.printHeader('Extender TTL de Cloud Anchors');
  console.log(chalk.gray('Conectando con Google ARCore Cloud...\n'));

  const client = await getArcoreClient();
  if (!client) return;

  const anchors = await client.getAllAnchors();
  if (anchors.length === 0) {
    display.printInfo('No hay Cloud Anchors en el proyecto.');
    return;
  }

  const now = new Date();
  const extendable = anchors.filter(a => {
    const expire = new Date(a.expireTime);
    const maxExpire = new Date(a.maximumExpireTime);
    return expire < maxExpire && expire > now; // only active anchors that can be extended
  });

  if (extendable.length === 0) {
    display.printInfo('No hay anchors que se puedan extender.');
    display.printInfo('(Ya estan al maximo o ya expiraron â€” los expirados no se pueden revivir.)');
    return;
  }

  console.log(chalk.white.bold(`  ${extendable.length} anchor(s) pueden extenderse:\n`));

  const { mode } = await inquirer.prompt([{
    type: 'list',
    name: 'mode',
    message: 'Como deseas extender?',
    choices: [
      { name: 'Extender TODOS al maximo posible (' + extendable.length + ' anchors)', value: 'all' },
      { name: 'Seleccionar uno especifico', value: 'one' },
      { name: 'Cancelar', value: 'cancel' },
    ],
  }]);

  if (mode === 'cancel') return;

  if (mode === 'all') {
    let ok = 0, fail = 0;
    for (const a of extendable) {
      const id = a.name.split('/').pop();
      try {
        await client.updateAnchorTtl(id, a.maximumExpireTime);
        ok++;
        const maxDate = new Date(a.maximumExpireTime);
        console.log(chalk.green('  âœ“ ') + chalk.gray(id.substring(0, 35)) + chalk.green(' â†’ ' + display.formatDate(maxDate)));
      } catch (err) {
        fail++;
        console.log(chalk.red('  âœ— ') + chalk.gray(id.substring(0, 35)) + chalk.red(' â€” ' + err.message));
      }
    }
    console.log('');
    display.printSuccess(`${ok} anchor(s) extendidos al maximo TTL.`);
    if (fail > 0) display.printWarning(`${fail} anchor(s) fallaron.`);
  } else {
    // Pick one
    const choices = extendable.map(a => {
      const id = a.name.split('/').pop();
      const expire = new Date(a.expireTime);
      const maxExpire = new Date(a.maximumExpireTime);
      return {
        name: chalk.yellow(id.substring(0, 35) + 'â€¦') +
              chalk.gray(' vence: ') + display.formatDate(expire) +
              chalk.gray(' max: ') + display.formatDate(maxExpire),
        value: a,
      };
    });
    choices.push({ name: chalk.gray('<- Volver'), value: null });

    const { anchor } = await inquirer.prompt([{
      type: 'list',
      name: 'anchor',
      message: 'Selecciona el anchor:',
      choices,
      pageSize: 15,
    }]);
    if (!anchor) return;

    const id = anchor.name.split('/').pop();
    const updated = await client.updateAnchorTtl(id, anchor.maximumExpireTime);
    const newExpire = new Date(updated.expireTime);
    display.printSuccess('Anchor extendido hasta: ' + display.formatDate(newExpire));
  }
}

// â”€â”€ API: Eliminar anchor de ARCore Cloud â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function cmdApiDelete() {
  display.printHeader('Eliminar Cloud Anchor(s) de ARCore');
  console.log(chalk.gray('Conectando con Google ARCore Cloud...\n'));

  const client = await getArcoreClient();
  if (!client) return;

  const anchors = await client.getAllAnchors();
  if (anchors.length === 0) {
    display.printInfo('No hay Cloud Anchors en el proyecto.');
    return;
  }

  const now = new Date();

  const { mode } = await inquirer.prompt([{
    type: 'list',
    name: 'mode',
    message: `Hay ${anchors.length} anchor(s). Que deseas eliminar?`,
    choices: [
      { name: chalk.red('Eliminar TODOS los expirados (' + anchors.filter(a => new Date(a.expireTime) < now).length + ')'), value: 'expired' },
      { name: 'Seleccionar uno especifico', value: 'one' },
      { name: chalk.red.bold('Eliminar TODOS (' + anchors.length + ')'), value: 'all' },
      { name: 'Cancelar', value: 'cancel' },
    ],
  }]);

  if (mode === 'cancel') return;

  let toDelete = [];

  if (mode === 'expired') {
    toDelete = anchors.filter(a => new Date(a.expireTime) < now);
    if (toDelete.length === 0) {
      display.printInfo('No hay anchors expirados.');
      return;
    }
  } else if (mode === 'all') {
    toDelete = anchors;
  } else {
    const choices = anchors.map(a => {
      const id = a.name.split('/').pop();
      const expire = new Date(a.expireTime);
      const isExp = expire < now;
      const tag = isExp ? chalk.red('[EXPIRADO]') : chalk.green('[ACTIVO]');
      return {
        name: tag + ' ' + chalk.yellow(id.substring(0, 40)) + chalk.gray(' vence: ') + display.formatDate(expire),
        value: a,
      };
    });
    choices.push({ name: chalk.gray('<- Volver'), value: null });

    const { anchor } = await inquirer.prompt([{
      type: 'list',
      name: 'anchor',
      message: 'Selecciona el anchor a eliminar:',
      choices,
      pageSize: 18,
    }]);
    if (!anchor) return;
    toDelete = [anchor];
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: chalk.red(`Eliminar ${toDelete.length} anchor(s) de ARCore Cloud? (irreversible)`),
    default: false,
  }]);
  if (!confirm) return;

  const ids = toDelete.map(a => a.name.split('/').pop());

  if (ids.length > 1 && ids.length <= 1000) {
    // Use batch delete
    try {
      await client.batchDelete(ids);
      display.printSuccess(`${ids.length} anchor(s) eliminados de ARCore Cloud.`);
    } catch (err) {
      display.printWarning('Batch delete fallo, intentando uno por uno...');
      const result = await client.deleteMultiple(ids);
      display.printSuccess(`${result.success.length} eliminados, ${result.failed.length} fallaron.`);
    }
  } else {
    for (const id of ids) {
      try {
        await client.deleteAnchor(id);
        console.log(chalk.green('  âœ“ ') + chalk.gray(id.substring(0, 45)));
      } catch (err) {
        console.log(chalk.red('  âœ— ') + chalk.gray(id.substring(0, 45)) + chalk.red(' â€” ' + err.message));
      }
    }
    display.printSuccess('Operacion completada.');
  }

  // Offer to clean DB references
  const { cleanDb } = await inquirer.prompt([{
    type: 'confirm',
    name: 'cleanDb',
    message: 'Limpiar tambien los anchor_codes correspondientes de la base de datos?',
    default: true,
  }]);

  if (cleanDb) {
    const dbLocs = await backend.getAnchorPoints();
    const deletedSet = new Set(ids);
    let cleaned = 0;
    for (const loc of dbLocs) {
      const code = loc.anchorCode ?? loc.anchor_code;
      if (code && deletedSet.has(code)) {
        try {
          await backend.clearAnchorCode(loc.id);
          cleaned++;
        } catch { /* ignore */ }
      }
    }
    if (cleaned > 0) display.printSuccess(`${cleaned} anchor_code(s) limpiados de la BD.`);
    else display.printInfo('No habia referencias en la BD para limpiar.');
  }
}

// â”€â”€ API: Sincronizar BD â†” ARCore Cloud â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function cmdApiSync() {
  display.printHeader('Sincronizar BD \u2194 ARCore Cloud');
  console.log(chalk.gray('Conectando con Google ARCore Cloud...\n'));

  const client = await getArcoreClient();
  if (!client) return;

  display.printInfo('Obteniendo Cloud Anchors de Google...');
  const cloudAnchors = await client.getAllAnchors();

  display.printInfo('Conectando al backend para comparar con la BD...');
  const backendOk = await tryConnectBackend();
  if (!backendOk) {
    display.printWarning('Sin acceso al backend. Mostrando solo datos de ARCore:');
    console.log(display.anchorTableRaw(cloudAnchors));
    return;
  }

  const dbLocs = await backend.getAnchorPoints();

  const now = new Date();

  // Build cloud anchor lookup
  const cloudMap = {};
  for (const a of cloudAnchors) {
    const id = a.name.split('/').pop();
    cloudMap[id] = a;
  }

  // Compare
  const comparisons = [];
  for (const loc of dbLocs) {
    const code = loc.anchorCode ?? loc.anchor_code;
    if (!code) {
      comparisons.push({ name: loc.name, anchorCode: null, foundInCloud: false, isExpired: false });
      continue;
    }
    const cloud = cloudMap[code];
    if (!cloud) {
      comparisons.push({ name: loc.name, anchorCode: code, foundInCloud: false, isExpired: false });
    } else {
      const expired = new Date(cloud.expireTime) < now;
      comparisons.push({ name: loc.name, anchorCode: code, foundInCloud: true, isExpired: expired });
    }
  }

  // Cloud anchors NOT in DB
  const dbCodes = new Set(dbLocs.map(l => l.anchorCode ?? l.anchor_code).filter(Boolean));
  const orphanCloud = cloudAnchors.filter(a => !dbCodes.has(a.name.split('/').pop()));

  console.log(display.syncTable(comparisons));

  const orphanInDb  = comparisons.filter(c => c.anchorCode && !c.foundInCloud).length;
  const expiredInDb = comparisons.filter(c => c.foundInCloud && c.isExpired).length;
  const okCount     = comparisons.filter(c => c.foundInCloud && !c.isExpired).length;

  console.log('\n  ' + chalk.bold('Resumen de sincronizacion:'));
  console.log('  ' + chalk.green(okCount + ' OK') + chalk.gray(' â€” anchor en BD y activo en ARCore'));
  console.log('  ' + chalk.red(orphanInDb + ' huerfanos') + chalk.gray(' â€” en BD pero NO en ARCore (limpiar anchor_code)'));
  console.log('  ' + chalk.yellow(expiredInDb + ' expirados') + chalk.gray(' â€” en BD y ARCore pero vencidos'));
  console.log('  ' + chalk.cyan(orphanCloud.length + ' solo en cloud') + chalk.gray(' â€” en ARCore pero sin referencia en BD'));

  if (orphanInDb > 0) {
    const { clean } = await inquirer.prompt([{
      type: 'confirm',
      name: 'clean',
      message: chalk.yellow(`Limpiar ${orphanInDb} anchor_code(s) huerfanos de la BD?`),
      default: true,
    }]);
    if (clean) {
      let cleaned = 0;
      for (const c of comparisons.filter(x => x.anchorCode && !x.foundInCloud)) {
        const loc = dbLocs.find(l => (l.anchorCode ?? l.anchor_code) === c.anchorCode);
        if (loc) {
          try { await backend.clearAnchorCode(loc.id); cleaned++; } catch { /* skip */ }
        }
      }
      display.printSuccess(`${cleaned} anchor_code(s) limpiados.`);
    }
  }
}

// =============================================================================
// HELPERS
// =============================================================================

async function pressEnter() {
  await inquirer.prompt([{
    type: 'input',
    name: '_',
    message: chalk.gray('Presiona Enter para continuar...'),
    prefix: '',
  }]);
}

// =============================================================================
// START
// =============================================================================

main().catch(err => {
  console.error(chalk.red.bold('\nError fatal: ') + err.message);
  if (process.env.DEBUG) console.error(chalk.gray(err.stack));
  process.exit(1);
});
