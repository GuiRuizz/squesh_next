# Análise Pré-Implementação — Admin Panel Squesh

> Documento gerado a partir da leitura integral de `squesh_golang` (backend) e
> `squesh_flutter` (app). **Nenhum arquivo dos dois repositórios foi alterado.**
> Data da análise: 01/10/2026 · Backend: `de59296` (main, com trabalho WIP não commitado)

---

## 0. Resumo executivo

O backend **já possui um núcleo administrativo funcional**, mas ele cobre
apenas **Loja (catálogo + pedidos)**. As três(três) funcionalidades pedidas
explicitarmente — **Dashboard**, **Entradas** e **Trilhas** — estão
**parcialmente cobertas**:

| Área pedida | Cobertura atual | Veredicto |
|---|---|---|
| Dashboard | `GET /admin/overview` (8 contadores) | ⚠️ Insuficiente — sem usuários, sem séries temporais |
| Entradas (pedidos) | `GET /admin/orders` + `POST /shop/orders/:id/pay` | 🟡 Lista e confirmação ok; falta busca, período, detalhe e cancelamento |
| Entregas (produtos entregues) | ❌ Nenhuma | 🔴 Falta endpoint admin de inventário/entregas |
| Trilhas (CRUD completo) | Só `POST /trails` e `POST /trails/:id/items` | 🔴 Falta editar, excluir, ativar/desativar, listar com filtro |
| Usuários | ❌ Nenhuma | 🔴 Falta endpoint admin de usuários |
| Planos | `GET /plans` (público, somente ativos) | ✅ Tela pronta · CRUD admin falta |
| Assinaturas | `GET /admin/subscriptions` (array cru, sem paginação) | 🟡 Leitura apenas |

**Conclusão:** dá para montar a primeira versão do painel **inteiramente com
endpoints existentes** para *ler* pedidos, catálogo, trilhas e assinaturas. Mas
**Trilhas (item 4 do escopo) e Entregas (item 3) não são possíveis sem
endpoints novos**, porque a操作 de escrita e a leitura de "produtos entregues"
simplesmente não existem.

---

## 1. O que já existe e pode ser reutilizado

### 1.1 Infraestrutura de API (reutilizar integralmente)

**Autenticação** — `internal/handler/auth_handler.go`, `internal/middleware/auth.go`

- `POST /api/v1/auth/login` → devolve `{ token, refresh_token, expires_in, token_type, user{id,name,email,role} }`
- `POST /api/v1/auth/refresh` → rotação de refresh token (o antigo é revogado na mesma transação)
- `POST /api/v1/auth/logout` → revoga um refresh token específico
- JWT com claim de **role** (`utils.GenerateAccessToken(user.ID, user.Role)`)
- `AuthMiddleware` popula `userID` e `userRole` no contexto do Gin
- `AdminMiddleware` bloqueia com **403** quem não tem `role == "admin"`

> **O painel pode usar exatamente a mesma autenticação do app Flutter.** Não há
> necessidade de criar sessão, cookie ou credencial paralela. Um usuário com
> `role: "admin"` no banco já se autentica no painel e é autorizado.

**CORS** — `internal/middleware/cors.go`

```go
Access-Control-Allow-Origin: *                    // já liberado
Access-Control-Allow-Headers: ... Authorization ...
Access-Control-Allow-Methods: POST, OPTIONS, GET, PUT, PATCH, DELETE
```

> **O navegador pode chamar a API direto.** Nenhuma alteração de CORS é
> necessária para o painel funcionar em dev.

**Upload de arquivos** — `internal/handler/upload_handler.go`

Fluxo presign já pronto e **reutilizável pelo painel**:
1. `POST /api/v1/uploads/presign` `{filename, content_type, folder}` → `{upload_url, image_url, key, expires_in}`
2. `PUT` direto na `upload_url` (binário, sem header de auth — a assinatura na query string autentica)
3. Usar o `image_url` retornado

Limites: 5MB, extensões `jpg|jpeg|png|webp|gif`, TTL 15min.
⚠️ **`folder` aceita apenas `posts` ou `avatars`** (`binding:"oneof=posts avatars"`).

**Formato de erro (padronizar no cliente do painel)** — o backend responde **sempre**:

```json
{ "error": "mensagem em português" }
```

O app Flutter já tem uma função `describeError()` que prioriza essa string do Go
e só cai em mensagens genéricas por status HTTP. **O painel deve fazer o mesmo**
— reaproveitar a mensagem do backend é sempre melhor que um texto genérico.

**Paginação (padrão já estabelecido)** — `handler/helpers.go:pageLimit`

```json
{ "data": [...], "meta": { "total_items": 0, "page": 1, "limit": 20, "total_pages": 0 } }
```

`page` a partir de 1, `limit` default 20, máximo 100 (fora da faixa → cai no default).

**Dinheiro** — sempre `price_cents` / `total_cents` (inteiro, centavos).
O app formata com `(cents/100).toStringAsFixed(2).replaceAll('.', ',')` → `R$ 119,90`.
**Nunca usar float para dinheiro** — comentário explícito no código Go.

### 1.2 Regras de negócio a preservar (não duplicar no painel)

| Regra | Onde está | Relevância para o painel |
|---|---|---|
| Limite diário: **1 conclusão/dia por tipo de trilha** | `trail_handler.go:dailyLimitReachedExcept` | Ao excluir/editar uma etapa, avisar que o progresso do usuário pode recalcular |
| Etapa só conta como concluída com **todas** as partes marcadas | `applyItemProgress` + `itemStepsRequired` | O painel deve mostrar "3/5 refeições marcadas" como progresso |
| `required_hour` trava a etapa pela hora **local do dispositivo** | `trail_detail_modal.dart:_isUnlocked` | O painel deve explicar que é hora de relógio, não do servidor |
| Pedido nasce `pending`; **inventário só é criado na confirmação** | `MarkOrderPaid` (transação + lock pessimista) | O botão "Confirmar pagamento" do painel é o gatilho do inventário |
| 2ª confirmação do mesmo pedido → **409** | `errOrderAlreadyConfirmed` + `FOR UPDATE` | O painel deve tratar 409 como "já confirmada", não como erro |
| Item com dono no inventário → **409 mandando desativar** | `DeleteItem` | O painel deve oferecer "Desativar" como alternativa ao "Excluir" |
| Preço/nome no pedido são **snapshot** do momento da compra | `ShopOrderItem` | Editar preço no catálogo **não** altera pedidos antigos — o painel deve mostrar o preço histórico da linha |
| Cancelar assinatura ≠ reembolso: vale até `renews_at` | `UserSubscription.IsCurrent` | O painel deve separar "ativa" de "cancelada mas válida" |
| 1 pedido pendente por usuário | `CreateOrder` | Contexto para a coluna "pedidos aguardando" |

