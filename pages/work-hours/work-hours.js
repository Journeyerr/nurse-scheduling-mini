// pages/work-hours/work-hours.js
const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    isLeader: false,
    currentYear: 2024,
    currentMonth: 1,
    
    // 个人统计
    myStats: {
      totalDays: 0,
      restDays: 0,
      totalHours: 0,
      shiftDetails: [],
      savedDays: 0,   // 存班天数
      owedDays: 0     // 欠班天数
    },
    
    // 科室统计
    deptStats: {
      totalSchedules: 0,
      totalMembers: 0,
      totalHours: 0,
      memberRank: []
    },

    // 当前用户统计（护士长自己的统计）
    currentUserStats: {
      totalDays: 0,
      restDays: 0,
      totalHours: 0
    },

    // 成员筛选（多选）
    memberOptions: [],
    selectedMemberIds: [],  // 空数组表示全部成员
    selectedMemberMap: {},  // {id: true} 选中映射，用于WXML判断
    showMemberPicker: false,
    memberStats: {
      totalDays: 0,
      restDays: 0,
      totalHours: 0
    },

    // 排行列表（筛选后）
    rankList: [],
    totalSummary: {
      totalSchedules: 0,
      totalRestSchedules: 0,
      totalHours: 0
    },

    // 班种图例
    shiftList: [],

    // 是否显示系数和列
    showCoeff: false
  },

  onLoad() {
    const now = new Date();
    this.setData({
      isLeader: app.isLeader(),
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
    
    this.loadData();
  },

  async loadData() {
    // 先加载班种列表（图例用 + 系数和计算依赖）
    await this.loadShiftList();

    if (this.data.isLeader) {
      await this.loadMemberOptions();
      this.loadDeptStats();
      this.loadCurrentUserStats();
    } else {
      this.loadMyStats();
    }
  },

  // 加载成员选项
  async loadMemberOptions() {
    try {
      const res = await api.getMemberList();
      const members = (res.data || []).map(m => ({
        id: String(m.id),
        name: m.nickName
      }));
      this.setData({ memberOptions: members });
    } catch (error) {
      // 加载成员列表失败
    }
  },

  // 加载班种列表（用于图例展示）
  async loadShiftList() {
    try {
      const res = await api.getShiftList();
      this.setData({ shiftList: res.data || [] });
    } catch (error) {
      // 加载班种失败
    }
  },

  // 切换显示/隐藏系数和列
  toggleShowCoeff() {
    this.setData({ showCoeff: !this.data.showCoeff });
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
      const data = res.data || {};
      // 补全系数和、工时（后端可能不返回，前端计算）
      if (data.shiftDetails && this.data.shiftList.length > 0) {
        data.shiftDetails = data.shiftDetails.map(detail => {
          const shift = this.data.shiftList.find(s => s.code === detail.code || s.name === detail.name);
          const coefficient = shift ? (shift.coefficient !== undefined ? shift.coefficient : 1.0) : 1.0;
          const duration = shift ? (shift.duration !== undefined ? shift.duration : 8) : 8;
          if (detail.coefficientSum === undefined || detail.coefficientSum === null) {
            detail.coefficientSum = Math.round(detail.count * coefficient * 10) / 10;
          }
          if (detail.hours === undefined || detail.hours === null) {
            detail.hours = Math.round(detail.count * duration * 10) / 10;
          }
          return detail;
        });
      }
      // 存班/欠班由后端返回
      data.savedDays = data.savedDays || 0;
      data.owedDays = data.owedDays || 0;
      this.setData({ myStats: data });
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
      const deptStats = res.data || {};
      // 给每个成员记录原始排行序号（存班/欠班由后端返回）
      const memberRank = (deptStats.memberRank || []).map((m, i) => ({
        ...m,
        rankIndex: i,
        savedDays: m.savedDays || 0,
        owedDays: m.owedDays || 0
      }));
      this.setData({
        deptStats: { ...deptStats, memberRank },
        rankList: memberRank,
        totalSummary: {
          totalSchedules: deptStats.totalSchedules,
          totalRestSchedules: deptStats.totalRestSchedules,
          totalHours: deptStats.totalHours
        }
      });
    } catch (error) {
      // 加载科室统计失败
    }
  },

  // 加载当前用户统计
  async loadCurrentUserStats() {
    try {
      const res = await api.getMyStatistics(this.data.currentYear, this.data.currentMonth);
      const data = res.data || {};
      // 存班/欠班由后端返回
      data.savedDays = data.savedDays || 0;
      data.owedDays = data.owedDays || 0;
      this.setData({ currentUserStats: data });
    } catch (error) {
      // 加载当前用户统计失败
    }
  },

  // 显示成员选择器
  showPicker() {
    this.setData({ showMemberPicker: true });
  },

  // 隐藏成员选择器
  hidePicker() {
    this.setData({ showMemberPicker: false });
  },

  // 阻止事件冒泡和穿透
  stopPropagation() {},

  // 切换成员选中状态（多选）
  onMemberChange(e) {
    const memberId = String(e.currentTarget.dataset.id);
    let ids = this.data.selectedMemberIds.slice();
    const index = ids.indexOf(memberId);
    if (index > -1) {
      ids.splice(index, 1);
    } else {
      ids.push(memberId);
    }
    const map = {};
    ids.forEach(id => { map[id] = true; });
    this.setData({ selectedMemberIds: ids, selectedMemberMap: map });
  },

  // 全选/取消全选
  toggleSelectAll() {
    const allIds = this.data.memberOptions.map(m => String(m.id));
    const currentIds = this.data.selectedMemberIds;
    if (currentIds.length === allIds.length && allIds.every(id => currentIds.includes(id))) {
      // 已全选，取消全选
      this.setData({ selectedMemberIds: [], selectedMemberMap: {} });
    } else {
      // 全选
      const map = {};
      allIds.forEach(id => { map[id] = true; });
      this.setData({ selectedMemberIds: allIds, selectedMemberMap: map });
    }
  },

  // 确认选择，筛选列表
  confirmMemberSelection() {
    const selectedMemberIds = this.data.selectedMemberIds.map(String);
    const memberRank = this.data.deptStats.memberRank || [];

    if (selectedMemberIds.length === 0) {
      // 未选任何成员 = 全部成员
      this.setData({
        rankList: memberRank,
        totalSummary: {
          totalSchedules: this.data.deptStats.totalSchedules,
          totalRestSchedules: this.data.deptStats.totalRestSchedules,
          totalHours: this.data.deptStats.totalHours
        },
        showMemberPicker: false
      });
    } else {
      // 选中部分成员
      const filtered = memberRank.filter(m => selectedMemberIds.includes(String(m.id)));
      const totalSchedules = filtered.reduce((sum, m) => sum + (m.scheduleCount || 0), 0);
      const totalHours = filtered.reduce((sum, m) => sum + (m.totalHours || 0), 0);
      this.setData({
        rankList: filtered,
        totalSummary: {
          totalSchedules,
          totalRestSchedules: 0,
          totalHours: Math.round(totalHours * 10) / 10
        },
        showMemberPicker: false
      });
    }
  },

  // 加载成员统计
  async loadMemberStats(memberId) {
    try {
      const res = await api.getMemberStatistics(memberId, this.data.currentYear, this.data.currentMonth);
      this.setData({ memberStats: res.data || {} });
    } catch (error) {
      // 加载成员统计失败
    }
  }
});
