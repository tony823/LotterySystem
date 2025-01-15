class LotterySystem {
    constructor() {
        this.people = [];
        this.winners = new Map(); // 存储每轮的获奖者
        this.currentRound = 1;
        this.totalRounds = 1;
        this.winnersCount = 1;
        this.isRunning = false;
        this.timer = null;
        this.roundStatus = new Map(); // 记录每轮抽奖状态
        this.prizes = []; // 存储奖品信息
        
        this.initializeElements(); // 先初始化所有元素
        this.bindEvents(); // 再绑定事件
        this.initializeWinnerList();
        this.initializePrizeSettings();
        
        // 添加窗口大小改变的监听
        window.addEventListener('resize', () => {
            if (this.roundStatus.get(this.currentRound)) {
                this.calculateCardSize();
            }
        });
        
        // 尝试从本地存储恢复数据
        this.restoreFromStorage();
    }

    initializeElements() {
        // 获取DOM元素
        this.settingsPanel = document.getElementById('settingsPanel');
        this.lotteryPanel = document.getElementById('lotteryPanel');
        this.fileInput = document.getElementById('fileInput');
        this.bgInput = document.getElementById('bgInput');
        this.roundCountInput = document.getElementById('roundCount');
        this.winnersPerRoundInput = document.getElementById('winnersPerRound');
        this.nameDisplay = document.getElementById('nameDisplay');
        this.currentRoundDisplay = document.getElementById('currentRound');
        this.winnerList = document.getElementById('winnerList');
        
        // 按钮
        this.startBtn = document.getElementById('startBtn');
        this.prevRoundBtn = document.getElementById('prevRound');
        this.nextRoundBtn = document.getElementById('nextRound');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.saveSettingsBtn = document.getElementById('saveSettings');
        this.cancelSettingsBtn = document.getElementById('cancelSettings');
        this.drawPrizeBtn = document.getElementById('drawPrizeBtn'); // 移到这里
    }

    bindEvents() {
        this.fileInput.addEventListener('change', this.handleFileUpload.bind(this));
        this.bgInput.addEventListener('change', this.handleBackgroundUpload.bind(this));
        this.startBtn.addEventListener('click', this.toggleLottery.bind(this));
        this.prevRoundBtn.addEventListener('click', this.previousRound.bind(this));
        this.nextRoundBtn.addEventListener('click', this.nextRound.bind(this));
        this.settingsBtn.addEventListener('click', () => {
            if (this.winners.size > 0) {
                if (!confirm('修改设置将清空所有轮次的抽奖结果，是否继续？')) {
                    return;
                }
            }
            this.settingsPanel.style.display = 'block';
            document.body.classList.add('settings-open');
        });
        this.saveSettingsBtn.addEventListener('click', () => {
            const newRounds = parseInt(this.roundCountInput.value) || 1;
            const newWinnersCount = parseInt(this.winnersPerRoundInput.value) || 1;
            
            if (this.winners.size > 0 && 
                (newRounds !== this.totalRounds || newWinnersCount !== this.winnersCount)) {
                if (!confirm('确定要保存修改吗？这将清空所有轮次的抽奖结果！')) {
                    return;
                }
            }
            
            this.saveSettings();
        });
        this.drawPrizeBtn.addEventListener('click', this.drawAllPrizes.bind(this));
        
        // 添加空格键控制
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.toggleLottery();
            }
        });

        // 添加取消按钮事件
        this.cancelSettingsBtn.addEventListener('click', () => {
            // 恢复原始设置值
            this.roundCountInput.value = this.totalRounds;
            this.winnersPerRoundInput.value = this.winnersCount;
            
            // 恢复原始奖品设置
            const prizesList = document.querySelector('.prizes-list');
            prizesList.innerHTML = '';
            this.prizes.forEach(prize => {
                const prizeItem = document.createElement('div');
                prizeItem.className = 'prize-item';
                prizeItem.innerHTML = `
                    <input type="text" placeholder="奖品名称" class="prize-name" value="${prize.name}">
                    <input type="number" placeholder="数量" class="prize-count" min="1" value="${prize.count}">
                    <button class="remove-prize">删除</button>
                `;
                prizesList.appendChild(prizeItem);

                // 添加删除按钮事件
                prizeItem.querySelector('.remove-prize').addEventListener('click', () => {
                    prizeItem.remove();
                });
            });
            
            // 关闭设置面板
            this.settingsPanel.style.display = 'none';
            document.body.classList.remove('settings-open');
        });

        // 添加清除数据按钮事件
        document.getElementById('clearDataBtn').addEventListener('click', () => {
            this.clearStorage();
        });

        // 添加悬浮菜单的点击事件
        const floatMenu = document.querySelector('.float-menu');
        const floatMenuToggle = document.querySelector('.float-menu-toggle');
        
        floatMenuToggle.addEventListener('click', () => {
            floatMenu.classList.toggle('active');
        });

        // 点击其他地方时关闭菜单
        document.addEventListener('click', (e) => {
            if (!floatMenu.contains(e.target)) {
                floatMenu.classList.remove('active');
            }
        });

        // ESC键关闭菜单
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                floatMenu.classList.remove('active');
            }
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            
            // 读取人员名单（第一个工作表）
            const peopleSheet = workbook.Sheets[workbook.SheetNames[0]];
            const peopleData = XLSX.utils.sheet_to_json(peopleSheet);

            if (peopleData.length === 0) {
                throw new Error('Excel文件中没有人员数据');
            }

            // 检查数据格式并导入人员名单
            this.people = peopleData.map(row => {
                const name = row['姓名'] || row['name'] || row['Name'] || row['NAME'];
                const department = row['部门'] || row['department'] || row['Department'] || row['DEPARTMENT'];
                
                if (!name) {
                    throw new Error('找不到姓名列，请确保Excel中包含"姓名"列');
                }

                return {
                    name: name,
                    department: department || '未知部门',
                    hasWon: false
                };
            });

            // 读取奖品信息（第二个工作表，如果存在）
            if (workbook.SheetNames.length > 1) {
                const prizesSheet = workbook.Sheets[workbook.SheetNames[1]];
                const prizesData = XLSX.utils.sheet_to_json(prizesSheet);

                if (prizesData.length > 0) {
                    // 清空现有奖品列表
                    const prizesList = document.querySelector('.prizes-list');
                    prizesList.innerHTML = '';

                    // 添加每个奖品到设置面板
                    prizesData.forEach(prize => {
                        const name = prize['奖品名称'] || prize['奖品'] || prize['prize'] || prize['Prize'];
                        const count = prize['数量'] || prize['count'] || prize['Count'] || 1;

                        if (name) {
                            const prizeItem = document.createElement('div');
                            prizeItem.className = 'prize-item';
                            prizeItem.innerHTML = `
                                <input type="text" placeholder="奖品名称" class="prize-name" value="${name}">
                                <input type="number" placeholder="数量" class="prize-count" min="1" value="${count}">
                                <button class="remove-prize">删除</button>
                            `;
                            prizesList.appendChild(prizeItem);

                            // 添加删除按钮事件
                            prizeItem.querySelector('.remove-prize').addEventListener('click', () => {
                                prizeItem.remove();
                            });
                        }
                    });
                }
            }

            if (this.people.length > 0) {
                this.setReadyText();
                alert(`成功导入${this.people.length}个人员信息${workbook.SheetNames.length > 1 ? '和奖品信息' : ''}`);
            }

        } catch (error) {
            this.people = []; // 确保失败时清空数组
            alert('导入失败：' + error.message);
            console.error('导入错误:', error);
        }
    }

    handleBackgroundUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            document.body.style.backgroundImage = `url(${e.target.result})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
        };
        reader.readAsDataURL(file);
    }

    saveSettings() {
        // 保存设置
        this.totalRounds = parseInt(this.roundCountInput.value) || 1;
        this.winnersCount = parseInt(this.winnersPerRoundInput.value) || 1;
        
        // 保存奖品信息
        this.prizes = [];
        document.querySelectorAll('.prize-item').forEach(item => {
            const name = item.querySelector('.prize-name').value;
            const count = parseInt(item.querySelector('.prize-count').value) || 1;
            if (name) {
                this.prizes.push({ name, count, remaining: count });
            }
        });

        // 重置所有抽奖状态
        this.winners.clear();  // 清空所有获奖记录
        this.roundStatus.clear();  // 清空所有轮次状态
        this.currentRound = 1;  // 重置当前轮次
        
        // 重置所有人员的中奖状态
        this.people.forEach(person => {
            person.hasWon = false;
        });

        // 更新显示
        this.settingsPanel.style.display = 'none';
        document.body.classList.remove('settings-open');
        this.setReadyText();
        this.updateDisplay();
        this.updateButtonStatus();
        
        // 保存状态
        this.saveToStorage();
    }

    toggleLottery() {
        if (this.isRunning) {
            this.stopLottery();
        } else {
            this.startLottery();
        }
    }

    startLottery() {
        // 检查当前轮次是否已抽奖
        if (this.roundStatus.get(this.currentRound)) {
            alert('本轮已经抽过奖了！');
            return;
        }

        // 检查人员名单
        if (!this.people || this.people.length === 0) {
            alert('请先导入人员名单！');
            return;
        }

        // 获取可抽奖的人员
        const availablePeople = this.people.filter(p => !p.hasWon);
        if (availablePeople.length === 0) {
            alert('所有人员都已中奖！');
            return;
        }

        // 检查剩余人数是否足够
        if (availablePeople.length < this.winnersCount) {
            alert(`剩余人数不足${this.winnersCount}人！`);
            return;
        }

        // 开始抽奖
        this.isRunning = true;
        this.startBtn.textContent = '停止';
        this.nameDisplay.classList.add('rolling');

        // 创建临时数组用于滚动显示
        let tempWinners = [];
        for (let i = 0; i < this.winnersCount; i++) {
            tempWinners.push({
                name: '',
                department: ''
            });
        }

        // 滚动效果
        this.timer = setInterval(() => {
            // 随机选择人员显示
            tempWinners = tempWinners.map(() => {
                const randomIndex = Math.floor(Math.random() * availablePeople.length);
                return availablePeople[randomIndex];
            });

            // 更新显示
            this.nameDisplay.innerHTML = `
                <div class="winners-container">
                    ${tempWinners.map(person => `
                        <div class="winner-item">
                            <div class="name">${person.name}</div>
                            <div class="department">${person.department}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }, 50);
    }

    stopLottery() {
        this.isRunning = false;
        this.startBtn.textContent = '开始抽奖';
        clearInterval(this.timer);
        this.nameDisplay.classList.remove('rolling');

        const availablePeople = this.people.filter(p => !p.hasWon);
        const winners = [];
        
        for (let i = 0; i < this.winnersCount && availablePeople.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availablePeople.length);
            const winner = availablePeople.splice(randomIndex, 1)[0];
            winner.hasWon = true;
            winners.push(winner);
        }

        // 使用新的布局显示获奖者
        this.nameDisplay.innerHTML = `
            <div class="winners-container">
                ${winners.map(winner => `
                    <div class="winner-item">
                        <div class="name">${winner.name}</div>
                        <div class="department">${winner.department}</div>
                    </div>
                `).join('')}
            </div>
        `;

        // 计算并应用卡片大小
        this.calculateCardSize();

        // 添加延迟显示动画效果
        const winnerItems = this.nameDisplay.querySelectorAll('.winner-item');
        winnerItems.forEach((item, index) => {
            item.style.animationDelay = `${index * 0.2}s`;
        });

        if (!this.winners.has(this.currentRound)) {
            this.winners.set(this.currentRound, []);
        }
        this.winners.get(this.currentRound).push(...winners);
        
        this.updateWinnerList();
        this.playWinSound();

        // 标记当前轮次已抽奖
        this.roundStatus.set(this.currentRound, true);
        
        // 更新所有按钮状态
        this.updateButtonStatus();
        
        // 保存状态
        this.saveToStorage();
    }

    // 添加中奖音效（可选）
    playWinSound() {
        const audio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAASAAAeMwAUFBQUFCIiIiIiIjAwMDAwPz8/Pz8/TU1NTU1NW1tbW1tbaGhoaGhoaHd3d3d3d4aGhoaGhpSUlJSUlKmpqampqbe3t7e3t8bGxsbGxtTU1NTU1OPj4+Pj4/H//////////wAAAABMYXZjNTguMTMAAAAAAAAAAAAAAAAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
        audio.play();
    }

    initializeWinnerList() {
        const winnerList = document.getElementById('winnerList');
        winnerList.innerHTML = `
            <div class="winner-list-header">
                <span>中奖名单</span>
                <div class="header-controls">
                    <span class="export-btn">导出</span>
                    <span class="toggle-icon">▼</span>
                </div>
            </div>
            <div class="winner-list-content"></div>
        `;

        // 添加点击展开/折叠功能
        const header = winnerList.querySelector('.winner-list-header');
        header.addEventListener('click', () => {
            winnerList.classList.toggle('expanded');
        });

        // 添加导出按钮事件监听
        const exportBtn = winnerList.querySelector('.export-btn');
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡，避免触发折叠面板
            this.exportWinnerList();
        });
    }

    updateWinnerList() {
        const content = document.querySelector('.winner-list-content');
        const allRounds = Array.from(this.winners.keys()).sort((a, b) => b - a); // 按轮次倒序排列
        
        content.innerHTML = allRounds.map(round => {
            const winners = this.winners.get(round);
            return `
                <div class="round-section">
                    <div class="round-header" onclick="this.parentElement.classList.toggle('expanded')">
                        <span>第${round}轮中奖名单</span>
                        <span class="toggle-icon">▼</span>
                    </div>
                    <div class="round-content">
                        ${winners.map(w => `
                            <div class="winner-item">
                                <div class="name">${w.name}</div>
                                <div class="department">${w.department}</div>
                                ${w.prize ? `<div class="prize">${w.prize}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // 自动展开当前轮次
        const currentRoundSection = content.querySelector(`.round-section:nth-child(${allRounds.length - this.currentRound + 1})`);
        if (currentRoundSection) {
            currentRoundSection.classList.add('expanded');
            // 3秒后自动收起
            setTimeout(() => {
                currentRoundSection.classList.remove('expanded');
            }, 3000);
        }
    }

    previousRound() {
        if (this.currentRound > 1) {
            this.currentRound--;
            this.updateDisplay();
            this.updateButtonStatus();
            
            if (this.roundStatus.get(this.currentRound)) {
                this.updateWinnerDisplay();
            } else {
                this.setReadyText();
            }
        }
    }

    nextRound() {
        if (this.currentRound < this.totalRounds) {
            this.currentRound++;
            this.updateDisplay();
            this.updateButtonStatus();
            
            if (this.roundStatus.get(this.currentRound)) {
                this.updateWinnerDisplay();
            } else {
                this.setReadyText();
            }
        }
    }

    updateButtonStatus() {
        // 检查当前轮次是否已抽奖
        const hasDrawn = this.roundStatus.get(this.currentRound);
        
        // 控制开始抽奖按钮
        this.startBtn.disabled = hasDrawn;
        this.startBtn.style.opacity = hasDrawn ? '0.5' : '1';
        this.startBtn.style.cursor = hasDrawn ? 'not-allowed' : 'pointer';

        // 控制抽取奖品按钮
        // 只有在已抽奖且有可用奖品的情况下才启用
        const currentWinners = this.winners.get(this.currentRound);
        const hasUndrawnWinners = currentWinners && currentWinners.some(w => !w.prize);
        const hasAvailablePrizes = this.prizes && this.prizes.some(p => p.remaining > 0);
        
        this.drawPrizeBtn.disabled = !(hasDrawn && hasUndrawnWinners && hasAvailablePrizes);
        this.drawPrizeBtn.style.opacity = this.drawPrizeBtn.disabled ? '0.5' : '1';
        this.drawPrizeBtn.style.cursor = this.drawPrizeBtn.disabled ? 'not-allowed' : 'pointer';
    }

    updateDisplay() {
        this.currentRoundDisplay.textContent = `第${this.currentRound}轮抽奖`;
        this.updateWinnerList();
        this.updateButtonStatus();
    }

    exportWinnerList() {
        // 创建导出数据
        let exportData = [];
        
        // 按轮次顺序导出
        const allRounds = Array.from(this.winners.keys()).sort((a, b) => a - b);
        
        allRounds.forEach(round => {
            const winners = this.winners.get(round);
            winners.forEach(winner => {
                exportData.push({
                    '轮次': `第${round}轮`,
                    '姓名': winner.name,
                    '部门': winner.department,
                    '奖品': winner.prize || '未抽取'  // 添加奖品列
                });
            });
        });

        if (exportData.length === 0) {
            alert('还没有中奖记录！');
            return;
        }

        // 创建工作簿
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        // 设置列宽
        const colWidths = [
            { wch: 8 },   // 轮次列宽
            { wch: 15 },  // 姓名列宽
            { wch: 20 },  // 部门列宽
            { wch: 30 }   // 奖品列宽，设置大一点以适应长奖品名称
        ];
        ws['!cols'] = colWidths;

        // 添加工作表到工作簿
        XLSX.utils.book_append_sheet(wb, ws, "中奖名单");

        // 生成文件并下载
        const fileName = `抽奖结果_${new Date().toLocaleDateString()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }

    calculateCardSize() {
        const container = document.querySelector('.winners-container');
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = window.innerHeight * 0.6; // 使用60%的视窗高度
        const count = this.winnersCount;

        // 计算最佳的行列数
        let cols = Math.ceil(Math.sqrt(count));
        let rows = Math.ceil(count / cols);

        // 确保行数不会太多
        while (rows > 3 && cols < count) {
            cols++;
            rows = Math.ceil(count / cols);
        }

        // 计算卡片大小
        const maxCardWidth = (containerWidth - (cols + 1) * 20) / cols; // 20px为间距
        const maxCardHeight = (containerHeight - (rows + 1) * 20) / rows;

        // 使用较小的值确保完全显示
        const cardSize = Math.min(maxCardWidth, maxCardHeight, 300); // 最大不超过300px

        // 计算字体大小
        const nameSize = Math.max(Math.min(cardSize / 4, 48), 24); // 最小24px，最大48px
        const deptSize = Math.max(Math.min(cardSize / 6, 24), 14); // 最小14px，最大24px
        const prizeSize = Math.max(Math.min(cardSize / 8, 16), 12); // 最小12px，最大16px

        // 应用样式
        const cards = document.querySelectorAll('.winner-item');
        cards.forEach(card => {
            card.style.width = `${cardSize}px`;
            card.style.height = `${cardSize}px`;
            card.querySelector('.name').style.fontSize = `${nameSize}px`;
            card.querySelector('.department').style.fontSize = `${deptSize}px`;
            
            // 为奖品设置字体大小
            const prizeElement = card.querySelector('.prize');
            if (prizeElement) {
                const prizeText = prizeElement.textContent;
                // 根据文本长度调整字体大小
                const adjustedSize = Math.max(prizeSize * (20 / Math.max(prizeText.length, 20)), 12);
                prizeElement.style.fontSize = `${adjustedSize}px`;
            }
        });
    }

    initializePrizeSettings() {
        const addPrizeBtn = document.getElementById('addPrize');
        addPrizeBtn.addEventListener('click', () => {
            const prizesList = document.querySelector('.prizes-list');
            const prizeItem = document.createElement('div');
            prizeItem.className = 'prize-item';
            prizeItem.innerHTML = `
                <input type="text" placeholder="奖品名称" class="prize-name">
                <input type="number" placeholder="数量" class="prize-count" min="1" value="1">
                <button class="remove-prize">删除</button>
            `;
            prizesList.appendChild(prizeItem);

            // 添加删除按钮事件
            prizeItem.querySelector('.remove-prize').addEventListener('click', () => {
                prizeItem.remove();
            });
        });
    }

    // 添加抽取所有奖品的方法
    drawAllPrizes() {
        const currentWinners = this.winners.get(this.currentRound);
        if (!currentWinners) return;

        // 检查是否有足够的奖品
        const availablePrizes = this.prizes.filter(p => p.remaining > 0);
        if (availablePrizes.length === 0) {
            alert('所有奖品已抽完！');
            return;
        }

        // 为每个未抽中奖品的获奖者抽取奖品
        currentWinners.forEach(winner => {
            if (!winner.prize) {
                const prize = this.drawPrizeForWinner();
                if (prize) {
                    winner.prize = prize;
                }
            }
        });

        // 更新显示
        this.updateWinnerDisplay();
        this.updateWinnerList();
        
        // 更新按钮状态
        this.updateButtonStatus();
        
        // 保存状态
        this.saveToStorage();
    }

    // 为单个获奖者抽取奖品
    drawPrizeForWinner() {
        const availablePrizes = this.prizes.filter(p => p.remaining > 0);
        if (availablePrizes.length === 0) return null;

        const prizeIndex = Math.floor(Math.random() * availablePrizes.length);
        const prize = availablePrizes[prizeIndex];
        prize.remaining--;
        return prize.name;
    }

    // 更新获奖者显示
    updateWinnerDisplay() {
        const winners = this.winners.get(this.currentRound);
        if (!winners) return;

        this.nameDisplay.innerHTML = `
            <div class="winners-container">
                ${winners.map(winner => `
                    <div class="winner-item">
                        <div class="name">${winner.name}</div>
                        <div class="department">${winner.department}</div>
                        ${winner.prize ? `<div class="prize">${winner.prize}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        // 重新计算卡片大小
        this.calculateCardSize();
    }

    // 添加设置准备文本的方法
    setReadyText() {
        this.nameDisplay.innerHTML = `
            <div class="winners-container">
                <div class="winner-item" style="animation: ready-pulse 2s infinite">
                    <div class="name" style="color: #ff4444; font-size: 48px;">准备开始抽奖</div>
                </div>
            </div>
        `;
    }

    // 添加保存到本地存储的方法
    saveToStorage() {
        const data = {
            people: this.people,
            winners: Array.from(this.winners.entries()),
            currentRound: this.currentRound,
            totalRounds: this.totalRounds,
            winnersCount: this.winnersCount,
            roundStatus: Array.from(this.roundStatus.entries()),
            prizes: this.prizes
        };
        localStorage.setItem('lotteryData', JSON.stringify(data));
    }

    // 添加从本地存储恢复的方法
    restoreFromStorage() {
        const savedData = localStorage.getItem('lotteryData');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.people = data.people;
                this.winners = new Map(data.winners);
                this.currentRound = data.currentRound;
                this.totalRounds = data.totalRounds;
                this.winnersCount = data.winnersCount;
                this.roundStatus = new Map(data.roundStatus);
                this.prizes = data.prizes;

                // 恢复显示
                this.updateDisplay();
                if (this.roundStatus.get(this.currentRound)) {
                    this.updateWinnerDisplay();
                } else {
                    this.setReadyText();
                }

                // 恢复设置面板的值
                this.roundCountInput.value = this.totalRounds;
                this.winnersPerRoundInput.value = this.winnersCount;

                // 恢复奖品列表
                const prizesList = document.querySelector('.prizes-list');
                prizesList.innerHTML = '';
                this.prizes.forEach(prize => {
                    const prizeItem = document.createElement('div');
                    prizeItem.className = 'prize-item';
                    prizeItem.innerHTML = `
                        <input type="text" placeholder="奖品名称" class="prize-name" value="${prize.name}">
                        <input type="number" placeholder="数量" class="prize-count" min="1" value="${prize.count}">
                        <button class="remove-prize">删除</button>
                    `;
                    prizesList.appendChild(prizeItem);

                    // 添加删除按钮事件
                    prizeItem.querySelector('.remove-prize').addEventListener('click', () => {
                        prizeItem.remove();
                    });
                });
            } catch (error) {
                console.error('恢复数据失败:', error);
                this.clearStorage();
            }
        }
    }

    // 添加清除存储的方法
    clearStorage() {
        if (confirm('确定要清除所有抽奖数据吗？此操作不可恢复！')) {
            localStorage.removeItem('lotteryData');
            location.reload(); // 刷新页面以重置所有状态
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LotterySystem();
}); 