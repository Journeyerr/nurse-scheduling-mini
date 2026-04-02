// pages/approval/approval.js
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    expectList: [],
    expectPending: 0,
    shiftList: [],
    initialized: false  // 是否已初始化
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    // 如果已经初始化过，则刷新数据
    if (this.data.initialized) {
      this.loadData();
    }
  },

  async loadData() {
    await this.loadShiftList();
    await this.loadExpectList();
    this.setData({ initialized: true });
  },

  // 加载班种列表
  async loadShiftList() {
    try {
      const res = await api.getShiftList();
      this.setData({ shiftList: res.data || [] });
    } catch (error) {
      // 加载班种失败
    }
  },

  // 加载申请列表
  async loadExpectList() {
    try {
      const res = await api.getExpectScheduleList();
      const { shiftList } = this.data;
      
      const list = (res.data || []).map(item => {
        // 统一转为字符串比较
        const shift = shiftList.find(s => String(s.id) === String(item.shiftId));
        const myShift = shiftList.find(s => String(s.id) === String(item.myShiftId));
        const targetShift = shiftList.find(s => String(s.id) === String(item.targetShiftId));
        
        // 根据类型处理不同的显示
        let displayInfo = {};
        if (item.type === 'swap') {
          displayInfo = {
            typeName: '换班申请',
            myShiftCode: myShift ? myShift.code : '',
            myShiftName: myShift ? myShift.name : '',
            myShiftColor: myShift ? myShift.color : '#999',
            targetShiftCode: targetShift ? targetShift.code : '',
            targetShiftName: targetShift ? targetShift.name : '',
            targetShiftColor: targetShift ? targetShift.color : '#999'
          };
        } else {
          displayInfo = {
            typeName: '期望排班',
            shiftCode: shift ? shift.code : '',
            shiftName: shift ? shift.name : '',
            shiftColor: shift ? shift.color : '#333'
          };
        }
        
        return {
          ...item,
          ...displayInfo,
          statusName: item.status === 'pending' ? '待审批' :
                      item.status === 'approved' ? '已通过' : '已拒绝'
        };
      });
      
      const pending = list.filter(i => i.status === 'pending').length;
      this.setData({ expectList: list, expectPending: pending });
    } catch (error) {
      // 加载申请列表失败
    }
  },

  // 通过审批
  async handleApprove(e) {
    const { id } = e.currentTarget.dataset;
    
    try {
      util.showLoading('处理中...');
      
      await api.approveExpectSchedule({ id, status: 'approved' });
      
      util.hideLoading();
      util.showSuccess('已通过');
      this.loadData();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '操作失败');
    }
  },

  // 拒绝审批
  async handleReject(e) {
    const { id } = e.currentTarget.dataset;
    
    const confirm = await util.showConfirm('确认拒绝', '确定要拒绝该申请吗？');
    if (!confirm) return;

    try {
      util.showLoading('处理中...');
      
      await api.approveExpectSchedule({ id, status: 'rejected' });
      
      util.hideLoading();
      util.showSuccess('已拒绝');
      this.loadData();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '操作失败');
    }
  }
});
