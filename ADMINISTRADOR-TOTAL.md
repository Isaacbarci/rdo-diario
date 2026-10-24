# Administrador total

Em Gerenciar usuários, a opção Administrador total libera as funções administrativas do aplicativo, incluindo usuários e permissões, histórico, exclusões e lixeiras. A conta principal isaacbarci@gmail.com permanece protegida contra exclusão, desativação, mudança de senha e mudança de permissões pelas APIs de administração, inclusive quando chamadas por outro administrador total.

A permissão começa desativada para todos. Ela é independente em cada aplicativo: Romaneio usa romaneio_acessos e RDO usa rdo_acessos. As contas Auth são compartilhadas entre Teste e RDO; criar, excluir, desativar uma conta ou redefinir sua senha afeta a mesma conta em ambos. Isso não concede automaticamente a função de administrador no outro app.

O perfil administra o aplicativo. Links para Supabase e Vercel não concedem acesso às organizações ou aos painéis desses provedores: as credenciais e permissões externas continuam separadas.

Aplicar administrador-total.sql após os scripts de permissões existentes. Já aplicado no banco correspondente em 24/10/2026. Não altera usuários nem libera novos administradores automaticamente.
