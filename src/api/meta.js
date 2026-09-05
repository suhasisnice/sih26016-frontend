import { api } from './client';

export function enums(opts) {
  return api.get('/meta/enums', opts);
}

export function health(opts) {
  return api.get('/health', opts);
}
