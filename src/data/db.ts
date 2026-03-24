import Dexie, { type Table } from 'dexie'
import type { Pessoa, Processo, DocumentoProcesso, Configuracao, BackupHistorico } from '../types/models'

export class AppDatabase extends Dexie {
  pessoas!: Table<Pessoa>
  processos!: Table<Processo>
  documentosProcesso!: Table<DocumentoProcesso>
  configuracoes!: Table<Configuracao>
  backupsHistorico!: Table<BackupHistorico>

  constructor() {
    super('AguiaGestao')
    this.version(1).stores({
      pessoas: 'id, cpf, dataCadastro',
      processos: 'id, pessoaId, tipo, status, dataPrazo',
      documentosProcesso: 'id, processoId, status, dataEntrega',
      configuracoes: 'id, chave',
      backupsHistorico: 'id, timestamp, origem',
    })
  }
}

export const db = new AppDatabase()

