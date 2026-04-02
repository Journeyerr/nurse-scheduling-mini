// pages/team-schedule/team-schedule.js
const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    currentWeekStart: null,
    weekRange: '',
    weekDays: [],
    scheduleData: []
  },

  onLoad() {
    // 初始化为本周
    const today = new Date();
    const weekStart = this.getWeekStart(today);

    this.setData({ currentWeekStart: weekStart });
    this.loadWeekData();
  },

  // 获取周的起始日期（周一）
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  // 格式化日期
  formatDate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  },

  // 格式化日期范围
  formatWeekRange(weekStart) {
    const start = this.formatDate(weekStart);
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 6);
    const end = this.formatDate(endDate);
    return `${start} 至 ${end}`;
  },

  // 加载周数据
  async loadWeekData() {
    const { currentWeekStart } = this.data;

    // 构建周日期数组
    const weekDays = [];
    const weekNames = ['一', '二', '三', '四', '五', '六', '日'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);

      weekDays.push({
        week: weekNames[i],
        date: date.getDate(),
        fullDate: this.formatFullDate(date)
      });
    }

    // 更新周范围显示
    const weekRange = this.formatWeekRange(currentWeekStart);

    this.setData({ weekDays, weekRange });

    // 加载排班数据
    await this.loadScheduleData();
  },

  // 格式化完整日期 YYYY-MM-DD
  formatFullDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加载排班数据
  async loadScheduleData() {
    try {
      const { currentWeekStart, weekDays } = this.data;

      // 计算周的起止日期
      const startDate = this.formatFullDate(currentWeekStart);
      const endDate = new Date(currentWeekStart);
      endDate.setDate(endDate.getDate() + 6);
      const endDateStr = this.formatFullDate(endDate);

      // 调用后端接口获取周排班
      const app = getApp();
      const departmentId = app.globalData.currentTeamId || app.globalData.department?.id;
      const res = await api.getWeeklySchedule(departmentId, startDate);

      const schedules = res.data || [];

      // 获取成员列表
      const memberRes = await api.getMemberList();
      const members = memberRes.data || [];

      // 构建排班数据结构
      const scheduleData = members.map(member => {
        // 获取该成员本周的排班
        const memberSchedules = schedules.filter(s => s.memberId === member.id);

        // 构建每天的排班数据
        const daySchedules = weekDays.map(day => {
          const schedule = memberSchedules.find(s => s.date === day.fullDate);
          return {
            date: day.fullDate,
            shiftCode: schedule ? schedule.shiftCode : '',
            color: schedule ? schedule.shiftColor : ''
          };
        });

        return {
          memberId: member.id,
          memberName: member.nickName,
          schedules: daySchedules
        };
      });

      this.setData({ scheduleData });
    } catch (error) {
      util.showError('加载排班数据失败');
    }
  },

  // 上周
  prevWeek() {
    const { currentWeekStart } = this.data;
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);

    this.setData({ currentWeekStart: newStart });
    this.loadWeekData();
  },

  // 下周
  nextWeek() {
    const { currentWeekStart } = this.data;
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);

    this.setData({ currentWeekStart: newStart });
    this.loadWeekData();
  }
});
