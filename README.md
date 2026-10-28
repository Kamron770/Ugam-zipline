# Ugam Gravity Park — sayt va onlayn bron

Zipline, Zipline Superman, Giant Swing va Quvnoq ko'prik uchun sayt. Mijoz uydan turib sana va vaqtni tanlaydi,
Payme yoki Click orqali to'laydi va QR-chipta oladi. Bitta chipta bilan tanlangan barcha
attraksionlardan o'tadi.

## Imkoniyatlar
- Ma'lumot: attraksionlar, narxlar, afishalar, xavfsizlik qoidalari, xarita, savol-javob
- Onlayn bron: sana → soat → chiptalar → ism/telefon → to'lov
- Har bir soatga sig'im cheklovi (navbat bo'lmasligi uchun), to'lanmagan bron 20 daqiqada bo'shaydi
- To'lov: Payme Merchant API va Click SHOP API (kalitlar kiritilmaguncha demo rejim)
- QR-chipta: har bir attraksionda xodim QR-ni skanerlab, "+1 o'tdi" deb belgilaydi
- Admin panel (`/admin`): kunlik bronlar, tushum, kishilar soni

## Ishga tushirish
```bash
npm install
cp .env.example .env   # parol va to'lov kalitlarini yozing
npm start              # http://localhost:3000
npm test
```
Node.js 22.13+ kerak (ma'lumotlar bazasi — ichki SQLite, `data/park.db`).

## Sozlash
- **Narxlar, qoidalar, ish vaqti, sig'im, telefon, manzil:** `src/config.js` (combo paket ham shu yerda yoqiladi)
- **Brend ranglari:** `public/styles.css` boshidagi `:root` qismi
- **Logotip va rasmlar:** `public/assets/` (Instagram afishalaridan olingan)

## To'lov tizimlarini ulash
**Payme** (business.payme.uz): endpoint — `https://SAYT/api/payme`, hisob maydoni — `order_id`.
`.env` ga `PAYME_MERCHANT_ID`, `PAYME_KEY` yozing (test uchun `PAYME_TEST=1`).

**Click** (merchant.click.uz): Prepare — `https://SAYT/api/click/prepare`,
Complete — `https://SAYT/api/click/complete`. `.env` ga `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`.

Kalitlar kiritilgach demo to'lov avtomatik o'chadi (yoki `PAYMENT_DEMO=0`).

## Xodimlar uchun
1. Telefonda `/admin` ni ochib parol bilan kiring (bir marta).
2. Mijoz QR-kodini oddiy kamera bilan skanerlang — chipta ochiladi.
3. O'z attraksioningiz qatorida `+1` yoki `Hammasi` ni bosing.
