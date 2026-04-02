// pages/expect-schedule/expect-schedule.js
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    myExpects: [],
    shiftList: [],
    shiftOptions: [],
    todayDate: '',
    showEditModal: false,
    initialized: false,  // 是否已初始化
    editingExpect: {
      date: '',
      shiftId: '',
      shiftCode: '',
      shiftName: '',
      color: '',
      remark: ''
    },
    
    // 换班相关
    showTypeModal: false,  // 显示申请类型选择弹窗
    showSwapModal: false,   // 显示换班弹窗
    swapUsers: [],          // 目标日期排班的用户列表
    mySwapInfo: null,       // 当前用户在我方日期的班次信息
    targetSwapInfo: null,   // 目标用户在目标日期的班次信息
    swapRequest: {
      myDate: '',           // 我方日期
      targetDate: '',       // 目标日期
      targetUserId: '',
      selectedUserIndex: -1,
      remark: ''
    }
  },

  onLoad() {
    const today = new Date();
    const todayDate = this.formatDate(today);
    this.setData({ todayDate });
    
    this.loadData();
  },

  onShow() {
    // 如果已初始化，刷新数据
    if (this.data.initialized) {
      this.loadMyExpects();
    }
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加载数据
  async loadData() {
    await this.loadShiftList();
    await this.loadMyExpects();
    this.setData({ initialized: true });
  },

  // 加载班种列表
  async loadShiftList() {
    try {
      const res = await api.getShiftList();
      const shiftList = res.data || [];
      
      // 处理时间段数据
      const processedList = shiftList.map(item => {
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
      
      // 构建选择器选项
      const shiftOptions = processedList.map(item => ({
        id: item.id,
        name: item.name,
        code: item.code,
        color: item.color,
        timeSlots: item.timeSlots,
        duration: item.duration
      }));
      
      this.setData({ shiftList: processedList, shiftOptions });
    } catch (error) {
      // 加载班种失败
    }
  },

  // 加载我的期望排班
  async loadMyExpects() {
    try {
      const res = await api.getMyExpectSchedule();
      const { shiftList } = this.data;
      console.log('期望排班列表数据:', res.data);
      console.log('班次列表:', shiftList);
      
      const list = (res.data || []).map(item => {
        // 统一转为字符串比较
        const shift = shiftList.find(s => String(s.id) === String(item.shiftId));
        const myShift = shiftList.find(s => String(s.id) === String(item.myShiftId));
        const targetShift = shiftList.find(s => String(s.id) === String(item.targetShiftId));
        
        console.log('item.shiftId:', item.shiftId, '找到的班次:', shift);
        
        // 根据类型处理不同的显示
        let displayInfo = {};
        if (item.type === 'swap') {
          displayInfo = {
            type: 'swap',
            typeName: '换班',
            myDate: item.startDate,
            targetDate: item.targetDate,
            myShiftCode: myShift ? myShift.code : '',
            myShiftName: myShift ? myShift.name : '',
            myShiftColor: myShift ? myShift.color : '#999',
            targetShiftCode: targetShift ? targetShift.code : '',
            targetShiftName: targetShift ? targetShift.name : '',
            targetShiftColor: targetShift ? targetShift.color : '#999',
            targetUserName: item.targetUserName || ''
          };
        } else {
          displayInfo = {
            type: 'schedule',
            typeName: '期望排班',
            shiftCode: shift ? shift.code : '',
            shiftName: shift ? shift.name : '',
            shiftColor: shift ? shift.color : '#4A90D9'
          };
        }
        
        return {
          ...item,
          ...displayInfo,
          statusName: item.status === 'pending' ? '待审批' :
                      item.status === 'approved' ? '已通过' : '已拒绝'
        };
      });
      this.setData({ myExpects: list });
    } catch (error) {
      // 加载期望排班失败
    }
  },

  // 新增申请
  addExpect() {
    this.setData({ showTypeModal: true });
  },
  
  // 关闭申请类型选择弹窗
  closeTypeModal() {
    this.setData({ showTypeModal: false });
  },
  
  // 选择排班类型
  selectScheduleType() {
    this.setData({ 
      showTypeModal: false,
      showEditModal: true,
      editingExpect: {
        date: '',
        shiftId: '',
        shiftCode: '',
        shiftName: '',
        color: '',
        remark: ''
      }
    });
  },
  
  // 选择换班类型
  selectSwapType() {
    this.setData({
      showTypeModal: false,
      showSwapModal: true,
      swapUsers: [],
      mySwapInfo: null,
      targetSwapInfo: null,
      swapRequest: {
        myDate: '',
        targetDate: '',
        targetUserId: '',
        selectedUserIndex: -1,
        remark: ''
      }
    });
  },

  // 关闭弹窗
  closeEditModal() {
    this.setData({ showEditModal: false });
  },

  // 阻止冒泡
  stopPropagation() {},

  // 选择日期
  onDateChange(e) {
    this.setData({
      'editingExpect.date': e.detail.value
    });
  },

  // 选择班种
  selectShift(e) {
    const { shift } = e.currentTarget.dataset;
    this.setData({
      'editingExpect.shiftId': shift.id,
      'editingExpect.shiftCode': shift.code,
      'editingExpect.shiftName': shift.name,
      'editingExpect.color': shift.color
    });
  },

  // 输入备注
  onRemarkInput(e) {
    this.setData({
      'editingExpect.remark': e.detail.value
    });
  },

  // 提交期望排班
  async submitExpect() {
    const { editingExpect } = this.data;
    
    if (!editingExpect.date) {
      util.showError('请选择日期');
      return;
    }

    if (!editingExpect.shiftId) {
      util.showError('请选择班种');
      return;
    }

    try {
      util.showLoading('提交中...');
      
      await api.submitExpectSchedule({
        shiftId: editingExpect.shiftId,
        startDate: editingExpect.date,
        endDate: editingExpect.date,
        remark: editingExpect.remark
      });
      
      util.hideLoading();
      util.showSuccess('提交成功');
      
      this.closeEditModal();
      this.loadMyExpects();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '提交失败');
    }
  },
  
  // 关闭换班弹窗
  closeSwapModal() {
    this.setData({ showSwapModal: false });
  },
  
  // 选择我方日期
  async onMyDateChange(e) {
    const date = e.detail.value;
    this.setData({
      'swapRequest.myDate': date
    });

    // 获取我方日期的班次
    try {
      const res = await api.getUsersByDate(date);
      const userInfo = wx.getStorageSync('userInfo');
      console.log('我方日期用户列表:', res.data);
      console.log('当前用户ID:', userInfo?.id);
      // 统一转为字符串比较
      const myInfo = (res.data || []).find(u => String(u.id) === String(userInfo?.id));
      console.log('我的班次信息:', myInfo);

      this.setData({
        mySwapInfo: myInfo || null
      });
    } catch (error) {
      console.error('获取班次信息失败:', error);
      util.showError('获取班次信息失败');
      this.setData({ mySwapInfo: null });
    }
  },

  // 选择目标日期
  onTargetDateChange(e) {
    const date = e.detail.value;
    this.setData({
      'swapRequest.targetDate': date,
      'swapRequest.targetUserId': '',
      'swapRequest.selectedUserIndex': -1,
      targetSwapInfo: null,
      swapUsers: []
    });

    // 加载目标日期排班的用户
    this.loadSwapUsers(date);
  },

  // 加载目标日期排班的用户
  async loadSwapUsers(date) {
    try {
      const res = await api.getUsersByDate(date);
      const userInfo = wx.getStorageSync('userInfo');
      console.log('目标日期用户列表:', res.data);

      // 过滤掉自己，统一转为字符串比较
      const users = (res.data || []).filter(u => String(u.id) !== String(userInfo?.id));
      console.log('过滤后的用户列表:', users);

      this.setData({
        swapUsers: users
      });
    } catch (error) {
      console.error('获取换班对象失败:', error);
      util.showError('获取换班对象失败');
      this.setData({ swapUsers: [] });
    }
  },

  // 选择换班对象
  onSwapUserChange(e) {
    const index = e.detail.value;
    const user = this.data.swapUsers[index];
    console.log('选择的用户:', user);

    this.setData({
      'swapRequest.targetUserId': String(user?.id || ''),
      'swapRequest.selectedUserIndex': index,
      targetSwapInfo: user || null
    });
  },
  
  // 输入换班备注
  onSwapRemarkInput(e) {
    this.setData({
      'swapRequest.remark': e.detail.value
    });
  },
  
  // 提交换班申请
  async submitSwap() {
    const { swapRequest, mySwapInfo, targetSwapInfo } = this.data;

    if (!swapRequest.myDate) {
      util.showError('请选择我方日期');
      return;
    }

    if (!mySwapInfo) {
      util.showError('您在该日期没有排班，无法换班');
      return;
    }

    if (!swapRequest.targetDate) {
      util.showError('请选择目标日期');
      return;
    }

    if (!swapRequest.targetUserId) {
      util.showError('请选择换班对象');
      return;
    }

    try {
      util.showLoading('提交中...');

      await api.submitSwapRequest({
        myDate: swapRequest.myDate,
        targetDate: swapRequest.targetDate,
        targetUserId: swapRequest.targetUserId,
        myShiftId: mySwapInfo.shiftId,      // 我方班次ID
        targetShiftId: targetSwapInfo?.shiftId,  // 目标班次ID
        remark: swapRequest.remark
      });

      util.hideLoading();
      util.showSuccess('提交成功');

      this.closeSwapModal();
      this.loadMyExpects();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '提交失败');
    }
  }
});
