// pages/statistics/statistics.js
const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    isCreator: false,
    currentYear: 2024,
    currentMonth: 1,
    
    // 个人统计
    myStats: {
      totalDays: 0,
      restDays: 0,
      leaveDays: 0,
      shiftDetails: []
    },
    
    // 科室统计
    deptStats: {
      totalSchedules: 0,
      totalMembers: 0,
      avgDays: 0,
      memberRank: []
    },
    
    // 成员筛选
    memberOptions: [{ id: 'all', name: '全部成员' }],
    selectedMemberId: 'all',
    selectedMemberName: '全部成员',
    memberStats: {
      totalDays: 0,
      restDays: 0,
      leaveDays: 0
    }
  },

  onLoad() {
    const now = new Date();
    this.setData({
      isCreator: app.isLeader(),
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
    
    this.loadData();
  },

  async loadData() {
    if (this.data.isCreator) {
      await this.loadMemberOptions();
      this.loadDeptStats();
    } else {
      this.loadMyStats();
    }
  },

  // 加载成员选项
  async loadMemberOptions() {
    try {
      const res = await api.getMemberList();
      const members = (res.data || []).map(m => ({
        id: m.id,
        name: m.nickName
      }));
      this.setData({
        memberOptions: [{ id: 'all', name: '全部成员' }, ...members]
      });
    } catch (error) {
      // 加载成员列表失败
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
    this.loadData();
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
    this.loadData();
  },

  // 加载个人统计
  async loadMyStats() {
    try {
      const res = await api.getMyStatistics(this.data.currentYear, this.data.currentMonth);
      this.setData({ myStats: res.data || {} });
    } catch (error) {
      // 加载统计失败
    }
  },

  // 加载科室统计
  async loadDeptStats() {
    try {
      const app = getApp();
      const departmentId = app.globalData.currentTeamId || app.globalData.department?.id;
      const res = await api.getDepartmentStatistics(this.data.currentYear, this.data.currentMonth, departmentId);
      this.setData({ deptStats: res.data || {} });
    } catch (error) {
      // 加载科室统计失败
    }
  },

  // 切换成员
  onMemberChange(e) {
    const index = e.detail.value;
    const member = this.data.memberOptions[index];
    this.setData({
      selectedMemberId: member.id,
      selectedMemberName: member.name
    });
    
    if (member.id !== 'all') {
      this.loadMemberStats(member.id);
    }
  },

  // 加载成员统计
  async loadMemberStats(memberId) {
    try {
      const res = await api.getMyStatistics(this.data.currentYear, this.data.currentMonth);
      // 这里应该传入memberId，API需要支持
      this.setData({ memberStats: res.data || {} });
    } catch (error) {
      // 加载成员统计失败
    }
  }
});
