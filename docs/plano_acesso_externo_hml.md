# Plano de acesso externo à homologação — túnel reverso + nginx na AWS

Escrito em 2026-10-12 como plano, executado depois. A seção "Situação atual" mostra a configuração em uso.

## Situação atual (2026-10-23)

O plano foi executado, e desde 2026-10-23 o túnel expõe a **produção**, não mais a homologação.

| Item | Valor |
|---|---|
| Endereço público | `https://digicam.efabrika.com.br/` |
| Máquina na AWS | `18.216.121.212` (nginx 1.28 no Ubuntu; o DNS do domínio aponta para esse IP) |
| Serviço do túnel nesta máquina | `~/.config/systemd/user/tunel-hml.service` (usuário `digicam`; o nome ficou `tunel-hml`) |
| Chave do túnel | `~/.ssh/tunel_hml_ed25519`, usuário `tunel` na AWS, limitada à porta 18081 |
| Encaminhamento | `-R 127.0.0.1:18081:127.0.0.1:80`: porta 18081 da AWS → nginx de **produção** (porta 80) |
| Antes de 2026-10-23 | `-R 127.0.0.1:18081:127.0.0.1:8081` (HML); cópia em `tunel-hml.service.antes-prod-2026-10-23` |

Como a chave na AWS só permite a porta 18081, só um ambiente fica exposto por vez. Para trocar o destino:

```bash
# editar a porta de destino (80 = produção, 8081 = HML) em ~/.config/systemd/user/tunel-hml.service
systemctl --user daemon-reload
systemctl --user restart tunel-hml.service
systemctl --user status tunel-hml.service
```

Para conferir qual ambiente o domínio alcança, fazer uma requisição com um marcador e procurar no log:

```bash
M=verifica-$(date +%s); curl -s -o /dev/null "https://digicam.efabrika.com.br/?$M"
docker logs --since 1m digicam_nginx_1     2>&1 | grep -c "$M"   # produção
docker logs --since 1m digicam-hml_nginx_1 2>&1 | grep -c "$M"   # HML
```

Em 2026-10-23 o domínio respondeu sem pedir a senha do nginx da AWS descrita no item 4.1; a única proteção na
frente da produção é o login da própria aplicação. O restante deste documento é o plano original, escrito para o
HML.

## 1. Objetivo

Permitir que o cliente (quem contrata, não quem opera a portaria) teste a aplicação pela internet, sem abrir
nenhuma porta de entrada nesta rede. A máquina `serverbosque` (10.0.0.126) não tem acesso externo de entrada; hoje
o acesso de manutenção é feito por SSH através do ngrok.

O que será exposto é a **homologação** (`http://10.0.0.126:8081/`), não a produção.

## 2. Arquitetura

```
 cliente ──HTTPS──► hml.<seu-dominio>            serverbosque (rede do condomínio)
                    ┌──────────────────────┐      ┌─────────────────────────────┐
                    │ máquina na AWS       │      │                             │
                    │  nginx :443          │      │  HML (nginx) :8081          │
                    │   ├ certificado TLS  │      │        ▲                    │
                    │   ├ senha de acesso  │      │        │                    │
                    │   └► 127.0.0.1:18081 │◄═════╪════ ssh -R (conexão de saída)│
                    │      (ponta do túnel)│      │                             │
                    └──────────────────────┘      └─────────────────────────────┘
```

A conexão é aberta **daqui para a AWS** (saída na porta 22, que já funciona nesta rede). A AWS nunca inicia
conexão para dentro do condomínio. O ngrok continua existindo só para o SSH de manutenção, como hoje.

| Tema | Escolha | Motivo |
|---|---|---|
| Transporte | túnel SSH reverso (`ssh -R`) | usa só saída; sem serviço de terceiros no caminho do cliente |
| Manter o túnel ativo | serviço `systemd` do usuário, com reinício automático | não há `autossh` na máquina e o `ssh` com keep-alive resolve |
| Entrada pública | nginx na AWS | domínio próprio, HTTPS e senha na frente da aplicação |
| O que expor | só a porta 8081 (HML) | o cliente testa a versão nova sem risco para a portaria |
| Usuário do túnel na AWS | dedicado, sem shell, limitado a uma porta | uma chave vazada não dá acesso à máquina da AWS |

