# Pendências

Itens em aberto, para resolver depois. Cada um traz a data em que foi anotado.

## Senha e sessão

Anotadas em 13/10/2026, ao criar a tela "Alterar Senha".

1. **Sessões antigas continuam valendo depois da troca de senha.** O token de login não expira e não é
   invalidado quando o usuário troca a senha: quem já estiver logado em outro navegador, ou tiver um token
   copiado, continua com acesso. Resolver junto com a validade do token (dar prazo ao token e recusar os
   emitidos antes da última troca de senha).
2. **Tamanho mínimo da senha.** A troca pela tela exige 8 caracteres; o valor foi escolhido na implementação e
   não foi validado com o cliente. A regra vale só para a tela "Alterar Senha": o cadastro de usuários não
   exige mínimo e as senhas atuais mais curtas continuam funcionando. Decidir o mínimo e se ele passa a valer
   também no cadastro de usuários.

## Outras pendências levantadas na mesma sessão

Anotadas em 13/10/2026. Não foram pedidas como pendência; estão aqui para não se perderem.

- **Importação da Green List:** não há link para baixar uma planilha-modelo; qualquer usuário do cliente pode
  importar (mesma regra do cadastro manual). Decidir se a importação fica restrita a administradores.
- **Pesquisa da Green List e da Red List:** o texto digitado é procurado em um campo por vez; "nissan kicks"
  não encontra nada, porque marca e modelo ficam em campos separados.
- **Cards em travessia:** no vermelho mais escuro (mais de 2 horas), o texto "Cruzar condomínio" fica com pouco
  contraste.
- **Detector de anomalias:**
  - o alerta sai cerca de 10 minutos depois da passagem, por causa da margem de consolidação;
  - cada ciclo lê 90 dias de histórico mesmo sem passagem nova (cerca de 2,5 s por minuto);
  - demais itens no item 16.5 de `docs/plano_anomalia.md`.
- **Log do backend:** continuam os avisos de opções de conexão ignoradas pelo driver do MySQL (`timeout`,
  `reconnect`, `idleTimeout`); só `acquireTimeout` foi removida.
- **Cadastro de usuários:** a rota de atualização aceita que qualquer usuário do cliente, mesmo sem ser
  administrador, altere outro usuário do mesmo cliente (inclusive a senha). Observado ao ler o código; não foi
  testado.