### 1.3 Modelos e DTOs reutilizáveis

**Domínio de Trilhas** (`internal/domain/trail.go`)

```
Trail      { id, title, description, type: "workout"|"nutrition", level, items[], created_at, updated_at }
TrailItem  { id, trail_id, order, title, description, value, steps[] (jsonb), created_at, completed(transiente) }
StepSpec   { slot, title, description, value, required_hour, done(transiente) }
```

> ⚠️ `Trail` **não possui `is_active`**. Ver item 6.1.

**Domínio de Loja** (`internal/domain/shop.go`)

```
ShopItem       { id, name, description, price_cents, image_url, category, rating, is_active, created_at }
ShopOrder      { id, user_id, status, total_cents, checkout_url, payment_provider,
                 external_payment_id, paid_at, canceled_at, items[], created_at, updated_at }
ShopOrderItem  { id, order_id, item_id, name, unit_price_cents, quantity }
UserInventory  { id, user_id, item_id, item, created_at }
```

**Billing** (`internal/domain/billing.go`) — `Plan`, `UserSubscription`, `PaymentMethod`, `Address`
**Arena/XP** (`internal/domain/arena.go`) — `XPEvent` (razão de XP, com `day_key` para recorte temporal)
**Usuário** (`internal/domain/user.go`) — `User` (com `role`, `streak_count`, `points`), `UserTrailProgress`

**DTOs de admin já prontos** (`internal/dto/admin_dto.go`) — 7 structs:
`AdminOverviewDTO`, `AdminCustomerDTO`, `AdminAddressDTO`, `AdminOrderDTO`,
`AdminShopItemDTO`, `AdminSubscriptionDTO`

### 1.4 Terminologia de domínio (obrigatória para o painel)

O conceito central do app é uma **hierarquia de 3 níveis** com nomes que
**mudam conforme o tipo da trilha**. A documentação está no próprio código
(`trail_entry.dart:1-4` e `trail.go:17-21`):

```
Trail    →  "Trilha"
   │
   ├── TrailItem  →  trilha de TREINO:     uma SESSÃO de treino
   │              →  trilha de NUTRIÇÃO:  um DIA
   │
   └── StepSpec   →  trilha de TREINO:     um EXERCÍCIO
                   →  trilha de NUTRIÇÃO:  uma REFEIÇÃO
```

O app resolve a ambiguidade com rótulos contextuais (`home_screen.dart`):
- `stepLabel` = `"o dia"` (nutrição) / `"o treino"` (workout)
- `"Liberado a partir das 8h"` (refeição) / por horário no treino
- `"2/5 exercícios"` (workout) / `"3/5 refeições"` (nutrição)

> **O painel deve seguir exatamente essa lógica.** Never exiba "Steps",
> "Etapa interna" ou "Items" ao usuário. Use o vocabulário do tipo da trilha.

**Slots de alimentação** — slugs `snake_case` em português, sem enum no código.
O histórico (`daily_meals.dart`, hoje órfão) indica os 4 canônicos:
`cafe_manha`, `almoco`, `lanche_tarde`, `jantar`. **O app nunca exibe o `slot`
na UI** — apenas o `title`. O painel deve oferecer os slots como sugestão, mas
**não restringir** (o `title` é o que o usuário vê).

**Níveis** — `iniciante`, `intermediario`, `avancado`. `Trail.Level` é
`varchar(20)` **sem validação no Go** e o app exibe o valor **cru, sem
traduzir** (`"${trail.level} • ${completed}/${total}"`). Ou seja: **um valor
errado no banco aparece errado no app**. O painel deve restring via select e
normalizar para minúsculas sem acento na escrita.

### 1.5 Design system (paleta reaproveitável)

O app tem **três vermelhos diferentes** circulando (documentado no código):

| Hex | Nome | Onde domina |
|---|---|---|
| `0xFF0D0D0D` | background global | todo o app |
| `0xFF141414` / `0xFF161616` / `0xFF1A1A1A` | superfícies de card | todo o app |
| `0xFF222222` / `0xFF262626` / `0xFF2C2C2C` | bordas e divisores | todo o app |
| **`0xFFFF1E40`** | `SettingsColors.accent` | **Loja, Config, Arena, bottom nav** ← mais visível |
| `0xFFE50914` | `AppTheme.crimsonRed` | tema, Home, Arena |
| `0xFFFF2E3B` | `AppTheme.crimsonAccent` | destaques, snackbar |
| `0xFF888888` / `0xFF8C8C8C` | texto muted | todo o app |
| `0xFF4ADE80` | sucesso / zona de promoção | feedback |
| `0xFFFF2E3B` | erro / zona de rebaixamento | feedback |
| `Colors.amber` | status `pending` | status de pedido |

**Padrão tipográfico:** todo cabeçalho é **UPPERCASE com `letterSpacing` 1.1–1.6**.
Raios: 8 (input) / 12–16 (card) / 999 (pill). Modo escuro.

> **Recomendação:** o painel herda o modo escuro e o acento `0xFFFF1E40` (o que
> domina a UI atual), mantendo a mesma linguagem de cabeçalhos uppercase e
> cards de superfície escura com borda sutil.

---

## 2. Endpoints do backend que serão utilizados

### 2.1 Autenticação (reutilizar sem alterações)

| Método | Endpoint | Uso no painel |
|---|---|---|
| POST | `/auth/login` | Tela de login; guarda token + refresh |
| POST | `/auth/refresh` | Renovar sessão (mesmo interceptor do app Flutter) |
| POST | `/auth/logout` | Botão "Sair" |
| GET | `/users/me` | Validar sessão e ler `role` (guarda de rota) |

### 2.2 Endpoints admin existentes (usar diretamente)

