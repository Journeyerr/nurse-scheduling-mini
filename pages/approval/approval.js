// pages/approval/approval.js
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    expectList: [],
    expectPending: 0,
    shiftList: [],
    initialized: false,  // 是否已初始化
    showDetailModal: false,  // 显示详情弹窗
    currentItem: null,  // 当前查看的申请
    approvalRemark: '',  // 审批意见
    // 分页相关
    page: 1,
    pageSize: 20,
    hasMore: true,
    loadingMore: false
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

  // 加载申请列表（首页/刷新）
  async loadExpectList() {
    this.setData({ page: 1, hasMore: true });
    try {
      const res = await api.getExpectScheduleList(1, this.data.pageSize);
      const { shiftList } = this.data;
      
      const list = this.processList(res.data?.list || res.data || [], shiftList);
      const hasMore = res.data?.hasMore !== undefined ? res.data.hasMore : false;
      const pending = list.filter(i => i.status === 'pending').length;
      this.setData({ expectList: list, expectPending: pending, hasMore });
    } catch (error) {
      // 加载申请列表失败
    }
  },

  // 加载更多
  async loadMoreExpects() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.setData({ loadingMore: true });
    
    try {
      const nextPage = this.data.page + 1;
      const res = await api.getExpectScheduleList(nextPage, this.data.pageSize);
      const { shiftList } = this.data;
      
      const newList = this.processList(res.data?.list || res.data || [], shiftList);
      const hasMore = res.data?.hasMore !== undefined ? res.data.hasMore : false;
      const allList = [...this.data.expectList, ...newList];
      const pending = allList.filter(i => i.status === 'pending').length;
      this.setData({
        expectList: allList,
        expectPending: pending,
        page: nextPage,
        hasMore,
        loadingMore: false
      });
    } catch (error) {
      this.setData({ loadingMore: false });
    }
  },

  // 处理列表数据
  processList(rawList, shiftList) {
    return rawList.map(item => {
      const shift = shiftList.find(s => String(s.id) === String(item.shiftId));
      const myShift = shiftList.find(s => String(s.id) === String(item.myShiftId));
      const targetShift = shiftList.find(s => String(s.id) === String(item.targetShiftId));
      
      let displayInfo = {};
      if (item.type === 'swap') {
        displayInfo = {
          typeName: '申请换班',
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
                    item.status === 'approved' ? '已通过' : 
                    item.status === 'cancelled' ? '已取消' : '已拒绝'
      };
    });
  },

  // 触底加载更多
  onReachBottom() {
    this.loadMoreExpects();
  },

  // 显示详情
  showDetail(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.expectList[index];
    
    this.setData({
      showDetailModal: true,
      currentItem: item,
      approvalRemark: ''
    });
  },

  // 关闭详情弹窗
  closeDetailModal() {
    this.setData({
      showDetailModal: false,
      currentItem: null,
      approvalRemark: ''
    });
  },

  // 阻止冒泡
  stopPropagation() {},

  // 输入审批意见
  onApprovalRemarkInput(e) {
    this.setData({
      approvalRemark: e.detail.value
    });
  },

  // 通过审批
  async handleApprove(e) {
    const { id } = e.currentTarget.dataset;
    const { approvalRemark } = this.data;
    
    try {
      util.showLoading('处理中...');
      
      await api.approveExpectSchedule({ 
        id, 
        status: 'approved',
        approveRemark: approvalRemark
      });
      
      util.hideLoading();
      util.showSuccess('已通过');
      
      this.closeDetailModal();
      this.loadData();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '操作失败');
    }
  },

  // 拒绝审批
  async handleReject(e) {
    const { id } = e.currentTarget.dataset;
    const { approvalRemark } = this.data;
    
    const confirm = await util.showConfirm('确认拒绝', '确定要拒绝该申请吗？');
    if (!confirm) return;

    try {
      util.showLoading('处理中...');
      
      await api.approveExpectSchedule({ 
        id, 
        status: 'rejected',
        approveRemark: approvalRemark
      });
      
      util.hideLoading();
      util.showSuccess('已拒绝');
      
      this.closeDetailModal();
      this.loadData();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '操作失败');
    }
  }
});
