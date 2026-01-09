# 🔐 Como Resetar a Senha do Super Admin

## Método 1: Usando o Script (Recomendado)

### Passo 1: Configure as variáveis de ambiente

Certifique-se de ter as variáveis de ambiente configuradas no arquivo `.env` na pasta `apps/api`:

```env
TURSO_DATABASE_URL=libsql://seu-banco.turso.io
TURSO_AUTH_TOKEN=seu-token-aqui
```

### Passo 2: Execute o script

```bash
# Resetar com senha padrão
cd apps/api
pnpm run prisma:reset-super-admin

# Ou especificar email e senha customizados
pnpm run prisma:reset-super-admin superadmin@timeclock.com MinhaNovaSenha123!
```

O script irá:
- ✅ Buscar o Super Admin existente
- ✅ Se não existir, criar um novo
- ✅ Resetar/definir a senha
- ✅ Mostrar as credenciais de acesso

## Método 2: Usando SQL Direto no Turso

### Passo 1: Acesse o Turso CLI

Se você tem o Turso CLI instalado:

```bash
# Instalar Turso CLI (se não tiver)
# macOS/Linux:
curl -sSfL https://get.tur.so/install.sh | bash

# Windows (PowerShell):
irm https://get.tur.so/install.ps1 | iex
```

### Passo 2: Conecte ao banco

```bash
turso db shell seu-banco
```

### Passo 3: Execute os comandos SQL

Primeiro, gere o hash da senha. Você pode usar Node.js:

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('SuaNovaSenha123!', 10).then(h => console.log(h))"
```

Depois, no shell do Turso:

```sql
-- Verificar se o Super Admin existe
SELECT id, email, role, "companyId" FROM "User" WHERE role = 'SUPER_ADMIN';

-- Se existir, atualizar a senha (substitua USER_ID e PASSWORD_HASH)
UPDATE "User" 
SET "passwordHash" = 'PASSWORD_HASH_AQUI'
WHERE id = 'USER_ID_AQUI' AND role = 'SUPER_ADMIN';

-- Se não existir, criar novo (substitua PASSWORD_HASH)
-- Primeiro, gere um ID único
INSERT INTO "User" (id, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
VALUES (
  'user_' || lower(hex(randomblob(8))),
  'superadmin@timeclock.com',
  'PASSWORD_HASH_AQUI',
  'SUPER_ADMIN',
  true,
  datetime('now'),
  datetime('now')
);
```

## Método 3: Via Prisma Studio (Interface Gráfica)

### Passo 1: Execute o Prisma Studio

```bash
cd apps/api
pnpm run prisma:studio
```

### Passo 2: Acesse no navegador

Abra `http://localhost:5555` no navegador.

### Passo 3: Edite o usuário

1. Clique na tabela `User`
2. Encontre o usuário com `role = SUPER_ADMIN`
3. Clique para editar
4. Gere um novo hash de senha e atualize o campo `passwordHash`

**⚠️ IMPORTANTE:** Você precisa gerar o hash bcrypt da senha. Use:

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('SuaSenha123!', 10).then(h => console.log(h))"
```

## Credenciais Padrão

Após executar o script, as credenciais padrão são:

- **Email:** `superadmin@timeclock.com`
- **Senha:** `SuperAdmin123!`

## Verificar se o Super Admin Existe

Para verificar se o Super Admin foi criado corretamente:

```bash
cd apps/api
pnpm run prisma:studio
```

Ou via SQL:

```sql
SELECT id, email, role, "companyId", "isActive" 
FROM "User" 
WHERE role = 'SUPER_ADMIN';
```

## Troubleshooting

### Erro: "Super Admin não encontrado"

O script tentará criar um novo Super Admin automaticamente.

### Erro: "NOT NULL constraint failed"

O script tentará criar com uma empresa temporária e depois você pode atualizar manualmente.

### Erro de conexão com Turso

Verifique se as variáveis de ambiente `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` estão corretas.


