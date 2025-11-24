import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();

type RouteModule = Record<string, (...args: unknown[]) => Promise<Response>>;
const METHOD_NAMES = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

function loadRouteModules() {
  return import.meta.glob('../src/app/api/**/route.js', {
    eager: true,
  }) as Record<string, RouteModule>;
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace('../src/app/api', '');
}

function getHonoPath(routeIdentifier: string): { name: string; pattern: string }[] {
  const relativePath = normalizeRoutePath(routeIdentifier);
  const parts = relativePath.split('/').filter(Boolean);
  const routeParts = parts.slice(0, -1);
  if (routeParts.length === 0) {
    return [{ name: 'root', pattern: '' }];
  }
  return routeParts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [, dots, param] = match;
      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }
    return { name: segment, pattern: segment };
  });
}

async function registerRoutes() {
  const routeModules = loadRouteModules();
  const entries = Object.entries(routeModules).sort((a, b) => b[0].length - a[0].length);

  const rootIndex = entries.findIndex(
    ([path]) => normalizeRoutePath(path) === '/route.js'
  );
  if (rootIndex > -1) {
    const [rootEntry] = entries.splice(rootIndex, 1);
    entries.unshift(rootEntry);
  }

  api.routes = [];

  for (const [routePath, routeModule] of entries) {
    for (const method of METHOD_NAMES) {
      const handlerImpl = routeModule[method];
      if (!handlerImpl) continue;

      const parts = getHonoPath(routePath);
      const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
      const handler: Handler = async (c) => {
        const params = c.req.param();
        return handlerImpl(c.req.raw, { params });
      };

      switch (method) {
        case 'GET':
          api.get(honoPath, handler);
          break;
        case 'POST':
          api.post(honoPath, handler);
          break;
        case 'PUT':
          api.put(honoPath, handler);
          break;
        case 'DELETE':
          api.delete(honoPath, handler);
          break;
        case 'PATCH':
          api.patch(honoPath, handler);
          break;
      }
    }
  }
}

await registerRoutes();

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    registerRoutes().catch((err) => {
      console.error('Error reloading routes:', err);
    });
  });
}

export { api, API_BASENAME };
