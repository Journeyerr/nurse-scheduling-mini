// pages/statistics/statistics.js
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
      shiftDetails: []
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

    // 成员筛选
    memberOptions: [{ id: 'all', name: '全部成员' }],
    selectedMemberId: 'all',
    selectedMemberName: '全部成员',
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
      // 给每个成员记录原始排行序号
      const memberRank = (deptStats.memberRank || []).map((m, i) => ({ ...m, rankIndex: i }));
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
      this.setData({ currentUserStats: res.data || {} });
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

  // 切换成员
  onMemberChange(e) {
    const memberId = e.currentTarget.dataset.id;
    const member = this.data.memberOptions.find(m => m.id === memberId);
    
    if (member) {
      const updates = {
        selectedMemberId: member.id,
        selectedMemberName: member.name,
        showMemberPicker: false
      };

      if (member.id === 'all') {
        // 全部成员：恢复完整排行
        const deptStats = this.data.deptStats;
        updates.rankList = deptStats.memberRank || [];
        updates.totalSummary = {
          totalSchedules: deptStats.totalSchedules,
          totalRestSchedules: deptStats.totalRestSchedules,
          totalHours: deptStats.totalHours
        };
        updates.memberStats = { totalDays: 0, restDays: 0, totalHours: 0 };
      } else {
        // 选中某人：只显示该人的排行（保留原始排行序号）
        const memberRank = this.data.deptStats.memberRank || [];
        const found = memberRank.find(m => m.id === member.id);
        updates.rankList = found ? [found] : [];
        // 用排行数据直接填充统计面板
        if (found) {
          updates.memberStats = {
            totalDays: found.scheduleCount || 0,
            restDays: found.restCount || 0,
            totalHours: found.totalHours || 0
          };
        }
      }

      this.setData(updates);
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
