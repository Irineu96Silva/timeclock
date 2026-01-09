# 🚀 Guia Passo a Passo - Deploy das Melhorias

## ✅ Passo 1: Dependências Instaladas
As dependências já foram instaladas com sucesso!

## 📝 Passo 2: Fazer Commit das Alterações

Agora você precisa commitar todas as mudanças. Execute os comandos abaixo:

### 2.1. Adicionar todos os arquivos modificados
```bash
git add .
```

### 2.2. Fazer o commit com uma mensagem descritiva
```bash
git commit -m "feat: adiciona Super Admin, exportação Excel e melhorias de UI

- Adiciona sistema de Super Admin para gerenciar empresas
- Implementa exportação em Excel (XLSX) e exportação em lote
- Adiciona tabela Employee com dados completos
- Melhora configurações de jornada de trabalho por empresa
- Atualiza estética com design moderno e animações
- Adiciona migração do Prisma para novas tabelas"
```

### 2.3. Enviar para o repositório
```bash
git push origin main
```

## 🔄 Passo 3: Atualizar Build Command no Render

Após o push, o Render vai fazer um novo deploy automaticamente. Mas você precisa garantir que o Build Command está correto:

1. Acesse: https://dashboard.render.com
2. Abra o serviço `timeclock-api`
3. Vá em **Settings**
4. Em **Build Command**, certifique-se de que está assim:

```bash
pnpm install --prod=false && pnpm -C apps/api exec prisma generate --schema=prisma/schema.prisma && pnpm -C apps/api exec prisma migrate deploy --schema=prisma/schema.prisma && pnpm -C apps/api run prisma:seed && pnpm -C apps/api build
```

5. Salve as alterações
6. Se necessário, faça um **Manual Deploy**

## 🗄️ Passo 4: Verificar Migração no Render

A migração será aplicada automaticamente durante o build. Verifique os logs do Render para confirmar:

- Procure por: `Applying migration`
- Deve aparecer: `20260107150616_add_super_admin_and_employee`

## 🧪 Passo 5: Testar no Ambiente de Produção

Após o deploy, teste:

1. **Login**: Verifique se o login ainda funciona
2. **Super Admin**: Se você tiver um usuário SUPER_ADMIN, teste a página `/super-admin/companies`
3. **Exportação Excel**: Vá em `/admin/exports` e teste a exportação em Excel
4. **Configurações**: Vá em `/admin/settings` e verifique os novos campos de jornada

## 📋 Checklist Final

- [ ] Dependências instaladas ✅
- [ ] Commit feito
- [ ] Push realizado
- [ ] Build Command atualizado no Render
- [ ] Deploy concluído
- [ ] Migração aplicada
- [ ] Funcionalidades testadas

## ⚠️ Observações Importantes

1. **Seed Script**: O seed será executado automaticamente no build, criando o usuário admin padrão
2. **Turso Database**: Certifique-se de que as variáveis `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` estão configuradas no Render
3. **CORS**: As configurações de CORS já estão corretas

## 🆘 Em Caso de Problemas

Se algo der errado:

1. Verifique os logs do Render
2. Confirme que todas as variáveis de ambiente estão configuradas
3. Verifique se a migração foi aplicada corretamente
4. Teste localmente primeiro: `pnpm dev`

---

**Boa sorte com o deploy! 🎉**


