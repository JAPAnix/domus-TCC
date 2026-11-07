-- Endereço informado pelo cliente quando o serviço é feito na casa dele.
ALTER TABLE `orders` ADD COLUMN `service_address` JSON NULL;
