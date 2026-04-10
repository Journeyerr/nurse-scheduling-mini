// pages/role-select/role-select.js
const app = getApp();

Page({
  data: {
    showNameModal: false,
    inputName: '',
    pendingInviteCode: ''
  },

  onLoad(options) {
    // 检查是否有邀请参数（护士通过邀请链接进入）
    if (options.inviteCode) {
      this.handleInvite(options.inviteCode);
    }
  },

  // 选择护士长身份
  selectLeader() {
    app.setRole('leader');
    wx.reLaunch({ url: '/pages/index/index' });
  },

  // 选择护士身份
  selectNurse() {
    app.setRole('nurse');
    wx.reLaunch({ url: '/pages/index/index' });
  },

  // 处理邀请
  handleInvite(inviteCode) {
    this.setData({ pendingInviteCode: inviteCode, showNameModal: true, inputName: '' });
  },

  // 输入名称
  onNameInput(e) {
    this.setData({ inputName: e.detail.value });
  },

  // 取消加入
  cancelJoin() {
    this.setData({ showNameModal: false, pendingInviteCode: '', inputName: '' });
  },

  // 确认加入
  async confirmJoin() {
    const name = this.data.inputName.trim();
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    this.setData({ showNameModal: false });
    await this.joinDepartment(this.data.pendingInviteCode, name);
  },

  // 加入科室
  async joinDepartment(inviteCode, nickName) {
    const api = require('../../utils/api');
    const util = require('../../utils/util');

    try {
      util.showLoading('加入中...');

      // 先更新用户昵称
      if (nickName) {
        await api.updateUserInfo({ nickName });
      }

      const res = await api.joinDepartment({ inviteCode });
      util.hideLoading();

      app.setDepartment(res.data);
      util.showSuccess('加入成功');

      setTimeout(() => {
        wx.redirectTo({ url: '/pages/index/index' });
      }, 1000);
    } catch (error) {
      util.hideLoading();
      util.showError(error.message || error.msg || '加入失败');
    }
  }
});
