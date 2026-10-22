# Lixeira de cópias — 30 dias

Aplicar lixeira-copias.sql depois das migrações anteriores. A exclusão do Histórico passa a preservar o arquivo e metadados por 30 dias. Somente a conta principal pode abrir Histórico > Lixeira e restaurar. Restaurar mantém nome, autor e data original do arquivo.

O prazo começa no primeiro envio confirmado para a lixeira; tentativas repetidas não o renovam. Após 30 dias a restauração é bloqueada. Uma tarefa diária na Vercel remove os arquivos vencidos, com repetição segura em caso de falha. Configure CRON_SECRET protegida no projeto para autorizar essa tarefa. Os arquivos podem permanecer armazenados até a execução bem-sucedida, mas não ficam acessíveis no histórico nem na lixeira depois do prazo.

Esta proteção vale para exclusões realizadas após a ativação. Não recupera arquivos apagados anteriormente, arquivos locais do computador, contas ou registros do RDO/romaneio. Os dados do aplicativo não são modificados por excluir/restaurar cópias.

Online: preparar o banco e variáveis não publica o site. Manter a versão Original até o envio manual do pacote ao GitHub.

Esvaziar lixeira: somente a conta principal, com confirmação digitando ESVAZIAR. Apaga definitivamente todas as cópias da lixeira deste app, independentemente da pesquisa. Uma marca de eliminação impede restaurar ao mesmo tempo; falhas mantêm a tarefa pendente para repetição segura.