## 3. Pré-requisitos

- Uma instância pequena na AWS (por exemplo `t4g.nano` ou `t3.micro`, Ubuntu LTS) com IP fixo (Elastic IP).
- Um nome de DNS apontando para esse IP, por exemplo `hml.<seu-dominio>` (registro A).
- Grupo de segurança da instância:
  - 443 e 80 abertas para a internet (a 80 só para emitir e renovar o certificado);
  - 22 aberta para o IP de saída do condomínio e para quem administra a instância.
- Senha de `sudo` nesta máquina, para um único comando (item 5.2, passo 5).

## 4. Cuidados antes de liberar para o cliente

1. **Senha na frente da aplicação.** O login da aplicação usa um token que não expira, e o HML tem os mesmos
   usuários e senhas de produção (vieram na cópia do banco). O nginx da AWS pede usuário e senha próprios antes
   de chegar à tela de login.
2. **Usuário próprio para o cliente no HML**, com senha diferente das de produção. Considerar trocar no banco do
   HML as senhas dos demais usuários.
3. **Dados reais.** O HML mostra placas e fotos de veículos reais do condomínio. Decidir se o cliente pode ver
   esses dados; se não, carregar um banco de demonstração antes.
4. **Câmeras ligadas no HML.** Com a leitura das câmeras ligada, o HML diverge de produção (as ações dos
   porteiros não chegam lá). Explicar isso ao cliente ou desligar a leitura durante a demonstração.

## 5. Fases

### 5.1 Na AWS — usuário do túnel

```bash
sudo adduser --disabled-password --gecos "" --shell /usr/sbin/nologin tunel
sudo mkdir -p /home/tunel/.ssh && sudo chmod 700 /home/tunel/.ssh
```

Em `/home/tunel/.ssh/authorized_keys` (chave pública gerada no item 5.2), numa linha só:

```
restrict,port-forwarding,permitlisten="127.0.0.1:18081" ssh-ed25519 AAAA... tunel-hml@serverbosque
```

```bash
sudo chown -R tunel:tunel /home/tunel/.ssh && sudo chmod 600 /home/tunel/.ssh/authorized_keys
```

- `restrict` desliga terminal, agente, X11 e demais recursos; só o encaminhamento de porta fica permitido.
- `permitlisten` limita a chave a abrir **apenas** a porta 18081 em `127.0.0.1` da AWS.
- Manter o padrão `GatewayPorts no` no `sshd`: a ponta do túnel fica acessível só para o nginx local.

### 5.2 Nesta máquina — chave e serviço do túnel

1. Gerar uma chave só para o túnel:

   ```bash
   ssh-keygen -t ed25519 -N "" -C "tunel-hml@serverbosque" -f ~/.ssh/tunel_hml_ed25519
   cat ~/.ssh/tunel_hml_ed25519.pub      # copiar para o authorized_keys da AWS (item 5.1)
   ```

