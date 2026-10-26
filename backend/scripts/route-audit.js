// backend/scripts/route-audit.js
// Walk Express router stack and audit every route and middleware for security compliance.

process.env.NODE_ENV = 'test';
const app = require('../src/server');

const router = app.router || app._router;
if (!router || !router.stack) {
  console.error('❌ Express router stack not found.');
  process.exit(1);
}

// Fixed prefix mappings based on server.js mount order and matchers
const KNOWN_MOUNTS = [
  { prefix: '/api/reports/export', name: 'reportExportRoutes' },
  { prefix: '/api/auth', name: 'authRoutes' },
  { prefix: '/api/rooms', name: 'roomRoutes' },
  { prefix: '/api/reservations', name: 'reservationRoutes' },
  { prefix: '/api/reports', name: 'reportRoutes' },
  { prefix: '/api/users', name: 'usersRoutes' },
  { prefix: '/api/customers', name: 'customersRoutes' },
  { prefix: '/api/upload', name: 'uploadRoutes' },
  { prefix: '/api/calendar', name: 'calendarRoutes' },
  { prefix: '/api/pricing', name: 'pricingRoutes' },
  { prefix: '/api/reviews', name: 'reviewsRoutes' },
  { prefix: '/api/public', name: 'publicRoutes' },
  { prefix: '/api/frontdesk', name: 'frontdeskRoutes' },
];

function getMiddlewareName(fn) {
  if (!fn) return 'anonymous';
  if (typeof fn === 'function') {
    if (fn.name && fn.name !== '<anonymous>' && fn.name !== 'handle') {
      return fn.name;
    }
    if (fn.roles && Array.isArray(fn.roles)) {
      return `requireRole(${fn.roles.join(',')})`;
    }
  }
  return fn.name || 'anonymous';
}

function hasVerifyToken(middlewares) {
  return middlewares.some((m) => m === 'verifyToken' || m.includes('verifyToken'));
}

function hasAdminCheck(middlewares) {
  return middlewares.some((m) => {
    if (m === 'requireRole(admin)' || m.includes('requireRole(admin)')) return true;
    if (m.startsWith('requireRole(')) {
      const inside = m.slice('requireRole('.length, -1);
      const roles = inside.split(',').map((r) => r.trim());
      return roles.length === 1 && roles[0] === 'admin';
    }
    return false;
  });
}

function isPublicRoute(method, fullPath) {
  if (fullPath.startsWith('/api/public')) return true;
  if (method === 'POST' && fullPath === '/api/auth/login') return true;
  if (method === 'POST' && fullPath === '/api/auth/register') return true;
  if (method === 'GET' && fullPath === '/api/health') return true;
  return false;
}

const collectedRoutes = [];

function inspectRouter(r, basePrefix, parentMiddlewares = []) {
  const routerMiddlewares = [...parentMiddlewares];

  for (const layer of r.stack) {
    // Router-level middleware
    if (!layer.route && layer.handle && !layer.handle.stack) {
      const mwName = getMiddlewareName(layer.handle);
      if (mwName !== 'router' && mwName !== 'corsMiddleware' && mwName !== 'helmetMiddleware') {
        routerMiddlewares.push(mwName);
      }
    }
  }

  for (const layer of r.stack) {
    if (layer.route) {
      const routePath = layer.route.path;
      const fullPath = (basePrefix + (routePath === '/' ? '' : routePath)).replace(/\/+/g, '/');
      const methods = Object.keys(layer.route.methods || {})
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());

      const routeMiddlewares = (layer.route.stack || []).map((s) => getMiddlewareName(s.handle));
      const combinedMiddlewares = [...routerMiddlewares, ...routeMiddlewares];

      for (const method of methods) {
        collectedRoutes.push({
          method,
          path: fullPath,
          middlewares: combinedMiddlewares,
        });
      }
    } else if (layer.handle && layer.handle.stack) {
      // Sub-router
      let subPrefix = basePrefix;
      for (const km of KNOWN_MOUNTS) {
        if (layer.matchers && layer.matchers.some((m) => m(km.prefix))) {
          if (!basePrefix || km.prefix.startsWith(basePrefix)) {
            subPrefix = km.prefix;
            break;
          }
        }
      }
      inspectRouter(layer.handle, subPrefix, routerMiddlewares);
    }
  }
}

