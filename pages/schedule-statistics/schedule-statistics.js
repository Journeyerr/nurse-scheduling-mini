// pages/schedule-statistics/schedule-statistics.js
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
    shareImagePath: '', // 分享图片路径
    cellWidths: { name: 140, shift: 120, coefficient: 100 } // 动态列宽
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

        // 计算系数总和：非休息班的次数 × 系数
        let coefficientSum = 0;
        shiftList.forEach((shift, index) => {
          const count = shiftCounts[index].count;
          if (count > 0 && !shift.isRest) {
            const coefficient = shift.coefficient || 1.0;
            coefficientSum += coefficient * count;
          }
        });
        coefficientSum = Math.round(coefficientSum * 10) / 10;
        
        return {
          memberId: member.id,
          memberName: member.nickName,
          shiftCounts,
          coefficientSum: coefficientSum > 0 ? coefficientSum : 0
        };
      });
      
      this.setData({ statisticsData, cellWidths: this.calcCellWidths(shiftList.length) });
    } catch (error) {
      // 加载统计数据失败
    }
  },

  // 根据班种数量动态计算列宽（rpx）
  calcCellWidths(shiftCount) {
    // 卡片可用宽度：750 - 20*2(外层padding) - 10*2(卡片padding) = 690rpx
    const totalWidth = 690;
    const shiftCountSafe = Math.max(shiftCount, 1);

    let nameWidth, coefficientWidth, shiftWidth;

    if (shiftCountSafe <= 3) {
      nameWidth = 140;
      coefficientWidth = 100;
    } else if (shiftCountSafe <= 5) {
      nameWidth = 120;
      coefficientWidth = 90;
    } else {
      nameWidth = 100;
      coefficientWidth = 80;
    }

    shiftWidth = Math.round((totalWidth - nameWidth - coefficientWidth) / shiftCountSafe);

    // 确保班种列最小宽度
    shiftWidth = Math.max(shiftWidth, 60);

    return { name: nameWidth, shift: shiftWidth, coefficient: coefficientWidth };
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

  // 核心绘制方法（saveImage 和 generateImage 共用）
  _drawScheduleCanvas() {
    return new Promise((resolve, reject) => {
      const shiftCount = this.data.shiftList.length || 1;
      const dpr = wx.getWindowInfo().pixelRatio || 2;

      // 逻辑尺寸（px）
      const canvasLogicWidth = 750;
      const nameWidth = 150;
      const coefficientWidth = 100;
      const shiftWidth = (canvasLogicWidth - nameWidth - coefficientWidth) / shiftCount;
      const rowHeight = 80;
      const headerHeight = 120;
      const footerPadding = 80;

      // 计算图例需要几行
      const legendCols = Math.min(shiftCount, 4);
      const legendRows = Math.ceil(shiftCount / legendCols);
      const legendHeight = legendRows * 50 + 40;

      const dataRowCount = this.data.statisticsData.length;
      const canvasLogicHeight = headerHeight + (dataRowCount + 1) * rowHeight + legendHeight + footerPadding;

      const coefficientX = canvasLogicWidth - coefficientWidth;

      const query = wx.createSelectorQuery();
      query.select('#myCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) {
            reject(new Error('Canvas not found'));
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          // 设置 canvas 实际像素尺寸（高清）
          canvas.width = canvasLogicWidth * dpr;
          canvas.height = canvasLogicHeight * dpr;

          // 缩放绘制上下文
          ctx.scale(dpr, dpr);

          // 绘制白色背景
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvasLogicWidth, canvasLogicHeight);

          // 绘制标题
          ctx.fillStyle = '#333333';
          ctx.font = 'bold 32px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            `${this.data.department.name} - ${this.data.currentYear}年${this.data.currentMonth}月排班表`,
            canvasLogicWidth / 2,
            50
          );

          // 绘制表头
          let y = headerHeight;
          ctx.fillStyle = '#f5f5f5';
          ctx.fillRect(0, y, canvasLogicWidth, rowHeight);

          ctx.strokeStyle = '#e0e0e0';
          ctx.lineWidth = 1;
          ctx.strokeRect(0, y, canvasLogicWidth, rowHeight);

          // 表头：姓名
          ctx.fillStyle = '#333333';
          ctx.font = 'bold 26px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('姓名', nameWidth / 2, y + rowHeight / 2);

          // 表头：班次
          this.data.shiftList.forEach((shift, index) => {
            const x = nameWidth + index * shiftWidth;
            ctx.strokeStyle = '#e0e0e0';
            ctx.strokeRect(x, y, shiftWidth, rowHeight);
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText(shift.code || shift.name, x + shiftWidth / 2, y + rowHeight / 2);
          });

          // 表头：系数
          ctx.strokeStyle = '#e0e0e0';
          ctx.strokeRect(coefficientX, y, coefficientWidth, rowHeight);
          ctx.fillStyle = '#333333';
          ctx.font = 'bold 26px sans-serif';
          ctx.fillText('系数', coefficientX + coefficientWidth / 2, y + rowHeight / 2);

          // 绘制数据行
          y += rowHeight;
          this.data.statisticsData.forEach((member, rowIndex) => {
            ctx.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#fafafa';
            ctx.fillRect(0, y, canvasLogicWidth, rowHeight);

            ctx.strokeStyle = '#e0e0e0';
            ctx.strokeRect(0, y, canvasLogicWidth, rowHeight);

            // 姓名
            ctx.fillStyle = '#333333';
            ctx.font = '26px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(member.memberName, nameWidth / 2, y + rowHeight / 2);

            // 各班次统计
            member.shiftCounts.forEach((shiftCount, colIndex) => {
              const x = nameWidth + colIndex * shiftWidth;
              ctx.strokeStyle = '#e0e0e0';
              ctx.strokeRect(x, y, shiftWidth, rowHeight);
              ctx.fillStyle = '#4A90D9';
              ctx.font = '26px sans-serif';
              ctx.fillText(
                shiftCount.count > 0 ? shiftCount.count.toString() : '-',
                x + shiftWidth / 2,
                y + rowHeight / 2
              );
            });

            // 系数
            ctx.strokeStyle = '#e0e0e0';
            ctx.strokeRect(coefficientX, y, coefficientWidth, rowHeight);
            ctx.fillStyle = '#E89B7C';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText(
              member.coefficientSum > 0 ? member.coefficientSum.toString() : '-',
              coefficientX + coefficientWidth / 2,
              y + rowHeight / 2
            );

            y += rowHeight;
          });

          // 绘制图例（自动换行，防止文字溢出覆盖）
          y += 30;
          ctx.fillStyle = '#666666';
          ctx.font = '22px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText('图例：', 30, y + 15);

          y += 35;
          const legendItemWidth = 170;
          const maxCols = Math.floor((canvasLogicWidth - 40) / legendItemWidth);
          // 重新计算图例实际行数和高度（可能因文字换行增加行数）
          let legendCurrentY = y;
          let currentCol = 0;
          this.data.shiftList.forEach((shift, index) => {
            const col = currentCol % maxCols;
            const row = Math.floor(currentCol / maxCols);
            const x = 30 + col * legendItemWidth;
            const itemY = y + row * 45;

            // 计算文字可用最大宽度（防止溢出到下一个图例项）
            const textX = x + 32;
            const maxTextWidth = legendItemWidth - 36;

            // 绘制颜色块
            ctx.fillStyle = shift.color || '#999';
            ctx.fillRect(x, itemY - 10, 24, 24);

            // 绘制文字（截断防溢出）
            ctx.fillStyle = '#333333';
            ctx.font = '22px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            let legendText = `${shift.code}: ${shift.name}（×${shift.coefficient || 1.0}）`;
            // 测量文字宽度，超出则截断
            let measuredWidth = ctx.measureText(legendText).width;
            if (measuredWidth > maxTextWidth) {
              // 逐步截断直到 fits
              while (legendText.length > 0 && ctx.measureText(legendText + '…').width > maxTextWidth) {
                legendText = legendText.slice(0, -1);
              }
              legendText += '…';
            }
            ctx.fillText(legendText, textX, itemY + 2);

            legendCurrentY = itemY;
          });

          // 转换为图片
          wx.canvasToTempFilePath({
            canvas: canvas,
            width: canvasLogicWidth * dpr,
            height: canvasLogicHeight * dpr,
            destWidth: canvasLogicWidth * dpr,
            destHeight: canvasLogicHeight * dpr,
            success: (res) => {
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

  // 保存图片
  async saveImage() {
    try {
      // 先请求相册权限（必须在用户点击的同步上下文中请求，否则手机上会失败）
      const auth = await wx.getSetting();
      if (auth.authSetting['scope.writePhotosAlbum'] === false) {
        wx.showModal({
          title: '提示',
          content: '需要您授权保存到相册的权限，请前往设置开启',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
        return;
      }

      if (!auth.authSetting['scope.writePhotosAlbum']) {
        try {
          await wx.authorize({ scope: 'scope.writePhotosAlbum' });
        } catch (authErr) {
          wx.showModal({
            title: '提示',
            content: '需要您授权保存到相册的权限，请前往设置开启',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            }
          });
          return;
        }
      }

      // 权限已获取，绘制图片
      wx.showLoading({ title: '生成中...' });
      const tempFilePath = await this._drawScheduleCanvas();

      // 将临时文件保存为持久路径，避免 saveImageToPhotosAlbum 找不到文件
      const fs = wx.getFileSystemManager();
      const persistentPath = `${wx.env.USER_DATA_PATH}/schedule_${this.data.currentYear}${this.data.currentMonth}.png`;
      fs.saveFileSync(tempFilePath, persistentPath);
      this.setData({ shareImagePath: persistentPath });

      // 保存到相册
      wx.saveImageToPhotosAlbum({
        filePath: persistentPath,
        success: () => {
          wx.hideLoading();
          wx.showToast({ title: '已保存到相册', icon: 'success' });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('保存失败', err);
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      });
    } catch (error) {
      wx.hideLoading();
      console.error('保存图片失败', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 分享排班
  async shareSchedule() {
    if (!this.data.shareImagePath) {
      await this.generateImage();
    }
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] });
  },

  // 生成图片（不保存）
  async generateImage() {
    try {
      const tempFilePath = await this._drawScheduleCanvas();
      this.setData({ shareImagePath: tempFilePath });
      return tempFilePath;
    } catch (err) {
      console.error('生成图片失败', err);
      throw err;
    }
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
