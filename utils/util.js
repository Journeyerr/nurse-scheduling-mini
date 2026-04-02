// utils/util.js - 工具函数

/**
 * 格式化日期
 * @param {Date} date 日期对象
 * @param {string} format 格式字符串
 */
const formatDate = (date, format = 'YYYY-MM-DD') => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * 获取月份的天数
 * @param {number} year 年份
 * @param {number} month 月份 (1-12)
 */
const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

/**
 * 获取月份第一天是周几
 * @param {number} year 年份
 * @param {number} month 月份 (1-12)
 */
const getFirstDayOfMonth = (year, month) => {
  return new Date(year, month - 1, 1).getDay();
};

/**
 * 生成日历数据
 * @param {number} year 年份
 * @param {number} month 月份 (1-12)
 */
const generateCalendarData = (year, month) => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const calendarData = [];
  let week = [];

  // 填充月初空白
  for (let i = 0; i < firstDay; i++) {
    week.push({ day: null, date: null });
  }

  // 填充日期
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    week.push({ day, date, isToday: isToday(year, month, day) });
    
    if (week.length === 7) {
      calendarData.push(week);
      week = [];
    }
  }

  // 填充月末空白
  if (week.length > 0) {
    while (week.length < 7) {
      week.push({ day: null, date: null });
    }
    calendarData.push(week);
  }

  return calendarData;
};

/**
 * 判断是否为今天
 */
const isToday = (year, month, day) => {
  const today = new Date();
  return today.getFullYear() === year && 
         today.getMonth() + 1 === month && 
         today.getDate() === day;
};

/**
 * 显示加载提示
 */
const showLoading = (title = '加载中...') => {
  wx.showLoading({ title, mask: true });
};

/**
 * 隐藏加载提示
 */
const hideLoading = () => {
  wx.hideLoading();
};

/**
 * 显示成功提示
 */
const showSuccess = (title) => {
  wx.showToast({ title, icon: 'success', duration: 2000 });
};

/**
 * 显示错误提示
 */
const showError = (title) => {
  wx.showToast({ title, icon: 'none', duration: 2000 });
};

/**
 * 显示确认弹窗
 * @param {string} title 标题
 * @param {string} content 内容
 */
const showConfirm = (title, content) => {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm);
      }
    });
  });
};

/**
 * 获取本周日期范围
 */
const getWeekRange = (date = new Date()) => {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  const sunday = new Date(date.setDate(diff + 6));
  
  return {
    start: formatDate(monday),
    end: formatDate(sunday),
    dates: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return formatDate(d);
    })
  };
};

/**
 * 获取下周日期范围
 */
const getNextWeekRange = (currentWeekStart) => {
  const date = new Date(currentWeekStart);
  date.setDate(date.getDate() + 7);
  return getWeekRange(date);
};

/**
 * 获取上周日期范围
 */
const getPrevWeekRange = (currentWeekStart) => {
  const date = new Date(currentWeekStart);
  date.setDate(date.getDate() - 7);
  return getWeekRange(date);
};

/**
 * 深拷贝
 */
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * 防抖函数
 */
const debounce = (fn, delay = 300) => {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

module.exports = {
  formatDate,
  getDaysInMonth,
  getFirstDayOfMonth,
  generateCalendarData,
  isToday,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showConfirm,
  getWeekRange,
  getNextWeekRange,
  getPrevWeekRange,
  deepClone,
  debounce
};