// 1. Process top-level stack
for (const layer of router.stack) {
  if (layer.route) {
    const routePath = layer.route.path;
    const methods = Object.keys(layer.route.methods || {})
      .filter((m) => layer.route.methods[m])
      .map((m) => m.toUpperCase());
    const routeMiddlewares = (layer.route.stack || []).map((s) => getMiddlewareName(s.handle));

    for (const method of methods) {
      collectedRoutes.push({
        method,
        path: routePath,
        middlewares: routeMiddlewares,
      });
    }
  } else if (layer.handle && layer.handle.stack) {
    let matchedPrefix = null;
    for (const km of KNOWN_MOUNTS) {
      if (layer.matchers && layer.matchers.some((m) => m(km.prefix))) {
        matchedPrefix = km.prefix;
        break;
      }
    }
    if (matchedPrefix) {
      inspectRouter(layer.handle, matchedPrefix, []);
    }
  }
}

// Sort routes deterministically by path and method
collectedRoutes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

// Deduplicate exact same (method, path) entries if any duplicate router mount
const uniqueRoutes = [];
const seenKey = new Set();
for (const r of collectedRoutes) {
  const key = `${r.method} ${r.path}`;
  if (!seenKey.has(key)) {
    seenKey.add(key);
    uniqueRoutes.push(r);
  }
}

console.log('='.repeat(95));
console.log('  LUXESTAY EXPRESS ROUTE SECURITY AUDIT');
console.log('='.repeat(95));
console.log(
  'METHOD'.padEnd(8) +
  'ROUTE'.padEnd(38) +
  'PUBLIC?'.padEnd(10) +
  'MIDDLEWARE CHAIN'
);
console.log('-'.repeat(95));

let hasErrors = false;
const errorLog = [];

for (const r of uniqueRoutes) {
  const isPublic = isPublicRoute(r.method, r.path);
  const mwList = r.middlewares.join(' -> ');
  const statusStr = isPublic ? '[PUBLIC]' : '[PROTECTED]';

  console.log(
    r.method.padEnd(8) +
    r.path.padEnd(38) +
    statusStr.padEnd(12) +
    mwList
  );

  // Check 1: Public routes must be EXACTLY those under /api/public plus POST /api/auth/login, POST /api/auth/register, GET /api/health
  if (isPublic) {
    const validPublic =
      r.path.startsWith('/api/public') ||
      (r.method === 'POST' && r.path === '/api/auth/login') ||
      (r.method === 'POST' && r.path === '/api/auth/register') ||
      (r.method === 'GET' && r.path === '/api/health');

    if (!validPublic) {
      hasErrors = true;
      errorLog.push(`❌ Unauthorized public route: ${r.method} ${r.path}`);
    }
  }

  // Check 2: Non-public routes MUST have verifyToken
  if (!isPublic) {
    if (!hasVerifyToken(r.middlewares)) {
      hasErrors = true;
      errorLog.push(`❌ Non-public route lacks verifyToken: ${r.method} ${r.path}`);
    }
  }

  // Check 3: Any route under /api/users, /api/reports, /api/pricing, /api/upload MUST have admin-only check
  const requiresAdminOnly =
    r.path.startsWith('/api/users') ||
    r.path.startsWith('/api/reports') ||
    r.path.startsWith('/api/pricing') ||
    r.path.startsWith('/api/upload');

  if (requiresAdminOnly) {
    if (!hasAdminCheck(r.middlewares)) {
      hasErrors = true;
      errorLog.push(`❌ Admin-only route lacks requireRole('admin'): ${r.method} ${r.path}`);
    }
  }
}

console.log('='.repeat(95));
console.log(`Total endpoints audited: ${uniqueRoutes.length}`);

if (hasErrors) {
  console.error('\n🚨 ROUTE AUDIT FAILED:');
  for (const err of errorLog) {
    console.error(`  ${err}`);
  }
  process.exit(1);
} else {
  console.log('\n✅ ROUTE AUDIT PASSED: All non-public routes have verifyToken, all admin areas strictly enforced, and public routes strictly bounded.');
  process.exit(0);
}
