# RDO Diário de Obra e Apontamento

Endereço: https://rdo-diario.vercel.app/
Supabase utilizado por escolha do usuário: romaneio-palmont-teste (aifukuicddxpxzvfnmur).
Projeto Vercel: rdo-diario. Repositório esperado: Isaacbarci/rdo-diario.

## Publicação

Extraia o ZIP e envie TODO o conteúdo à raiz do repositório: public/, api/, server/, requirements.txt, vercel.json e demais arquivos. Não coloque public como raiz do projeto e não envie somente o HTML.

Na Vercel: Framework Other, Root Directory vazio, Output Directory public. O arquivo vercel.json configura a função em São Paulo com limite de 60 segundos. Se houver bloqueio de novas publicações na Vercel, aguarde a liberação e publique o commit mais recente. Apenas arquivos que chegaram a um deploy Ready entram no site.

As cinco variáveis MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER e MYSQL_PASSWORD foram cadastradas no projeto rdo-diario para Production e Preview. A senha é sensível, fica somente no servidor e não faz parte deste pacote. Não é necessário copiá-la para o código.

O banco-rdo.sql foi aplicado ao Supabase de teste. Ele fica no pacote como referência. Usa apenas tabelas rdo_* e o armazenamento privado rdo-arquivos; não altera as tabelas ou arquivos dos romaneios. O retorno de autenticação do novo endereço foi autorizado no Supabase, preservando o endereço do Romaneio Teste.

Esta entrega é um pacote para publicação manual. O fluxo completo na Vercel com sua conta real deve ser confirmado após você enviar os arquivos ao GitHub. A função MySQL precisa fazer parte da publicação; se aparecer Base inicial da planilha, a consulta não concluiu e a reserva foi usada.

## Acesso

Use o mesmo e-mail e senha de uma conta do Supabase de teste, ou crie uma conta pelo app e confirme o e-mail se solicitado. Cada conta só vê e edita seus próprios RDOs, apontamentos, semanas e arquivos exportados. Não existe visão administrativa de outras contas nesta versão. Resumo e envio de semana à obra abrangem somente os registros da conta conectada.

Este novo RDO exige conexão para autenticar, salvar no banco, consultar registros e gerar cópias arquivadas. Ele não inclui o login offline nem a fila offline do aplicativo de romaneios. Campos ainda não enviados são mantidos como rascunho no navegador por conta, mas só devem ser considerados salvos online após a confirmação. Não limpe os dados do navegador se houver rascunhos importantes.

## Abas

### Lançar RDO

Reúne local/equipe, data, turno, efetivo, hora extra, Atividades do dia e observações. As atividades agora são os spools apontados dentro do próprio formulário. Marque ou desmarque a caixa de cada spool para incluí-lo ou retirá-lo do RDO. Não há modal nem observação por spool. A data de todos os itens selecionados acompanha automaticamente a data do RDO, inclusive ao alterar o dia antes de salvar. A observação geral do RDO permanece disponível. Observações antigas continuam preservadas nos registros e exportações. A gravação no Supabase acontece ao salvar o RDO, incluindo as atividades em uma única operação. Ao editar um RDO existente, salve as alterações para efetivar a retirada de um spool.

Enviar e baixar Excel gera o arquivo daquele registro, guarda uma cópia privada e inicia o download. Erros ao gerar o Excel não apagam o RDO já salvo. Atividades digitadas nas versões anteriores continuam preservadas nos registros e nas exportações.

### Registros e Resumo

Permitem consultar e editar os próprios lançamentos, visualizar a semana, gerar o Excel da semana ou completo e baixar o dashboard HTML. As exportações são guardadas no histórico da conta. O Excel contém RDO, Atividades do dia e Envio à obra, e inclui Resumo quando exportado por semana. Cada linha de atividade identifica o RDO, local/equipe, serviço, Lote, isométrico, spool, ID do spool, data e observação. Só entram as atividades vinculadas aos RDOs exportados. A conta autenticada aparece no Excel, além do responsável/equipe do formulário original.

Os RDOs que estavam salvos nos serviços do Claude não são copiados automaticamente: o HTML fornecido não contém esses registros. A nova integração funciona diretamente na Vercel, sem depender do Claude.

### Atividades do dia, dentro de Lançar RDO

A fonte é a mesma tabela MySQL TB_STG_MAPA_SPOOLS usada pelas consultas da planilha Spools.xlsx. A leitura é feita somente pelo servidor e exige login no Supabase. Não existe escrita no MySQL de origem.

