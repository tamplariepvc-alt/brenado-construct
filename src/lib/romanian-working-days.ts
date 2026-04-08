export type HolidayInfo = {
  date: string; // YYYY-MM-DD
  name: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

/**
 * Paștele Ortodox (calendar gregorian), algoritm Meeus/Jones/Butcher
 * returnează data Paștelui Ortodox pentru anul dat.
 */
export const getOrthodoxEaster = (year: number) => {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3 = martie, 4 = aprilie
  const day = ((d + e + 114) % 31) + 1;

  // data în calendar iulian
  const julianDate = new Date(Date.UTC(year, month - 1, day));

  // conversie practică spre gregorian pentru anii moderni
  // 1900–2099 => +13 zile
  const gregorianDate = addDays(julianDate, 13);

  return new Date(
    gregorianDate.getUTCFullYear(),
    gregorianDate.getUTCMonth(),
    gregorianDate.getUTCDate()
  );
};

export const getRomanianLegalHolidays = (year: number): HolidayInfo[] => {
  const orthodoxEaster = getOrthodoxEaster(year);
  const goodFriday = addDays(orthodoxEaster, -2);
  const easterMonday = addDays(orthodoxEaster, 1);
  const pentecostSunday = addDays(orthodoxEaster, 49);
  const pentecostMonday = addDays(orthodoxEaster, 50);

  const holidays: HolidayInfo[] = [
    { date: `${year}-01-01`, name: "Anul Nou - ziua 1" },
    { date: `${year}-01-02`, name: "Anul Nou - ziua 2" },
    { date: `${year}-01-06`, name: "Boboteaza" },
    { date: `${year}-01-07`, name: "Soborul Sfântului Ioan Botezătorul" },
    { date: `${year}-01-24`, name: "Ziua Unirii Principatelor Române" },

    { date: toDateKey(goodFriday), name: "Vinerea Mare" },
    { date: toDateKey(orthodoxEaster), name: "Paști - ziua 1" },
    { date: toDateKey(easterMonday), name: "Paști - ziua 2" },

    { date: `${year}-05-01`, name: "Ziua Muncii" },
    { date: `${year}-06-01`, name: "Ziua Copilului" },

    { date: toDateKey(pentecostSunday), name: "Rusalii - ziua 1" },
    { date: toDateKey(pentecostMonday), name: "Rusalii - ziua 2" },

    { date: `${year}-08-15`, name: "Adormirea Maicii Domnului" },
    { date: `${year}-11-30`, name: "Sfântul Andrei" },
    { date: `${year}-12-01`, name: "Ziua Națională a României" },
    { date: `${year}-12-25`, name: "Crăciun - ziua 1" },
    { date: `${year}-12-26`, name: "Crăciun - ziua 2" },
  ];

  holidays.sort((a, b) => a.date.localeCompare(b.date));
  return holidays;
};

export const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

export const isRomanianLegalHoliday = (date: Date) => {
  const holidays = getRomanianLegalHolidays(date.getFullYear());
  const key = toDateKey(date);
  return holidays.some((holiday) => holiday.date === key);
};

export const getWorkingDaysInMonthRomania = (
  year: number,
  monthIndex: number
) => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const holidays = new Set(
    getRomanianLegalHolidays(year).map((holiday) => holiday.date)
  );

  let workingDays = 0;

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, monthIndex, day);
    const key = toDateKey(date);
    const dayOfWeek = date.getDay();

    const isSaturdayOrSunday = dayOfWeek === 0 || dayOfWeek === 6;
    const isLegalHoliday = holidays.has(key);

    if (!isSaturdayOrSunday && !isLegalHoliday) {
      workingDays += 1;
    }
  }

  return workingDays;
};

export const getMonthlyNormHoursRomania = (
  year: number,
  monthIndex: number,
  hoursPerDay = 8
) => {
  return getWorkingDaysInMonthRomania(year, monthIndex) * hoursPerDay;
};