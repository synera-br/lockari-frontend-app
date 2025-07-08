# Plano de Ação para o Desenvolvimento

Este documento descreve as próximas etapas e tarefas para a implementação de novas funcionalidades na plataforma Lockari Vault.

## Foco Atual: Implementação do "FREE Plan"

A estratégia é lançar o plano FREE o mais rápido possível para obter feedback de usuários reais e iterar sobre o produto. As tarefas abaixo representam o caminho para alcançar o MVP (Minimum Viable Product) do plano FREE.

---

### **Tarefa 1: Estruturar a Navegação**

**Objetivo**: Adicionar os links no menu da barra lateral para as novas funcionalidades.

*   **Ação no Frontend**:
    *   Atualizar a barra lateral de navegação no dashboard (`src/app/[lang]/dashboard/dashboard-client.tsx`).
    *   Adicionar links para:
        *   `Vaults`
        *   `Controle de Acesso`
        *   `Recuperação de Segredos`
        *   `Trilha de Auditoria`
        *   `Configurações`
    *   Inicialmente, esses links apontarão para páginas placeholder.
*   **Ação no Backend**: Nenhuma ação necessária.

---

### **Tarefa 2: Listagem de Vaults**

**Objetivo**: Criar a tela principal onde o usuário gerencia seus cofres.

*   **Ação no Frontend**:
    *   Criar a página em `/dashboard/vaults`.
    *   A página deve conter um cabeçalho "Meus Cofres" e um botão "Criar Novo Cofre".
    *   Implementar um estado vazio para quando o usuário não tiver cofres.
    *   Implementar a exibição da lista de cofres (em formato de lista ou cartões), mostrando nome, data de criação e número de itens.
*   **Ação no Backend (Go)**:
    *   Criar o endpoint `GET /v1/vaults`.
    *   Este endpoint deve retornar a lista de cofres pertencentes ao usuário autenticado, buscando os dados no Firestore.

---

### **Tarefa 3: Criação e Edição de Vaults**

**Objetivo**: Permitir que o usuário crie e edite as informações de um cofre.

*   **Ação no Frontend**:
    *   Implementar um formulário modal para a criação de um novo cofre (campos: nome, descrição).
    *   Criar a interface para editar o nome e a descrição de um cofre existente.
*   **Ação no Backend (Go)**:
    *   Criar o endpoint `POST /v1/vaults` para criar um novo cofre no Firestore.
    *   Criar o endpoint `PUT /v1/vaults/{vaultId}` para atualizar um cofre existente.

---

### **Tarefa 4: Visualização de Itens Dentro de um Vault**

**Objetivo**: Permitir que o usuário veja o conteúdo de um cofre selecionado.

*   **Ação no Frontend**:
    *   Criar a página dinâmica `/dashboard/vaults/[vaultId]`.
    *   Nesta página, exibir os detalhes do cofre e uma lista de todos os itens (secrets, keys, etc.) contidos nele.
*   **Ação no Backend (Go)**:
    *   Criar o endpoint `GET /v1/vaults/{vaultId}/items`.
    *   Este endpoint deve listar todos os itens de um cofre específico. A integração com **OpenFGA** será necessária aqui para validar as permissões de leitura.

---

### **Tarefa 5: Gerenciamento de Itens (CRUD)**

**Objetivo**: Dar ao usuário a capacidade de gerenciar completamente os segredos dentro de um cofre.

*   **Ação no Frontend**:
    *   Na página `/dashboard/vaults/[vaultId]`, implementar os botões e formulários para:
        *   **Criar** novos itens (secret, key, certificate, ssh key).
        *   **Visualizar** o valor de um item (com proteção, ex: valor escondido por padrão e botão "revelar").
        *   **Copiar** o valor de um item para a área de transferência.
        *   **Editar** um item existente.
        *   **Excluir** um item (com diálogo de confirmação).
*   **Ação no Backend (Go)**:
    *   Implementar a API RESTful completa para o gerenciamento de itens, com validação de permissão do OpenFGA em cada operação:
        *   `POST /v1/vaults/{vaultId}/items`
        *   `GET /v1/vaults/{vaultId}/items/{itemId}`
        *   `PUT /v1/vaults/{vaultId}/items/{itemId}`
        *   `DELETE /v1/vaults/{vaultId}/items/{itemId}`

---
### **Próximos Passos após o MVP do FREE Plan**

Uma vez que o ciclo de gerenciamento de vaults e itens esteja completo, podemos prosseguir para:

*   **Tarefa 6: Dashboard (Visualização)**
*   **Tarefa 7: Recuperação de Versões (Histórico de Itens)**