| Método | Endpoint | O que entrega | Limitação para o painel |
|---|---|---|---|
| GET | `/admin/overview` | 8 contadores: receita, pedidos por status, assinaturas ativas, MRR estimado, nº de trilhas, itens ativos | Objeto puro (sem envelope). Sem usuários, sem séries temporais, sem métricas de trilha |
| GET | `/admin/orders?status=&page=&limit=` | Pedidos com `items[]`, `customer{id,name,email}` e `address` (endereço padrão) | Só filtra por status. **Sem busca** por cliente/id, **sem filtro de período**, sem ordenação configurável |
| GET | `/admin/shop?search=&page=&limit=` | Catálogo completo com `is_active` e `created_at` | Busca só por nome. **Sem filtro por categoria** nem por `is_active` |
| GET | `/admin/subscriptions` | Assinaturas com `plan` e `customer` | **Array cru, sem paginação** e sem filtros |
| POST | `/shop/orders/:orderId/pay` | Confirma pagamento e **cria o inventário** (transação atômica) | Idempotente: 2ª chamada → 409 |
| POST | `/shop` | Cria item de catálogo | `image_url` com `binding:"url"` (exige URL absoluta válida) |
| PUT | `/shop/:id` | Atualiza item (parcial, ponteiros) | 409 se tiver dono → desativar |
| DELETE | `/shop/:id` | Remove item | 409 se alguém já comprou |
| POST | `/trails` | Cria trilha (`type` validado: `workout\|nutrition`) | Só criar |
| POST | `/trails/:id/items` | Cria etapa com `steps[]` | Só criar. ⚠️ `order` com `binding:"required"` **rejeita 0** |

### 2.3 Endpoints públicos a reutilizar como leitura

| Método | Endpoint | Uso no painel | Cuidado |
|---|---|---|---|
| GET | `/trails?type=workout\|nutrition` | Listar trilhas | **Array cru, sem paginação, sem busca, sem filtro por nível.** Traz `items[]` completo (payload pesado) |
| GET | `/trails/:id` | Detalhe da trilha | ⚠️ **Resposta muda conforme o token:** sem token → objeto cru; **com token** → `{ trail, progress }`. Normalizar |
| GET | `/plans` | Vitrine de planos | ⚠️ Retorna **só ativos** e o DTO **não expõe** `is_active` nem `sort_order` |
| GET | `/shop?search=&page=&limit=` | Fallback de catálogo | Só itens **ativos** |
| POST | `/uploads/presign` + `PUT` na `upload_url` | Upload de imagem de produto | ⚠️ `folder` **rejeita** `shop` |

### 2.4 Inconsistências de envelope a normalizar no cliente

| Endpoint | Formato |
|---|---|
| `/admin/overview` | objeto puro |
| `/admin/orders`, `/admin/shop` | `{ data, meta }` |
| `/admin/subscriptions`, `/trails`, `/plans`, `/users/me/addresses` | **array puro** |
| `/shop`, `/shop/inventory` | `{ data }` |
| `/arena/me` | `{ data, tiers, period }` |
| `/trails/:id` | cru **ou** `{ trail, progress }` (depende do token) |
| `/trails/me` | `{ trails, today_completed }` |

> O cliente do painel deve ter **um único normalizador** (`unwrapList`,
> `unwrapOne`) para que nenhuma tela precise saber o formato de cada endpoint.

---

## 3. Telas/módulos que o Admin Panel deverá possuir

### Navegação proposta

```
┌─ Dashboard
├─ Entradas .............. pedidos recebidos + confirmação de pagamento
├─ Entregas .............. produtos entregues (inventário) + histórico
├─ Catálogo .............. itens da loja (CRUD completo já existe)
├─ Trilhas
│   ├─ Trilhas de Treino ............. (type=workout)
│   └─ Trilhas de Alimentação ....... (type=nutrition)
├─ Assinaturas
│   ├─ Assinaturas ....... assinaturas ativas e canceladas
│   └─ Planos ............ catálogo de planos Pro
├─ Usuários .............. lista, busca, detalhe, role
└─ Avisos ................ notificações enviadas aos usuários (novo)
```

**Módulos identificados durante a análise e acrescentados ao pedido original:**

| Módulo | Motivo |
|---|---|
| **Catálogo** | Já existe CRUD admin completo.-product da loja precisa de gestão de preço, categoria e ativação — é o módulo mais maduro do backend e não estava no pedido |
| **Assinaturas / Planos** | `AdminOverviewDTO` já calcula MRR e assinaturas ativas. `/admin/subscriptions` já existe. Deixar isso sem tela desperdiça dados prontos |
| **Usuários** | Um painel sem lista de usuários não consegue responder "quem comprou isso?" nem "quem é admin?" |
| **Avisos** | `NotificationService` existe e é acionado por pedido pago. Falta só um disparo em massa (p.ex.: "nova trilha disponível") |

### Detalhamento por tela

#### 3.1 Dashboard
- **KPIs principais:** receita total, pedidos pagos/pendentes/cancelados, assinaturas ativas, MRR estimado, itens de catálogo ativos, total de trilhas
- **KPIs a adicionar:** total de usuários, novos usuários (7/30 dias), entregas (unidades no inventário), taxa de conclusão de pedidos
- **Gráficos:** receita por dia/mês; pedidos por dia; novos usuários por dia; concluções de trilha por dia (`UserTrailProgress` com `completed_at`)
- **Listas auxiliares:** últimos 5 pedidos pendentes (com ação rápida "Confirmar pagamento"), trilhas mais concluídas, itens mais vendidos
- **Alertas:** pedidos pendentes há mais de X dias; trilhas de treino sem nenhum item; usuário checkpoint — quantidade de trilhas sem itens

#### 3.2 Entradas (Pedidos)
- **Tabela:** ID (curto), cliente (nome + email), data, itens (contagem), total, status, endereço de entrega
- **Filtros:** status (`pending`/`paid`/`canceled`), busca por nome/email/ID, período (de/até), valor mínimo
- **Detalhe (drawer/página):** cabeçalho com status e datas, itens com **preço histórico** (snapshot), total, cliente clicável, endereço padrão
- **Ações:** "Confirmar pagamento" (só `pending`), "Cancelar pedido" (novo endpoint)
- **Estados vazios:** por status, por filtro, sem pedidos no período

