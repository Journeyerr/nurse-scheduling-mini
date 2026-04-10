// pages/shift-manage/shift-manage.js
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    shiftList: [],
    initialized: false,  // 是否已初始化
    
    // 模态框相关
    showEditModal: false,
    isEdit: false,
    editingShiftId: '',
    editingShift: {
      code: '',
      name: '',
      timeSlots: [
        { startTime: '', endTime: '', startIsNextDay: false, endIsNextDay: false }
      ],
      duration: '',
      coefficient: '1.0',
      isRest: false,
      color: '#7BA3C8'
    },
    colorList: [
      '#7BA3C8', '#9B8AA8', '#A8B5BD',
      '#E89B7C', '#B8A07E', '#8A9EB5',
      '#C49BA8', '#C4B89A'
    ],
    canSubmit: false,

    // 时间选择器
    showTimePickerModal: false,
    pickingTime: 'start',
    editingIndex: 0,
    hours: [],
    minutes: [],
    pickerValue: [0, 0],
    tempIsNextDay: false
  },

  onLoad() {
    // 初始化小时和分钟列表
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(i.toString().padStart(2, '0'));
    }
    const minutes = [];
    for (let i = 0; i < 60; i += 5) {
      minutes.push(i.toString().padStart(2, '0'));
    }

    this.setData({ hours, minutes });
    this.loadShiftList();
  },

  onShow() {
    // 如果已初始化，刷新数据
    if (this.data.initialized) {
      this.loadShiftList();
    }
  },

  // 加载班种列表
  async loadShiftList() {
    try {
      const res = await api.getShiftList();
      let list = (res.data || []).map(item => {
        // 处理时间段数据
        let timeSlots = item.timeSlots || [];
        
        // 如果是旧格式（startTime/endTime），转换为 timeSlots
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
          
          // 处理开始时间的次日标记
          if (startTime.includes('+1')) {
            startTime = startTime.replace('+1', '');
            startIsNextDay = true;
          }
          
          // 处理结束时间的次日标记
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
          coefficient: item.coefficient != null ? parseFloat(item.coefficient).toFixed(1) : '1.0',
          timeSlots
        };
      });
      
      // 按名称排序：白班、晚班、夜班、休息
      const orderMap = { '白班': 1, '晚班': 2, '夜班': 3, '休息': 4 };
      list.sort((a, b) => {
        const orderA = orderMap[a.name] || 999;
        const orderB = orderMap[b.name] || 999;
        return orderA - orderB;
      });
      
      this.setData({ shiftList: list, initialized: true });
    } catch (error) {
      // 加载班种失败
    }
  },

  // 添加班种
  addShift() {
    this.setData({
      showEditModal: true,
      isEdit: false,
      editingShiftId: '',
      editingShift: {
        code: '',
        name: '',
        timeSlots: [
          { startTime: '', endTime: '', startIsNextDay: false, endIsNextDay: false }
        ],
        duration: '',
        coefficient: '1.0',
        isRest: false,
        color: '#7BA3C8'
      },
      canSubmit: false
    });
  },

  // 编辑班种
  editShift(e) {
    const { id } = e.currentTarget.dataset;
    const shift = this.data.shiftList.find(s => s.id === id);
    
    if (shift) {
      this.setData({
        showEditModal: true,
        isEdit: true,
        editingShiftId: id,
        editingShift: {
          code: shift.code,
          name: shift.name,
          timeSlots: shift.timeSlots.length > 0 ? shift.timeSlots : [{ startTime: '', startIsNextDay: false, endTime: '', endIsNextDay: false }],
          duration: shift.duration ? String(shift.duration) : '',
          coefficient: shift.coefficient ? String(shift.coefficient) : '1.0',
          isRest: !!shift.isRest,
          color: shift.color
        },
        canSubmit: true
      });
    }
  },

  // 关闭模态框
  closeEditModal() {
    this.setData({ showEditModal: false });
  },

  // 阻止冒泡
  stopPropagation() {},

  // 输入班种编号
  onCodeInput(e) {
    const code = e.detail.value.toUpperCase();
    this.setData({
      'editingShift.code': code
    });
    this.checkCanSubmit();
  },

  // 输入班种名称
  onNameInput(e) {
    this.setData({
      'editingShift.name': e.detail.value
    });
    this.checkCanSubmit();
  },

  // 输入时长
  onDurationInput(e) {
    this.setData({
      'editingShift.duration': e.detail.value
    });
  },

  // 输入班种系数
  onCoefficientInput(e) {
    this.setData({
      'editingShift.coefficient': e.detail.value
    });
  },

  // 切换是否休息
  toggleIsRest(e) {
    this.setData({
      'editingShift.isRest': e.detail.value
    });
  },

  // 选择颜色
  selectColor(e) {
    const { color } = e.currentTarget.dataset;
    this.setData({
      'editingShift.color': color
    });
  },

  // 显示开始时间选择器
  showStartTimePicker(e) {
    const { index } = e.currentTarget.dataset;
    const { editingShift, hours, minutes } = this.data;
    const slot = editingShift.timeSlots[index];
    let pickerValue = [0, 0];

    if (slot && slot.startTime) {
      const [h, m] = slot.startTime.split(':');
      const hIndex = hours.indexOf(h);
      const mIndex = minutes.indexOf(m);
      pickerValue = [hIndex >= 0 ? hIndex : 0, mIndex >= 0 ? mIndex : 0];
    }

    this.setData({
      showTimePickerModal: true,
      pickingTime: 'start',
      editingIndex: index,
      pickerValue,
      tempIsNextDay: slot ? slot.startIsNextDay : false
    });
  },

  // 显示结束时间选择器
  showEndTimePicker(e) {
    const { index } = e.currentTarget.dataset;
    const { editingShift, hours, minutes } = this.data;
    const slot = editingShift.timeSlots[index];
    let pickerValue = [0, 0];

    if (slot && slot.endTime) {
      const [h, m] = slot.endTime.split(':');
      const hIndex = hours.indexOf(h);
      const mIndex = minutes.indexOf(m);
      pickerValue = [hIndex >= 0 ? hIndex : 0, mIndex >= 0 ? mIndex : 0];
    }

    this.setData({
      showTimePickerModal: true,
      pickingTime: 'end',
      editingIndex: index,
      pickerValue,
      tempIsNextDay: slot ? slot.endIsNextDay : false
    });
  },

  // 隐藏时间选择器
  hideTimePicker() {
    this.setData({ showTimePickerModal: false });
  },

  // 切换今日/次日
  toggleDay(e) {
    const { day } = e.currentTarget.dataset;
    this.setData({
      tempIsNextDay: day === 'next'
    });
  },

  // 时间变化
  onTimeChange(e) {
    this.setData({
      pickerValue: e.detail.value
    });
  },

  // 确认时间选择
  confirmTime() {
    const { pickerValue, hours, minutes, pickingTime, tempIsNextDay, editingIndex, editingShift } = this.data;
    const hour = hours[pickerValue[0]];
    const minute = minutes[pickerValue[1]];
    const time = `${hour}:${minute}`;

    const updatedSlots = [...editingShift.timeSlots];

    if (pickingTime === 'start') {
      updatedSlots[editingIndex] = {
        ...updatedSlots[editingIndex],
        startTime: time,
        startIsNextDay: tempIsNextDay
      };
    } else {
      updatedSlots[editingIndex] = {
        ...updatedSlots[editingIndex],
        endTime: time,
        endIsNextDay: tempIsNextDay
      };
    }

    this.setData({
      'editingShift.timeSlots': updatedSlots
    });
    this.calculateDuration();
    this.checkCanSubmit();
    this.hideTimePicker();
  },

  // 添加时间段
  addTimeSlot() {
    const { editingShift } = this.data;
    if (editingShift.timeSlots.length >= 2) {
      return;
    }

    this.setData({
      'editingShift.timeSlots': [...editingShift.timeSlots, { startTime: '', startIsNextDay: false, endTime: '', endIsNextDay: false }]
    });
  },

  // 删除时间段
  removeTimeSlot(e) {
    const { index } = e.currentTarget.dataset;
    const { editingShift } = this.data;

    if (editingShift.timeSlots.length <= 1) {
      return;
    }

    const updatedSlots = editingShift.timeSlots.filter((_, i) => i !== index);
    this.setData({
      'editingShift.timeSlots': updatedSlots
    });
    this.calculateDuration();
    this.checkCanSubmit();
  },

  // 计算时长
  calculateDuration() {
    const { editingShift } = this.data;
    let totalMinutes = 0;

    editingShift.timeSlots.forEach(slot => {
      if (slot.startTime && slot.endTime) {
        const [startH, startM] = slot.startTime.split(':').map(Number);
        const [endH, endM] = slot.endTime.split(':').map(Number);

        let startMinutes = startH * 60 + startM;
        let endMinutes = endH * 60 + endM;

        // 如果开始时间是次日，加上24小时
        if (slot.startIsNextDay) {
          startMinutes += 24 * 60;
        }

        // 如果结束时间是次日，加上24小时
        if (slot.endIsNextDay) {
          endMinutes += 24 * 60;
        }

        // 如果结束时间小于开始时间，说明跨天了
        if (endMinutes < startMinutes) {
          endMinutes += 24 * 60;
        }

        totalMinutes += (endMinutes - startMinutes);
      }
    });

    // 转换为小时，保留一位小数
    const duration = (totalMinutes / 60).toFixed(1);
    this.setData({
      'editingShift.duration': duration === '0.0' ? '' : duration
    });
  },

  // 检查是否可以提交
  checkCanSubmit() {
    const { editingShift } = this.data;

    // 检查是否所有时间段都有开始和结束时间
    const allSlotsValid = editingShift.timeSlots.every(slot => slot.startTime && slot.endTime);

    this.setData({
      canSubmit: editingShift.code && editingShift.name && allSlotsValid
    });
  },

  // 提交班种
  async submitShift() {
    const { isEdit, editingShiftId, editingShift } = this.data;

    if (!editingShift.code || !editingShift.name) {
      util.showError('请填写班种编号和名称');
      return;
    }

    // 检查所有时间段
    const hasEmptySlot = editingShift.timeSlots.some(slot => !slot.startTime || !slot.endTime);
    if (hasEmptySlot) {
      util.showError('请完善所有时间段信息');
      return;
    }

    // 格式化时间段数据
    const formattedSlots = editingShift.timeSlots.map(slot => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      startIsNextDay: slot.startIsNextDay || false,
      endIsNextDay: slot.endIsNextDay || false
    }));

    const data = {
      code: editingShift.code.trim(),
      name: editingShift.name.trim(),
      timeSlots: formattedSlots,
      duration: editingShift.duration ? parseFloat(editingShift.duration) : 0,
      coefficient: editingShift.coefficient ? parseFloat(editingShift.coefficient) : 1.0,
      isRest: editingShift.isRest ? 1 : 0,
      color: editingShift.color
    };

    try {
      util.showLoading(isEdit ? '保存中...' : '创建中...');

      if (isEdit) {
        await api.updateShift({ id: editingShiftId, ...data });
      } else {
        await api.createShift(null, data);
      }

      util.hideLoading();
      util.showSuccess(isEdit ? '修改成功' : '创建成功');

      // 关闭模态框并刷新列表
      this.setData({ showEditModal: false });
      setTimeout(() => {
        this.loadShiftList();
      }, 500);
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '操作失败');
    }
  },

  // 删除班种
  async deleteShift(e) {
    const { id } = e.currentTarget.dataset;
    
    const confirm = await util.showConfirm('确认删除', '删除后该班种的所有排班数据将被清除，确定要删除吗？');
    if (!confirm) return;

    try {
      util.showLoading('删除中...');
      await api.deleteShift(id);
      util.hideLoading();
      util.showSuccess('删除成功');
      this.loadShiftList();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '删除失败');
    }
  },

  // 跳转到班种套餐
  goShiftPackage() {
    wx.navigateTo({ url: '/pages/shift-package/shift-package' });
  }
});