2. Registrar a identidade da AWS e testar à mão:

   ```bash
   ssh-keyscan -t ed25519 <IP-DA-AWS> >> ~/.ssh/known_hosts
   ssh -N -T -i ~/.ssh/tunel_hml_ed25519 -o ExitOnForwardFailure=yes \
       -R 127.0.0.1:18081:127.0.0.1:8081 tunel@<IP-DA-AWS>
   ```

   Com o comando em execução, na AWS: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18081/`
   deve responder `200`. Encerrar o teste com `Ctrl+C`.

3. Criar `~/.config/systemd/user/tunel-hml.service`:

   ```ini
   [Unit]
   Description=Túnel reverso do HML para a AWS
   After=network-online.target

   [Service]
   ExecStart=/usr/bin/ssh -N -T -i %h/.ssh/tunel_hml_ed25519 \
     -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
     -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=yes \
     -R 127.0.0.1:18081:127.0.0.1:8081 tunel@<IP-DA-AWS>
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=default.target
   ```

sudo chown -R digicam:digicam /home/digicam/.config/systemd

4. Ativar:

   ```bash
   systemctl --user daemon-reload
   systemctl --user enable --now tunel-hml.service
   systemctl --user status tunel-hml.service
   ```

5. Fazer o serviço subir no boot, mesmo sem ninguém logado (hoje `Linger=no`):

   ```bash
   sudo loginctl enable-linger digicam
   ```

O `ServerAliveInterval` faz o `ssh` perceber a queda da conexão em cerca de um minuto e sair; o `systemd`
o reinicia em 10 segundos.

### 5.3 Na AWS — nginx, senha e certificado

```bash
sudo apt install -y nginx apache2-utils certbot python3-certbot-nginx
sudo htpasswd -c /etc/nginx/hml.htpasswd cliente       # cria o usuário e pede a senha
```

`/etc/nginx/sites-available/hml`:

```nginx
server {
    listen 80;
    server_name hml.<seu-dominio>;

    # impede indexação por buscadores
    add_header X-Robots-Tag "noindex, nofollow" always;

    auth_basic           "Homologação";
    auth_basic_user_file /etc/nginx/hml.htpasswd;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:18081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hml /etc/nginx/sites-enabled/hml
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d hml.<seu-dominio> --redirect      # emite o certificado e força HTTPS
```

O `certbot` ajusta o arquivo para atender em 443 e redirecionar a 80. A renovação é automática.

Com o túnel parado, o nginx responde `502`; a página pública nunca alcança outra coisa da rede do condomínio.

### 5.4 Validação

| Verificação | Resultado esperado |
|---|---|
| `https://hml.<seu-dominio>/` sem credenciais | pede usuário e senha (401) |
| com as credenciais do nginx | tela de login da aplicação |
| login com o usuário do cliente | tela de Tráfego com dados e fotos |
| recarregar a página | continua logado |
| `http://hml.<seu-dominio>/` | redireciona para HTTPS |
| `systemctl --user stop tunel-hml` nesta máquina | o endereço público passa a responder 502 |
| `systemctl --user start tunel-hml` | volta em alguns segundos |
| reiniciar esta máquina | o túnel sobe sozinho (depende do passo 5 do item 5.2) |
| produção (`http://10.0.0.126/`) | inalterada durante todo o processo |

## 6. Operação

| Tarefa | Onde | Comando |
|---|---|---|
| Ver o estado do túnel | aqui | `systemctl --user status tunel-hml` |
| Ver o log do túnel | aqui | `journalctl --user -u tunel-hml -n 50` |
| Cortar o acesso externo na hora | aqui | `systemctl --user stop tunel-hml` |
| Trocar a senha do cliente | AWS | `sudo htpasswd /etc/nginx/hml.htpasswd cliente` |
| Ver quem acessou | AWS | `/var/log/nginx/access.log` |

## 7. Desmontagem

1. Aqui: `systemctl --user disable --now tunel-hml.service` e apagar o arquivo do serviço e a chave
   `~/.ssh/tunel_hml_ed25519*`.
2. Na AWS: remover a linha do `authorized_keys` do usuário `tunel` (ou o usuário), o site do nginx e, se a
   instância não tiver outro uso, encerrá-la.

## 8. Alternativa rápida, sem AWS: túnel HTTP do ngrok

Serve para uma demonstração pontual. O agente do ngrok desta máquina hoje só tem o túnel de SSH; bastaria
acrescentar um segundo túnel em `~/.ngrok2/ngrok.yml`:

```yaml
tunnels:
  ssh:
    proto: tcp
    addr: 22
  hml:
    proto: http
    addr: 8081
    basic_auth:
      - "cliente:<senha>"
```

e iniciar o agente com os dois túneis (`ngrok start ssh hml`).

Pontos a conferir na conta do ngrok antes de contar com isso: quantos túneis simultâneos o plano permite, se o
endereço público é fixo e se o plano exibe uma página de aviso antes da aplicação. Reiniciar o agente para
carregar a configuração derruba por instantes o SSH de manutenção.

## 9. Pendências relacionadas

- Dar prazo de validade ao token de login da aplicação (hoje não expira).
- Decidir entre dados reais e banco de demonstração para o cliente (item 4.3).
- Se o acesso do cliente virar permanente, restringir o grupo de segurança da AWS aos endereços dele.
