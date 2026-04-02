// pages/department-manage/department-manage.js
const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    department: {},
    members: [],
    selectMode: false,
    selectedMember: ''
  },

  onLoad(options) {
    this.loadData();
    
    if (options.action === 'invite') {
      this.handleInvite();
    }
  },

  async loadData() {
    try {
      const department = wx.getStorageSync('department');
      const res = await api.getMemberList();
      const userInfo = wx.getStorageSync('userInfo');
      const members = (res.data || []).map(item => ({
        ...item,
        isCreator: item.id === userInfo?.id
      }));
      
      this.setData({
        department: department || {},
        members
      });
    } catch (error) {
      // 加载数据失败
    }
  },

  // 邀请成员
  async handleInvite() {
    try {
      const res = await api.getInviteLink();
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage']
      });
      
      // 提示用户分享
      wx.showModal({
        title: '邀请成员',
        content: '请点击右上角...按钮，分享给需要加入的护士',
        showCancel: false
      });
    } catch (error) {
      util.showError(error.message || '获取邀请链接失败');
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `邀请你加入${this.data.department.name}`,
      path: `/pages/login/login?inviteCode=${this.data.department.inviteCode}`
    };
  },

  // 转让科室
  handleTransfer() {
    wx.showModal({
      title: '转让科室',
      content: '转让后，对方将成为新的科室管理员（护士长），您将变为普通护士。确定要转让吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ selectMode: true });
        }
      }
    });
  },

  // 选择成员
  selectMember(e) {
    if (!this.data.selectMode) return;
    
    const { id } = e.currentTarget.dataset;
    const userInfo = wx.getStorageSync('userInfo');
    
    if (id === userInfo?.id) {
      util.showError('不能转让给自己');
      return;
    }
    
    this.setData({ selectedMember: id });
  },

  // 确认转让
  async confirmTransfer() {
    if (!this.data.selectedMember) {
      util.showError('请选择成员');
      return;
    }

    const member = this.data.members.find(m => m.id === this.data.selectedMember);
    const confirm = await util.showConfirm('确认转让', `确定将科室转让给 ${member.nickName} 吗？`);
    if (!confirm) return;

    try {
      util.showLoading('转让中...');
      await api.transferDepartment(null, { newCreatorId: this.data.selectedMember });
      util.hideLoading();
      
      // 更新本地状态
      app.setDepartment({
        ...this.data.department,
        creatorId: this.data.selectedMember
      });
      
      util.showSuccess('转让成功');
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '转让失败');
    }
  },

  // 取消选择
  cancelSelect() {
    this.setData({ selectMode: false, selectedMember: '' });
  },

  // 解散科室
  async handleDismiss() {
    const confirm = await util.showConfirm(
      '解散科室',
      '解散后，所有成员将被移出科室，数据无法恢复。确定要解散吗？'
    );
    if (!confirm) return;

    const doubleConfirm = await util.showConfirm(
      '再次确认',
      '确定要解散科室吗？此操作不可撤销！'
    );
    if (!doubleConfirm) return;

    try {
      util.showLoading('解散中...');
      await api.dismissDepartment();
      util.hideLoading();
      
      // 清除本地数据
      app.clearUserInfo();
      
      util.showSuccess('科室已解散');
      
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/role-select/role-select' });
      }, 1000);
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || '解散失败');
    }
  }
});
