// Parkning asosiy sozlamalari: narxlar, ish vaqti, sig'im, aloqa.
// Narxlarni o'zgartirish uchun faqat shu faylni tahrirlang.

module.exports = {
  brand: {
    name: 'Ugam Gravity Park',
    instagram: 'https://www.instagram.com/ugamgravity_park',
    instagramHandle: '@ugamgravity_park',
    phone: '+998 90 000 00 00',
    telegram: 'https://t.me/ugamgravity_park',
    address: "Ugam, Bo'stonliq tumani, Toshkent viloyati",
    mapQuery: "Ugam, Bo'stonliq tumani, Toshkent viloyati",
    hours: '09:00 – 19:00, har kuni',
  },

  // Toshkent vaqti (UTC+5)
  timezoneOffsetHours: 5,
  // Necha kun oldindan bron qilish mumkin
  bookingDaysAhead: 30,
  // To'lanmagan bron necha daqiqa joyni ushlab turadi
  holdMinutes: 20,
  // Bitta bronda bitta attraksion uchun maksimal chipta soni
  maxPerItem: 20,

  // Kelish vaqtlari (har biri 1 soatlik oyna)
  slots: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],

  // capacity — bitta soatlik oynada nechta odam o'ta oladi
  attractions: [
    {
      id: 'zipline',
      name: 'Zipline',
      price: 150000,
      capacity: 40,
      short: "Tog' ustidan qushdek uchib o'ting",
      rules: "7 yoshdan katta, vazn 30–120 kg",
    },
    {
      id: 'bridge',
      name: "Osma ko'prik",
      price: 50000,
      capacity: 80,
      short: "Daralar ustidagi chayqaluvchi ko'prik",
      rules: '5 yoshdan katta (12 yoshgacha kattalar bilan)',
    },
    {
      id: 'swing',
      name: 'Giga belanchak',
      price: 120000,
      capacity: 30,
      short: "Jarlik ustida ulkan belanchakda erkin tushish",
      rules: "12 yoshdan katta, vazn 40–110 kg",
    },
  ],

  combo: {
    id: 'combo',
    name: 'Gravity Combo — 3 tasi birga',
    price: 280000,
    includes: ['zipline', 'bridge', 'swing'],
    short: 'Hamma attraksion bitta chiptada, arzonroq',
  },
};
