// pages/shift-package/shift-package.js
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    packageList: [],
    shiftList: [],
    shiftOptions: [],
    weekDays: ['一', '二', '三', '四', '五', '六', '日'],
    showEditModal: false,
    initialized: false,  // 是否已初始化
    editingPackage: {
      name: '',
      shifts: Array(7).fill(null).map(() => ({}))
    },
    selectedDayIndex: 0 // 默认选中第一天
  },

  onLoad() {
    this.loadShiftList();
    this.loadPackages();
  },

  onShow() {
    // 如果已初始化，刷新数据
    if (this.data.initialized) {
      this.loadPackages();
    }
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

  // 加载套餐列表
  async loadPackages() {
    try {
      const res = await api.getShiftPackageList();
      this.setData({ packageList: res.data || [] });
    } catch (error) {
      // 加载套餐失败
    }
  },

  // 添加套餐
  addPackage() {
    this.setData({
      showEditModal: true,
      editingPackage: {
        name: '',
        shifts: Array(7).fill(null).map(() => ({}))
      },
      selectedDayIndex: 0
    });
  },

  // 编辑套餐
  editPackage(e) {
    const { id } = e.currentTarget.dataset;
    const pkg = this.data.packageList.find(p => p.id === id);
    
    if (pkg) {
      this.setData({
        showEditModal: true,
        editingPackage: {
          ...pkg,
          shifts: pkg.shifts.map(s => s || {})
        },
        selectedDayIndex: 0
      });
    }
  },

  // 删除套餐
  async deletePackage(e) {
    const { id } = e.currentTarget.dataset;
    
    const confirm = await util.showConfirm('确认删除', '确定要删除该套餐吗？');
    if (!confirm) return;

    try {
      await api.deleteShiftPackage(id);
      util.showSuccess('删除成功');
      this.loadPackages();
    } catch (error) {
      util.showError('删除失败');
    }
  },

  // 输入套餐名称
  onNameInput(e) {
    this.setData({
      'editingPackage.name': e.detail.value
    });
  },

  // 选择某一天（点击已填充的格子则删除）
  selectDay(e) {
    const { dayIndex } = e.currentTarget.dataset;
    const { editingPackage } = this.data;
    const currentShift = editingPackage.shifts[dayIndex];
    
    // 如果点击的是已填充的格子，删除该班次
    if (currentShift && currentShift.shiftId) {
      const shifts = [...editingPackage.shifts];
      shifts[dayIndex] = {};
      this.setData({
        'editingPackage.shifts': shifts,
        selectedDayIndex: dayIndex
      });
    } else {
      this.setData({ selectedDayIndex: dayIndex });
    }
  },

  // 选择班种（直接填充到选中的格子）
  selectShift(e) {
    const { shift } = e.currentTarget.dataset;
    const { selectedDayIndex, editingPackage } = this.data;
    
    if (selectedDayIndex < 0) return;
    
    const shifts = [...editingPackage.shifts];
    shifts[selectedDayIndex] = {
      shiftId: shift.id,
      code: shift.code,
      name: shift.name,
      color: shift.color
    };
    
    const nextDayIndex = selectedDayIndex < 6 ? selectedDayIndex + 1 : selectedDayIndex;
    
    this.setData({
      'editingPackage.shifts': shifts,
      selectedDayIndex: nextDayIndex
    });
  },

  // 关闭弹窗
  closeEditModal() {
    this.setData({ 
      showEditModal: false,
      selectedDayIndex: 0
    });
  },

  // 阻止冒泡
  stopPropagation() {},

  // 保存套餐
  async savePackage() {
    const { editingPackage } = this.data;
    
    if (!editingPackage.name.trim()) {
      util.showError('请输入套班名称');
      return;
    }

    const hasShift = editingPackage.shifts.some(s => s.shiftId);
    if (!hasShift) {
      util.showError('请至少选择一天的班种');
      return;
    }

    // 构建套班数据
    const shifts = editingPackage.shifts.map(s => ({
      shiftId: s.shiftId || null,
      code: s.code || '',
      name: s.name || '',
      color: s.color || ''
    }));

    try {
      if (editingPackage.id) {
        // 编辑模式
        await api.updateShiftPackage({
          id: editingPackage.id,
          name: editingPackage.name,
          shifts
        });
      } else {
        // 新增模式
        await api.createShiftPackage(null, {
          name: editingPackage.name,
          shifts
        });
      }
      
      this.closeEditModal();
      util.showSuccess('保存成功');
      this.loadPackages();
    } catch (error) {
      util.showError('保存失败');
    }
  }
});
