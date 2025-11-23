const { Telegraf, Markup } = require('telegraf');
const PdfPrinter = require('pdfmake');

// --- НАСТРОЙКИ ---
const BOT_TOKEN = 'ТВОЙ_ТОКЕН_ОТ_BOTFATHER'; // <-- ВСТАВЬ ТОКЕН СЮДА
// Ссылка на твой index.html (если запускаешь локально через туннель, или реальный URL)
// Для теста можно пока оставить любую, но кнопка работать не будет без реального https
const WEB_APP_URL = 'https://твой-сайт-с-index.html'; 

const bot = new Telegraf(BOT_TOKEN);

// Настройка шрифтов для PDF (используем стандартные)
const fonts = {
    Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};
const printer = new PdfPrinter(fonts);


// Команда /start
bot.start((ctx) => {
  ctx.reply(
    '👋 Привет! Я оконный калькулятор.\nНажми кнопку, чтобы посчитать окно и получить PDF-смету.',
    Markup.keyboard([
      Markup.button.webApp('🧮 Открыть калькулятор', WEB_APP_URL)
    ]).resize()
  );
});


// --- ГЛАВНАЯ ЛОГИКА: Получение данных и генерация PDF ---
bot.on('web_app_data', async (ctx) => {
  try {
    // 1. Получаем данные от веб-приложения
    const data = JSON.parse(ctx.webAppData.data);
    console.log('Получены данные для расчета:', data);

    await ctx.reply('⏳ Данные приняты, формирую PDF-документ...');

    // 2. Формируем структуру PDF документа
    const docDefinition = {
        content: [
            { text: 'Коммерческое предложение', style: 'header' },
            { text: `Дата: ${new Date().toLocaleDateString()}`, alignment: 'right', margin: [0, 0, 0, 20] },

            { text: 'Параметры изделия', style: 'subheader' },
            {
                table: {
                    widths: ['*', '*'],
                    body: [
                        ['Габариты (ШхВ):', `${data.width} x ${data.height} мм`],
                        ['Площадь:', `${((data.width * data.height)/1000000).toFixed(2)} м²`],
                        ['Кол-во створок:', `${data.sashes.length} шт.`]
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 20]
            },

            { text: 'Конфигурация створок', style: 'subheader' },
            { ul: data.sashes.map((s, i) => {
                let typeName = s === 'fixed' ? 'Глухое' : s === 'turn' ? 'Поворотное' : 'Поворотно-откидное';
                return `Створка ${i+1}: ${typeName}`;
            }), margin: [0, 0, 0, 20] },

            { text: 'Комплектация', style: 'subheader' },
            {
                ul: [
                    data.extras.sill ? 'Подоконник' : null,
                    data.extras.ebb ? 'Отлив' : null,
                    data.extras.mosquito ? 'Москитная сетка' : null,
                    data.extras.install ? 'Монтажные работы' : null,
                ].filter(Boolean), // Убираем пустые значения (null)
                margin: [0, 0, 0, 20]
            },
            
            // Разделитель
            { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2 }] },

            { 
                text: [
                    'ИТОГО К ОПЛАТЕ: ', 
                    { text: `${data.totalPrice.toLocaleString()} ₽`, style: 'totalPrice' }
                ], 
                margin: [0, 20, 0, 0],
                alignment: 'right'
            }
        ],
        styles: {
            header: { fontSize: 22, bold: true, margin: [0, 0, 0, 10] },
            subheader: { fontSize: 16, bold: true, margin: [0, 10, 0, 5], color: '#2563eb' },
            totalPrice: { fontSize: 24, bold: true, color: '#dc2626' }
        },
        defaultStyle: {
            font: 'Roboto'
        }
    };

    // 3. Создаем PDF в памяти
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
        const result = Buffer.concat(chunks);
        // 4. Отправляем готовый файл пользователю
        ctx.replyWithDocument({ source: result, filename: `Смета_Окно_${data.width}x${data.height}.pdf` })
           .catch(err => console.error('Ошибка отправки файла:', err));
    });
    pdfDoc.end();


  } catch (e) {
    console.error('Ошибка обработки данных:', e);
    ctx.reply('❌ Произошла ошибка при формировании сметы.');
  }
});

bot.launch();
console.log('Бот запущен и готов к работе!');

// Плавная остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
