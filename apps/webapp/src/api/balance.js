import { request } from './client.js';

export async function getBalance(token) {
  return request('GET', '/balance', { token });
}
