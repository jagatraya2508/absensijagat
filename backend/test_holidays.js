const Holidays = require('date-holidays');
const hd = new Holidays('ID');
const holidays = hd.getHolidays(2026);
console.log(holidays.filter(h => h.type === 'public').slice(0, 5));
