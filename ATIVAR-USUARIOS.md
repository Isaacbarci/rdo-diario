# Administração de usuários

1. No Supabase correspondente a este pacote, execute usuarios-permissoes-rdo.sql depois de administrador-rdo.sql. Não execute novamente os SQL antigos depois desta migração: eles restauram as regras antigas.
2. Na Vercel deste aplicativo, adicione a variável protegida SUPABASE_SECRET_KEY com a chave secreta do mesmo projeto Supabase (sb_secret_... ou service_role). Nunca coloque a chave no GitHub, HTML, public ou em variável NEXT_PUBLIC_.
3. Envie o pacote completo ao GitHub e publique novamente para ativar a variável.
4. Entre com isaacbarci@gmail.com e abra Administração > Usuários e permissões.

A tela permite criar contas confirmadas com senha inicial e conceder/revogar leitura global do histórico e exclusão de cópias. Outras contas não recebem gestão de usuários nem acesso aos dados vivos de outros romaneios. A conta principal é protegida contra exclusão/alteração de permissões.

Excluir conta é diferente de excluir cópia: remove a autenticação no projeto Supabase e pode remover dados vinculados por cascata. Exige digitar o e-mail. Contas com cópias ou outros vínculos impeditivos não são apagadas automaticamente: remova os vínculos conscientemente no painel antes. Teste compartilha as contas com RDO; excluir usuário ali também afeta o RDO.

Gerenciar usuários e excluir cópias exigem internet. A revogação vale para novos acessos ao servidor; arquivos já baixados e cópias disponíveis offline em outros aparelhos não podem ser recolhidos remotamente.

As telas foram testadas localmente com serviços simulados. Nenhuma conta real foi criada ou excluída nos testes. É preciso configurar a variável e executar o SQL para ativar no ambiente publicado.

Desativar/Reativar conta usa o bloqueio nativo do Supabase Auth e preserva registros e arquivos. Só a conta principal pode executar essa operação. A desativação impede novos logins; sessões já abertas podem durar até a renovação e acessos offline não são revogados remotamente. No Teste o bloqueio também afeta o RDO, pois compartilha o mesmo Supabase.

A permissão Excluir apenas as próprias cópias é independente da leitura do histórico de todas as contas. Excluir cópias de todas as contas inclui as próprias e continua exigindo leitura global. Em instalações existentes, aplicar permissao-copias-proprias.sql antes de publicar esta versão. A migração não concede a nova permissão a nenhuma conta existente.


Lixeira (22/10/2026): banco e variáveis protegidas já preparados. As novas exclusões do Histórico são recuperáveis por 30 dias pela conta principal. Consulte LIXEIRA.md. Não execute migrações antigas depois de lixeira-copias.sql.
