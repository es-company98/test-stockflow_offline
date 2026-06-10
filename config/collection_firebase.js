
🧱 STRUCTURE FIREBASE FINALE (PRO + SCALABLE + SANS FUNCTIONS)


---

📁 1. products

products
  productId
    name: "Cuvette plastique"
    category: "plastique"
    price_buy: 2
    price_sell: 3
    price_min: 2.5       <-- prix minimum autorisé pour la vente
    stock_current: 120
    stock_alert: 10
    isActive: true
    offlineBlocked: true,
    minOfflineStock: 5
    createdAt
    updatedAt
    variant: "tembo"
    imageUrl:""

👉 stock_current = cache (optimisation affichage)
👉 vérité = stock_movements


---

📁 2. sales

sales
  saleId
    sellerId: "user_1"
    //added
    payment_status: "paid" | "partial"
    amount_paid
    amount_remaining
    hasDebt: true?false
    //offline 
    offlineActionId: action.id,
    deviceId: action.deviceId,
    syncSource: offlineActionId ? "offline-sync" : "online",
    
    total_amount: 30
    total_profit: 10
    status: "active" | "cancelled"
    createdAt
    updatedAt


---

📁 3. sale_items (IMPORTANT : séparation)

sale_items
  itemId
    saleId: "sale_1"
    productId: "prod_1"
    quantity: 3
    price: 10
    price_min: 9           <-- stocké pour référence, force prix minimal si besoin
    profit: 3
    createdAt

👉 Pourquoi séparé ?

scalable

requêtes propres

évite documents lourds



---

📁 4. stock_movements 🔥 (SOURCE DE VÉRITÉ)

stock_movements
  movementId
    productId: "prod_1"
    type: "IN" | "OUT"
    quantity: 3
    reason: "sale" | "purchase" | "loss" | "correction"
    referenceId: "sale_1"
    createdBy: "user_1"
    createdAt

👉 Chaque mouvement doit être traçable
👉 jamais de modification → uniquement ajout


---

📁 5. purchases

purchases
  purchaseId
    supplier: "grossiste"
    total_cost: 100
    createdAt
    updatedAt


---

📁 6. purchase_items

purchase_items
  itemId
    purchaseId: "purchase_1"
    productId: "prod_1"
    quantity: 50
    price: 2
    createdAt


📁 7. users

users (2 users)
  userId (authId)
    name : "Elonga"
    role: "admin" | "seller"
    isActive: true
    userId : authId
    createdAt   
    lastLoginAt 


---

📁 9. settings (contrôle système)

settings
  system
    activeSeller: "user_1"
    lockSales: false

👉 utile si conflit / contrôle manuel


    
// seule collection expenses = dépenses (expenses) + dettes (debts) + pertes (losses)
expensess {
  expenseId: string,

  genre: "expense" | "loss" | "debt",

  category: string,
  reason: string,
  
  isSystemCorrection: false|true

  // ✅ commun simple
  amount: number, // utilisé pour expense + loss

  // ✅ uniquement si debt
  name : "nom du client",
  phone
  DueDate,
  amount_total: number,
  amount_paid: number,
  amount_remaining: number,
  status: "paid" | "partial",

  relatedSaleId: string ="saleRef.id" | null,

  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: string,

  note: string
}

Collection: appConfig{main}
{
    shopName         → string
    shopAddress      → string
    shopPhone        → string
    currency         → string
    currencySymbol   → string
    logoUrl          → string
    lowStockLimit    → number
    enableOffline    → boolean
    createdAt        → timestamp
    updatedAt        → timestamp
}


---

⚙️ LOGIQUE OBLIGATOIRE (CÔTÉ JS)

🔥 Vente (process complet)

1. créer sale


2. créer sale_items (avec price_min)


3. créer stock_movements (OUT)


4. recalculer stock_current depuis stock_movements






---

🔥 Achat

1. créer purchase


2. créer purchase_items


3. créer stock_movements (IN)


4. update stock


---

⚠️ RÈGLES STRICTES (SINON TON SYSTÈME MEURT)

❌ Tu ne modifies JAMAIS :

sale_items

stock_movements


✅ Tu fais :

cancel sale

ajouter correction




  
