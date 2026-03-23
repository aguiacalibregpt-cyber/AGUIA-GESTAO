# AGUIA em rede local (Windows) - guia detalhado

Este guia configura 3 computadores:
- 1 host (seu PC) rodando o servidor.
- 2 clientes acessando pelo navegador.

## 1. Requisitos no computador host

1. Instale Node.js LTS (com npm):
   - https://nodejs.org
2. Abra o PowerShell como usuario comum e instale pnpm:

```powershell
npm install -g pnpm
```

3. Teste as versoes:

```powershell
node -v
npm -v
pnpm -v
```

## 2. Primeiro preparo do projeto no host

1. Abra terminal na pasta do projeto.
2. Instale dependencias:

```powershell
pnpm install
```

3. Gere build da aplicacao:

```powershell
pnpm build
```

4. Inicie o servidor (teste manual):

```powershell
pnpm server
```

5. Deixe a janela aberta e teste no proprio host:
   - http://127.0.0.1:3000

## 3. Descobrir IP local do host

No host, rode:

```powershell
ipconfig
```

Use o IPv4 da placa de rede (exemplo: 192.168.1.25).

## 4. Liberar firewall no host

No PowerShell (Administrador):

```powershell
New-NetFirewallRule -DisplayName "AGUIA Servidor 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

## 5. Testar acesso dos outros 2 computadores

Nos clientes, abra navegador em:

- http://IP-DO-HOST:3000
- Exemplo: http://192.168.1.25:3000

Se abrir, a rede esta OK.

## 6. Inicializacao automatica ao ligar o Windows (host)

Opcao A (recomendada): tarefa agendada

No host:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-startup-task.ps1
```

Isso cria a tarefa `AGUIA-Servidor-Autostart` para iniciar no logon.

Para remover:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\uninstall-startup-task.ps1
```

## 7. Backup automatico do db.json

### 7.1 Executar backup manual agora

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\backup-db.ps1
```

Arquivos sao salvos em:
- `backups\\db`

### 7.2 Agendar backup diario

Exemplo: diario as 18:00, mantendo 30 dias:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-backup-task.ps1 -BackupTime "18:00" -KeepDays 30
```

Para remover a tarefa:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\uninstall-backup-task.ps1
```

## 8. Subir servidor com 1 clique

No host, use:
- `INICIAR-AGUIA-SERVIDOR.bat` (janela visivel)
- `INICIAR-AGUIA-SERVIDOR-OCULTO.vbs` (sem janela)

Para parar rapidamente:
- `PARAR-AGUIA-SERVIDOR.bat`

## 9. Criar pacote portatil simples (host)

Gera pasta pronta em `release\\AGUIA-SERVIDOR-LAN`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\create-portable-package.ps1
```

Depois copie a pasta para o host definitivo.

## 10. Rotina diaria recomendada

1. Verifique se o host ligou o servidor automaticamente.
2. Abra no cliente: http://IP-DO-HOST:3000
3. Confirme backup diario no fim do dia em `backups\\db`.
4. Uma vez por semana copie os arquivos `.zip` para nuvem ou pendrive.

## 10.1 Checklist de validacao em 3 PCs (host + 2 clientes)

Use este roteiro para validar em producao sem pular etapas.

### Etapa A - Host (seu computador)

1. Feche servidores antigos:

```powershell
powershell -ExecutionPolicy Bypass -File .\PARAR-AGUIA-SERVIDOR.bat
```

2. Inicie com 1 clique:
- `INICIAR-AGUIA-SERVIDOR.bat`

3. Resultado esperado:
- aparece `AGUIA servidor local em http://0.0.0.0:3000`
- aparece o caminho do banco `server\\data\\db.json`

4. Abra no host:
- http://127.0.0.1:3000

5. Crie uma pessoa de teste com nome claro:
- Exemplo: `TESTE HOST 001`

### Etapa B - Cliente 1

1. Abra no navegador:
- `http://IP-DO-HOST:3000`

2. Confirme se aparece a pessoa criada no host:
- `TESTE HOST 001`

3. Edite o telefone dessa pessoa no Cliente 1 e salve.

4. Volte no Host e atualize a pagina:
- o novo telefone deve aparecer.

### Etapa C - Cliente 2

1. Abra no navegador:
- `http://IP-DO-HOST:3000`

2. Crie um processo para `TESTE HOST 001`.

3. No Host, abra Processos:
- o processo deve estar visivel.

4. Abra os documentos do processo e altere 1 status para `ENTREGUE`.

5. No Cliente 1, atualize a pagina:
- o mesmo status deve aparecer.

### Etapa D - Teste de backup

1. No Host, rode backup manual:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\backup-db.ps1
```

2. Confirme se criou `.zip` em:
- `backups\\db`

3. Abra o zip e confirme que existe `db_...json`.

### Etapa E - Teste de reinicio (resiliencia)

1. Pare o servidor:
- `PARAR-AGUIA-SERVIDOR.bat`

2. Inicie novamente:
- `INICIAR-AGUIA-SERVIDOR.bat`

3. Confirme que os dados de teste continuam:
- pessoa `TESTE HOST 001`
- processo criado no Cliente 2

### Etapa F - Teste de autostart (logon)

1. Garanta tarefa instalada:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-startup-task.ps1
```

2. Faça logoff/logon do Windows no host.

3. Em ate 30 segundos, teste no cliente:
- `http://IP-DO-HOST:3000`

4. Resultado esperado:
- sistema abre sem iniciar manualmente o `.bat`.

### Etapa G - Criterio de aprovacao final

Considere a implantacao aprovada quando:
1. Os 3 PCs visualizam os mesmos dados.
2. Edicoes feitas em um PC aparecem nos outros apos atualizar a pagina.
3. Backup `.zip` e gerado com sucesso.
4. Dados persistem apos parar/iniciar servidor.
5. Servidor sobe automaticamente no logon (quando tarefa instalada).

## 11. Local do banco principal

Banco compartilhado usado pelos 3 PCs:
- `server\\data\\db.json`

Nao apague esse arquivo.

## 12. Solucao de problemas

### Porta 3000 ocupada

```powershell
netstat -ano | findstr :3000
```

Mate o PID se necessario:

```powershell
taskkill /PID <PID> /F
```

### Clientes nao acessam

1. Confirme IP correto do host.
2. Confirme firewall liberado.
3. Host e clientes na mesma rede.
4. Teste ping do cliente para o host.

### Servidor nao inicia no logon

1. Abra "Agendador de Tarefas".
2. Verifique `AGUIA-Servidor-Autostart`.
3. Execute manualmente para validar.

## 13. Comandos curtos via package.json

No host, tambem pode usar:

```powershell
pnpm win:install-startup
pnpm win:backup-now
pnpm win:install-backup-task
pnpm win:package
```

## 14. Checklist para marcar e assinar

Para execucao assistida da implantacao (OK/FALHA/NA + evidencias + assinatura), use:

- `docs/checklist-validacao-implantacao-3pcs.md`
