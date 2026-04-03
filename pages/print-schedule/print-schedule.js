// pages/print-schedule/print-schedule.js
const app = getApp();
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    department: {},
    currentYear: 2024,
    currentMonth: 1,
    shiftList: [],
    statisticsData: [],
    shareImagePath: '' // 分享图片路径
  },

  onLoad() {
    const department = wx.getStorageSync('department');
    const now = new Date();
    
    this.setData({
      department: department || {},
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
    
    this.loadData();
  },

  async loadData() {
    await this.loadShiftList();
    await this.loadStatisticsData();
    // 数据加载完成后自动生成分享图片
    this.generateImage();
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

  // 加载统计数据
  async loadStatisticsData() {
    try {
      const { currentYear, currentMonth, shiftList } = this.data;
      
      // 加载成员
      const memberRes = await api.getMemberList();
      const members = memberRes.data || [];
      
      // 加载排班
      const app = getApp();
      const departmentId = app.globalData.currentTeamId || app.globalData.department?.id;
      const scheduleRes = await api.getMonthlySchedule(departmentId, currentYear, currentMonth);
      const schedules = scheduleRes.data || [];
      
      // 统计每个成员各班种次数
      const statisticsData = members.map(member => {
        const memberSchedules = schedules.filter(s => s.memberId === member.id);
        
        // 统计各班种次数
        const shiftCounts = shiftList.map(shift => {
          const count = memberSchedules.filter(s => s.shiftId === shift.id).length;
          return {
            shiftId: shift.id,
            count: count
          };
        });
        
        return {
          memberId: member.id,
          memberName: member.nickName,
          shiftCounts
        };
      });
      
      this.setData({ statisticsData });
    } catch (error) {
      // 加载统计数据失败
    }
  },

  // 上个月
  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth -= 1;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear -= 1;
    }
    this.setData({ currentYear, currentMonth });
    this.loadStatisticsData();
  },

  // 下个月
  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth += 1;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear += 1;
    }
    this.setData({ currentYear, currentMonth });
    this.loadStatisticsData();
  },

  // 保存图片
  async saveImage() {
    try {
      wx.showLoading({ title: '生成中...' });

      // 请求保存到相册的权限
      const auth = await wx.getSetting();
      if (!auth.authSetting['scope.writePhotosAlbum']) {
        await wx.authorize({ scope: 'scope.writePhotosAlbum' });
      }

      // 使用 Canvas 绘制排班表
      const canvasWidth = 750;
      const rowHeight = 80;
      const nameWidth = 150;
      const shiftWidth = (canvasWidth - nameWidth) / (this.data.shiftList.length || 1);

      // 计算画布高度
      const headerHeight = 100;
      const legendHeight = 120;
      const canvasHeight = headerHeight + (this.data.statisticsData.length + 1) * rowHeight + legendHeight + 100;

      // 获取 Canvas 实例
      const query = wx.createSelectorQuery();
      query.select('#myCanvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          canvas.width = canvasWidth;
          canvas.height = canvasHeight;

          // 绘制白色背景
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);

          // 绘制标题
          ctx.fillStyle = '#333333';
          ctx.font = 'bold 36px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${this.data.department.name} - ${this.data.currentYear}年${this.data.currentMonth}月排班表`,
            canvasWidth / 2,
            60
          );

          // 绘制表头
          let y = headerHeight;
          ctx.fillStyle = '#f5f5f5';
          ctx.fillRect(0, y, canvasWidth, rowHeight);

          ctx.strokeStyle = '#e0e0e0';
          ctx.lineWidth = 1;
          ctx.strokeRect(0, y, canvasWidth, rowHeight);

          // 表头：姓名
          ctx.fillStyle = '#333333';
          ctx.font = 'bold 28px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('姓名', nameWidth / 2, y + 50);

          // 表头：班次
          this.data.shiftList.forEach((shift, index) => {
            const x = nameWidth + index * shiftWidth;
            ctx.strokeRect(x, y, shiftWidth, rowHeight);
            ctx.fillText(shift.code, x + shiftWidth / 2, y + 50);
          });

          // 绘制数据行
          y += rowHeight;
          this.data.statisticsData.forEach((member, rowIndex) => {
            ctx.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#fafafa';
            ctx.fillRect(0, y, canvasWidth, rowHeight);

            ctx.strokeStyle = '#e0e0e0';
            ctx.strokeRect(0, y, canvasWidth, rowHeight);

            // 姓名
            ctx.fillStyle = '#333333';
            ctx.font = '28px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(member.memberName, nameWidth / 2, y + 50);

            // 各班次统计
            member.shiftCounts.forEach((shiftCount, colIndex) => {
              const x = nameWidth + colIndex * shiftWidth;
              ctx.strokeRect(x, y, shiftWidth, rowHeight);
              ctx.fillStyle = '#4A90D9';
              ctx.fillText(
                shiftCount.count > 0 ? shiftCount.count.toString() : '-',
                x + shiftWidth / 2,
                y + 50
              );
            });

            y += rowHeight;
          });

          // 绘制图例
          y += 40;
          ctx.fillStyle = '#666666';
          ctx.font = '24px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('图例：', 30, y);

          this.data.shiftList.forEach((shift, index) => {
            const x = 30 + index * 180;
            const legendY = y + 40;

            // 绘制颜色块
            ctx.fillStyle = shift.color;
            ctx.fillRect(x, legendY - 20, 30, 30);

            // 绘制文字
            ctx.fillStyle = '#333333';
            ctx.font = '24px sans-serif';
            ctx.fillText(`${shift.code}: ${shift.name}`, x + 40, legendY);
          });

          // 转换为图片
          wx.canvasToTempFilePath({
            canvas: canvas,
            success: (res) => {
              // 保存图片路径用于分享
              this.setData({ shareImagePath: res.tempFilePath });

              // 保存到相册
              wx.saveImageToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => {
                  wx.hideLoading();
                  wx.showToast({
                    title: '已保存到相册',
                    icon: 'success'
                  });
                },
                fail: (err) => {
                  wx.hideLoading();
                  console.error('保存失败', err);
                  wx.showToast({
                    title: '保存失败',
                    icon: 'none'
                  });
                }
              });
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('生成图片失败', err);
              wx.showToast({
                title: '生成图片失败',
                icon: 'none'
              });
            }
          });
        });
    } catch (error) {
      wx.hideLoading();
      console.error('保存图片失败', error);

      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '提示',
          content: '需要您授权保存相册权限',
          confirmText: '去授权',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      } else {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    }
  },

  // 分享排班
  async shareSchedule() {
    // 如果还没有生成图片，先生成
    if (!this.data.shareImagePath) {
      await this.generateImage();
    }

    // 触发分享
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage']
    });
  },

  // 生成图片（不保存）
  generateImage() {
    return new Promise((resolve, reject) => {
      const canvasWidth = 750;
      const rowHeight = 80;
      const nameWidth = 150;
      const shiftWidth = (canvasWidth - nameWidth) / (this.data.shiftList.length || 1);

      const headerHeight = 100;
      const legendHeight = 120;
      const canvasHeight = headerHeight + (this.data.statisticsData.length + 1) * rowHeight + legendHeight + 100;

      const query = wx.createSelectorQuery();
      query.select('#myCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          canvas.width = canvasWidth;
          canvas.height = canvasHeight;

          // 绘制白色背景
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);

          // 绘制标题
          ctx.fillStyle = '#333333';
          ctx.font = 'bold 36px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${this.data.department.name} - ${this.data.currentYear}年${this.data.currentMonth}月排班表`,
            canvasWidth / 2,
            60
          );

          // 绘制表头
          let y = headerHeight;
          ctx.fillStyle = '#f5f5f5';
          ctx.fillRect(0, y, canvasWidth, rowHeight);

          ctx.strokeStyle = '#e0e0e0';
          ctx.lineWidth = 1;
          ctx.strokeRect(0, y, canvasWidth, rowHeight);

          ctx.fillStyle = '#333333';
          ctx.font = 'bold 28px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('姓名', nameWidth / 2, y + 50);

          this.data.shiftList.forEach((shift, index) => {
            const x = nameWidth + index * shiftWidth;
            ctx.strokeRect(x, y, shiftWidth, rowHeight);
            ctx.fillText(shift.code, x + shiftWidth / 2, y + 50);
          });

          // 绘制数据行
          y += rowHeight;
          this.data.statisticsData.forEach((member, rowIndex) => {
            ctx.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#fafafa';
            ctx.fillRect(0, y, canvasWidth, rowHeight);

            ctx.strokeStyle = '#e0e0e0';
            ctx.strokeRect(0, y, canvasWidth, rowHeight);

            ctx.fillStyle = '#333333';
            ctx.font = '28px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(member.memberName, nameWidth / 2, y + 50);

            member.shiftCounts.forEach((shiftCount, colIndex) => {
              const x = nameWidth + colIndex * shiftWidth;
              ctx.strokeRect(x, y, shiftWidth, rowHeight);
              ctx.fillStyle = '#4A90D9';
              ctx.fillText(
                shiftCount.count > 0 ? shiftCount.count.toString() : '-',
                x + shiftWidth / 2,
                y + 50
              );
            });

            y += rowHeight;
          });

          // 绘制图例
          y += 40;
          ctx.fillStyle = '#666666';
          ctx.font = '24px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('图例：', 30, y);

          this.data.shiftList.forEach((shift, index) => {
            const x = 30 + index * 180;
            const legendY = y + 40;

            ctx.fillStyle = shift.color;
            ctx.fillRect(x, legendY - 20, 30, 30);

            ctx.fillStyle = '#333333';
            ctx.font = '24px sans-serif';
            ctx.fillText(`${shift.code}: ${shift.name}`, x + 40, legendY);
          });

          // 转换为图片
          wx.canvasToTempFilePath({
            canvas: canvas,
            success: (res) => {
              this.setData({ shareImagePath: res.tempFilePath });
              resolve(res.tempFilePath);
            },
            fail: (err) => {
              console.error('生成图片失败', err);
              reject(err);
            }
          });
        });
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.department.name} - ${this.data.currentYear}年${this.data.currentMonth}月排班表`,
      path: '/pages/index/index',
      imageUrl: this.data.shareImagePath || ''
    };
  }
});
