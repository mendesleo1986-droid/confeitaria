# 🍰 Confeitaria — Gestão de Receitas e Precificação

Sistema web para gestão de confeitaria com **controle de receitas** e **precificação automática**.
Cadastre seus ingredientes, monte fichas técnicas (receitas) e descubra o **preço de venda sugerido**
com base no custo real, mão de obra, embalagem, custos fixos e margem de lucro desejada.

## Funcionalidades

- **Ingredientes (matéria-prima)**: cadastro com preço pago e quantidade da embalagem. O **custo unitário**
  (R$ por grama/ml/unidade) é calculado automaticamente.
- **Receitas / Fichas técnicas**: lista de ingredientes com quantidades, rendimento, modo de preparo e tempo.
- **Precificação automática** de cada receita:
  - Custo dos ingredientes
  - Mão de obra
  - Embalagem
  - Custos fixos (gás, luz, água) como percentual
  - Margem de lucro (markup)
  - **Preço de venda sugerido** e **preço por porção**
- **Painel** com visão geral: total de ingredientes, receitas, custo, receita potencial e lucro potencial.

## Como a precificação é calculada

```
custo_ingredientes = Σ (quantidade × custo_unitário)
subtotal           = custo_ingredientes + mão de obra + embalagem
custos_fixos       = subtotal × (% custos fixos / 100)
custo_total        = subtotal + custos_fixos
preço_de_venda     = custo_total × (1 + margem_lucro / 100)
preço_por_porção   = preço_de_venda / rendimento
```

## Tecnologias

- **Backend**: Node.js + Express
- **Banco de dados**: SQLite (via `better-sqlite3`) — arquivo local, sem servidor externo
- **Frontend**: HTML, CSS e JavaScript puro (sem build)

## Como executar

Requisitos: **Node.js 18+**.

```bash
# 1. Instalar dependências
npm install

# 2. (Opcional) Popular o banco com dados de exemplo
npm run seed

# 3. Iniciar o servidor
npm start
```

Acesse **http://localhost:3000**.

Para desenvolvimento com recarga automática:

```bash
npm run dev
```

### Variáveis de ambiente

- `PORT` — porta do servidor (padrão `3000`).
- `DB_PATH` — caminho do arquivo SQLite (padrão `./confeitaria.db`).

## API

Base: `/api`

| Método | Rota                     | Descrição                                  |
| ------ | ------------------------ | ------------------------------------------ |
| GET    | `/api/resumo`            | Indicadores do painel                      |
| GET    | `/api/ingredientes`      | Lista ingredientes (com custo unitário)    |
| POST   | `/api/ingredientes`      | Cria ingrediente                           |
| PUT    | `/api/ingredientes/:id`  | Atualiza ingrediente                       |
| DELETE | `/api/ingredientes/:id`  | Remove ingrediente (se não estiver em uso) |
| GET    | `/api/receitas`          | Lista receitas (com preços calculados)     |
| GET    | `/api/receitas/:id`      | Detalhe da receita + precificação completa |
| POST   | `/api/receitas`          | Cria receita com ingredientes              |
| PUT    | `/api/receitas/:id`      | Atualiza receita                           |
| DELETE | `/api/receitas/:id`      | Remove receita                             |

### Exemplo: criar uma receita

```bash
curl -X POST http://localhost:3000/api/receitas \
  -H 'Content-Type: application/json' \
  -d '{
    "nome": "Bolo de Cenoura",
    "categoria": "Bolo",
    "rendimento": 10,
    "unidade_rendimento": "fatias",
    "custo_mao_obra": 15,
    "custo_embalagem": 5,
    "percentual_custos_fixos": 10,
    "margem_lucro": 120,
    "ingredientes": [
      { "ingrediente_id": 1, "quantidade": 300 },
      { "ingrediente_id": 3, "quantidade": 3 }
    ]
  }'
```

## Estrutura do projeto

```
confeitaria/
├── server.js              # Servidor Express e rota de resumo
├── src/
│   ├── db.js              # Conexão SQLite e aplicação do schema
│   ├── schema.sql         # Definição das tabelas
│   ├── precificacao.js    # Lógica de cálculo de custos e preços
│   ├── seed.js            # Dados de exemplo
│   └── routes/
│       ├── ingredientes.js
│       └── receitas.js
└── public/                # Frontend
    ├── index.html
    ├── css/styles.css
    └── js/{api.js,app.js}
```

## Observações sobre unidades

Cada ingrediente tem uma **unidade base** (`g`, `ml` ou `un`). As quantidades nas receitas devem
ser informadas nessa mesma unidade base. Por exemplo, se a farinha está em gramas, use `400` para 400 g.
