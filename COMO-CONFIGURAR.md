# Central de Conteúdo: como colocar no ar com login próprio

O painel não depende mais do claude.ai. O login, os dados e as fotos ficam no **Supabase**, que é gratuito para começar. O site em si pode ficar na **Netlify** ou na **Vercel**, também de graça.

## O que mudou

- **Login com e-mail e senha.** Você cadastra o e-mail do cliente e o sistema gera uma senha provisória. Ela aparece junto de uma mensagem pronta para copiar e mandar no WhatsApp.
- **Primeiro acesso.** O cliente entra com a senha provisória e o sistema obriga a criar uma senha própria. Ela precisa ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial (ex.: `!@#$%`).
- **Esqueceu a senha.** Em *Acessos dos clientes*, clique em **Resetar senha**. Sai uma nova senha provisória, e no próximo acesso o cliente cria outra senha.
- **Cliente não pagou.** Clique em **Bloquear**. Isso pode ser feito em *Acessos dos clientes*, para uma pessoa, ou em *Clientes*, para todas as pessoas da empresa. O cliente perde o acesso na hora e vê a mensagem "Acesso bloqueado". Para devolver o acesso, clique em **Desbloquear** ou **Liberar acesso**.
- **Alterar senha e Sair.** Os dois botões estão disponíveis para você e para os clientes.

## Arquivos

| Pasta / arquivo | Para que serve |
|---|---|
| `site/index.html` | O painel (novo) |
| `site/config.js` | Onde você cola as 2 chaves do Supabase |
| `supabase/1-estrutura.sql` | Cria tabelas, regras de segurança e o espaço de fotos |
| `supabase/2-migracao-dados.sql` | Traz seus dados atuais (3 clientes, 9 conteúdos, 4 tarefas, 6 leads) |
| `supabase/3-criar-admin.sql` | Transforma o seu login em administradora |
| `supabase/4-faturas-cliente.sql` | Deixa o cliente ver as faturas dele (aba Pagamentos). Quem já rodou o 1 antes desta versão precisa rodar este uma vez no SQL Editor |
| `supabase/funcao-admin-users.ts` | Função segura que cria login, reseta senha e bloqueia |
| `migracao/cA/…mp4` | O vídeo que já estava anexado a um conteúdo |
| `central-conteudo.html` | Versão antiga (claude.ai), guardada como backup |

## Passo a passo (uns 20 minutos)

### 1. Criar o projeto no Supabase
1. Crie uma conta em supabase.com e clique em **New project**. Escolha a região **South America (São Paulo)**.
2. Em **Project Settings → API**, copie a **Project URL** e a chave **anon / publishable**.
3. Cole as duas em `site/config.js`.
   **Nunca** use a chave `service_role` / `secret` nesse arquivo.

### 2. Criar o banco
No menu **SQL Editor**, abra uma consulta nova, cole o conteúdo de `supabase/1-estrutura.sql` e clique em **Run**. Depois faça o mesmo com `supabase/2-migracao-dados.sql`.

### 3. Configurar o login
Em **Authentication → Sign In / Providers → Email**:
- **Desligue** "Allow new users to sign up". Assim só você cria acessos.
- **Desligue** "Confirm email" e "Secure password change".
- (Opcional) Se aparecer *Password requirements* / *Minimum password length*, escolha **Lowercase, uppercase letters, digits and symbols** e **8**. Se não aparecer, pode pular: o painel já exige essas regras na tela de criar senha.

### 4. Criar o seu login de administradora
1. Vá em **Authentication → Users → Add user → Create new user**. Digite seu e-mail e uma senha forte, e marque **Auto Confirm User**.
2. No **SQL Editor**, abra `supabase/3-criar-admin.sql`, troque `SEU-EMAIL-AQUI@exemplo.com` pelo seu e-mail e clique em **Run**.

### 5. Criar a função de acessos
1. Vá em **Edge Functions → Deploy a new function → Via Editor**.
2. Dê o nome **`admin-users`** (exatamente assim).
3. Apague o código de exemplo, cole todo o conteúdo de `supabase/funcao-admin-users.ts` e clique em **Deploy**.

### 6. Subir o vídeo antigo (opcional)
Em **Storage → media**, crie a pasta `cA` e envie o arquivo que está em `migracao/cA/`, mantendo o nome dele.

### 7. Colocar o site no ar
Em app.netlify.com/drop, arraste a pasta **`site`** inteira. O link que aparecer é o endereço do seu painel. Você pode trocar por um domínio próprio depois.

> Se você abrir o `site/index.html` antes de preencher o `config.js`, ele mostra o **modo demonstração**.

## Observações
- Sem login, ninguém vê nada. Cada cliente vê só a própria empresa. Isso é garantido pelo banco, não só pela tela.
- As fotos ficam num espaço privado. O cliente só abre as fotos da própria empresa, por links que expiram em 6 horas.
- As permissões por cliente (aprovar, concluir etapa, tarefas) também valem no banco.
- O plano gratuito do Supabase pausa o projeto depois de 1 semana **sem nenhum acesso**. Com uso normal isso não acontece. Se acontecer, é só reativar no painel do Supabase.
