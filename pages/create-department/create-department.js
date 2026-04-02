// pages/create-department/create-department.js
const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    name: '',
    creatorName: '',
    shiftList: [],
    selectedShifts: [],
    canSubmit: false
  },

  onLoad() {
    // 检查用户是否已有科室，一个用户只能创建/加入一个科室
    if (app.hasDepartment()) {
      wx.showModal({
        title: '提示',
        content: '您已创建或加入了科室，一个用户只能创建或加入一个科室',
        showCancel: false,
        success: () => {
          wx.reLaunch({ url: '/pages/index/index' });
        }
      });
      return;
    }
    this.loadDefaultShifts();
  },

  onLoad() {
    // 检查用户是否已有科室，一个用户只能创建/加入一个科室
    if (app.hasDepartment()) {
      wx.showModal({
        title: '提示',
        content: '您已创建或加入了科室，一个用户只能创建或加入一个科室',
        showCancel: false,
        success: () => {
          wx.reLaunch({ url: '/pages/index/index' });
        }
      });
      return;
    }
    this.loadDefaultShifts();
  },

  onShow() {
    // 检查是否有新添加的班种
    const newShift = app.globalData.tempNewShift;
    if (newShift) {
      this.addNewShift(newShift);
      // 清除临时数据
      app.globalData.tempNewShift = null;
    }
  },

  // 加载默认班种列表
  loadDefaultShifts() {
    // 不预设班种，用户需要自行添加
    this.setData({ shiftList: [] });
  },

  // 添加新班种
  addNewShift(newShift) {
    const shift = {
      id: 'shift_' + Date.now(),
      name: newShift.name,
      code: newShift.code || newShift.name.substring(0, 2),
      color: newShift.color || '#4A90D9',
      timeSlots: newShift.timeSlots || [], // 添加时间段数据
      duration: newShift.duration || '', // 添加时长数据
      selected: true
    };
    
    const shiftList = [...this.data.shiftList, shift];
    const selectedShifts = shiftList.filter(item => item.selected);
    
    this.setData({ 
      shiftList: shiftList,
      selectedShifts: selectedShifts
    }, () => {
      this.checkCanSubmit();
    });
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
    this.checkCanSubmit();
  },

  onCreatorNameInput(e) {
    this.setData({ creatorName: e.detail.value });
    this.checkCanSubmit();
  },

  // 切换班种选择
  toggleShift(e) {
    const index = e.currentTarget.dataset.index;
    const shiftList = this.data.shiftList;
    
    if (!shiftList[index]) {
      return;
    }
    
    shiftList[index].selected = !shiftList[index].selected;
    
    const selectedShifts = shiftList.filter(item => item.selected);
    this.setData({ 
      shiftList: shiftList,
      selectedShifts: selectedShifts
    });
    this.checkCanSubmit();
  },

  // 检查是否可以提交
  checkCanSubmit() {
    const canSubmit = this.data.name.trim() && 
                      this.data.creatorName.trim() && 
                      this.data.selectedShifts.length > 0;
    
    this.setData({ canSubmit });
  },

  // 跳转到新增班种页面
  addShift() {
    wx.navigateTo({ 
      url: '/pages/create-shift/create-shift?mode=select'
    });
  },

  // 提交创建
  async handleSubmit() {
    if (!this.data.name.trim()) {
      util.showError('请输入科室名称');
      return;
    }

    if (!this.data.creatorName.trim()) {
      util.showError('请输入您的姓名');
      return;
    }

    if (this.data.selectedShifts.length === 0) {
      util.showError('请选择至少一个班种');
      return;
    }

    try {
      util.showLoading('创建中...');
      
      // 准备班种数据
      const shifts = this.data.selectedShifts.map(item => ({
        name: item.name,
        code: item.code,
        color: item.color,
        timeSlots: item.timeSlots || [],
        duration: item.duration || 0
      }));

      const res = await api.createDepartment({ 
        name: this.data.name.trim(),
        creatorName: this.data.creatorName.trim(),
        shifts: shifts
      });
      
      util.hideLoading();

      // 保存科室信息到全局数据和缓存
      app.setDepartment(res.data);

      util.showSuccess('创建成功');

      setTimeout(() => {
        // 使用 reLaunch 强制重新加载首页
        wx.reLaunch({ url: '/pages/index/index' });
      }, 1000);
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || error.msg || '创建失败');
    }
  }
});