#### 3.3 Entregas (Produtos entregues)
- **Tabela:** unidade entregue, produto, cliente, data de aquisição, categoria, preço pago
- **Filtros:** produto, cliente, categoria, período
- **Detalhe:** agrupar por cliente → "usuários com mais itens", "itens mais entregues"
- **Observação de domínio:** `UserInventory` **não tem `order_id`** — não é possível ligar a unidade ao pedido de origem pela API atual. Ver item 6.2
- **Escopo de "entrega":** a loja é **100% digital**. Não há `shipment`, `tracking_code` nem `order.address_id`. Endereço é do **perfil** do usuário (aba "ENTREGAS" das Configurações) e é anexado ao pedido só no momento da leitura (`AdminOrderDTO.address`). Ver item 6.3

#### 3.4 Catálogo (Produtos)
- **Tabela:** imagem, nome, categoria, preço, rating, status (ativo/inativo), criado em
- **Filtros:** busca (existe no backend), categoria, ativo/inativo
- **Formulário:** nome, descrição, preço (em centavos com máscara BRL), categoria, rating (0–5), imagem (upload presign ou URL), ativo
- **Ações:** criar, editar, ativar/desativar, excluir (com fallback "desativar" em 409)
- **Categorias:** texto livre em português; os chips do app são **derivados do catálogo** (`shop_providers.dart`) — o painel deve derivar as opções do mesmo jeito, sem tabela nova

#### 3.5 Trilhas (o módulo mais crítico)
- **Lista separada por tipo** (`?type=workout` / `?type=nutrition`)
- **Tabela:** título, nível, nº de etapas, concluídas, criado em, status ativo
- **Editor de trilha:** título, descrição, tipo, nível, ativo/inativo
- **Editor de etapas** (a parte mais complexa do painel):
  - Lista ordenada por `order`, com reordenação
  - Cada etapa: `title`, `description`, `value`, `order`
  - **Sub-editor de `steps[]`** com repetição: `slot` (sugestão por tipo), `title`, `description`, `value`, `required_hour` (0–23, 0 = sem trava)
  - **Pré-visualização contextual** do que o usuário verá: para `nutrition`, "Dia 1 — 4 refeições"; para `workout`, "Sessão 1 — 5 exercícios"
  - **Alerta de impacto:** avisar que alterações em etapas já concluídas por usuários alteram o progresso deles
- **Ações extras:** duplicar trilha, gerar trilha por remix (`POST /trails/generate`), excluir

#### 3.6 Assinaturas
- **Tabela:** cliente, plano, status (ativa / cancelada mas válida), início, renovação, valor, MRR
- **Filtros:** status, plano, período de renovação
- **Detalhe:** histórico de planos do cliente, valor por período
- **Planos:** CRUD de nome, descrição, preço, período, badge, destaque, popular, ativo, ordem de exibição, lista de benefícios
- **Ações:** (novo) forçar cancelamento, reativar, estender renovação

#### 3.7 Usuários
- **Tabela:** nome, email, papel (`user`/`admin`), ofensiva, pontos, plano, criado em
- **Filtros:** busca, papel, plano (Pro/free)
- **Detalhe:** perfil, preferências de notificação, assinatura ativa, endereços, pedidos, itens no inventário, progresso em trilhas
- **Ações:** promover/rebaixar a admin (endpoint novo), ver detalhe

#### 3.8 Avisos
- Enviar notificação para um usuário, para um segmento (assinantes Pro) ou para todos
- Histórico de envios

---

## 4. Informações que cada tela deve apresentar

| Tela | Colunas / campos |
|---|---|
| **Dashboard** | KPI: receita (`shop_revenue_cents`), pedidos por status, assinaturas ativas, MRR, trilhas, itens ativos, usuários, entregas. Séries: receita/pedidos/usuários/conclusões por dia. Alertas: pedidos pendentes, trilhas vazias. Shortcuts: últimos pedidos pendentes, trilhas mais concluídas, top itens |
| **Entradas** | `id`, `customer.name`, `customer.email`, `created_at`, contagem de `items[]`, `total_cents`, `status` (badge), `address` (resumo), `paid_at`/`canceled_at`. Detalhe: cada `items[]` com `name`, `quantity`, `unit_price_cents`, `line_total_cents` (**snapshot**), total geral, endereço completo (`recipient`, `street`, `number`, `complement`, `zip_code`, `city`, `state`, `label`) |
| **Entregas** | `item.name`, `item.category`, `item.image_url`, `price_cents`, `customer`, `acquired_at` (`UserInventory.created_at`). Derivados: unidades por cliente, por produto, por categoria |
| **Catálogo** | `name`, `image_url`, `category`, `price_cents`, `rating`, `is_active`, `created_at`. Formulário: todos + upload |
| **Trilhas — lista** | `id`, `title`, `type`, `level`, nº de `items`, concluídas (agregado), `created_at`, ativo. Filtros: nível, busca por título |
| **Trilhas — editor** | `title`, `description`, `type`, `level`, ativo. Etapas: `order`, `title`, `description`, `value`, `steps[]` (`slot`, `title`, `description`, `value`, `required_hour`) |
| **Assinaturas** | `customer.name/email`, `plan.name`, `plan.price_cents`, `plan.period_months`, `status`, `started_at`, `renews_at`, `canceled_at`, `is_current` |
| **Planos** | `name`, `slug`, `description`, `price_cents`, `period_months`, `badge`, `highlight`, `is_popular`, `is_active`, `sort_order`, `features[]` |
| **Usuários** | `name`, `email`, `role`, `streak_count`, `points`, `avatar_url`, `bio`, `created_at`, `last_active_date`, assinatura ativa, nº de pedidos, nº de itens |

---

## 5. Operações de CRUD necessárias (por módulo)

| Módulo | Listar | Buscar/Filtrar | Criar | Editar | Excluir | Ativar/Desativar | Ações extras |
|---|---|---|---|---|---|---|---|
| **Dashboard** | ✅ existe | — | — | — | — | — | — |
| **Entradas** | ✅ existe | ⚠️ só status | — | ❌ | ❌ | — | ⚠️ confirmar pagamento ✅ · cancelar ❌ |
| **Entregas** | ❌ | ❌ | — | — | — | — | — |
| **Catálogo** | ✅ existe | ⚠️ só nome | ✅ existe | ✅ existe | ✅ existe | ✅ via `is_active` | — |
| **Trilhas** | ⚠️ público sem paginação | ❌ | ✅ existe | ❌ | ❌ | ❌ sem coluna | ❌ duplicar |
| **Etapas** | ✅ embutida | ❌ | ✅ existe | ❌ | ❌ | — | ❌ reordenar |
| **Steps** | ✅ embutida | — | ✅ embutida | ❌ | ❌ | — | — |
| **Assinaturas** | ✅ (sem paginação) | ❌ | — | ❌ | ❌ | — | ❌ cancelar/reativar/estender |
| **Planos** | ⚠️ só ativos | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Usuários** | ❌ | ❌ | ❌ | ❌ role | ❌ | ❌ | — |
| **Avisos** | ❌ | ❌ | ❌ | — | — | — | — |

