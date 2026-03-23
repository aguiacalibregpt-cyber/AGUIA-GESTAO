# Checklist de Validacao e Aceite - AGUIA LAN (3 PCs)

Data: ____/____/______

Projeto: AGUIA GESTAO (Host + 2 Clientes)

Versao implantada: __________________________

Responsavel tecnico: _________________________

Cliente responsavel: _________________________

---

## 1. Identificacao do ambiente

- Host (nome da maquina): ______________________
- Host (IP local): _____________________________
- Cliente 1 (nome da maquina): _________________
- Cliente 2 (nome da maquina): _________________
- Pasta do projeto no host: ____________________

---

## 2. Checklist tecnico (marcar)

Legenda:
- OK = validado com sucesso
- FALHA = nao validado
- NA = nao aplicavel

| ID | Verificacao | OK | FALHA | NA | Evidencia/Observacao |
|---|---|---|---|---|---|
| T01 | Node.js LTS instalado no host | [ ] | [ ] | [ ] | |
| T02 | pnpm instalado no host | [ ] | [ ] | [ ] | |
| T03 | Dependencias instaladas (pnpm install) | [ ] | [ ] | [ ] | |
| T04 | Build gerado com sucesso (pnpm build) | [ ] | [ ] | [ ] | |
| T05 | Firewall liberado para TCP 3000 no perfil Private | [ ] | [ ] | [ ] | |
| T06 | Servidor inicia com INICIAR-AGUIA-SERVIDOR.bat | [ ] | [ ] | [ ] | |
| T07 | Servidor exibe URL e caminho do db.json no log | [ ] | [ ] | [ ] | |
| T08 | Checagem de porta ocupada funciona (quando porta 3000 em uso) | [ ] | [ ] | [ ] | |
| T09 | Host acessa http://127.0.0.1:3000 | [ ] | [ ] | [ ] | |
| T10 | Cliente 1 acessa http://IP-DO-HOST:3000 | [ ] | [ ] | [ ] | |
| T11 | Cliente 2 acessa http://IP-DO-HOST:3000 | [ ] | [ ] | [ ] | |
| T12 | Criacao de pessoa no host aparece no Cliente 1 | [ ] | [ ] | [ ] | |
| T13 | Edicao de pessoa no Cliente 1 aparece no host apos atualizar | [ ] | [ ] | [ ] | |
| T14 | Criacao de processo no Cliente 2 aparece no host | [ ] | [ ] | [ ] | |
| T15 | Alteracao de documento no host aparece no Cliente 1 | [ ] | [ ] | [ ] | |
| T16 | Backup manual gera .zip em backups\\db | [ ] | [ ] | [ ] | |
| T17 | Conteudo do zip contem arquivo db_*.json | [ ] | [ ] | [ ] | |
| T18 | Parar servidor com PARAR-AGUIA-SERVIDOR.bat funciona | [ ] | [ ] | [ ] | |
| T19 | Reinicio do servidor preserva dados de teste | [ ] | [ ] | [ ] | |
| T20 | Tarefa AGUIA-Servidor-Autostart instalada | [ ] | [ ] | [ ] | |
| T21 | Servidor sobe apos logoff/logon (sem start manual) | [ ] | [ ] | [ ] | |
| T22 | Tarefa AGUIA-Backup-Diario instalada no horario definido | [ ] | [ ] | [ ] | |

---

## 3. Teste funcional resumido

### 3.1 Dados de teste usados

- Pessoa teste: _______________________________
- CPF teste: __________________________________
- Processo teste: _____________________________
- Documento alterado: _________________________

### 3.2 Resultado dos testes cruzados

- Fluxo Host -> Cliente 1: [ ] OK  [ ] FALHA
- Fluxo Cliente 1 -> Host: [ ] OK  [ ] FALHA
- Fluxo Cliente 2 -> Host: [ ] OK  [ ] FALHA
- Fluxo Host -> Cliente 1 (documentos): [ ] OK  [ ] FALHA

Observacoes:

____________________________________________________________________

____________________________________________________________________

---

## 4. Pendencias encontradas

| ID | Descricao da pendencia | Criticidade (Alta/Media/Baixa) | Responsavel | Prazo |
|---|---|---|---|---|
| P01 |  |  |  |  |
| P02 |  |  |  |  |
| P03 |  |  |  |  |

---

## 5. Criterio de aceite

Marque o status final:

- [ ] APROVADO SEM RESSALVAS
- [ ] APROVADO COM RESSALVAS
- [ ] REPROVADO

Justificativa:

____________________________________________________________________

____________________________________________________________________

---

## 6. Assinaturas

Responsavel tecnico (implantacao):

Nome: _______________________________________

Assinatura: __________________________________

Data: ____/____/______

Cliente responsavel (aceite):

Nome: _______________________________________

Assinatura: __________________________________

Data: ____/____/______

---

## 7. Comandos de apoio (referencia rapida)

Instalar autostart:

powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-startup-task.ps1

Instalar backup diario (18:00, 30 dias):

powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-backup-task.ps1 -BackupTime "18:00" -KeepDays 30

Backup manual:

powershell -ExecutionPolicy Bypass -File .\scripts\windows\backup-db.ps1

Subir servidor (1 clique):

INICIAR-AGUIA-SERVIDOR.bat

Parar servidor:

PARAR-AGUIA-SERVIDOR.bat
