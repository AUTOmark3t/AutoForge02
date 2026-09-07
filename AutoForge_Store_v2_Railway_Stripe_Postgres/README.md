# AutoForge Store v2

Magazin auto gata pentru Railway:
- design responsive în română;
- imagini AI incluse local;
- produse din PostgreSQL;
- coș persistent în browser;
- Stripe Checkout;
- tabele `orders` și `order_items`;
- webhook Stripe pentru marcarea comenzilor ca `paid`;
- căutare și filtrare pe categorii;
- contact: +40 745 942 521 / benedekzoltan916@gmail.com.

## 1. Instalare locală
```bash
npm install
cp .env.example .env
npm start
```

Ai nevoie de PostgreSQL și de un `DATABASE_URL` valid.

## 2. Railway
În serviciul AutoForge:
1. Încarcă/deployează acest proiect.
2. Conectează serviciul PostgreSQL.
3. În Variables setează:
   - `DATABASE_URL` = variabila DATABASE_URL a serviciului Postgres;
   - `STRIPE_SECRET_KEY` = cheia `sk_test_...` sau `sk_live_...`;
   - `BASE_URL` = `https://autoforge.up.railway.app`;
   - `STRIPE_WEBHOOK_SECRET` = cheia `whsec_...`.
4. Start command: `npm start`.

## 3. Stripe webhook
În Stripe Dashboard creează endpoint:
`https://autoforge.up.railway.app/api/stripe/webhook`

Eveniment necesar:
`checkout.session.completed`

Copiază signing secret (`whsec_...`) în Railway ca `STRIPE_WEBHOOK_SECRET`.

## 4. Baza de date
La prima pornire, `server.js` creează automat:
- `products`
- `orders`
- `order_items`

și adaugă produsele demo dacă tabela `products` este goală.

## 5. Important înainte de vânzări reale
Completează datele oficiale ale PFA după emiterea lor:
- denumirea oficială;
- CUI/CIF;
- numărul Registrului Comerțului;
- sediul profesional;
- politica reală de livrare, retur și garanție.

Nu pune `STRIPE_SECRET_KEY` direct în cod sau în fișiere publice.
