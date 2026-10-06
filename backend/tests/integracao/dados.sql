-- Dados de teste da integração (tests/integracao/conciliacao.test.mjs). Apaga tráfegos e identificações: use SOMENTE em banco descartável.
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM Saidas_nao_identificadas;
DELETE FROM LogIdentificacao;
DELETE FROM Trafegos;
DELETE FROM Cameras;
DELETE FROM Portarias;
DELETE FROM Users WHERE email = 'op@bosque';
DELETE FROM Clients WHERE id IN (1, 2);
SET FOREIGN_KEY_CHECKS = 1;
INSERT INTO Clients (id,name,type,cpfCnpj,cep,address,number,district,city,state,active,createdAt,updatedAt,entrada_automatica,tocar_alarme) VALUES
(1,'Bosque dos Esquilos','PJ','0','0','Rua','1','B','C','BA',1,NOW(),NOW(),0,0),
(2,'Outro Cond','PJ','0','0','Rua','1','B','C','BA',1,NOW(),NOW(),0,0);
INSERT INTO Portarias (id,nome,client_id,createdAt,updatedAt) VALUES (1,'Portaria Principal',1,NOW(),NOW()),(2,'Portaria Outro',2,NOW(),NOW());
INSERT INTO Cameras (id,nome,url,modelo,sentido,client_id,portaria_id,createdAt,updatedAt) VALUES
(1,'Cam Entrada','x','m','E',1,1,NOW(),NOW()),(2,'Cam Saida','x','m','S',1,1,NOW(),NOW()),(3,'Cam Saida Outro','x','m','S',2,2,NOW(),NOW());
-- operador do cliente 1, senha op123
INSERT INTO Users (name,email,password,active,admin,admin_client,client_id,createdAt,updatedAt) VALUES
('Operador Bosque','op@bosque','$2b$08$QdqRjbgPFTGOCf/zZmr3L.zL6asYkZ7D0gvJfD2DSeLf5dlmLvN1e',1,0,0,1,NOW(),NOW());
-- saída anterior à implantação, como a migração a deixa
INSERT INTO Saidas_nao_identificadas (id,identificador_placa,placa,data,camera_id,client_id,status,resolvido_em,motivo_arquivamento,createdAt,updatedAt) VALUES
(1,'legado-1','OLD1A23',UTC_TIMESTAMP()-INTERVAL 2 DAY,2,1,'arquivada',NOW(),'Registro anterior à implantação da conciliação manual',NOW(),NOW());
INSERT INTO Trafegos (id,placa,dataEntrada,dataSaida,destino,client_id,portaria_entrada_id,portaria_saida_id,in_whitelist,imagem,imagem_thumb,saida_automatica,createdAt,updatedAt) VALUES
(1,'ABC1D23',UTC_TIMESTAMP()-INTERVAL 10 MINUTE,NULL,'cruzar',1,1,NULL,NULL,'/e/1.jpg','/e/1_thumb.jpg',NULL,NOW(),NOW()),
(2,'SRV1234',UTC_TIMESTAMP()-INTERVAL 2 HOUR,NULL,'servico',1,1,NULL,NULL,'/e/2.jpg','/e/2_thumb.jpg',NULL,NOW(),NOW()),
(3,'VIS5678',UTC_TIMESTAMP()-INTERVAL 1 HOUR,NULL,'morador',1,1,NULL,NULL,'/e/3.jpg','/e/3_thumb.jpg',NULL,NOW(),NOW()),
(4,'WHT0001',UTC_TIMESTAMP()-INTERVAL 10 MINUTE,NULL,'cruzar',1,1,NULL,1,'/e/4.jpg','/e/4_thumb.jpg',NULL,NOW(),NOW()),
(5,'OUT9999',UTC_TIMESTAMP()-INTERVAL 40 MINUTE,UTC_TIMESTAMP()-INTERVAL 5 MINUTE,'cruzar',1,1,1,NULL,'/e/5.jpg','/e/5_thumb.jpg',1,NOW(),NOW()),
(6,'OLD0001',UTC_TIMESTAMP()-INTERVAL 3 DAY,UTC_TIMESTAMP()-INTERVAL 2 DAY,'servico',1,1,1,NULL,'/e/6.jpg','/e/6_thumb.jpg',0,NOW(),NOW()),
(7,'OTH0001',UTC_TIMESTAMP()-INTERVAL 10 MINUTE,NULL,'cruzar',2,2,NULL,NULL,'/e/7.jpg','/e/7_thumb.jpg',NULL,NOW(),NOW()),
(8,'XYZ9F41',UTC_TIMESTAMP()-INTERVAL 30 MINUTE,NULL,'cruzar',1,1,NULL,NULL,'/e/8.jpg','/e/8_thumb.jpg',NULL,NOW(),NOW()),
(9,'OUT8888',UTC_TIMESTAMP()-INTERVAL 50 MINUTE,UTC_TIMESTAMP()-INTERVAL 15 MINUTE,'servico',1,1,1,NULL,'/e/9.jpg','/e/9_thumb.jpg',0,NOW(),NOW());
INSERT INTO Saidas_nao_identificadas (id,identificador_placa,placa,data,camera_id,client_id,status,imagem_carro,imagem_carro_thumb,createdAt,updatedAt) VALUES
(10,'s-10','ABC1D28',UTC_TIMESTAMP()-INTERVAL 1 MINUTE,2,1,'pendente','/s/10.jpg','/s/10_thumb.jpg',NOW(),NOW()),
(11,'s-11','QRS5T02',UTC_TIMESTAMP()-INTERVAL 2 MINUTE,2,1,'pendente',NULL,NULL,NOW(),NOW()),
(12,'s-12','XYZ9F44',UTC_TIMESTAMP()-INTERVAL 45 MINUTE,2,1,'pendente',NULL,NULL,NOW(),NOW()),
(13,'s-13','OTH0002',UTC_TIMESTAMP()-INTERVAL 1 MINUTE,3,2,'pendente',NULL,NULL,NOW(),NOW());
