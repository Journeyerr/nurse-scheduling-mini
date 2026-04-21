// pages/schedule/schedule.js
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    // 周日期
    weekDates: [],
    weekStart: '',
    weekEnd: '',
    weekRangeText: '',
    currentYear: 2024,
    weekDays: ['一', '二', '三', '四', '五', '六', '日'],
    
    // 日历弹窗
    showCalendarModal: false,
    calYear: 2024,
    calMonth: 1,
    calDays: [],
    
    // 成员列表（含排班数据）
    members: [],
    
    // 班种列表
    shiftList: [],
    currentShift: '',
    
    // 班种套餐
    packageList: [],
    
    // 所有成员（用于弹窗选择）
    allMembers: [],
    selectedMemberMap: {},  // {id: true} 选中映射
    allSelected: false,     // 是否全选
    selectedMemberCount: 0, // 已选人数
    
    // 弹窗
    showMemberModal: false,
    
    // 当前选中
    selectedMemberId: '',
    selectedDate: '',
    
    // 编辑焦点（自动移动的光标）
    focusCell: null, // { memberId, dateIndex }
    
    // 本地排班变更记录
    localChanges: {
      adds: [],    // 新增的排班
      deletes: []  // 删除的排班
    },
    
    // 发布确认弹窗
    showPublishModal: false,
    publishStats: null,  // 统计数据
    
    // 底部工具栏
    toolbarTab: 'shift',  // 'shift' | 'package'
    
    // 拖拽排序相关
    dragIndex: -1,            // 正在拖拽的行索引
    insertBeforeIndex: -1,    // 插入位置指示（-1表示在最后，0表示在行0之前，1表示在行1之前...）
    dragOffsetY: 0,           // 拖拽偏移量（rpx）
    dragStartTimestamp: 0,    // 触摸开始时间戳
    isDragging: false,        // 是否正在拖拽
    dragThreshold: 350,       // 长按触发阈值（ms）
    rowHeight: 104,           // 行高（rpx）
    
    initialized: false  // 是否已初始化
  },

  onLoad() {
    this.initWeekDates();
    this.loadData();
  },

  onShow() {
    // 如果已初始化，刷新套餐数据
    if (this.data.initialized) {
      this.loadPackages();
    }
  },

  // 初始化周日期
  initWeekDates() {
    const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      weekDates.push({
        date: d.getDate(),
        fullDate: util.formatDate(d),
        day: weekDays[i]
      });
    }
    
    const startParts = weekDates[0].fullDate.split('-');
    const endParts = weekDates[6].fullDate.split('-');
    const weekRangeText = `${startParts[1]}-${startParts[2]} 至 ${endParts[1]}-${endParts[2]}`;
    
    this.setData({
      weekDates,
      weekStart: weekDates[0].fullDate,
      weekEnd: weekDates[6].fullDate,
      weekRangeText,
      currentYear: parseInt(startParts[0])
    });
  },

  // 加载数据
  async loadData() {
    await Promise.all([
      this.loadShifts(),
      this.loadAllMembers(),
      this.loadPackages()
    ]);
    await this.loadMembers();
    await this.loadWeeklySchedule();
    
    // 清空本地变更记录
    this.setData({
      localChanges: { adds: [], deletes: [] },
      initialized: true
    });
  },

  // 加载班种套餐
  async loadPackages() {
    try {
      const res = await api.getShiftPackageList();
      this.setData({ packageList: res.data || [] });
    } catch (error) {
      // 加载套餐失败
    }
  },

  // 加载班种
  async loadShifts() {
    try {
      const res = await api.getShiftList();
      const list = (res.data || []).map(item => {
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
        
        return {
          ...item,
          timeSlots
        };
      });
      
      this.setData({ 
        shiftList: list,
        currentShift: list.length > 0 ? list[0].id : ''
      });
    } catch (error) {
      // 加载班种失败
    }
  },

  // 加载所有成员
  async loadAllMembers() {
    try {
      const app = getApp();
      const departmentId = app.globalData.currentTeamId || app.globalData.department?.id;
      
      if (!departmentId) {
        this.setData({ allMembers: [] });
        return;
      }
      
      const res = await api.getMemberList();
      const members = (res.data || []).map(m => ({ ...m, id: String(m.id), selected: false }));
      
      this.setData({ allMembers: members, selectedMemberMap: {}, allSelected: false, selectedMemberCount: 0 });
    } catch (error) {
      this.setData({ allMembers: [] });
    }
  },

  // 加载已添加的成员
  loadMembers() {
    return new Promise((resolve) => {
      const selectedIds = this.data.allMembers.filter(m => m.selected).map(m => m.id);
      const members = this.data.allMembers
        .filter(m => selectedIds.includes(m.id))
        .map(m => ({ ...m, schedules: {} }));
      
      this.setData({ members }, () => {
        resolve();
      });
    });
  },

  // 加载周排班
  async loadWeeklySchedule() {
    try {
      const app = getApp();
      const deptId = app.globalData.currentTeamId || app.globalData.department?.id;
      const res = await api.getWeeklySchedule(deptId, this.data.weekStart);
      
      const scheduleMap = {};
      (res.data || []).forEach(item => {
        const key = `${item.memberId}_${item.date}`;
        scheduleMap[key] = {
          id: item.id,
          code: item.shiftCode,
          name: item.shiftName,
          color: item.shiftColor
        };
      });

      const members = this.data.members.map(m => {
        const schedules = { ...m.schedules }; // 保留已有的schedules数据（包括期望排班）
        this.data.weekDates.forEach(d => {
          const key = `${m.id}_${d.fullDate}`;
          if (scheduleMap[key]) {
            schedules[d.fullDate] = scheduleMap[key];
          }
        });
        return { ...m, schedules };
      });

      this.setData({ members });
      
      // 加载期望排班数据
      await this.loadExpectSchedules();
    } catch (error) {
      // 加载排班失败
    }
  },

  // 加载期望排班数据
  async loadExpectSchedules() {
    try {
      // 获取选中成员的ID列表
      const selectedUserIds = this.data.members.map(m => m.id);
      
      if (selectedUserIds.length === 0) {
        return;
      }
      
      // 调用后端接口获取已审核通过的期望排班
      const res = await api.getApprovedExpectByUsers(selectedUserIds);
      const expectList = res.data || [];
      
      if (expectList.length === 0) {
        return;
      }
      
      // 获取班种列表，用于查找班种信息
      const shiftMap = {};
      this.data.shiftList.forEach(s => {
        shiftMap[s.id] = s;
        shiftMap[s.id.toString()] = s; // 同时支持字符串和数字类型
      });
      
      // 辅助函数：将日期转换为字符串格式
      const formatDateToString = (date) => {
        if (Array.isArray(date)) {
          // 数组格式 [2026, 4, 22] -> "2026-04-22"
          const [year, month, day] = date;
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } else if (typeof date === 'string') {
          // 已经是字符串格式
          return date;
        }
        return date;
      };
      
      // 将期望排班数据合并到成员的schedules中
      const members = this.data.members.map(m => {
        const schedules = { ...m.schedules };
        
        // 查找该成员的期望排班
        const memberExpects = expectList.filter(expect => {
          const match = expect.userId == m.id || expect.userId === m.id.toString();
          return match;
        });
        
        memberExpects.forEach(expect => {
          
          // 转换日期格式
          const startDate = formatDateToString(expect.startDate);
          const endDate = formatDateToString(expect.endDate);
          
          // 遍历当前周的所有日期
          this.data.weekDates.forEach(d => {
            const date = d.fullDate;
            // 如果日期在期望排班的日期范围内
            if (date >= startDate && date <= endDate) {
              // 只有当该日期还没有排班数据时，才用期望排班填充
              if (!schedules[date]) {
                // 尝试多种方式查找班种
                let shift = shiftMap[expect.shiftId] || shiftMap[expect.shiftId.toString()];
                
                if (shift) {
                  schedules[date] = {
                    id: null, // 期望排班没有实际排班ID
                    code: shift.code,
                    name: shift.name,
                    color: shift.color,
                    isExpect: true // 标记为期望排班
                  };
                }
              }
            }
          });
        });
        
        return { ...m, schedules };
      });
      
      this.setData({ members });
    } catch (error) {
      // 加载期望排班失败
    }
  },

  // 上一周
  prevWeek() {
    const date = new Date(this.data.weekStart);
    date.setDate(date.getDate() - 7);
    const weekRange = util.getWeekRange(date);
    
    const weekDates = weekRange.dates.map((d, i) => ({
      date: new Date(d).getDate(),
      fullDate: d,
      day: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i]
    }));
    
    const startParts = weekDates[0].fullDate.split('-');
    const endParts = weekDates[6].fullDate.split('-');
    const weekRangeText = `${startParts[1]}-${startParts[2]} 至 ${endParts[1]}-${endParts[2]}`;
    
    this.setData({
      weekStart: weekRange.start,
      weekEnd: weekRange.end,
      weekDates,
      weekRangeText,
      currentYear: parseInt(startParts[0]),
      focusCell: null,
      localChanges: { adds: [], deletes: [] }
    });
    this.loadWeeklySchedule();
  },

  // 下一周
  nextWeek() {
    const date = new Date(this.data.weekStart);
    date.setDate(date.getDate() + 7);
    const weekRange = util.getWeekRange(date);
    
    const weekDates = weekRange.dates.map((d, i) => ({
      date: new Date(d).getDate(),
      fullDate: d,
      day: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i]
    }));
    
    const startParts = weekDates[0].fullDate.split('-');
    const endParts = weekDates[6].fullDate.split('-');
    const weekRangeText = `${startParts[1]}-${startParts[2]} 至 ${endParts[1]}-${endParts[2]}`;
    
    this.setData({
      weekStart: weekRange.start,
      weekEnd: weekRange.end,
      weekDates,
      weekRangeText,
      currentYear: parseInt(startParts[0]),
      focusCell: null,
      localChanges: { adds: [], deletes: [] }
    });
    this.loadWeeklySchedule();
  },

  // 显示日历弹窗
  showCalendarModal() {
    const today = new Date();
    this.setData({
      showCalendarModal: true,
      calYear: this.data.currentYear,
      calMonth: today.getMonth() + 1
    });
    this.generateCalDays();
  },

  // 隐藏日历弹窗
  hideCalendarModal() {
    this.setData({ showCalendarModal: false });
  },

  // 生成日历天数
  generateCalDays() {
    const { calYear, calMonth } = this.data;
    const daysInMonth = util.getDaysInMonth(calYear, calMonth);
    const firstDay = util.getFirstDayOfMonth(calYear, calMonth);
    const today = new Date();
    
    const calDays = [];
    
    // 上月天数填充
    const prevMonth = calMonth === 1 ? 12 : calMonth - 1;
    const prevYear = calMonth === 1 ? calYear - 1 : calYear;
    const prevMonthDays = util.getDaysInMonth(prevYear, prevMonth);
    
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      calDays.push({ day, date, isCurrentMonth: false, isToday: false });
    }
    
    // 当月天数
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = today.getFullYear() === calYear && 
                      today.getMonth() + 1 === calMonth && 
                      today.getDate() === day;
      calDays.push({ day, date, isCurrentMonth: true, isToday });
    }
    
    // 下月天数填充
    const nextMonth = calMonth === 12 ? 1 : calMonth + 1;
    const nextYear = calMonth === 12 ? calYear + 1 : calYear;
    const remaining = 42 - calDays.length; // 6行7列
    
    for (let day = 1; day <= remaining; day++) {
      const date = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      calDays.push({ day, date, isCurrentMonth: false, isToday: false });
    }
    
    this.setData({ calDays });
  },

  // 上一年
  calPrevYear() {
    this.setData({ calYear: this.data.calYear - 1 });
    this.generateCalDays();
  },

  // 下一年
  calNextYear() {
    this.setData({ calYear: this.data.calYear + 1 });
    this.generateCalDays();
  },

  // 上个月
  calPrevMonth() {
    let { calYear, calMonth } = this.data;
    calMonth -= 1;
    if (calMonth < 1) {
      calMonth = 12;
      calYear -= 1;
    }
    this.setData({ calYear, calMonth });
    this.generateCalDays();
  },

  // 下个月
  calNextMonth() {
    let { calYear, calMonth } = this.data;
    calMonth += 1;
    if (calMonth > 12) {
      calMonth = 1;
      calYear += 1;
    }
    this.setData({ calYear, calMonth });
    this.generateCalDays();
  },

  // 选择日期
  selectCalDay(e) {
    const { date } = e.currentTarget.dataset;
    
    // 跳转到选中日期所在周
    const weekRange = util.getWeekRange(new Date(date));
    const weekDates = weekRange.dates.map((d, i) => ({
      date: new Date(d).getDate(),
      fullDate: d,
      day: ['一', '二', '三', '四', '五', '六', '日'][i]
    }));
    
    const startParts = weekDates[0].fullDate.split('-');
    const endParts = weekDates[6].fullDate.split('-');
    const weekRangeText = `${startParts[1]}-${startParts[2]} 至 ${endParts[1]}-${endParts[2]}`;
    
    this.setData({
      weekStart: weekRange.start,
      weekEnd: weekRange.end,
      weekDates,
      weekRangeText,
      currentYear: parseInt(startParts[0]),
      showCalendarModal: false,
      focusCell: null,
      localChanges: { adds: [], deletes: [] }
    });
    this.loadWeeklySchedule();
  },

  // 选择班种
  selectShift(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({ currentShift: id });
    
    // 如果有焦点位置，本地填充
    const { focusCell, shiftList, weekDates, members, localChanges } = this.data;
    if (focusCell) {
      const shift = shiftList.find(s => s.id === id);
      const date = weekDates[focusCell.dateIndex].fullDate;
      const member = members.find(m => m.id === focusCell.memberId);
      
      // 检查是否已有排班（排除本地新增的和期望排班）
      const existingSchedule = member?.schedules[date];
      if (existingSchedule && !existingSchedule.id?.startsWith('local_') && !existingSchedule.isExpect) {
        wx.showModal({
          title: '排班冲突',
          content: `${member.nickName} ${date} 已排班 ${existingSchedule.name}，不能重复排班`,
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      
      // 更新本地数据
      const updatedMembers = members.map(m => {
        if (m.id === focusCell.memberId) {
          return {
            ...m,
            schedules: {
              ...m.schedules,
              [date]: {
                id: 'local_' + Date.now(),
                code: shift.code,
                name: shift.name,
                color: shift.color
              }
            }
          };
        }
        return m;
      });
      
      // 记录变更（先移除同一成员同一日期的旧本地新增记录，避免重复）
      const newAdd = {
        memberId: focusCell.memberId,
        memberName: member?.nickName || '',
        date: date,
        shiftId: id,
        shiftCode: shift.code,
        shiftName: shift.name,
        shiftColor: shift.color
      };
      
      const filteredAdds = localChanges.adds.filter(a => !(a.memberId === focusCell.memberId && a.date === date));
      
      // 移动到下一个日期
      const nextDateIndex = focusCell.dateIndex < 6 ? focusCell.dateIndex + 1 : null;
      
      this.setData({
        members: updatedMembers,
        localChanges: {
          ...localChanges,
          adds: [...filteredAdds, newAdd]
        },
        focusCell: nextDateIndex !== null ? {
          memberId: focusCell.memberId,
          dateIndex: nextDateIndex
        } : null
      });
    }
  },

  // 点击日期格子
  onCellTap(e) {
    const { memberId, date, dateIndex } = e.currentTarget.dataset;
    const { members, localChanges } = this.data;
    
    const member = members.find(m => m.id === memberId);
    const existingSchedule = member?.schedules[date];
    
    // 如果已有排班，本地删除
    if (existingSchedule) {
      // 如果是期望排班，直接清除并允许选择新的班种
      if (existingSchedule.isExpect) {
        const updatedMembers = members.map(m => {
          if (m.id === memberId) {
            const newSchedules = { ...m.schedules };
            delete newSchedules[date];
            return { ...m, schedules: newSchedules };
          }
          return m;
        });
        
        this.setData({
          members: updatedMembers,
          focusCell: { memberId, dateIndex: parseInt(dateIndex) }
        });
        return;
      }
      
      // 更新本地数据
      const updatedMembers = members.map(m => {
        if (m.id === memberId) {
          const newSchedules = { ...m.schedules };
          delete newSchedules[date];
          return { ...m, schedules: newSchedules };
        }
        return m;
      });
      
      // 记录删除（如果id以local_开头，说明是本地新增的，从adds中移除）
      let newDeletes = [...localChanges.deletes];
      let newAdds = [...localChanges.adds];
      
      if (existingSchedule.id && existingSchedule.id.startsWith('local_')) {
        // 本地新增的，从adds中移除
        newAdds = newAdds.filter(a => !(a.memberId === memberId && a.date === date));
      } else if (existingSchedule.id) {
        // 已存在的真实排班，记录删除
        newDeletes.push({
          scheduleId: existingSchedule.id,
          memberId: memberId,
          date: date
        });
      }
      
      this.setData({
        members: updatedMembers,
        localChanges: {
          adds: newAdds,
          deletes: newDeletes
        },
        focusCell: { memberId, dateIndex: parseInt(dateIndex) }
      });
      return;
    }
    
    // 设置焦点到当前格子
    this.setData({
      focusCell: { memberId, dateIndex: parseInt(dateIndex) }
    });
  },

  // 应用班种套餐（只填充当前光标选中的成员）
  applyPackage(e) {
    const { id } = e.currentTarget.dataset;
    const pkg = this.data.packageList.find(p => p.id === id);
    
    if (!pkg) return;
    
    // 获取当前光标选中的成员
    const { focusCell, members } = this.data;
    if (!focusCell || !focusCell.memberId) {
      util.showError('请先点击选择一个成员');
      return;
    }
    
    // 找到选中的成员
    const member = members.find(m => m.id === focusCell.memberId);
    if (!member) {
      util.showError('成员不存在');
      return;
    }
    
    // 直接应用套餐，不需要确认提示
    this.doApplyPackage(pkg, member);
  },

  // 执行应用套餐（只应用到一个成员）
  doApplyPackage(pkg, member) {
    const { members, weekDates, localChanges } = this.data;
    const newAdds = [...localChanges.adds];
    
    // 只更新选中的成员
    const updatedMembers = members.map(m => {
      if (m.id !== member.id) return m;
      
      const newSchedules = { ...m.schedules };
      
      // 遍历一周七天
      pkg.shifts.forEach((shift, dayIndex) => {
        if (shift.shiftId && weekDates[dayIndex]) {
          const date = weekDates[dayIndex].fullDate;
          
          // 如果该日期已有排班，先记录删除
          if (newSchedules[date]) {
            if (!newSchedules[date].id?.startsWith('local_') && !newSchedules[date].isExpect) {
              // 已存在的真实排班，记录删除
              if (!newAdds.some(a => a.memberId === member.id && a.date === date)) {
                localChanges.deletes.push({
                  scheduleId: newSchedules[date].id,
                  memberId: member.id,
                  date: date
                });
              }
            }
          }
          
          // 设置新排班
          newSchedules[date] = {
            id: 'local_' + Date.now() + '_' + Math.random(),
            code: shift.code,
            name: shift.name,
            color: shift.color
          };
          
          // 记录新增（先移除同一成员同一日期的旧本地新增记录，避免重复）
          const existIdx = newAdds.findIndex(a => a.memberId === m.id && a.date === date);
          if (existIdx !== -1) {
            newAdds.splice(existIdx, 1);
          }
          newAdds.push({
            memberId: m.id,
            memberName: m.nickName,
            date: date,
            shiftId: shift.shiftId,
            shiftCode: shift.code,
            shiftName: shift.name,
            shiftColor: shift.color
          });
        }
      });
      
      return { ...m, schedules: newSchedules };
    });
    
    this.setData({
      members: updatedMembers,
      localChanges: {
        ...localChanges,
        adds: newAdds
      }
    });
  },

  // 发布排班 - 显示确认弹窗
  async publishSchedule() {
    const { localChanges, members, weekDates, shiftList } = this.data;
    
    // 如果没有变更，提示
    if (localChanges.adds.length === 0 && localChanges.deletes.length === 0) {
      util.showError('没有需要发布的排班变更');
      return;
    }
    
    // 计算统计信息
    const stats = this.calculateStats(members, weekDates, shiftList);
    
    this.setData({
      showPublishModal: true,
      publishStats: stats
    });
  },
  
  // 计算排班统计
  calculateStats(members, weekDates, shiftList) {
    // 统计结果：{ shifts: [{code, name, color, counts: [1,2,3...]}], dates: [...] }
    const stats = {
      dates: weekDates.map(d => ({
        day: d.day,
        date: d.date
      })),
      shifts: []
    };
    
    // 收集所有班种的统计数据
    shiftList.forEach(shift => {
      const counts = weekDates.map(wd => {
        let count = 0;
        members.forEach(member => {
          const schedule = member.schedules[wd.fullDate];
          if (schedule && schedule.code === shift.code) {
            count++;
          }
        });
        return count;
      });
      
      // 只有有排班的班种才显示
      const totalCount = counts.reduce((sum, c) => sum + c, 0);
      if (totalCount > 0) {
        stats.shifts.push({
          code: shift.code,
          name: shift.name,
          color: shift.color,
          counts: counts,
          total: totalCount
        });
      }
    });
    
    return stats;
  },
  
  // 确认发布
  async confirmPublish() {
    const { localChanges } = this.data;
    const app = getApp();
    const departmentId = app.globalData.currentTeamId || app.globalData.department?.id;
    
    // 构建批量请求数据
    const batchData = {
      adds: localChanges.adds,
      deletes: localChanges.deletes.map(d => d.scheduleId)
    };
    
    this.setData({ showPublishModal: false });
    
    try {
      util.showLoading('发布中...');
      
      // 批量操作（一次请求完成添加和删除）
      await api.batchSchedule(departmentId, batchData);
      
      // 清空变更记录
      this.setData({
        localChanges: { adds: [], deletes: [] },
        publishStats: null
      });
      
      util.hideLoading();
      util.showSuccess('发布成功');
      this.loadWeeklySchedule();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '发布失败');
    }
  },
  
  // 取消发布
  cancelPublish() {
    this.setData({ 
      showPublishModal: false,
      publishStats: null
    });
  },

  // 添加成员
  addMember() {
    this.setData({ showMemberModal: true });
  },

  // 切换成员选择
  toggleMember(e) {
    const memberId = String(e.currentTarget.dataset.id);
    const allMembers = this.data.allMembers.map(m => {
      if (m.id === memberId) {
        return { ...m, selected: !m.selected };
      }
      return m;
    });
    const selectedCount = allMembers.filter(m => m.selected).length;
    const map = {};
    allMembers.forEach(m => { if (m.selected) map[m.id] = true; });
    this.setData({
      allMembers,
      selectedMemberMap: map,
      allSelected: allMembers.length > 0 && selectedCount === allMembers.length,
      selectedMemberCount: selectedCount
    });
  },

  // 全选/取消全选
  toggleSelectAll() {
    const allMembers = this.data.allMembers;
    const allSelected = allMembers.length > 0 && allMembers.every(m => m.selected);
    if (allSelected) {
      const updated = allMembers.map(m => ({ ...m, selected: false }));
      this.setData({ allMembers: updated, selectedMemberMap: {}, allSelected: false, selectedMemberCount: 0 });
    } else {
      const updated = allMembers.map(m => ({ ...m, selected: true }));
      const map = {};
      updated.forEach(m => { map[m.id] = true; });
      this.setData({ allMembers: updated, selectedMemberMap: map, allSelected: true, selectedMemberCount: updated.length });
    }
  },

  // 确认成员选择
  async confirmMembers() {
    this.setData({ showMemberModal: false });
    
    // 先加载成员列表
    await this.loadMembers();
    
    // 然后加载排班数据并等待完成
    await this.loadWeeklySchedule();
    
    // 设置初始焦点为新添加的第一个成员的周一
    const selectedMembers = this.data.allMembers.filter(m => m.selected);
    if (selectedMembers.length > 0) {
      const newMemberId = selectedMembers[selectedMembers.length - 1].id;
      this.setData({
        focusCell: {
          memberId: newMemberId,
          dateIndex: 0 // 周一
        }
      });
    }
  },

  // 关闭弹窗
  closeMemberModal() {
    this.setData({ showMemberModal: false });
  },

  // 切换工具栏标签
  switchToolbarTab(e) {
    const { tab } = e.currentTarget.dataset;
    this.setData({ toolbarTab: tab });
  },

  // 跳转创建套餐
  goCreatePackage() {
    wx.navigateTo({ url: '/pages/shift-package/shift-package' });
  },

  // ========== 拖拽排序 ==========
  
  // 拖拽开始
  onDragStart(e) {
    const { index } = e.currentTarget.dataset;
    const touch = e.touches[0];
    
    this.dragStartData = {
      index: index,
      startY: touch.clientY,
      timestamp: Date.now(),
      moved: false,
      activated: false
    };
    
    // 长按定时器
    this.longPressTimer = setTimeout(() => {
      if (this.dragStartData && !this.dragStartData.moved) {
        this.setData({
          isDragging: true,
          dragIndex: index,
          insertBeforeIndex: index,
          dragOffsetY: 0
        });
        
        this.dragStartData.activated = true;
      }
    }, this.data.dragThreshold);
  },
  
  // 拖拽移动
  onDragMove(e) {
    if (!this.dragStartData) return;
    
    const touch = e.touches[0];
    const moveY = touch.clientY - this.dragStartData.startY;
    
    // 如果还没激活拖拽，检查是否移动太多（取消长按）
    if (!this.dragStartData.activated) {
      if (Math.abs(moveY) > 10) {
        this.dragStartData.moved = true;
        clearTimeout(this.longPressTimer);
      }
      return;
    }
    
    // 正在拖拽中 - 计算偏移
    const rpxRatio = 750 / wx.getSystemInfoSync().windowWidth;
    const offsetY = moveY * rpxRatio;
    
    const { dragIndex, members, rowHeight } = this.data;
    
    // 计算插入位置：基于拖拽偏移量，判断在哪一行之前插入
    // insertBeforeIndex 的含义：插入到第 insertBeforeIndex 行之前
    // 如果 insertBeforeIndex = 0，插入到最前面
    // 如果 insertBeforeIndex = members.length，插入到最后面
    let insertBeforeIndex;
    
    if (offsetY >= 0) {
      // 向下拖动
      const moveRows = Math.floor(offsetY / rowHeight + 0.3);
      insertBeforeIndex = Math.min(dragIndex + moveRows + 1, members.length);
    } else {
      // 向上拖动
      const moveRows = Math.floor(-offsetY / rowHeight + 0.7);
      insertBeforeIndex = Math.max(dragIndex - moveRows, 0);
    }
    
    this.setData({
      dragOffsetY: offsetY,
      insertBeforeIndex: insertBeforeIndex
    });
  },
  
  // 拖拽结束
  onDragEnd(e) {
    clearTimeout(this.longPressTimer);
    
    if (!this.dragStartData || !this.dragStartData.activated) {
      this.dragStartData = null;
      return;
    }
    
    const { dragIndex, insertBeforeIndex, members } = this.data;
    
    // 计算实际要插入的目标位置
    // insertBeforeIndex 表示"在第N行之前插入"
    // 如果拖拽行在插入位置之前，splice目标要减1
    if (dragIndex >= 0 && insertBeforeIndex >= 0 && insertBeforeIndex !== dragIndex) {
      const newMembers = [...members];
      const [movedItem] = newMembers.splice(dragIndex, 1);
      
      // splice 的插入位置：如果原位置在插入位置之前，需要减1
      const targetIndex = dragIndex < insertBeforeIndex ? insertBeforeIndex - 1 : insertBeforeIndex;
      newMembers.splice(targetIndex, 0, movedItem);
      
      this.setData({ members: newMembers });
    }
    
    // 重置拖拽状态
    this.setData({
      isDragging: false,
      dragIndex: -1,
      insertBeforeIndex: -1,
      dragOffsetY: 0
    });
    
    this.dragStartData = null;
  },

  // 阻止冒泡
  stopPropagation() {}
});
