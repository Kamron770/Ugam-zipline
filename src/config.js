// Parkning asosiy sozlamalari: narxlar, qoidalar, ish vaqti, sig'im, aloqa.
// Narx yoki qoidani o'zgartirish uchun faqat shu faylni tahrirlang.

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
      name: "Zipline (o'tirib)",
      price: 150000,
      capacity: 40,
      image: '/assets/img/zipline.jpg',
      poster: '/assets/img/zipline-poster.jpg',
      short: "Minoradan o'tirgan holda arqon bo'ylab o'rmon ustidan uchib o'ting.",
      summary: "40–120 kg, bo'y 140 sm dan",
      rules: [
        'Faqat berilgan jihozlardan foydalaning.',
        'Barcha kamarlar instruktor tomonidan tekshirilishi shart.',
        "Qo'llaringizni xavfsizlik kamarlarida ushlab turing.",
        "Xodimlarning ko'rsatmalariga amal qiling.",
        'Mustaqil ravishda tormoz qilish taqiqlanadi.',
      ],
      limitsTitle: 'Cheklovlar',
      limits: [
        'Vazn: 40–120 kg.',
        "Bo'yi: 140 sm dan boshlab.",
        'Homilador ayollarga taqiqlanadi.',
        "Yurak va umurtqa pog'onasi bilan bog'liq jiddiy kasalligi borlarga taqiqlanadi.",
      ],
    },
    {
      id: 'superman',
      name: 'Zipline Superman',
      price: 250000,
      capacity: 30,
      image: '/assets/img/superman.jpg',
      poster: '/assets/img/superman-poster.jpg',
      short: "Superman kabi yotgan holda, qo'llarni yoyib, qushdek parvoz qiling.",
      summary: '40–120 kg, 14 yoshdan katta',
      rules: [
        'Parvoz faqat Superman holatida amalga oshiriladi.',
        "Bosh yuqoriga ko'tarilgan bo'lishi kerak.",
        "Oyoqlar biroz ajratilgan bo'lishi kerak.",
        'Xavfsizlik kamarlarini yechishga urinmang.',
        "To'xtagandan so'ng instruktor ruxsatisiz joydan turmang.",
      ],
      limitsTitle: 'Cheklovlar',
      limits: [
        "Og'irlik: 40–120 kg.",
        'Yosh: 14 yoshdan katta.',
        'Homilador ayollarga taqiqlanadi.',
        "Yurak va umurtqa pog'onasi kasalliklari va epilepsiya bilan og'riganlar uchun taqiqlanadi.",
        "Spirtli ichimlik yoki narkotik moddalar ta'sirida bo'lgan shaxslar uchun taqiqlanadi.",
      ],
    },
    {
      id: 'swing',
      name: 'Giant Swing',
      price: 150000,
      capacity: 30,
      image: '/assets/img/swing.jpg',
      poster: '/assets/img/swing-poster.jpg',
      short: "Tog'lar fonida ulkan belanchakda baland tebraning — do'stlar bilan birga.",
      summary: '40–120 kg',
      rules: [
        'Ishga tushirishdan oldin instruktor xavfsizlik kamarlarini tekshiradi.',
        "Tebranish vaqtida qo'ltiqlardan ushlang.",
        'Xavfsizlik kamarlarini yechishga urinmang.',
        "To'xtagandan so'ng instruktor ruxsatisiz joydan turmang.",
      ],
      limitsTitle: 'Cheklamalar',
      limits: [
        "Og'irlik: 40–120 kg.",
        'Homilador ayollarga taqiqlanadi.',
        "Yurak-qon tomir kasalliklari, umurtqa pog'onasi kasalliklari va epilepsiya bilan og'riganlar uchun taqiqlanadi.",
        "Spirtli ichimlik yoki narkotik moddalar ta'sirida bo'lgan shaxslar uchun taqiqlanadi.",
      ],
    },
    {
      id: 'bridge',
      name: "Quvnoq ko'prik",
      subtitle: '+ tomosha maydonchasi',
      price: 40000,
      capacity: 80,
      image: '/assets/img/bridge.jpg',
      poster: '/assets/img/bridge-poster.jpg',
      short: "Osma ko'prikdan o'tib, tomosha maydonchasidan Ugam manzarasini kuzating.",
      summary: '12 yoshgacha — kattalar bilan',
      rules: [
        'Uyushqoqlik bilan harakatlaning, yugurmang.',
        "Ko'prikni chayqatmang.",
        "Qo'ltiqlardan ushlab turing.",
        "To'siqlardan oshib o'tmang.",
        "12 yoshgacha bo'lgan bolalar faqat kattalar bilan.",
        "Xodimlar ko'rsatmalariga rioya qiling.",
      ],
      limitsTitle: 'Taqiqlanadi',
      limits: [
        'Sakrash.',
        'Turtishib itarish.',
        'Narsalarni pastga tashlash.',
        "Spirtli ichimlik yoki narkotik moddalar ta'sirida bo'lish.",
      ],
    },
  ],

  // Paket (bir nechta attraksion bitta chiptada, chegirma bilan).
  // Yoqish uchun masalan:
  // combo: { id: 'combo', name: 'Gravity Combo', price: 300000, includes: ['zipline', 'swing', 'bridge'], short: '...' },
  combo: null,
};
