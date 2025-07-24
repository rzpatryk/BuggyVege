# API Dokumentacja - System Wirtualnego Portfela

## Przegląd

System wirtualnego portfela umożliwia użytkownikom:
- Zarządzanie saldem portfela
- Doładowywanie środków
- Płacenie za produkty z portfela
- Przeglądanie historii transakcji i zamówień
- Zwroty środków

## Endpointy API

### Autoryzacja
Wszystkie endpointy portfela wymagają nagłówka:
```
Authorization: Bearer <jwt_token>
```

---

## 1. Portfel

### GET /api/v1/wallet/balance
**Sprawdź saldo portfela**

**Odpowiedź:**
```json
{
  "status": "success",
  "data": {
    "balance": 150.50,
    "currency": "PLN",
    "formattedBalance": "150.50 PLN"
  }
}
```

### POST /api/v1/wallet/deposit
**Doładuj portfel**

**Body:**
```json
{
  "amount": 100.00,
  "paymentMethod": "card",
  "description": "Doładowanie portfela"
}
```

**Odpowiedź:**
```json
{
  "status": "success",
  "message": "Portfel został pomyślnie doładowany",
  "data": {
    "transaction": {
      "_id": "...",
      "type": "deposit",
      "amount": 100,
      "balanceBefore": 50.50,
      "balanceAfter": 150.50
    },
    "newBalance": 150.50,
    "formattedBalance": "150.50 PLN"
  }
}
```

### GET /api/v1/wallet/transactions
**Historia transakcji**

**Query parametry:**
- `page` (number, default: 1)
- `limit` (number, default: 10)
- `type` (string): 'deposit', 'payment', 'refund'

**Odpowiedź:**
```json
{
  "status": "success",
  "results": 5,
  "pagination": {
    "currentPage": 1,
    "totalPages": 2,
    "totalTransactions": 15,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "data": {
    "transactions": [...]
  }
}
```

---

## 2. Zakupy

### POST /api/v1/wallet/purchase
**Kup produkty za pomocą portfela**

**Body:**
```json
{
  "items": [
    {
      "productId": "product_id_1",
      "quantity": 2
    },
    {
      "productId": "product_id_2", 
      "quantity": 1
    }
  ],
  "shippingAddress": {
    "street": "ul. Przykładowa 123",
    "city": "Warszawa",
    "postalCode": "00-001",
    "country": "Polska"
  }
}
```

**Odpowiedź:**
```json
{
  "status": "success",
  "message": "Zakup został pomyślnie zrealizowany",
  "data": {
    "order": {
      "orderNumber": "202501240001",
      "totalAmount": 45.99,
      "status": "paid",
      "items": [...]
    },
    "newBalance": 104.51,
    "formattedBalance": "104.51 PLN"
  }
}
```

### GET /api/v1/wallet/orders
**Historia zamówień**

**Query parametry:**
- `page` (number, default: 1)
- `limit` (number, default: 10)
- `status` (string): 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'

### GET /api/v1/wallet/orders/:orderId
**Szczegóły zamówienia**

### POST /api/v1/wallet/refund
**Zwrot zamówienia**

**Body:**
```json
{
  "orderId": "order_id",
  "reason": "Produkt uszkodzony"
}
```

---

## 3. Kody błędów

- `400` - Błędne dane wejściowe
- `401` - Brak autoryzacji
- `404` - Nie znaleziono zasobu
- `500` - Błąd serwera

---

## 4. Modele danych

### User (rozszerzony)
```javascript
{
  // ... istniejące pola
  wallet: {
    balance: Number,     // Saldo portfela
    currency: String     // Waluta (default: "PLN")
  }
}
```

### Transaction
```javascript
{
  user: ObjectId,              // Referencja do User
  type: String,                // 'deposit', 'payment', 'refund'  
  amount: Number,              // Kwota transakcji
  description: String,         // Opis transakcji
  status: String,              // 'pending', 'completed', 'failed'
  balanceBefore: Number,       // Saldo przed transakcją
  balanceAfter: Number,        // Saldo po transakcji
  relatedOrder: ObjectId,      // Powiązane zamówienie (opcjonalne)
  metadata: {
    paymentMethod: String,
    externalTransactionId: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Order
```javascript
{
  user: ObjectId,              // Referencja do User
  orderNumber: String,         // Unikalny numer zamówienia
  items: [{
    product: ObjectId,         // Referencja do Product
    quantity: Number,          // Ilość
    price: Number,             // Cena za sztukę
    totalPrice: Number         // Cena całkowita
  }],
  totalAmount: Number,         // Całkowita kwota zamówienia
  status: String,              // Status zamówienia
  paymentMethod: String,       // Metoda płatności
  paymentStatus: String,       // Status płatności
  shippingAddress: Object,     // Adres dostawy
  transaction: ObjectId,       // Powiązana transakcja
  createdAt: Date,
  updatedAt: Date
}
```

---

## 5. Przykłady użycia

### Typowy przepływ zakupu:
1. Użytkownik sprawdza saldo: `GET /api/v1/wallet/balance`
2. Jeśli niewystarczające środki, doładowuje portfel: `POST /api/v1/wallet/deposit`
3. Dokonuje zakupu: `POST /api/v1/wallet/purchase`
4. Sprawdza historię zamówień: `GET /api/v1/wallet/orders`

### Obsługa zwrotów:
1. Użytkownik znajduje zamówienie: `GET /api/v1/wallet/orders`
2. Złoży żądanie zwrotu: `POST /api/v1/wallet/refund`
3. Środki są automatycznie zwracane na portfel
