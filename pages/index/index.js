// pages/index/index.js
const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    // 启动加载状态
    isLaunching: true, // 是否正在启动检查
    isLoggedIn: false, // 是否已登录

    // 科室信息
    department: {},
    isCreator: false,
    hasDepartment: false, // 是否有科室
    role: null, // 用户角色：'leader' 或 'nurse'
    isLeader: false, // 是否为护士长（综合判断：创建者或管理员）
    isAdmin: false, // 是否为管理员
    initialized: false, // 是否已初始化

    // 日历相关
    currentYear: 2024,
    currentMonth: 1,
    swiperIndex: 1,
    calendarList: [[], [], []], // 三个月数据用于滑动
    calendarHeight: 500, // 日历高度（rpx）
    isChangingMonth: false, // 防止重复切换月份
    weekDays: ['一', '二', '三', '四', '五', '六', '日'],

    // 假日数据（从后端获取，缓存）
    holidayMap: {},   // { 'YYYY-MM-DD': '假日名称' }
    workdayMap: {},   // { 'YYYY-MM-DD': true }

    // 排班数据
    scheduleData: {},
    scheduleCount: 0, // 排班数据数量

    // 功能数据
    pendingCount: 0,

    // 成员列表
    members: [],

    // 成员选择器
    showMemberPicker: false,
    pickerMode: '', // 'transfer' | 'kick'
    pickerMembers: [],
    pickerIndex: 0,

    // 搜索相关
    showSearchInput: false,
    searchKeyword: '',
    filteredMembers: [],
    memberExpanded: false,
    displayMembers: [],

    // 弹窗相关
    showDayModal: false,
    selectedDate: '',
    daySchedule: [],
    showInviteModal: false,  // 邀请护士长弹窗
    
    // 错误提示条
    showErrorBar: false,
    errorMessage: '',
    
    // 防抖标志
    loadingPendingCount: false  // 是否正在加载待审批数量
  },

  onLoad() {
    // 启动时先检查登录状态
    this.checkLoginAndInit();
  },

  // 检查登录状态并初始化
  checkLoginAndInit() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    if (!token || !userInfo) {
      // 未登录，允许浏览首页，但不加载数据
      // 默认显示护士长角色
      this.setData({
        isLaunching: false,
        isLoggedIn: false,
        hasDepartment: false,
        initialized: true,
        role: 'leader',
        isLeader: true
      });

      // 初始化日历（未登录用户也能看到日历）
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      this.setData({
        currentYear,
        currentMonth
      }, () => {
        this.loadHolidays().then(() => {
          this.initCalendar();
        });
      });
      return;
    }

    // 已登录，初始化首页
    this.setData({
      isLaunching: false,
      isLoggedIn: true
    });
    this.loadHolidays().then(() => {
      this.checkDepartment();
    });
  },

  onShow() {
    // 如果正在启动检查，不执行
    if (this.data.isLaunching) {
      return;
    }

    // 重新检查登录状态（用户可能刚登录返回）
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = !!(token && userInfo);

    // 如果登录状态发生变化
    if (isLoggedIn !== this.data.isLoggedIn) {
      this.setData({ isLoggedIn });
      
      if (isLoggedIn) {
        // 刚登录，重新初始化
        this.checkDepartment();
        return;
      }
    }

    // 如果已经初始化过，则只刷新数据
    if (this.data.initialized) {
      if (this.data.hasDepartment && this.data.isLoggedIn) {
        this.loadData();
      }
    } else {
      // 未初始化时，执行初始化
      this.checkDepartment();
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    // 没有科室时不触发刷新
    if (!this.data.hasDepartment) {
      wx.stopPullDownRefresh();
      return;
    }

    try {
      // 等待数据加载完成
      await this.refreshData();
      // 成功后收起下拉样式
      wx.stopPullDownRefresh();
    } catch (error) {
      console.error('刷新失败:', error);
      // 失败时显示错误横幅
      this.setData({
        showErrorBar: true,
        errorMessage: '加载失败'
      });
      
      // 2秒后关闭横幅并收起下拉样式
      setTimeout(() => {
        this.setData({ showErrorBar: false });
        wx.stopPullDownRefresh();
      }, 2000);
    }
  },

  // 异步刷新数据
  async refreshData() {
    // 并行请求：获取用户信息和科室信息
    const promises = [api.getUserInfo()];
    
    // 如果有科室，也获取科室信息
    if (this.data.hasDepartment) {
      promises.push(api.getDepartmentInfo());
    }
    
    const results = await Promise.all(promises);
    
    // 更新用户信息缓存
    const userInfo = results[0].data;
    wx.setStorageSync('userInfo', userInfo);
    
    // 如果有科室信息，更新科室缓存
    if (results[1]) {
      const department = results[1].data;
      wx.setStorageSync('department', department);
      this.setData({ department });
    }
    
    // 重新检查科室状态（异步执行）
    this.checkDepartment();
  },

  // 检查科室状态
  async checkDepartment() {
    // 立即设置标志，防止 onShow 重复调用
    this.setData({ initialized: true });

    const hasDept = app.hasDepartment();
    const role = app.getRole();

    // 从本地存储获取科室和用户信息
    const department = wx.getStorageSync('department');
    const userInfo = wx.getStorageSync('userInfo');

    // 判断是否为创建者
    const isCreator = department && department.creatorId == userInfo?.id;

    // 判断是否为管理员（从成员列表中查找当前用户）
    let isAdmin = false;
    if (this.data.members.length > 0) {
      const selfMember = this.data.members.find(m => m.id == userInfo?.id);
      isAdmin = !!(selfMember && selfMember.isAdmin);
    }

    const isLeader = this.checkIsLeader(hasDept, role, isCreator, isAdmin);

    this.setData({
      hasDepartment: hasDept,
      role: role,
      isLeader: isLeader,
      isCreator: isCreator,
      isAdmin: isAdmin,
      department: department || {},
      isLaunching: false  // 完成启动检查
    });

    // 护士长/管理员加载待审批数量
    if (isLeader) {
      this.loadPendingCount();
    }

    // 初始化日历（无论有无科室都显示）
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // 使用 setData 的回调确保数据更新完成
    this.setData({
      currentYear,
      currentMonth
    }, () => {
      this.initCalendar();
      
      if (hasDept) {
        this.loadData();
      }
    });
  },

  // 加载假日数据（从后端获取，缓存到本地）
  async loadHolidays() {
    // 先尝试从缓存读取
    const cachedHolidayMap = wx.getStorageSync('holidayMap');
    const cachedWorkdayMap = wx.getStorageSync('workdayMap');
    if (cachedHolidayMap && cachedWorkdayMap) {
      this.setData({ holidayMap: cachedHolidayMap, workdayMap: cachedWorkdayMap });
      return;
    }
    try {
      const res = await api.getHolidayList();
      const data = res.data || {};
      this.setData({
        holidayMap: data.holidays || {},
        workdayMap: data.workdays || {}
      });
      // 缓存到本地
      wx.setStorageSync('holidayMap', data.holidays || {});
      wx.setStorageSync('workdayMap', data.workdays || {});
    } catch (error) {
      // 加载失败使用空数据
    }
  },

  // 获取指定日期的假日信息（使用后端数据）
  getHolidayInfo(date) {
    const holidayMap = this.data.holidayMap || {};
    const workdayMap = this.data.workdayMap || {};
    const isHoliday = holidayMap.hasOwnProperty(date);
    const holidayName = holidayMap[date] || '';
    const isWorkday = workdayMap.hasOwnProperty(date);
    return { isHoliday, holidayName, isWorkday };
  },

  // 判断是否为护士长（综合科室状态和角色：创建者或管理员）
  checkIsLeader(hasDept, role, isCreator, isAdmin = false) {
    if (hasDept) {
      return isCreator || isAdmin;
    }
    return role === 'leader';
  },

  // 根据最新成员列表刷新护士长/管理员身份
  refreshLeaderStatus() {
    const department = wx.getStorageSync('department');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (!department) return;
    
    const hasDept = app.hasDepartment();
    const isCreator = department.creatorId == userInfo?.id;
    
    let isAdmin = false;
    if (this.data.members.length > 0) {
      const selfMember = this.data.members.find(m => m.id == userInfo?.id);
      isAdmin = !!(selfMember && selfMember.isAdmin);
    }
    
    const newIsLeader = this.checkIsLeader(hasDept, this.data.role, isCreator, isAdmin);
    
    // 只有身份发生变化时才更新（避免不必要的 setData）
    if (newIsLeader !== this.data.isLeader || isAdmin !== this.data.isAdmin || isCreator !== this.data.isCreator) {
      this.setData({
        isLeader: newIsLeader,
        isAdmin: isAdmin,
        isCreator: isCreator
      });
      
      // 同步到 app 全局
      app.setAdmin(isAdmin);
      
      // 身份变为 leader 时加载待审批数
      if (newIsLeader && !this.data.pendingCount) {
        this.loadPendingCount();
      }
    }
  },

  // 创建科室
  goCreateDepartment() {
    // 先检查是否登录
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    if (!token || !userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再创建科室',
        showCancel: false,
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/create-department/create-department',
      success: () => {
        // 跳转成功
      },
      fail: (err) => {
        // 失败时使用 reLaunch
        wx.reLaunch({ url: '/pages/create-department/create-department' });
      }
    });
  },

  // 加入科室
  goJoinDepartment() {
    wx.showModal({
      title: '加入科室',
      editable: true,
      placeholderText: '请输入邀请码',
      success: (res) => {
        if (res.confirm && res.content) {
          this.joinDepartment(res.content.trim());
        }
      }
    });
  },

  // 加入科室
  async joinDepartment(inviteCode) {
    try {
      util.showLoading('加入中...');
      const res = await api.joinDepartment({ inviteCode });
      util.hideLoading();

      app.setDepartment(res.data);
      this.setData({ hasDepartment: true });
      util.showSuccess('加入成功');

      this.loadData();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || error.msg || '加入失败');
    }
  },

  // 切换为护士长
  switchToLeader() {
    app.setRole('leader');
    const isLeader = this.checkIsLeader(this.data.hasDepartment, 'leader', this.data.isCreator);
    this.setData({ role: 'leader', isLeader: isLeader });
    wx.showToast({
      title: '已切换为护士长',
      icon: 'success'
    });
  },

  // 切换为护士
  switchToNurse() {
    app.setRole('nurse');
    const isLeader = this.checkIsLeader(this.data.hasDepartment, 'nurse', this.data.isCreator);
    this.setData({ role: 'nurse', isLeader: isLeader });
    wx.showToast({
      title: '已切换为护士',
      icon: 'success'
    });
  },

  // 加载数据
  async loadData() {
    let department = wx.getStorageSync('department');
    let userInfo = wx.getStorageSync('userInfo');
    
    // 如果没有科室，直接返回
    if (!department) {
      return;
    }
    
    // 如果 userInfo 为空或没有 id，重新获取
    if (!userInfo || !userInfo.id) {
      try {
        const res = await api.getUserInfo();
        userInfo = res.data;
        wx.setStorageSync('userInfo', userInfo);
      } catch (error) {
        // 获取用户信息失败
      }
    }

    // 从服务器获取最新的科室信息，更新缓存和 isCreator 状态
    try {
      const deptRes = await api.getDepartmentInfo();
      department = deptRes.data;
      wx.setStorageSync('department', department);
    } catch (error) {
      // 获取科室信息失败，使用缓存数据
    }
    
    const isCreator = department && department.creatorId == userInfo?.id;

    // 判断是否为管理员（从成员列表中查找当前用户）
    // 注意：首次进入时 members 可能为空，需要等 loadMembers 完成后 refreshLeaderStatus 更新
    let isAdmin = false;
    if (this.data.members.length > 0) {
      const selfMember = this.data.members.find(m => m.id == userInfo?.id);
      isAdmin = !!(selfMember && selfMember.isAdmin);
    }

    const isLeader = this.checkIsLeader(true, this.data.role, isCreator, isAdmin);

    // 如果 members 为空，先保留之前的身份状态，等 loadMembers 后再刷新
    const updates = {
      department: department || {},
      isCreator: isCreator,
    };
    if (this.data.members.length > 0) {
      updates.isAdmin = isAdmin;
      updates.isLeader = isLeader;
    }

    this.setData(updates);

    // 加载排班和成员数据
    await Promise.all([
      this.loadSchedule(),
      this.loadMembers(department)
    ]);
    
    if (this.data.isLeader) {
      this.loadPendingCount();
    }
  },

  // 初始化日历
  initCalendar() {
    const { currentYear, currentMonth, scheduleData } = this.data;
    
    const calendars = [
      this.generateCalendarData(currentYear, currentMonth - 1),
      this.generateCalendarData(currentYear, currentMonth),
      this.generateCalendarData(currentYear, currentMonth + 1)
    ];
    
    // 如果已有排班数据，合并到日历中（使用扁平化属性）
    if (Object.keys(scheduleData).length > 0) {
      calendars.forEach((monthCalendar, monthIndex) => {
        monthCalendar.forEach(week => {
          week.forEach(day => {
            const schedule = scheduleData[day.date];
            if (schedule) {
              day.scheduleCode = schedule.code;
              day.scheduleColor = schedule.color;
            }
          });
        });
      });
    }
    
    // 根据当前月份日历的行数计算高度
    // day-cell 高度 100rpx + week-row margin-bottom 8rpx
    const rows = calendars[1].length;
    const calendarHeight = rows * 108;
    
    this.setData({ 
      calendarList: calendars,
      calendarHeight
    });
  },

  // 生成日历数据
  generateCalendarData(year, month) {
    // 处理月份溢出
    if (month < 1) {
      year -= 1;
      month = 12;
    } else if (month > 12) {
      year += 1;
      month = 1;
    }

    const daysInMonth = util.getDaysInMonth(year, month);
    const firstDay = util.getFirstDayOfMonth(year, month);
    const calendarData = [];
    let week = [];

    // 计算上个月的信息（用于填充月初空白）
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const daysInPrevMonth = util.getDaysInMonth(prevYear, prevMonth);

    // 填充月初空白（从周一开始）
    // firstDay: 0=周日, 1=周一, ..., 6=周六
    // 周一开始时：周日(0)需要填充6个，周一(1)填充0个，周二(2)填充1个，...
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = offset - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const holidayInfo = this.getHolidayInfo(date);
      week.push({
        day,
        date,
        isCurrentMonth: false,
        isToday: false,
        isHoliday: holidayInfo.isHoliday,
        holidayName: holidayInfo.holidayName,
        isWorkday: holidayInfo.isWorkday
      });
    }

    // 填充当前月日期
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const holidayInfo = this.getHolidayInfo(date);
      week.push({
        day,
        date,
        isCurrentMonth: true,
        isToday: util.isToday(year, month, day),
        isHoliday: holidayInfo.isHoliday,
        holidayName: holidayInfo.holidayName,
        isWorkday: holidayInfo.isWorkday
      });

      if (week.length === 7) {
        calendarData.push(week);
        week = [];
      }
    }

    // 计算下个月的信息（用于填充月末空白）
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }

    // 填充月末空白
    if (week.length > 0) {
      let nextDay = 1;
      while (week.length < 7) {
        const date = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
        const holidayInfo = this.getHolidayInfo(date);
        week.push({
          day: nextDay,
          date,
          isCurrentMonth: false,
          isToday: false,
          isHoliday: holidayInfo.isHoliday,
          holidayName: holidayInfo.holidayName,
          isWorkday: holidayInfo.isWorkday
        });
        nextDay++;
      }
      calendarData.push(week);
    }

    return calendarData;
  },

  // 加载排班数据（显示当前用户自己的排班）
  async loadSchedule() {
    // 未登录时不加载排班数据
    if (!this.data.isLoggedIn) {
      return;
    }

    try {
      const { currentYear, currentMonth } = this.data;
      
      // 计算前后月份（考虑跨年情况）
      let prevYear = currentYear;
      let prevMonth = currentMonth - 1;
      if (prevMonth < 1) {
        prevMonth = 12;
        prevYear = currentYear - 1;
      }
      
      let nextYear = currentYear;
      let nextMonth = currentMonth + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear = currentYear + 1;
      }
      
      // 单次请求加载三个月的排班数据
      // 格式：year1-month1,year2-month2,year3-month3
      const yearMonths = [
        `${prevYear}-${prevMonth}`,
        `${currentYear}-${currentMonth}`,
        `${nextYear}-${nextMonth}`
      ];
      
      const res = await api.getMySchedule(yearMonths);
      
      // 将排班数据映射到 scheduleData
      this.updateScheduleData(res.data || []);
    } catch (error) {
      // 加载排班失败
    }
  },

  // 更新排班数据（不再合并到日历，直接存储到 scheduleData）
  updateScheduleData(scheduleList) {
    const scheduleMap = {};
    scheduleList.forEach(item => {
      // 处理时间段数据
      let timeSlots = item.timeSlots || [];
      
      // 如果是旧格式，转换为 timeSlots
      if (!timeSlots.length && item.startTime) {
        timeSlots = [{
          startTime: item.startTime,
          endTime: item.endTime
        }];
      }
      
      // 解析每个时间段，处理次日标记
      timeSlots = timeSlots.map(slot => {
        let startTime = slot.startTime || '';
        let endTime = slot.endTime || '';
        let startIsNextDay = false;
        let endIsNextDay = false;
        
        if (startTime.includes('+1')) {
          startTime = startTime.replace('+1', '');
          startIsNextDay = true;
        }
        
        if (endTime.includes('+1')) {
          endTime = endTime.replace('+1', '');
          endIsNextDay = true;
        }
        
        return {
          startTime,
          endTime,
          startIsNextDay,
          endIsNextDay
        };
      });
      
      // 确保日期格式为 yyyy-MM-dd
      let dateKey = item.date;
      if (Array.isArray(item.date)) {
        // 如果是数组格式 [2026, 3, 31]，转换为字符串
        const [year, month, day] = item.date;
        dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else if (typeof item.date === 'string') {
        // 如果已经是字符串，确保格式正确
        dateKey = item.date;
      }
      
      scheduleMap[dateKey] = {
        code: item.shiftCode,
        name: item.shiftName,
        color: item.shiftColor,
        timeSlots
      };
    });
    
    // 存储 scheduleData 并合并到日历
    const scheduleCount = Object.keys(scheduleMap).length;
    this.setData({ 
      scheduleData: scheduleMap,
      scheduleCount: scheduleCount
    });
    this.mergeScheduleToCalendar();
  },

  // 将排班数据合并到日历
  mergeScheduleToCalendar() {
    const { calendarList, scheduleData } = this.data;
    
    // 创建全新的日历数组
    const newCalendarList = [];
    
    calendarList.forEach((monthCalendar, monthIndex) => {
      const newMonthCalendar = [];
      
      monthCalendar.forEach((week, weekIndex) => {
        const newWeek = [];
        
        week.forEach(day => {
          const schedule = scheduleData[day.date];
          
          // 创建新的 day 对象，使用扁平化的属性
          const newDay = {
            day: day.day,
            date: day.date,
            isCurrentMonth: day.isCurrentMonth,
            isToday: day.isToday,
            isHoliday: day.isHoliday,
            holidayName: day.holidayName,
            isWorkday: day.isWorkday,
            // 将排班信息扁平化
            scheduleCode: schedule ? schedule.code : '',
            scheduleColor: schedule ? schedule.color : ''
          };
          
          newWeek.push(newDay);
        });
        
        newMonthCalendar.push(newWeek);
      });
      
      newCalendarList.push(newMonthCalendar);
    });
    
    // 强制更新整个 calendarList
    this.setData({ 
      calendarList: newCalendarList
    });
  },

  // 加载成员列表
  async loadMembers(department) {
    try {
      const res = await api.getMemberList();
      let userInfo = wx.getStorageSync('userInfo');
      
      // 如果 userInfo 为空或没有 id，重新获取
      if (!userInfo || !userInfo.id) {
        try {
          const userRes = await api.getUserInfo();
          userInfo = userRes.data;
          wx.setStorageSync('userInfo', userInfo);
        } catch (error) {
          // 获取用户信息失败
        }
      }
      
      const members = (res.data || []).map(item => {
        const isCreator = item.isCreator === true || item.isCreator === 'true' || item.isCreator === 1;
        const isAdmin = item.isAdmin === true || item.isAdmin === 'true' || item.isAdmin === 1;
        const isSelf = item.id == userInfo?.id;
        return {
          ...item,
          isCreator,
          isAdmin,
          isSelf
        };
      });
      
      this.setData({
        members,
        filteredMembers: members
      });
      this.updateDisplayMembers();
      
      // 成员加载完成后，重新判断管理员身份（首次加载时 members 可能为空）
      this.refreshLeaderStatus();
    } catch (error) {
      // 加载成员失败
    }
  },

  // 加载待审批数量（仅护士长调用）
  async loadPendingCount() {
    // 防抖：如果正在加载，则不重复请求
    if (this.data.loadingPendingCount) {
      return;
    }
    
    this.setData({ loadingPendingCount: true });
    
    try {
      const res = await api.getPendingCount();
      this.setData({ 
        pendingCount: res.data || 0,
        loadingPendingCount: false
      });
    } catch (error) {
      this.setData({ loadingPendingCount: false });
    }
  },

  // 上个月
  async prevMonth() {
    if (this.data.isChangingMonth) return;
    
    let { currentYear, currentMonth } = this.data;
    currentMonth -= 1;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear -= 1;
    }
    
    this.setData({ 
      currentYear, 
      currentMonth, 
      isChangingMonth: true 
    });
    
    // 等待 setData 完成
    await new Promise(resolve => wx.nextTick(resolve));
    
    // 重新初始化日历和加载排班
    this.initCalendar();
    await this.loadSchedule();
    
    // 合并排班数据到日历
    this.mergeScheduleToCalendar();
    
    // 重置 swiper 到中间位置
    setTimeout(() => {
      this.setData({ 
        swiperIndex: 1,
        isChangingMonth: false
      });
    }, 50);
  },

  // 下个月
  async nextMonth() {
    if (this.data.isChangingMonth) return;
    
    let { currentYear, currentMonth } = this.data;
    currentMonth += 1;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear += 1;
    }
    
    this.setData({ 
      currentYear, 
      currentMonth, 
      isChangingMonth: true 
    });
    
    // 等待 setData 完成
    await new Promise(resolve => wx.nextTick(resolve));
    
    // 重新初始化日历和加载排班
    this.initCalendar();
    await this.loadSchedule();
    
    // 合并排班数据到日历
    this.mergeScheduleToCalendar();
    
    // 重置 swiper 到中间位置
    setTimeout(() => {
      this.setData({ 
        swiperIndex: 1,
        isChangingMonth: false
      });
    }, 50);
  },

  // 滑动切换月份
  onSwiperChange(e) {
    if (this.data.isChangingMonth) return;
    
    const index = e.detail.current;
    if (index === 0) {
      this.prevMonth();
    } else if (index === 2) {
      this.nextMonth();
    }
  },

  // 点击日期
  async onDayTap(e) {
    const { date, day } = e.currentTarget.dataset;
    if (!day || !date) return;

    // 解析日期，判断是否为当前月
    const [year, month] = date.split('-').map(Number);
    const { currentYear, currentMonth } = this.data;
    
    // 如果点击的是其他月份的日期，跳转到该月份
    if (year !== currentYear || month !== currentMonth) {
      this.setData({
        currentYear: year,
        currentMonth: month
      }, async () => {
        this.initCalendar();
        await this.loadSchedule();
        this.mergeScheduleToCalendar();
      });
      return;
    }

    // 显示当天所有排班
    this.setData({ showDayModal: true, selectedDate: date, daySchedule: [] });
    try {
      const app = getApp();
      const departmentId = app.globalData.currentTeamId || app.globalData.department?.id;
      const res = await api.getDailySchedule(date, departmentId);
      this.setData({ daySchedule: res.data || [] });
    } catch (error) {
      // 获取当天排班失败
    }
  },

  // 关闭日期弹窗
  closeDayModal() {
    this.setData({ showDayModal: false });
  },

  // 阻止冒泡
  stopPropagation() {},

  // 邀请成员
  inviteMember() {
    wx.navigateTo({ url: '/pages/department-manage/department-manage?action=invite' });
  },

  // 科室管理
  goDepartmentManage() {
    wx.navigateTo({ url: '/pages/department-manage/department-manage' });
  },

  // 检查是否有科室，没有则提示
  checkDepartmentAndGo(url) {
    // 先检查是否登录
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    if (!token || !userInfo) {
      // 未登录，跳转到登录页
      wx.showModal({
        title: '提示',
        content: '请先登录后再使用该功能',
        showCancel: false,
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
      return false;
    }

    if (!this.data.hasDepartment) {
      // 根据角色显示不同提示
      if (this.data.role === 'leader') {
        // 护士长：提示创建科室
        wx.showModal({
          title: '提示',
          content: '请先创建科室',
          showCancel: false,
          confirmText: '去创建',
          success: (res) => {
            if (res.confirm) {
              this.goCreateDepartment();
            }
          }
        });
      } else {
        // 护士：显示邀请弹窗
        this.setData({ showInviteModal: true });
      }
      return false;
    }
    wx.navigateTo({ url: url });
    return true;
  },

  // 关闭邀请弹窗
  closeInviteModal() {
    this.setData({ showInviteModal: false });
  },

  // 排班设置
  goSchedule() {
    this.checkDepartmentAndGo('/pages/schedule/schedule');
  },

  // 班种管理
  goShiftManage() {
    this.checkDepartmentAndGo('/pages/shift-manage/shift-manage');
  },

  // 全科排班
  goTeamSchedule() {
    this.checkDepartmentAndGo('/pages/team-schedule/team-schedule');
  },

  // 打印排班
  goPrint() {
    this.checkDepartmentAndGo('/pages/print-schedule/print-schedule');
  },

  // 审批
  goApproval() {
    this.checkDepartmentAndGo('/pages/approval/approval');
  },

  // 统计
  goStatistics() {
    this.checkDepartmentAndGo('/pages/statistics/statistics');
  },

  // 申请班次
  goExpectSchedule() {
    this.checkDepartmentAndGo('/pages/expect-schedule/expect-schedule');
  },

  // 假勤申请
  goLeaveApply() {
    wx.navigateTo({ url: '/pages/leave-apply/leave-apply' });
  },

  // 点击管理员标签（创建者取消管理员）
  async onAdminTagTap(e) {
    if (!this.data.isCreator) return;
    
    const { id, name } = e.currentTarget.dataset;
    
    const confirm = await util.showConfirm('取消管理员', `确定取消 ${name || '该成员'} 的管理员身份吗？`);
    if (!confirm) return;
    
    try {
      util.showLoading('处理中...');
      await api.setAdmin(this.data.department.id, { memberId: id, isAdmin: false });
      util.hideLoading();
      util.showSuccess('已取消管理员');
      this.loadMembers(this.data.department);
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || error.msg || '操作失败');
    }
  },

  // 长按成员（踢人）
  async onMemberLongPress(e) {
    if (!this.data.isLeader) return;
    
    const { id, name } = e.currentTarget.dataset;
    const userInfo = wx.getStorageSync('userInfo');
    
    // 不能踢自己
    if (id === userInfo?.id) {
      util.showError('不能移除自己');
      return;
    }

    const confirm = await util.showConfirm('确认移除', `确定要将 ${name} 移出科室吗？`);
    if (!confirm) return;

    try {
      util.showLoading('处理中...');
      await api.kickMember({ memberId: id });
      util.hideLoading();
      util.showSuccess('已移出');
      this.loadMembers();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '操作失败');
    }
  },

  // 点击成员查看信息
  goMemberInfo(e) {
    // 先检查是否登录
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    if (!token || !userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再查看成员信息',
        showCancel: false,
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
      return;
    }

    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/member-info/member-info?memberId=${id}` });
  },

  // 头像点击事件
  onAvatarTap(e) {
    const { id, phone, isself } = e.currentTarget.dataset;
    
    if (isself) {
      // 是本人，跳转到用户信息详情页
      wx.navigateTo({ url: `/pages/member-info/member-info?memberId=${id}` });
    } else {
      // 不是本人，拨打电话
      if (!phone) {
        wx.showToast({
          title: '暂无电话号码',
          icon: 'none'
        });
        return;
      }
      
      wx.makePhoneCall({
        phoneNumber: phone,
        fail: (err) => {
          if (err.errMsg !== 'makePhoneCall:fail cancel') {
            wx.showToast({
              title: '拨打失败',
              icon: 'none'
            });
          }
        }
      });
    }
  },

  // 分享
  onShareAppMessage() {
    if (this.data.isLoggedIn && this.data.hasDepartment && this.data.department.inviteCode) {
      // 已登录且有科室，分享邀请链接
      return {
        title: `邀请你加入${this.data.department.name}`,
        path: `/pages/login/login?inviteCode=${this.data.department.inviteCode}`
      };
    }
    // 未登录或没有科室，分享小程序首页
    return {
      title: '护士排班系统 - 高效便捷的排班管理工具',
      path: '/pages/index/index'
    };
  },

  // 显示科室操作菜单（护士长/管理员专属）
  showDepartmentActions() {
    if (!this.data.isLeader) return;
    
    // 根据角色动态生成菜单：创建者显示全部，管理员只显示移除成员+退出科室
    const items = this.data.isCreator
      ? ['添加管理员', '解散科室', '转让科室', '移除成员']
      : ['移除成员', '退出科室'];
    
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        // 延迟执行，避免连续弹出 ActionSheet 导致失败
        setTimeout(() => {
          const action = items[res.tapIndex];
          switch (action) {
            case '添加管理员':
              this.addAdmin();
              break;
            case '解散科室':
              this.dismissDepartment();
              break;
            case '转让科室':
              this.transferDepartment();
              break;
            case '移除成员':
              this.kickMember();
              break;
            case '退出科室':
              this.quitDepartment();
              break;
          }
        }, 300);
      }
    });
  },

  // 添加管理员 - 显示成员选择器
  addAdmin() {
    const userInfo = wx.getStorageSync('userInfo');
    // 排除自己和已经是管理员的成员
    const candidateMembers = this.data.members.filter(m =>
      m.id != userInfo?.id && !m.isAdmin && !m.isCreator
    );
    
    if (candidateMembers.length === 0) {
      util.showError('暂无可设为管理员的成员');
      return;
    }

    this.setData({
      pickerMode: 'admin',
      pickerMembers: candidateMembers,
      pickerIndex: 0,
      showMemberPicker: true
    });
  },

  // 解散科室
  async dismissDepartment() {
    const confirm = await util.showConfirm('确认解散', '解散后将删除所有数据且无法恢复，确定要解散吗？');
    if (!confirm) return;

    try {
      util.showLoading('解散中...');
      await api.dismissDepartment(this.data.department.id);
      util.hideLoading();
      
      // 清除本地数据
      app.clearUserInfo();
      wx.removeStorageSync('department');
      
      util.showSuccess('已解散');
      
      // 跳转到登录页
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/login/login' });
      }, 1500);
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || error.msg || '解散失败');
    }
  },

  // 转让科室 - 显示 picker
  transferDepartment() {
    const userInfo = wx.getStorageSync('userInfo');
    // 排除自己，显示其他所有成员
    const transferableMembers = this.data.members.filter(m => m.id != userInfo?.id);
    
    if (transferableMembers.length === 0) {
      util.showError('暂无其他成员可转让');
      return;
    }

    this.setData({
      pickerMode: 'transfer',
      pickerMembers: transferableMembers,
      pickerIndex: 0,
      showMemberPicker: true
    });
  },

  // 踢出成员 - 显示 picker
  kickMember() {
    const userInfo = wx.getStorageSync('userInfo');
    // 排除自己，显示其他所有成员
    const kickableMembers = this.data.members.filter(m => m.id != userInfo?.id);
    
    if (kickableMembers.length === 0) {
      util.showError('暂无其他成员可踢出');
      return;
    }

    this.setData({
      pickerMode: 'kick',
      pickerMembers: kickableMembers,
      pickerIndex: 0,
      showMemberPicker: true
    });
  },

  // picker 滚动选择
  onPickerChange(e) {
    // 用实例变量记录，不触发 setData 避免picker回弹
    this._pickerIndex = e.detail.value[0];
  },

  // picker 确认选择
  async onPickerConfirm() {
    const pickerIndex = this._pickerIndex !== undefined ? this._pickerIndex : this.data.pickerIndex;
    const { pickerMode, pickerMembers } = this.data;
    this.setData({ showMemberPicker: false });

    const selectedMember = pickerMembers[pickerIndex];
    if (!selectedMember) return;

    if (pickerMode === 'transfer') {
      const confirm = await util.showConfirm('确认转让', `确定将科室转让给 ${selectedMember.nickName || '未命名用户'} 吗？`);
      if (!confirm) return;

      try {
        util.showLoading('转让中...');
        await api.transferDepartment(this.data.department.id, { newCreatorId: selectedMember.id });
        util.hideLoading();
        
        const department = this.data.department;
        department.creatorId = selectedMember.id;
        wx.setStorageSync('department', department);
        
        util.showSuccess('已转让');
        this.checkDepartment();
      } catch (error) {
        util.hideLoading();
        util.showError(error.message || error.msg || '转让失败');
      }
    } else if (pickerMode === 'admin') {
      const confirm = await util.showConfirm('确认设为管理员', `确定将 ${selectedMember.nickName || '未命名用户'} 设为科室管理员吗？管理员拥有与护士长相同的权限。`);
      if (!confirm) return;

      try {
        util.showLoading('设置中...');
        await api.setAdmin(this.data.department.id, { memberId: selectedMember.id, isAdmin: true });
        util.hideLoading();
        util.showSuccess('已设为管理员');
        this.loadMembers(this.data.department);
      } catch (error) {
        util.hideLoading();
        util.showError(error.message || error.msg || '操作失败');
      }
    } else if (pickerMode === 'kick') {
      const confirm = await util.showConfirm('确认踢出', `确定要将 ${selectedMember.nickName || '未命名用户'} 移出科室吗？`);
      if (!confirm) return;

      try {
        util.showLoading('处理中...');
        await api.kickMember(this.data.department.id, { memberId: selectedMember.id });
        util.hideLoading();
        util.showSuccess('已移出');
        this.loadMembers(this.data.department);
      } catch (error) {
        util.hideLoading();
        util.showError(error.message || error.msg || '操作失败');
      }
    }
  },

  // picker 取消
  onPickerCancel() {
    this.setData({ showMemberPicker: false });
  },

  // 显示成员操作菜单（非护士长专属）
  showMemberActions() {
    wx.showActionSheet({
      itemList: ['退出科室'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.quitDepartment();
        }
      }
    });
  },

  // 退出科室
  async quitDepartment() {
    const confirm = await util.showConfirm('确认退出', '退出后将无法查看科室排班信息，确定要退出吗？');
    if (!confirm) return;

    try {
      util.showLoading('退出中...');
      await api.quitDepartment(this.data.department.id);
      util.hideLoading();
      
      // 清除本地科室相关数据（保留登录信息：token、userInfo、holidayMap、workdayMap）
      app.setDepartment(null);
      app.setRole(null);
      app.globalData.isCreator = false;
      app.globalData.isAdmin = false;
      app.globalData.currentTeamId = null;
      wx.removeStorageSync('department');
      wx.removeStorageSync('role');
      
      util.showSuccess('已退出科室');

      // 跳转到身份选择页
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/role-select/role-select' });
      }, 1500);
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || error.msg || '退出失败');
    }
  },

  // 点击邀请按钮
  onInviteTap() {
    if (!this.data.hasDepartment) {
      wx.showModal({
        title: '提示',
        content: '请先创建科室',
        showCancel: false,
        confirmText: '去创建',
        success: (res) => {
          if (res.confirm) {
            this.goCreateDepartment();
          }
        }
      });
    }
  },

  // 切换搜索框显示
  toggleSearch() {
    // 先检查是否登录
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    if (!token || !userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再使用搜索功能',
        showCancel: false,
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
      return;
    }

    this.setData({
      showSearchInput: !this.data.showSearchInput,
      searchKeyword: '',
      filteredMembers: this.data.members,
      memberExpanded: false
    });
    this.updateDisplayMembers();
  },

  // 关闭搜索框
  closeSearch() {
    this.setData({
      showSearchInput: false,
      searchKeyword: '',
      filteredMembers: this.data.members,
      memberExpanded: false
    });
    this.updateDisplayMembers();
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    this.setData({ searchKeyword: keyword });
    this.filterMembers(keyword);
  },

  // 过滤成员列表
  filterMembers(keyword) {
    if (!keyword) {
      this.setData({ filteredMembers: this.data.members, memberExpanded: false });
      this.updateDisplayMembers();
      return;
    }

    const filtered = this.data.members.filter(member => {
      const name = member.nickName.toLowerCase();
      const searchKey = keyword.toLowerCase();
      return name.includes(searchKey);
    });

    // 搜索时展开全部结果
    this.setData({ filteredMembers: filtered, memberExpanded: true });
    this.updateDisplayMembers();
  },

    // 模糊匹配成员名称（不区分大小写）
  // 更新显示的成员列表（折叠/展开）
  updateDisplayMembers() {
    const { filteredMembers, memberExpanded } = this.data;
    if (memberExpanded || filteredMembers.length <= 3) {
      this.setData({ displayMembers: filteredMembers });
    } else {
      this.setData({ displayMembers: filteredMembers.slice(0, 3) });
    }
  },

  // 展开/收起成员列表
  toggleMemberList() {
    const memberExpanded = !this.data.memberExpanded;
    this.setData({ memberExpanded });
    this.updateDisplayMembers();
  }
});
/*  */