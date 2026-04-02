// pages/create-shift/create-shift.js
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    isEdit: false,
    isSelectMode: false, // 选择模式（用于创建科室时选择班种）
    shiftId: '',
    code: '',
    name: '',
    timeSlots: [
      { startTime: '', endTime: '', startIsNextDay: false, endIsNextDay: false }
    ], // 时间段数组
    duration: '', // 时长
    currentColor: '#7BA3C8',
    colorList: [
      '#7BA3C8', '#9B8AA8', '#A8B5BD',
      '#E89B7C', '#B8A07E', '#8A9EB5',
      '#C49BA8', '#C4B89A'
    ],
    canSubmit: false,

    // 时间选择器
    showTimePickerModal: false,
    pickingTime: 'start', // 'start' or 'end'
    editingIndex: 0, // 当前编辑的时间段索引
    hours: [],
    minutes: [],
    pickerValue: [0, 0],
    tempIsNextDay: false
  },

  onLoad(options) {
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

    // 选择模式（创建科室时使用）
    if (options.mode === 'select') {
      this.setData({ isSelectMode: true });
    }

    if (options.id) {
      this.setData({ isEdit: true, shiftId: options.id });
      this.loadShiftDetail(options.id);
    }
  },

  // 加载班种详情
  async loadShiftDetail(id) {
    try {
      const res = await api.getShiftList();
      const shift = (res.data || []).find(s => s.id === id);
      if (shift) {
        // 解析时间段
        let timeSlots = [];

        if (shift.timeSlots && shift.timeSlots.length > 0) {
          // 新格式：多个时间段
          timeSlots = shift.timeSlots.map(slot => {
            let startTime = slot.startTime;
            let startIsNextDay = false;
            let endTime = slot.endTime;
            let endIsNextDay = false;

            if (startTime && startTime.includes('+1')) {
              startTime = startTime.replace('+1', '');
              startIsNextDay = true;
            }

            if (endTime && endTime.includes('+1')) {
              endTime = endTime.replace('+1', '');
              endIsNextDay = true;
            }

            return {
              startTime: startTime,
              startIsNextDay: startIsNextDay,
              endTime: endTime,
              endIsNextDay: endIsNextDay
            };
          });
        } else if (shift.startTime && shift.endTime) {
          // 旧格式：单个时间段，兼容处理
          let startTime = shift.startTime;
          let startIsNextDay = false;
          let endTime = shift.endTime;
          let endIsNextDay = false;

          if (startTime && startTime.includes('+1')) {
            startTime = startTime.replace('+1', '');
            startIsNextDay = true;
          }

          if (endTime && endTime.includes('+1')) {
            endTime = endTime.replace('+1', '');
            endIsNextDay = true;
          }

          timeSlots = [{
            startTime: startTime,
            startIsNextDay: startIsNextDay,
            endTime: endTime,
            endIsNextDay: endIsNextDay
          }];
        }

        this.setData({
          code: shift.code,
          name: shift.name,
          timeSlots: timeSlots.length > 0 ? timeSlots : [{ startTime: '', startIsNextDay: false, endTime: '', endIsNextDay: false }],
          currentColor: shift.color
        });

        // 计算时长
        this.calculateDuration();
        this.checkCanSubmit();
      }
    } catch (error) {
      // 加载班种详情失败
    }
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value.toUpperCase() });
    this.checkCanSubmit();
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
    this.checkCanSubmit();
  },

  // 显示开始时间选择器
  showStartTimePicker(e) {
    const { index } = e.currentTarget.dataset;
    const { timeSlots, hours, minutes } = this.data;
    const slot = timeSlots[index];
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
    const { timeSlots, hours, minutes } = this.data;
    const slot = timeSlots[index];
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
    const { pickerValue, hours, minutes, pickingTime, tempIsNextDay, editingIndex, timeSlots } = this.data;
    const hour = hours[pickerValue[0]];
    const minute = minutes[pickerValue[1]];
    const time = `${hour}:${minute}`;

    const updatedSlots = [...timeSlots];

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

    this.setData({ timeSlots: updatedSlots });
    this.calculateDuration();
    this.checkCanSubmit();
    this.hideTimePicker();
  },

  // 添加时间段
  addTimeSlot() {
    const { timeSlots } = this.data;
    if (timeSlots.length >= 2) {
      return;
    }

    this.setData({
      timeSlots: [...timeSlots, { startTime: '', startIsNextDay: false, endTime: '', endIsNextDay: false }]
    });
  },

  // 删除时间段
  removeTimeSlot(e) {
    const { index } = e.currentTarget.dataset;
    const { timeSlots } = this.data;

    if (timeSlots.length <= 1) {
      return;
    }

    const updatedSlots = timeSlots.filter((_, i) => i !== index);
    this.setData({ timeSlots: updatedSlots });
    this.calculateDuration();
    this.checkCanSubmit();
  },

  // 计算时长
  calculateDuration() {
    const { timeSlots } = this.data;
    let totalMinutes = 0;

    timeSlots.forEach(slot => {
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
    this.setData({ duration: duration === '0.0' ? '' : duration });
  },

  // 时长输入
  onDurationInput(e) {
    this.setData({ duration: e.detail.value });
  },

  // 阻止冒泡
  stopPropagation() {},

  selectColor(e) {
    const { color } = e.currentTarget.dataset;
    this.setData({ currentColor: color });
  },

  checkCanSubmit() {
    const { code, name, timeSlots } = this.data;

    // 检查是否所有时间段都有开始和结束时间
    const allSlotsValid = timeSlots.every(slot => slot.startTime && slot.endTime);

    this.setData({
      canSubmit: code && name && allSlotsValid
    });
  },

  async handleSubmit() {
    const { isEdit, isSelectMode, shiftId, code, name, timeSlots, duration, currentColor } = this.data;

    if (!code || !name) {
      util.showError('请填写班种编号和名称');
      return;
    }

    // 检查所有时间段
    const hasEmptySlot = timeSlots.some(slot => !slot.startTime || !slot.endTime);
    if (hasEmptySlot) {
      util.showError('请完善所有时间段信息');
      return;
    }

    // 格式化时间段数据
    const formattedSlots = timeSlots.map(slot => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      startIsNextDay: slot.startIsNextDay || false,
      endIsNextDay: slot.endIsNextDay || false
    }));

    const data = {
      code: code.trim(),
      name: name.trim(),
      timeSlots: formattedSlots,
      duration: duration ? parseFloat(duration) : 0,
      color: currentColor
    };

    // 选择模式：不调用API，直接返回数据
    if (isSelectMode) {
      const app = getApp();
      app.globalData.tempNewShift = data;
      wx.navigateBack();
      return;
    }

    try {
      util.showLoading(isEdit ? '保存中...' : '创建中...');

      if (isEdit) {
        await api.updateShift({ id: shiftId, ...data });
      } else {
        await api.createShift(null, data); // departmentId 会自动获取
      }

      util.hideLoading();
      util.showSuccess(isEdit ? '修改成功' : '创建成功');

      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '操作失败');
    }
  }
});
