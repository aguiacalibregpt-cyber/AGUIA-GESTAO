import Dexie, { Table } from 'dexie'
import { Client, ClientSchema } from '../types/models'

class AppDB extends Dexie {
  clients!: Table<Client>
  constructor() {
    super('aguia-gestao-db')
    this.version(1).stores({
      clients: 'id, updatedAt',
    })
  }
}

export const db = new AppDB()

export function validateClient(data: Client) {
  return ClientSchema.parse(data)
}
