// pages/leave-apply/leave-apply.js
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    myApplies: [],
    members: [],
    initialized: false,  // 是否已初始化
    
    // 弹窗相关
    showModal: false,
    applyType: 'leave',
    startDate: '',
    endDate: '',
    selectedMemberId: '',
    selectedMemberName: '',
    reason: ''
  },

  onLoad() {
    this.loadMyApplies();
    this.loadMembers();
  },

  onShow() {
    // 如果已初始化，刷新数据
    if (this.data.initialized) {
      this.loadMyApplies();
    }
  },

  // 加载我的申请记录
  async loadMyApplies() {
    try {
      const res = await api.getMyLeaveApplyList();
      const list = (res.data || []).map(item => ({
        ...item,
        typeName: item.type === 'leave' ? '请假' : 
                  item.type === 'transfer' ? '调班' : '换班',
        statusName: item.status === 'pending' ? '待审批' :
                    item.status === 'approved' ? '已通过' : '已拒绝'
      }));
      this.setData({ myApplies: list, initialized: true });
    } catch (error) {
      // 加载申请记录失败
    }
  },

  // 加载成员列表（用于换班选择）
  async loadMembers() {
    try {
      const res = await api.getMemberList();
      const userInfo = wx.getStorageSync('userInfo');
      // 排除自己
      const members = (res.data || []).filter(m => m.id !== userInfo?.id);
      this.setData({ members });
    } catch (error) {
      // 加载成员失败
    }
  },

  // 新建申请
  addApply() {
    this.setData({ showModal: true });
  },

  // 关闭弹窗
  closeModal() {
    this.setData({
      showModal: false,
      applyType: 'leave',
      startDate: '',
      endDate: '',
      selectedMemberId: '',
      selectedMemberName: '',
      reason: ''
    });
  },

  // 选择类型
  selectType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ applyType: type });
  },

  // 选择开始日期
  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value });
  },

  // 选择结束日期
  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value });
  },

  // 选择换班成员
  onMemberChange(e) {
    const index = e.detail.value;
    const member = this.data.members[index];
    this.setData({
      selectedMemberId: member.id,
      selectedMemberName: member.nickName
    });
  },

  // 输入事由
  onReasonInput(e) {
    this.setData({ reason: e.detail.value });
  },

  // 提交申请
  async submitApply() {
    const { applyType, startDate, endDate, selectedMemberId, reason } = this.data;
    
    if (!startDate || !endDate) {
      util.showError('请选择时间');
      return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      util.showError('开始时间不能大于结束时间');
      return;
    }
    
    if (applyType === 'exchange' && !selectedMemberId) {
      util.showError('请选择换班对象');
      return;
    }
    
    if (!reason.trim()) {
      util.showError('请填写事由说明');
      return;
    }

    try {
      util.showLoading('提交中...');
      await api.submitLeaveApply({
        type: applyType,
        startDate,
        endDate,
        targetMemberId: applyType === 'exchange' ? selectedMemberId : undefined,
        reason: reason.trim()
      });
      util.hideLoading();
      util.showSuccess('提交成功');
      
      this.closeModal();
      this.loadMyApplies();
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '提交失败');
    }
  },

  // 阻止冒泡
  stopPropagation() {}
});
