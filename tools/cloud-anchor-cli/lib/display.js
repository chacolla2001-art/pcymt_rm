/**
 * lib/display.js — Utilidades de visualización (chalk + cli-table3)
 */

'use strict';

const chalk = require('chalk');
const Table = require('cli-table3');

// ── Date formatter ────────────────────────────────────────────────────────────

function formatDate(d) {
  if (!d || isNaN(d)) return chalk.gray('--');
  const date = d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function daysUntil(d) {
  if (!d) return null;
  const diff = d - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ── Banner ────────────────────────────────────────────────────────────────────

function printBanner() {
  console.log(chalk.blue.bold(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  🦎  ADMINISTRADOR DE ANCHOR POINTS — PCyMT RM               ║
║                                                               ║
║     Parque de las Culturas y la Madre Tierra                  ║
║     Mi Teleférico — La Paz, Bolivia                            ║
║                                                               ║
║  Google Cloud Project: pedrochacolla-488420                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`));
}

// ── Section headers ───────────────────────────────────────────────────────────

function printHeader(title) {
  const line = '═'.repeat(title.length + 6);
  console.log('\n' + chalk.bgBlue.white.bold(` ═══ ${title} ═══ `) + '\n');
}

function printError(msg) {
  console.log('\n' + chalk.red.bold('❌  ') + chalk.red(msg));
}

function printSuccess(msg) {
  console.log(chalk.green.bold('✅  ') + chalk.green(msg));
}

function printInfo(msg) {
  console.log(chalk.cyan('ℹ️   ') + msg);
}

function printWarning(msg) {
  console.log(chalk.yellow.bold('⚠️   ') + chalk.yellow(msg));
}

// ── ARCore anchors table ──────────────────────────────────────────────────────

/**
 * Genera tabla de cloud anchors con referencia cruzada a la BD.
 * @param {object[]} anchors - Lista de anchors de ARCore
 * @param {object[]} dbLocations - Lista de locations de la BD (para cross-ref)
 */
function anchorTable(anchors, dbLocations = []) {
  // Build lookup: anchorCode → db location (handles "ua:" prefix variants)
  const dbMap = {};
  for (const loc of dbLocations) {
    const code = loc.anchorCode ?? loc.anchor_code;
    if (code) {
      dbMap[code] = loc;
      // Also index without "ua:" prefix
      if (code.startsWith('ua:')) dbMap[code.slice(3)] = loc;
      else dbMap['ua:' + code] = loc;
    }
  }

  const now = new Date();

  const table = new Table({
    head: [
      chalk.cyan('#'),
      chalk.cyan('Anchor ID (Cloud ARCore)'),
      chalk.cyan('Creado'),
      chalk.cyan('Vence'),
      chalk.cyan('Días restantes'),
      chalk.cyan('En BD (location)'),
      chalk.cyan('Estado'),
    ],
    colWidths: [4, 38, 18, 18, 16, 26, 11],
    wordWrap: false,
    style: { head: [], border: [] },
  });

  anchors.forEach((anchor, idx) => {
    const id = anchor.name.split('/').pop();
    const expireDate = new Date(anchor.expireTime);
    const createDate = new Date(anchor.createTime);
    const lastLoc = anchor.lastLocalizeTime ? new Date(anchor.lastLocalizeTime) : null;
    const isExpired = expireDate < now;
    const days = daysUntil(expireDate);

    const dbLoc = dbMap[id] ?? null;

    // ID display (truncated)
    const idStr = id.length > 35 ? id.substring(0, 35) + '…' : id;
    const idDisplay = isExpired ? chalk.red(idStr) : chalk.green(idStr);

    // Days remaining
    let daysDisplay;
    if (isExpired) daysDisplay = chalk.red(`hace ${Math.abs(days)}d`);
    else if (days <= 2) daysDisplay = chalk.yellow(`${days}d`);
    else daysDisplay = chalk.green(`${days}d`);

    // DB cross-reference
    const dbDisplay = dbLoc
      ? chalk.yellow(dbLoc.name?.substring(0, 23) ?? dbLoc.id?.substring(0, 22))
      : chalk.gray('—');

    const statusLabel = isExpired ? chalk.red.bold('EXPIRADO') : chalk.green.bold('ACTIVO');

    table.push([
      chalk.gray(idx + 1),
      idDisplay,
      formatDate(createDate),
      isExpired ? chalk.red(formatDate(expireDate)) : chalk.green(formatDate(expireDate)),
      daysDisplay,
      dbDisplay,
      statusLabel,
    ]);
  });

  return table.toString();
}

// ── DB locations table ────────────────────────────────────────────────────────

function dbLocationsTable(locations, ttlDays) {
  const showExpiry = !!ttlDays;
  const head = [
    chalk.cyan('#'),
    chalk.cyan('Nombre'),
    chalk.cyan('Sección'),
    chalk.cyan('Anchor Code (ARCore)'),
    chalk.cyan('Animal / Asset'),
  ];
  const colWidths = [4, 22, 17, 38, 22];
  if (showExpiry) {
    head.push(chalk.cyan('Expiración'));
    colWidths.push(22);
  }

  const table = new Table({
    head,
    colWidths,
    wordWrap: false,
    style: { head: [], border: [] },
  });

  const now = new Date();

  locations.forEach((loc, idx) => {
    const code = loc.anchorCode ?? loc.anchor_code;
    const asset = loc.virtualAsset?.name ?? loc.VirtualAsset?.name ?? loc.virtual_asset?.name ?? '—';
    const section = loc.section ?? (loc.sectionId ? `Sección ${loc.sectionId}` : '—');

    const codeDisplay = code
      ? chalk.yellow(code.length > 35 ? code.substring(0, 35) + '…' : code)
      : chalk.gray('(sin cloud anchor)');

    const row = [
      chalk.gray(idx + 1),
      loc.name ?? '—',
      section,
      codeDisplay,
      asset,
    ];

    if (showExpiry && code && code.startsWith('ua-')) {
      const created = new Date(loc.createdAt ?? loc.created_at ?? loc.updatedAt ?? loc.updated_at);
      const expire = new Date(created.getTime() + ttlDays * 24 * 60 * 60 * 1000);
      const days = Math.floor((expire - now) / (1000 * 60 * 60 * 24));
      if (days < 0) {
        row.push(chalk.red('EXPIRADO (hace ' + Math.abs(days) + 'd)'));
      } else if (days <= 2) {
        row.push(chalk.yellow(formatDate(expire) + ' (' + days + 'd)'));
      } else {
        row.push(chalk.green(formatDate(expire) + ' (' + days + 'd)'));
      }
    } else if (showExpiry) {
      row.push(chalk.gray(code ? 'N/A (no AR)' : '—'));
    }

    table.push(row);
  });

  return table.toString();
}

// ── Cloud Anchor Status table (solo anchors reales de ARCore) ─────────────────

function cloudStatusTable(locations, ttlDays) {
  const now = new Date();

  const table = new Table({
    head: [
      chalk.cyan('#'),
      chalk.cyan('Anchor Code'),
      chalk.cyan('Ubicación'),
      chalk.cyan('Animal'),
      chalk.cyan('Creado'),
      chalk.cyan('Expira'),
      chalk.cyan('Días'),
      chalk.cyan('Estado'),
    ],
    colWidths: [4, 38, 20, 20, 18, 18, 7, 12],
    wordWrap: false,
    style: { head: [], border: [] },
  });

  const arLocs = locations.filter(l => {
    const code = l.anchorCode ?? l.anchor_code;
    return code && code.startsWith('ua-');
  });

  arLocs.forEach((loc, idx) => {
    const code = loc.anchorCode ?? loc.anchor_code;
    const asset = loc.virtualAsset?.name ?? loc.VirtualAsset?.name ?? '—';
    const created = new Date(loc.createdAt ?? loc.created_at ?? loc.updatedAt ?? loc.updated_at);
    const expire = new Date(created.getTime() + ttlDays * 24 * 60 * 60 * 1000);
    const days = Math.floor((expire - now) / (1000 * 60 * 60 * 24));
    const isExpired = expire < now;

    const codeShort = code.length > 35 ? code.substring(0, 35) + '…' : code;

    table.push([
      chalk.gray(idx + 1),
      isExpired ? chalk.red(codeShort) : chalk.green(codeShort),
      loc.name ?? '—',
      asset,
      chalk.gray(formatDate(created)),
      isExpired ? chalk.red(formatDate(expire)) : chalk.yellow(formatDate(expire)),
      isExpired ? chalk.red(days + 'd') : (days <= 2 ? chalk.yellow(days + 'd') : chalk.green(days + 'd')),
      isExpired ? chalk.red.bold('EXPIRADO') : chalk.green.bold('ACTIVO'),
    ]);
  });

  return { table: table.toString(), total: arLocs.length, expired: arLocs.filter(l => { const c = new Date(l.createdAt ?? l.created_at ?? l.updatedAt ?? l.updated_at); return new Date(c.getTime() + ttlDays * 24*60*60*1000) < now; }).length };
}

// ── Sync comparison table ────────────────────────────────────────────────────

/**
 * Tabla comparativa BD ↔ ARCore.
 * @param {Array<{name, anchorCode, foundInCloud, isExpired}>} comparisons
 */
function syncTable(comparisons) {
  const table = new Table({
    head: [
      chalk.cyan('Location (BD)'),
      chalk.cyan('anchor_code'),
      chalk.cyan('En ARCore'),
      chalk.cyan('Estado'),
      chalk.cyan('Acción recomendada'),
    ],
    colWidths: [22, 34, 12, 12, 28],
    wordWrap: false,
    style: { head: [], border: [] },
  });

  for (const c of comparisons) {
    const codeShort = c.anchorCode
      ? (c.anchorCode.length > 31 ? c.anchorCode.substring(0, 31) + '…' : c.anchorCode)
      : chalk.gray('—');

    let inCloud, estado, accion;

    if (!c.anchorCode) {
      inCloud = chalk.gray('N/A');
      estado  = chalk.gray('Sin anchor');
      accion  = chalk.gray('Colocar anchor desde la app');
    } else if (!c.foundInCloud) {
      inCloud = chalk.red('✗ No');
      estado  = chalk.red('HUÉRFANO');
      accion  = chalk.red('Limpiar anchor_code de BD');
    } else if (c.isExpired) {
      inCloud = chalk.green('✓ Sí');
      estado  = chalk.yellow('EXPIRADO');
      accion  = chalk.yellow('Re-anclar en la app AR');
    } else {
      inCloud = chalk.green('✓ Sí');
      estado  = chalk.green('ACTIVO');
      accion  = chalk.green('✓ OK');
    }

    table.push([c.name ?? '—', codeShort, inCloud, estado, accion]);
  }

  return table.toString();
}

// ── ARCore raw data table (sin cruce con BD, muestra todos los campos reales) ─

/**
 * Muestra los datos originales de la ARCore Management API sin truncar.
 * Cada anchor se muestra como un bloque de detalles.
 * @param {object[]} anchors  Respuesta directa de la API de Google ARCore
 */
function anchorTableRaw(anchors) {
  if (!anchors || anchors.length === 0) return chalk.gray('  (sin anchors)');

  const now   = new Date();
  const lines = [];
  const DIV   = chalk.gray('  ' + '─'.repeat(78));

  anchors.forEach((anchor, idx) => {
    const fullId   = anchor.name ?? '—';
    const shortId  = fullId.split('/').pop() ?? fullId;
    const isExpired = anchor.expireTime ? new Date(anchor.expireTime) < now : false;
    const days      = anchor.expireTime ? daysUntil(new Date(anchor.expireTime)) : null;

    const numColor  = isExpired ? chalk.red.bold : chalk.green.bold;
    const idColor   = isExpired ? chalk.red      : chalk.yellow;
    const stLabel   = isExpired ? chalk.red.bold('EXPIRADO') : chalk.green.bold('ACTIVO');

    let daysStr = '—';
    if (days !== null) {
      if (isExpired)  daysStr = chalk.red(`hace ${Math.abs(days)} día(s)`);
      else if (days <= 2) daysStr = chalk.yellow(`${days} día(s)`);
      else            daysStr = chalk.green(`${days} día(s)`);
    }

    lines.push(DIV);
    lines.push(
      '  ' + numColor(`[${idx + 1}]`) +
      '  Estado: ' + stLabel +
      (days !== null ? '   ' + daysStr : '')
    );

    // Mostramos el recurso completo (ej. "management/anchors/ua:XXXX...")
    lines.push('  ' + chalk.cyan('Recurso:       ') + chalk.gray(fullId));
    lines.push('  ' + chalk.cyan('Anchor ID:     ') + idColor(shortId));

    lines.push(
      '  ' + chalk.cyan('Creado:        ') +
      (anchor.createTime
        ? chalk.white(formatDate(new Date(anchor.createTime))) +
          chalk.gray('  [' + anchor.createTime + ']')
        : chalk.gray('—'))
    );
    lines.push(
      '  ' + chalk.cyan('Vence:         ') +
      (anchor.expireTime
        ? (isExpired ? chalk.red : chalk.green)(formatDate(new Date(anchor.expireTime))) +
          chalk.gray('  [' + anchor.expireTime + ']')
        : chalk.gray('—'))
    );
    lines.push(
      '  ' + chalk.cyan('TTL máximo:    ') +
      (anchor.maximumExpireTime
        ? chalk.white(formatDate(new Date(anchor.maximumExpireTime))) +
          chalk.gray('  [' + anchor.maximumExpireTime + ']')
        : chalk.gray('—  (no disponible)'))
    );
    lines.push(
      '  ' + chalk.cyan('Último uso:    ') +
      (anchor.lastLocalizeTime
        ? chalk.white(formatDate(new Date(anchor.lastLocalizeTime))) +
          chalk.gray('  [' + anchor.lastLocalizeTime + ']')
        : chalk.gray('—  (nunca localizado)'))
    );
  });

  lines.push(DIV);
  return lines.join('\n');
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  printBanner,
  printHeader,
  printError,
  printSuccess,
  printInfo,
  printWarning,
  anchorTable,
  anchorTableRaw,
  dbLocationsTable,
  cloudStatusTable,
  syncTable,
  formatDate,
};