**Resumo:** de 11 módulos, **3 estão prontos** (Dashboard parcial, Catálogo
completo, Entradas parcialmente), **4 precisam de leitura nova**
(Entregas, Usuários, Planas admin, Assinaturas paginadas) e **Trilhas precisa de
escrita nova** (é o único bloqueador do escopo principal).

---

## 6. Pontos que precisam de novas APIs ou alterações no backend

> Todas as sugestões abaixo são **aditivas** (rotas novas, handlers novos,
> colunas novas com default). **Nenhuma exige refatorar** o que já funciona.
> Detalhamento em `docs/plano-backend.md` (a ser escrito após a decisão).

### 6.1 🔴 Trilhas — bloqueador crítico (escopo principal do pedido)

| # | Gap | Solução sugerida | Impacto |
|---|---|---|---|
| 6.1.1 | **`Trail` não tem `is_active`** → ativar/desativar é impossível | Adicionar coluna `is_active bool default true` (o `AutoMigrate` já roda sozinho em `db.go:58`) | Coluna nova |
| 6.1.2 | **Não existe editar trilha** | `PUT /admin/trails/:id` (parcial, espelhando `UpdateShopItemDTO`) | Rota nova |
| 6.1.3 | **Não existe excluir trilha** | `DELETE /admin/trails/:id` com 409 se houver `UserTrailProgress` ligado (mesma política do `DeleteItem`) | Rota nova |
| 6.1.4 | **Listagem sem paginação/busca/filtro** | `GET /admin/trails?type=&level=&search=&page=&limit=` com `{data, meta}` (padrão já existente) | Rota nova |
| 6.1.5 | **Não existe editar/excluir etapa** | `PUT` e `DELETE /admin/trails/items/:itemId` | Rotas novas |
| 6.1.6 | **Não existe reordenar etapas** | `PATCH /admin/trails/:id/items/order` com `[{item_id, order}]` | Rota nova |
| 6.1.7 | **Carga útil pesada** — `GET /trails` traz todas as trilhas com todas as etapas e todos os steps | O endpoint admin de 6.1.4 traz **sem** `items`; o detalhe traz com | Rota nova |
| 6.1.8 | ⚠️ `CreateTrailItemDTO.Order` com `binding:"required"` **rejeita `order: 0`** | Não é bug a corrigir, mas o formulário **deve** comecçar em 1 e o painel deve enviar sempre `>= 1` | Documentar no painel |
| 6.1.9 | `Trail.Level` e `StepSpec.Slot` sem validação no Go | Aceitar no endpoint admin, mas **normalizar** (minúsculas, sem acento) antes de gravar | Regra do painel |

> **Veredicto:** o item 4 do escopo ("criar e administrar as trilhas", "editar",
> "ativar/desativar", "gerenciar conteúdos") **não é viável hoje**. É o conjunto
> de mudanças mais prioritário.

### 6.2 🔴 Entregas / produtos entregues

| # | Gap | Solução sugerida |
|---|---|---|
| 6.2.1 | Nenhum endpoint lista `UserInventory` globalmente (só `/shop/inventory` do próprio usuário) | `GET /admin/inventory?item_id=&user_id=&category=&search=&page=&limit=` → `{data, meta}` |
| 6.2.2 | `UserInventory` **não tem `order_id`** → impossível dizer de qual pedido veio a unidade | Adicionar `order_id` (nullable) e preencher em `MarkOrderPaid`; backfill opcional |
| 6.2.3 | Não há agregados (top clientes, top produtos) | `GET /admin/inventory/summary` ou incluir no `overview` |

### 6.3 🟡 Entregas físicas (esclarecimento de escopo)

A loja é **inteiramente digital**. Não existe:
- `ShopOrder.address_id` (o endereço vem do perfil, anexado só na leitura)
- `shipment`, `tracking_code`, `shipping_*`

**Pergunta em aberto:** o painel deve tratar "entrega" como
(a) **unidades entregues no inventário digital** (leitura de 6.2), ou
(b) **rastreamento físico** (exige modelo `Shipment` novo, bem maior)?

> A leitura do pedido mostra que o endereço **é** coletado e **é** exibido ao
> admin (`AdminOrderDTO.address` com todos os campos). Isso sugere que a intenção
> original era (b), mas nada foi implementado.

### 6.4 🔴 Usuários

| # | Gap | Solução sugerida |
|---|---|---|
| 6.4.1 | Nenhum endpoint admin de usuários | `GET /admin/users?search=&role=&page=&limit=` → `{data, meta}` |
| 6.4.2 | Nenhum detalhe de usuário | `GET /admin/users/:id` com assinatura, endereços, contagens de pedidos/itens/progresso |
| 6.4.3 | **Não existe forma de promover a admin pela API** — `Register` sempre cria `role: "user"` (`auth_handler.go:118`) | `PATCH /admin/users/:id/role` |
| 6.4.4 | Total de usuários / novos usuários para o Dashboard | Incluir no `overview` ou em `GET /admin/users/stats` |
| 6.4.5 | Bloqueio de usuário | `User` não tem `is_active`/`banned_at` → precisa de coluna, se desejado |

### 6.5 🟡 Dashboard

`GET /admin/overview` hoje devolve 8 contadores planos. Faltam:

| # | Gap | Solução sugerida |
|---|---|---|
| 6.5.1 | Sem séries temporais (para gráficos) | `GET /admin/overview/timeseries?days=30&metric=revenue\|orders\|users\|completions` |
| 6.5.2 | Sem total de usuários / novos usuários | Ampliar `AdminOverviewDTO` (aditivo, não quebra o app — o app não consome essa rota) |
| 6.5.3 | Sem métricas de trilhas (conclusões, itens, trilhas vazias) | Ampliar `AdminOverviewDTO` |
| 6.5.4 | Sem itens mais vendidos | `GET /admin/shop/top` ou incluir no overview |
| 6.5.5 | `EstimatedMrrCents` usa divisão inteira (`PriceCents / PeriodMonths`) → trunca | Considerar `math.Round` no backend (mudança de 1 linha, mas **é** alteração de comportamento) |