PROG FAB é apresentado como Lote. Há filtros de Serviço, Lote, Isométrico/ID e situação (Todos, Pendentes, Apontados ou Neste RDO); a lista é paginada e adapta-se a cartões no celular. CORTE/BISEL preenchido com data válida aparece como Apontado, sem Editar ou Limpar. Spools vinculados a outro RDO da mesma conta, ou apontamentos independentes das versões anteriores, também são exibidos como já apontados, sem incluí-los automaticamente em um novo RDO. Somente os spools escolhidos para o RDO atual integram suas atividades e podem ser marcados ou desmarcados no formulário. As cópias Excel anteriores permanecem preservadas.

Não existe mais uma aba separada de Apontamento nem exportação isolada da seleção filtrada: use Enviar e baixar Excel ou as exportações de Registros e Resumo. As novas atividades ficam no JSON de rdo_registros, sob apontamentos e atividades, protegidas pelas mesmas regras de acesso do RDO. Nenhuma alteração adicional no SQL é necessária para quem já aplicou banco-rdo.sql. rdo_apontamentos continua sendo consultada para preservar os apontamentos independentes antigos.

Ao abrir o app, tenta buscar o MySQL. Se a consulta não concluir, usa Spools.xlsx como reserva inicial e informa essa origem. A base é carregada uma vez por abertura da página; recarregue a página para uma nova leitura. Não há consulta periódica em segundo plano. Spools.xlsx fornecido não contém CORTE/BISEL; o preenchimento dessa data depende da coluna retornada pelo MySQL.

### Histórico e cópias

Os Excel e dashboards são arquivados em bucket privado com data, e-mail, tamanho e SHA-256. A cópia recuperada é conferida antes de baixar. Limite de 20 MB por arquivo. Usuários do site não podem sobrescrever nem apagar o histórico. Se um upload concluir e o cadastro do histórico falhar, pode restar um arquivo sem listagem; o app informa a falha e não confirma a exportação como concluída.

## Configuração futura

public/config.json e server/config.json apontam para o mesmo Supabase de teste e contêm apenas a chave pública. Para migrar a outro projeto, atualize ambos, aplique o esquema no novo banco e configure os redirects do novo site. Não use chaves secretas ou service_role no navegador.

O certificado público fixado do MySQL fica em server/mysql-server.pem. Se a hospedagem trocar o certificado, será preciso atualizá-lo; o servidor não aceita conexão sem TLS.

## Conferências realizadas

Sintaxe de todas as páginas; preenchimento de RDO e apontamento na prévia local; filtro por Lote; XLSX reais gerados e reabertos com nomes e dados corretos; rascunhos separados por usuário; regras SQL reais de isolamento, e-mail autenticado, histórico imutável, bucket privado e bloqueio de metadados sem arquivo. Os dados artificiais usados nos testes SQL foram revertidos.

Após Salvar RDO, Enviar e baixar Excel usa o registro recém-salvo, sem abrir Editar e sem criar outro RDO. Se preencher um novo relatório ou abrir outro para editar, o botão passa a salvar e exportar o formulário atual.

Efetivo, hora extra e atividades do RDO salvo continuam visíveis para a mesma equipe, data e turno, sem abrir Editar. Os spools salvos mostram Apontado e permanecem vinculados ao registro; Editar habilita desmarcar e Salvar alterações efetiva a retirada. Adicionar novos spools à mesma equipe/data/turno atualiza o RDO existente, preservando as atividades anteriores, em vez de criar outro registro.

Quando já existe RDO para equipe/data/turno, a tela exibe os dados salvos para consulta e oculta os botões do formulário. Abrir para editar habilita os campos e mostra Salvar alterações, Enviar e baixar Excel e Cancelar edição. Cancelar ou concluir o salvamento retorna à consulta. Para uma combinação sem RDO, Salvar RDO e Enviar e baixar Excel ficam disponíveis normalmente.

Fluxo atual dos botões: no rodapé ficam apenas Salvar RDO ou, durante a edição, Salvar alterações e Cancelar edição. Após salvar, Enviar e baixar Excel fica no aviso do registro existente, ao lado de Abrir para editar; esse é o botão para exportar o RDO salvo.


## Administracao do RDO

administrador-rdo.sql libera historico global para isaacbarci@gmail.com confirmado. RDOs normais continuam separados por conta; acesso administrativo pela API exige x-rdo-admin: true. Administracao aparece apos verificacao no banco e abre a gestao de dados, usuarios e configuracoes no painel Supabase, onde a conta ja possui papel Owner. Alteracoes e exclusoes nao sao executadas automaticamente por essa configuracao.

## Histórico e nomes dos downloads
O histórico permite pesquisar por nome, equipe e intervalo de geração. Novos downloads individuais usam RDO_DATA_EQUIPE_TURNO.xlsx e guardam a equipe e a data do RDO. Arquivos anteriores continuam com seus nomes originais. Em bancos existentes, aplicar historico-filtros.sql antes de publicar.
