class LotterySystem {
    constructor() {
        this.people = [];
        this.winners = new Map(); // 存储每轮的获奖者
        this.currentRound = 1;
        this.totalRounds = 1;
        this.winnersPerRound = 1;
        this.isRunning = false;
        this.timer = null;
        this.roundStatus = new Map(); // 记录每轮抽奖状态
        
        this.initializeElements();
        this.bindEvents();
        this.initializeWinnerList();
    }

    initializeElements() {
        // 获取DOM元素
        this.settingsPanel = document.getElementById('settingsPanel');
        this.lotteryPanel = document.getElementById('lotteryPanel');
        this.fileInput = document.getElementById('fileInput');
        this.bgInput = document.getElementById('bgInput');
        this.roundCount = document.getElementById('roundCount');
        this.winnersPerRound = document.getElementById('winnersPerRound');
        this.nameDisplay = document.getElementById('nameDisplay');
        this.currentRoundDisplay = document.getElementById('currentRound');
        this.winnerList = document.getElementById('winnerList');
        
        // 按钮
        this.startBtn = document.getElementById('startBtn');
        this.prevRoundBtn = document.getElementById('prevRound');
        this.nextRoundBtn = document.getElementById('nextRound');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.saveSettingsBtn = document.getElementById('saveSettings');
    }

    bindEvents() {
        this.fileInput.addEventListener('change', this.handleFileUpload.bind(this));
        this.bgInput.addEventListener('change', this.handleBackgroundUpload.bind(this));
        this.startBtn.addEventListener('click', this.toggleLottery.bind(this));
        this.prevRoundBtn.addEventListener('click', this.previousRound.bind(this));
        this.nextRoundBtn.addEventListener('click', this.nextRound.bind(this));
        this.settingsBtn.addEventListener('click', () => this.settingsPanel.style.display = 'block');
        this.saveSettingsBtn.addEventListener('click', this.saveSettings.bind(this));
        
        // 添加空格键控制
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.toggleLottery();
            }
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                throw new Error('Excel文件中没有数据');
            }

            // 检查数据格式并尝试不同的列名
            this.people = jsonData.map(row => {
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

            if (this.people.length > 0) {
                console.log('导入的数据:', this.people);
                this.nameDisplay.textContent = '准备开始抽奖';
                alert(`成功导入${this.people.length}个人员信息`);
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
        this.totalRounds = parseInt(this.roundCount.value) || 1;
        this.winnersPerRound = parseInt(this.winnersPerRound.value) || 1;
        this.settingsPanel.style.display = 'none';
        
        // 重置所有轮次状态
        this.roundStatus.clear();
        this.winners.clear();
        this.currentRound = 1;
        
        this.updateDisplay();
        this.nameDisplay.textContent = '准备开始抽奖';
    }

    toggleLottery() {
        if (this.isRunning) {
            this.stopLottery();
        } else {
            this.startLottery();
        }
    }

    startLottery() {
        if (this.roundStatus.get(this.currentRound)) {
            alert('本轮已经抽过奖了！');
            return;
        }

        console.log('当前人员列表:', this.people);
        if (!this.people || this.people.length === 0) {
            alert('请先导入人员名单！');
            return;
        }

        const availablePeople = this.people.filter(p => !p.hasWon);
        if (availablePeople.length === 0) {
            alert('所有人员都已中奖！');
            return;
        }

        if (availablePeople.length < this.winnersPerRound) {
            alert(`剩余人数不足${this.winnersPerRound}人！`);
            return;
        }

        this.isRunning = true;
        this.startBtn.textContent = '停止';
        this.nameDisplay.classList.add('rolling');
        
        // 创建临时数组用于滚动显示
        let tempWinners = [];
        for (let i = 0; i < this.winnersPerRound; i++) {
            tempWinners.push({
                name: '',
                department: ''
            });
        }
        
        // 滚动效果同时显示多个位置
        this.timer = setInterval(() => {
            tempWinners = tempWinners.map(() => {
                const randomPerson = availablePeople[Math.floor(Math.random() * availablePeople.length)];
                return randomPerson;
            });

            // 显示所有位置的滚动
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
        
        for (let i = 0; i < this.winnersPerRound && availablePeople.length > 0; i++) {
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
        this.updateButtonStatus();
    }

    // 添加中奖音效（可选）
    playWinSound() {
        const audio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAASAAAeMwAUFBQUFCIiIiIiIjAwMDAwPz8/Pz8/TU1NTU1NW1tbW1tbaGhoaGhoaHd3d3d3d4aGhoaGhpSUlJSUlKmpqampqbe3t7e3t8bGxsbGxtTU1NTU1OPj4+Pj4/H//////////wAAAABMYXZjNTguMTMAAAAAAAAAAAAAAAAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
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
            
            // 如果这轮已经抽过奖，显示结果
            if (this.roundStatus.get(this.currentRound)) {
                const winners = this.winners.get(this.currentRound);
                if (winners) {
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
                }
            } else {
                // 如果没抽过奖，显示默认状态
                this.nameDisplay.textContent = '准备开始抽奖';
            }
        }
    }

    nextRound() {
        if (this.currentRound < this.totalRounds) {
            this.currentRound++;
            this.updateDisplay();
            this.updateButtonStatus();
            
            // 如果这轮已经抽过奖，显示结果
            if (this.roundStatus.get(this.currentRound)) {
                const winners = this.winners.get(this.currentRound);
                if (winners) {
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
                }
            } else {
                // 如果没抽过奖，显示默认状态
                this.nameDisplay.textContent = '准备开始抽奖';
            }
        }
    }

    updateButtonStatus() {
        // 如果当前轮次已抽奖，禁用开始按钮
        if (this.roundStatus.get(this.currentRound)) {
            this.startBtn.disabled = true;
            this.startBtn.style.opacity = '0.5';
            this.startBtn.style.cursor = 'not-allowed';
        } else {
            this.startBtn.disabled = false;
            this.startBtn.style.opacity = '1';
            this.startBtn.style.cursor = 'pointer';
        }
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
            { wch: 8 },  // 轮次列宽
            { wch: 15 }, // 姓名列宽
            { wch: 20 }, // 部门列宽
        ];
        ws['!cols'] = colWidths;

        // 添加工作表到工作簿
        XLSX.utils.book_append_sheet(wb, ws, "中奖名单");

        // 生成文件并下载
        const fileName = `抽奖结果_${new Date().toLocaleDateString()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LotterySystem();
}); 