### 6.6 🟡 Assinaturas e Planos

| # | Gap | Solução sugerida |
|---|---|---|
| 6.6.1 | `GET /admin/subscriptions` sem paginação nem filtros | Adicionar `page`/`limit`/`status`/`plan_id` e passar a `{data, meta}` (⚠️ quebra o formato atual — verificar se o app consome; **não consome**) |
| 6.6.2 | Nenhuma ação admin (cancelar/reativar/estender) | `POST /admin/subscriptions/:id/cancel`, `/reactivate`, `/extend` |
| 6.6.3 | Nenhum CRUD de planos | `GET /admin/plans` (com `is_active` + `sort_order`), `POST`, `PUT`, `DELETE` |
| 6.6.4 | `GET /plans` não expõe `is_active`/`sort_order` | Novo DTO admin — **não** alterar `PlanResponseDTO` (o app consome) |

### 6.7 🟡 Upload de imagem de produto

| # | Gap | Solução sugerida |
|---|---|---|
| 6.7.1 | `presign` rejeita `folder: "shop"` (`oneof=posts avatars`) | Ampliar o `oneof` para incluir `shop` (ou remover a restrição) |
| 6.7.2 | Alternativa sem tocar no backend | O painel aceita colar a URL da imagem manualmente |

### 6.8 🟢 Avisos / Notificações

| # | Gap | Solução sugerida |
|---|---|---|
| 6.8.1 | `NotificationService.CreateNotification` só cria para **um** usuário | `POST /admin/notifications { user_id \| segment: "all"\|"pro", title, message, type }` |
| 6.8.2 | Sem histórico de envios | `GET /admin/notifications` |

### 6.9 Estado do repositório `squesh_golang` — **CORRIGIDO**

> **Correção (verificada contra `routes.go` em 05/10/2026).** A versão anterior
> desta seção afirmava que as rotas de pagamento Stripe **não** estavam
> registradas. Isso está errado: elas estão. O que segue é a situação real.

`git status` mostra **6 arquivos modificados e 5 novos não commitados** em
`main`, incluindo `internal/handler/payment_handler.go` e
`internal/service/stripe.go`. Existe um **módulo de pagamentos Stripe em
construção**, mas ele **JÁ ESTÁ REGISTRADO** no router:

| Rota | Handler | Efeito no painel |
|---|---|---|
| `POST /shop/orders/:orderId/pay` | `PaymentHandler.PayOrder` | App pede o segredo de cobrança |
| `POST /users/me/subscription` | `PaymentHandler.Subscribe` | Contratação pelo app |
| `POST /payments/portal` | `PaymentHandler.CreatePortalSession` | — |
| `GET /payments/config` | `PaymentHandler.GetConfig` | Bandeira `is_stripe_configured` |
| `POST /webhooks/stripe` | `PaymentHandler.Webhook` | Ativa pedido/assinatura sozinho |
| `PUT /admin/plans/:planId/stripe-price` | `BillingHandler.SetPlanStripePrice` | **Única escrita de plano hoje** |

**Consequências práticas já tratadas nas telas desta rodada:**

1. `PUT /admin/plans/:planId/stripe-price` é alcançável, então a tela de
   Assinaturas já expõe "Ligar / Trocar `price_xxx`". Ela responde **503**
   enquanto `STRIPE_SECRET_KEY` não estiver no `.env` — o painel mostra o texto
   do Go, sem tratamento especial.
2. `POST /admin/orders/:orderId/pay` **continua sendo a via do admin** e não
   fica redundante: o webhook só roda depois que o Stripe confirma, e nenhum dos
   dois substitui o outro.
3. A tela de Assinaturas lê os planos por `GET /plans` (público), e **não** por
   `GET /admin/plans` — este último ainda não existe. Ver §6.6.4.

### 6.10 Resumo de esforço no backend

| Prioridade | Módulo | Itens | Esforço |
|---|---|---|---|
| 🔴 P0 | Trilhas | 6.1.1–6.1.7 | ~2 dias |
| 🔴 P0 | Entregas | 6.2.1 | ~0,5 dia |
| 🔴 P1 | Usuários | 6.4.1–6.4.3 | ~1 dia |
| 🟡 P1 | Dashboard | 6.5.1–6.5.4 | ~1 dia |
| 🟡 P2 | Assinaturas/Planos | 6.6.1–6.6.4 | ~1,5 dias |
| 🟢 P3 | Upload, Avisos | 6.7.1, 6.8.1–6.8.2 | ~0,5 dia |

---

## 7. Arquitetura sugerida para o Admin Panel

### 7.1 Stack

O diretório `squesh_next` **já está preparado** com o scaffold exato:

```json
"next": "^15.5.4",  "react": "^19.1.0",  "tailwindcss": "^4",  "typescript": "^5"
```

