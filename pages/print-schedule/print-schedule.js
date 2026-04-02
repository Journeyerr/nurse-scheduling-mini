// pages/print-schedule/print-schedule.js
const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    department: {},
    currentYear: 2024,
    currentMonth: 1,
    shiftList: [],
    statisticsData: []
  },

  onLoad() {
    const department = wx.getStorageSync('department');
    const now = new Date();
    
    this.setData({
      department: department || {},
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
    
    this.loadData();
  },

  async loadData() {
    await this.loadShiftList();
    await this.loadStatisticsData();
  },

  // 加载班种列表
  async loadShiftList() {
    try {
      const res = await api.getShiftList();
      this.setData({ shiftList: res.data || [] });
    } catch (error) {
      // 加载班种失败
    }
  },

  // 加载统计数据
  async loadStatisticsData() {
    try {
      const { currentYear, currentMonth, shiftList } = this.data;
      
      // 加载成员
      const memberRes = await api.getMemberList();
      const members = memberRes.data || [];
      
      // 加载排班
      const app = getApp();
      const departmentId = app.globalData.currentTeamId || app.globalData.department?.id;
      const scheduleRes = await api.getMonthlySchedule(departmentId, currentYear, currentMonth);
      const schedules = scheduleRes.data || [];
      
      // 统计每个成员各班种次数
      const statisticsData = members.map(member => {
        const memberSchedules = schedules.filter(s => s.memberId === member.id);
        
        // 统计各班种次数
        const shiftCounts = shiftList.map(shift => {
          const count = memberSchedules.filter(s => s.shiftId === shift.id).length;
          return {
            shiftId: shift.id,
            count: count
          };
        });
        
        return {
          memberId: member.id,
          memberName: member.nickName,
          shiftCounts
        };
      });
      
      this.setData({ statisticsData });
    } catch (error) {
      // 加载统计数据失败
    }
  },

  // 上个月
  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth -= 1;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear -= 1;
    }
    this.setData({ currentYear, currentMonth });
    this.loadStatisticsData();
  },

  // 下个月
  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth += 1;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear += 1;
    }
    this.setData({ currentYear, currentMonth });
    this.loadStatisticsData();
  },

  // 保存图片
  saveImage() {
    wx.showLoading({ title: '生成中...' });
    
    const query = wx.createSelectorQuery();
    query.select('#scheduleCanvas').boundingClientRect(rect => {
      wx.hideLoading();
      wx.showModal({
        title: '保存排班表',
        content: '请使用手机截图功能保存当前排班表',
        showCancel: false
      });
    }).exec();
  },

  // 分享排班
  shareSchedule() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage']
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.department.name} - ${this.data.currentYear}年${this.data.currentMonth}月排班表`,
      path: '/pages/index/index'
    };
  }
});