`.env.example` e `.env.local` já apontam para a API:
```
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

> O nome do diretório (`squesh_next`) e o `.env` já configurado indicam que esta
> é a intenção. **Recomendação: manter Next.js 15 (App Router) + Tailwind 4 +
> TypeScript**, sem introduzir outra stack.

Dependências a adicionar (sob decisão — ver pergunta 3):
- **UI:** `lucide-react` (ícones) + primitives próprios, **ou** `shadcn/ui`
- **Tabelas:** `tanstack/react-table` (ordenar, filtrar, paginar no cliente)
- **Formulários:** `react-hook-form` + `zod` (validação espelhando os *bindings* do Go)
- **Dados:** `swr` (ou `@tanstack/react-query`) para cache/refetch/mutação
- **Estilos:** apenas Tailwind 4 com tokens customizados (paleta do app)

### 7.2 Organização de pastas

```
squesh_next/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (admin)/                 ← layout protegido com sidebar
│   │   │   ├── layout.tsx            guarda de sessão + role
│   │   │   ├── page.tsx              Dashboard
│   │   │   ├── entradas/page.tsx
│   │   │   ├── entregas/page.tsx
│   │   │   ├── catalogo/page.tsx
│   │   │   ├── trilhas/{page.tsx, [id]/page.tsx}
│   │   │   ├── assinaturas/{page.tsx, planos/page.tsx}
│   │   │   ├── usuarios/{page.tsx, [id]/page.tsx}
│   │   │   └── avisos/page.tsx
│   │   └── api/                      ← BFF (se adotado)
│   │
│   ├── components/
│   │   ├── ui/                       Button, Input, Select, Table, Dialog,
│   │   │                             Badge, Card, Tabs, Pagination, Toast
│   │   ├── layout/                   Sidebar, Topbar, Breadcrumb
│   │   ├── tables/                   DataTable, FilterBar, ColumnFilters
│   │   ├── trails/                   TrailEditor, TrailItemEditor, StepEditor
│   │   └── charts/
│   │
│   ├── lib/
│   │   ├── api/                      client.ts (fetch + refresh), endpoints.ts,
│   │   │                             normalize.ts (unwrapList/unwrapOne), types.ts
│   │   ├── auth/                     session.ts, useSession()
│   │   ├── format/                   currency.ts, date.ts, labels.ts
│   │   └── validation/               schemas espelhando os bindings do Go
│   │
│   └── styles/globals.css            tokens Tailwind 4 (paleta do app)
└── middleware.ts                     redireciona não-autenticado → /login
```

### 7.3 Camada de API (o ponto mais importante)

**Uma única função de fetch** com refresh automático, espelhando o
`AuthInterceptor` do app Flutter (`QueuedInterceptor`):

```ts
// lib/api/client.ts
async function apiFetch(path, { method, body, token, refreshToken, ... })
// 1. Envia Authorization: Bearer <token>
// 2. Se 401 e houver refresh_token:
//      - POST /auth/refresh (em cadeia, para evitar corrida)
//      - salva o novo par
//      - repete a requisição original
// 3. Se o refresh falhar → limpa sessão, redireciona para /login
// 4. Em erro → prioriza res.json().error (mensagem em PT do backend)
```

**Normalizadores** para absorver as inconsistências de envelope (§2.4):

```ts
// lib/api/normalize.ts
unwrapList<T>(res)     // [T] | {data: T[]}  -> T[]
unwrapOne<T>(res)      // T   | {data: T}     -> T
unwrapTrail<T>(res)    // T   | {trail: T}    -> T   ← GET /trails/:id
unwrapPage<T>(res)     // {data, meta} | T[] -> {items, page, total, totalPages}
```

**Labels e formatação centralizados** — nunca hardcodar no JSX:

```ts
// lib/format/labels.ts
TRAIL_TYPE     = { workout: { label: "Treino", itemNoun: "Sessão",
                               stepNoun: "Exercício", plural: "Exercícios" },
                  nutrition: { label: "Alimentação", itemNoun: "Dia",
                               stepNoun: "Refeição", plural: "Refeições" } }
ORDER_STATUS   = { pending: "Aguardando pagamento", paid: "Pago",
                   canceled: "Cancelado" }
SUBSCRIPTION   = { active: "Ativa", canceled: "Cancelada" }
TRAIL_LEVEL    = { iniciante: "Iniciante", intermedio: "Intermediário",
                    avancado: "Avançado" }
```

> **Regra de ouro:** `getItemNoun(trailType)` e `getStepNoun(trailType)` usados
> em toda a UI de trilhas, exatamente como o app faz com `stepLabel`. Nenhum
> "Step", "Item" ou "meal" visível para o usuário.

### 7.4 Decisão de arquitetura: BFF vs. chamada direta

O `.env.local` já traz `NEXT_PUBLIC_API_URL`, sugerindo chamada direta. As duas
opções são viáveis (CORS já é `*`):

| | **A) Direta (client components)** | **B) BFF / Route Handlers** |
|---|---|---|
| Onde o token vive | `localStorage` (vulnerável a XSS) | cookie `httpOnly` + `SameSite=Strict` |
| Endpoints Go expostos ao browser | todos | só os que o proxy repassa |
| Refresh de token | no cliente (como o app Flutter) | no servidor, transparente |
| Refresh de página | re-busca sessão (ok) | automática |
| Complexidade | baixa | média |
| Pode rotear por role no edge | não | sim (`middleware.ts`) |

> **Recomendação: BFF (opção B).** Um painel administrativo lida com dados
> sensíveis (emails de todos os usuários, receita, endereços). Manter o JWT em
> `localStorage` é o principal risco de XSS, e a opção B permite centralizar o
> refresh e validar `role` no servidor. O `.env.local` existente seria
> complementado por `API_URL` (server-only).

### 7.5 Renderização: Server vs. Client Components

| Parte | Renderização | Motivo |
|---|---|---|
| Layout, sidebar, cabeçalho | **Server** | estático, sem interatividade |
| Tabelas com dados, KPIs | **Server** (fetch direto na API) | primeira pintura rápida, SEO irrelevante |
| Filtros, busca, paginação, ordenação | **Client** | interação; sincroniza com a URL |
| Formulários (criar/editar) | **Client** | validação e feedback |
| Editor de trilhas (`steps[]` dinâmico) | **Client** | estado local complexo |
| Toasts / feedback de ação | **Client** | feedback imediato |

> Regra: **o `access_token` nunca é lido por um Server Component**; com BFF, os
> Server Components passam apenas o cookie e a chamada acontece no servidor.

### 7.6 Sistema de design

Reaproveitar a paleta (§1.5) como tokens do Tailwind 4:

```css
@theme {
  --color-bg:        #0D0D0D;   /* background global */
  --color-surface:   #141414;   /* cards */
  --color-surface-2: #1A1A1A;
  --color-border:    #222222;
  --color-divider:   #262626;
  --color-accent:    #FF1E40;   /* SettingsColors.accent (predominante) */
  --color-accent-2:  #E50914;   /* AppTheme.crimsonRed */
  --color-accent-3:  #FF2E3B;   /* AppTheme.crimsonAccent */
  --color-success:   #4ADE80;
  --color-warning:   #FFC107;
  --color-muted:     #888888;
}
```

Princípios herdados do app:
- Modo escuro, cards com borda sutil (`1px` `var(--color-border)`), raio 12–16
- Cabeçalhos de seção em **UPPERCASE** com `letter-spacing` 1.2–1.6
- Feedback por **toast** (o app usa um snackbar "liquid neon" carmim) para
  criar/editar/excluir, com variante `success` / `error` / `info`
- Confirmação obrigatória em ações destrutivas (o app usa
  `confirmSettingsAction(title, message, confirmLabel, cancelLabel: 'VOLTAR', destructive: true)`)

### 7.7 Responsividade

O app é **mobile-first**; o painel é **desktop-first**, mas deve degradar:

| Faixa | Comportamento |
|---|---|
| ≥ 1280px | Sidebar fixa (240px) + conteúdo em tabela completa |
| 1024–1280px | Sidebar recolhível (ícones) |
| 768–1024px | Sidebar em overlay; tabelas com colunas secundárias ocultas |
| < 768px | Tabelas viram **cards empilhados**; filtros em sheet inferior; formulários em coluna única |

### 7.8 Segurança

| Aspecto | Decisão |
|---|---|
| Autorização | `middleware.ts` redireciona não-autenticado; layout verifica `role === "admin"` (defesa em profundidade — a API já protege com `AdminMiddleware`) |
| Token | `httpOnly` + `SameSite=Strict` (com BFF). Nunca `localStorage` |
| Refresh | Token de curta duração; refresh transparente; logout em cadeia para limpar a sessão |
| Upload | Presign com TTL de 15min; validar `content_type` e tamanho (5MB) **no cliente também** |
| Dados sensíveis | **Nunca** renderizar o número do cartão — o backend já devolve só bandeira e `last4`; o painel não tem tela de cartões |
| Erros | Reutilizar `res.json().error` do Go; **nunca** vazar stack trace |

---

## 8. Plano de implementação sugerido (após aprovação)

### Fase 0 — Fundação (sem depender de backend novo)
1. Tokens de design + primitives de UI (`Button`, `Input`, `Select`, `Table`, `Badge`, `Dialog`, `Toast`, `Card`, `Tabs`, `Pagination`)
2. Camada de API: `client.ts` (refresh), `normalize.ts`, `endpoints.ts`, `types.ts`
3. `lib/format`: `currency` (centavos → `R$ 119,90`), `date`, `labels`
4. Login + guarda de sessão + layout com sidebar
5. **Dashboard** com `GET /admin/overview` (8 KPIs) — já funciona

### Fase 1 — Catálogo + Entradas (100% com API existente)
6. Catálogo: tabela, busca, filtros, CRUD, upload de imagem
7. Entradas: tabela, filtro por status, detalhe, **Confirmar pagamento**

### Fase 1 — Catálogo + Entradas (100% com API existente) — ✅ **CONCLUÍDA**

6. Catálogo: tabela, busca, filtro por categoria, CRUD completo e upload de imagem
7. Entradas: tabela, filtro por status, KPIs, detalhe do pedido e **Confirmar
   pagamento** (com 409 tratado como sucesso idempotente)

### Fase 1b — Assinaturas (100% com API existente) — ✅ **CONCLUÍDA**

8. Assinantes (`GET /admin/subscriptions`) + KPIs + MRR
9. Vitrine de planos (`GET /plans`) com a única escrita existente:
   `PUT /admin/plans/:planId/stripe-price`

### Fase 2 — Trilhas (depende de 6.1.x)
10. Backend: colunas/rotas de admin de trilhas
11. Lista por tipo, filtros, editor de trilha
12. Editor de etapas + sub-editor de `steps[]` com pré-visualização contextual

### Fase 3 — Entregas, Usuários
13. Backend: 6.2.1, 6.4.x
14. Telas correspondentes + Gráficos do Dashboard (6.5.1)

---

## 9. Perguntas em aberto — ✅ respondidas em 05/10/2026

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Escopo de "Entregas" | **Inventário digital** (`UserInventory`). Não há envio físico na loja. |
| 2 | Alterações no `squesh_golang` | **Aditivas autorizadas** — rotas/colunas novas, sem refatorar. |
| 3 | UI kit | **shadcn/ui** (v4 / Base UI, não Radix). |
| 4 | BFF vs. chamada direta | **BFF** com cookie `httpOnly`. Implementado. |
| 5 | Módulo Stripe WIP | **Implementar contra o estado atual**; ver §6.9 corrigido. |

---

## 10. O que foi validado contra a API real

A Fase 0 + 1 + 1b rodaram contra o `squesh_golang` de verdade (Docker, porta
8080, banco `squesh_db` populado). O que foi verificado e **não** deve ser
esquecido:

| Verificação | Resultado |
|---|---|
| Guarda de sessão | `/catalogo`, `/entradas`, `/assinaturas` → **307 → `/login`** sem cookie |
| `/admin/overview` | 8 KPIs com dados reais (receita `R$ 169,90`, 17 assinaturas, MRR `R$ 461,26`) |
| `/admin/subscriptions` | 17 assinantes, 2 ativas, 15 "canceladas, ainda válidas" |
| `/plans` | 3 planos com `price_xxx` já cadastrado |
| `POST /shop` (criar) | **200** — item criado e apareceu na tabela |
| `PUT /shop/:id` com `image_url: ""` | **400** `Field validation for 'ImageURL' failed on the 'url' tag` |
| `PUT /shop/:id` sem `image_url` | **200** — preço e `is_active` gravados, badge "Desativado" apareceu |
| Filtro `?search=` | Encontrou o item; estado vazio correto quando não há resultado |
| `DELETE /shop/:id` | **200** `Item removido com sucesso` — sumiu da listagem |

### 10.1 Armadilha do `UpdateShopItemDTO` — confirmada na prática

O teste acima **comprova** o risco descrito na análise: como o DTO usa `*string`
com `binding:"omitempty,url"`, o `omitempty` do go-playground só pula a
validação quando o ponteiro é `nil`. Enviar `{"image_url": ""}` faz a regra
`url` rodar sobre string vazia e o Go responde 400.

> **Regra para todo formulário de update:** **omitir** do corpo os campos de
> texto que ficaram vazios. Nunca mandar `""`. O mesmo vale para `name`
> (`min=3`) e para qualquer outro `*string` do Go.

### 10.2 Estado do banco após os testes

O usuário de teste `admintest.panel@squesh.com` (promovido a `admin` só para o
smoke test) e o produto `Produto Teste Painel` foram **removidos**. O banco
voltou ao estado anterior.
