// ⭐ 必須確保 index.html 中有 Chart.js 註釋外掛 CDN 才能使用功能 B ⭐

// ======= 取得 DOM 元素 (統一放在開頭) =======
const form = document.getElementById('glucoseForm');
const tableBody = document.getElementById('recordTableBody');
// ⚠️ 檢查: 確保 index.html 中 canvas ID 正確
const ctx = document.getElementById('glucoseChart').getContext('2d'); 
const aiButton = document.querySelector('button[onclick="getAIAdvice()"]');

const chartStartDate = document.getElementById('chartStartDate');
const chartEndDate = document.getElementById('chartEndDate');
const applyChartFilterBtn = document.getElementById('applyChartFilter');
const resetChartFilterBtn = document.getElementById('resetChartFilter');
const chartStatusEl = document.getElementById('chartStatus');

// ⭐ 數據摘要元素必須在這裡獲取 ⭐
const avgGlucoseEl = document.getElementById('avgGlucose');
const tirPercentEl = document.getElementById('tirPercent');
const tarPercentEl = document.getElementById('tarPercent');

let records = JSON.parse(localStorage.getItem('glucoseRecords')) || [];
let glucoseChart = null;

let currentPage = 1; // 當前小分頁 (10 筆)
const recordsPerPage = 10;
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfoSpan = document.getElementById('pageInfo');
const filterSelect = document.getElementById("filterSelect");


// 輔助函數：根據血糖值回傳 CSS class (功能 A)
function getStatusClass(glucose) {
    if (glucose > 140) return 'glucose-high';
    if (glucose < 70) return 'glucose-low';
    return 'normal-color'; // 這裡應該返回 CSS class 名稱
}

// ======= 顯示表格 (整合功能 A：表格上色 + 分頁/排序/月份提示) =======
function displayRecords(list = records) {
    tableBody.innerHTML = "";

    // 1. 排序
    const sortedList = [...list].sort(
        (a, b) => new Date(b.date + " " + b.time) - new Date(a.date + " " + a.time)
    );

    // 2. 計算分頁資訊
    const totalRecords = sortedList.length;
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    } else if (totalPages === 0) {
        currentPage = 0;
    }

    // 3. 取得當前頁面的資料
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    const currentRecords = sortedList.slice(startIndex, endIndex);

    // 4. 渲染表格
    let lastMonth = ""; 

    currentRecords.forEach(r => {
        const currentMonth = r.date.substring(0, 7); 
        if (currentMonth !== lastMonth) {
            const monthRow = `
                <tr>
                    <td colspan="5" style="background-color: var(--low-bg); font-weight: bold; text-align: center; color: var(--text-color); border-bottom: none;">
                        --- ${currentMonth} 月份紀錄 ---
                    </td>
                </tr>
            `;
            tableBody.innerHTML += monthRow;
            lastMonth = currentMonth;
        }

        const statusClass = getStatusClass(r.glucose); 
        
        const row = `
        <tr class="${statusClass}"> 
            <td>${r.date}</td>
            <td>${r.time}</td>
            <td>${r.glucose}</td>
            <td class="${r.medication ? 'med-yes' : 'med-no'}">
                ${r.medication ? "✔ 有" : "✘ 無"}
            </td>
            <td>
                <button onclick="deleteRecord(${r.id})">刪除</button>
            </td>
        </tr>
        `;
        tableBody.innerHTML += row;
    });

    if (totalRecords === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">尚無血糖紀錄</td></tr>';
    }

    // 5. 更新分頁控制項狀態
    pageInfoSpan.innerText = `頁次: ${currentPage} / ${totalPages || 1}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        displayRecords(getFilteredRecords()); 
    }
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(records.length / recordsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayRecords(getFilteredRecords()); 
    }
});

// 輔助函數：根據 filterSelect 的值返回過濾後的 records 
function getFilteredRecords() {
    const value = filterSelect.value;
    let filtered = records;

    if (value === "high") {
        filtered = records.filter(r => r.glucose > 140);
    } else if (value === "normal") {
        filtered = records.filter(r => r.glucose >= 70 && r.glucose <= 140);
    } else if (value === "low") {
        filtered = records.filter(r => r.glucose < 70);
    }
    return filtered;
}

// ======= 更新折線圖 (整合功能 B：目標區間) =======
function updateChart(filteredList = null) {
    let dataToChart = [];
    let statusMessage = "";

    // 1. 選擇數據源
    if (filteredList && filteredList.length > 0) {
        // 方案 B: 使用自訂篩選的列表 (日期篩選)
        dataToChart = filteredList;
        const start = dataToChart[0].date;
        const end = dataToChart[dataToChart.length - 1].date;
        statusMessage = `目前顯示：${start} 至 ${end} 的 ${dataToChart.length} 筆紀錄。`;
    } else {
        // 方案 A: 預設使用所有紀錄 (用於計算最新 15 筆)
        dataToChart = records;

        if (records.length === 0) {
            statusMessage = "目前沒有血糖紀錄可供繪圖。";
        } else if (records.length <= 15) { 
            statusMessage = `目前顯示：所有 ${records.length} 筆紀錄。`;
        } else {
            statusMessage = `目前顯示：最新 15 筆紀錄。`; 
        }
    }


    // 2. ⭐ 排序：無論數據來自哪裡，都必須按時間排序 ⭐
    let sortedData = [...dataToChart].sort(
        (a, b) => new Date(a.date + " " + a.time) - new Date(b.date + " " + b.time)
    );

    // 3. 處理預設情況下的「只顯示最新 15 筆」
    if (!filteredList && records.length > 15) {
        sortedData = sortedData.slice(-15);
    }


    // 4. 如果沒有資料，直接清空圖表
    if (sortedData.length === 0) {
        if (glucoseChart) glucoseChart.destroy();
        glucoseChart = null; 
        chartStatusEl.innerText = statusMessage;
        return;
    }
    
    // 5. 準備 Chart.js 資料
    const labels = sortedData.map(r => `${r.date} ${r.time}`);
    const data = sortedData.map(r => r.glucose);
    chartStatusEl.innerText = statusMessage; // 更新提示訊息

    // 每次先銷毀舊圖表，避免重疊
    if (glucoseChart) glucoseChart.destroy();

    glucoseChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "血糖值 (mg/dL)",
                data: data,
                borderColor: "rgb(0, 123, 255)", 
                borderWidth: 2,
                fill: false,
                tension: 0.2,

                pointBackgroundColor: data.map(g => {
                    if (g < 70) return "var(--low-color)";    // 低血糖
                    if (g > 140) return "var(--high-color)";  // 高血糖
                    return "var(--normal-color)";              // 正常
                })
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    suggestedMin: 50,
                    suggestedMax: 200
                }
            },
            // 註釋外掛配置 (目標區間 70-140) 保持不變
            plugins: {
                annotation: {
                    annotations: {
                        normalRange: {
                            type: 'box',
                            yMin: 70,       
                            yMax: 140,      
                            backgroundColor: 'rgba(40, 167, 69, 0.15)', 
                            borderColor: 'rgba(0, 0, 0, 0)',
                            borderWidth: 0,
                            drawTime: 'beforeDatasetsDraw',
                        },
                        highLine: {
                            type: 'line',
                            yMin: 140,
                            yMax: 140,
                            borderColor: 'var(--high-color)',
                            borderWidth: 1,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: '高血糖臨界值',
                                position: 'end'
                            }
                        }
                    }
                }
            }
        }
    });
}

applyChartFilterBtn.addEventListener('click', () => {
    const start = chartStartDate.value;
    const end = chartEndDate.value;
    // 移除了：const category = chartCategoryFilter.value;

    if (!start || !end) {
        alert("請選擇開始和結束日期。");
        return;
    }
    
    // 篩選數據：僅根據日期
    const filtered = records.filter(r => r.date >= start && r.date <= end);
    
    if (filtered.length === 0) {
        alert("所選期間沒有資料。");
        updateChart([]); 
        return;
    }

    updateChart(filtered); 
});

// 重設按鈕事件處理
resetChartFilterBtn.addEventListener('click', () => {
    chartStartDate.value = '';
    chartEndDate.value = '';
    // 移除了：chartCategoryFilter.value = 'all';
    updateChart();
});

// ======= 表單送出 & 刪除 =======
form.addEventListener("submit", e => {
    e.preventDefault();

    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;
    const glucose = Number(document.getElementById("glucose").value);
    const medication = document.getElementById("medication").checked;

    const newRecord = {
        id: Date.now(),
        date,
        time,
        glucose,
        medication,
    };

    records.push(newRecord);

    localStorage.setItem("glucoseRecords", JSON.stringify(records));

    currentPage = 1; 
    // 使用 getFilteredRecords() 確保新增紀錄後列表顯示符合當前篩選條件的第一頁
    displayRecords(getFilteredRecords()); 
    updateChart();
    updateSummaryStats();
    form.reset();
});

function deleteRecord(id) {
    if (!confirm("確定要刪除這筆紀錄嗎？")) return;

    records = records.filter(r => r.id !== id);
    localStorage.setItem("glucoseRecords", JSON.stringify(records));
    
    displayRecords(getFilteredRecords());
    updateChart();
    updateSummaryStats();
}


filterSelect.addEventListener("change", () => {
    currentPage = 1; 
    displayRecords(getFilteredRecords());
});

// ======= AI 建議 (保持不變) =======
async function getAIAdvice() {
    const resultArea = document.getElementById("aiResult");

    if (records.length === 0) {
        resultArea.innerText = "尚無血糖資料可分析。";
        return;
    }

    aiButton.disabled = true; // 禁用按鈕
    aiButton.innerText = "生成中..."; // 更改按鈕文字

    const recent = records.slice(-5);
    const oldestDate = recent[0].date;
    const newestDate = recent[recent.length - 1].date;
    
    let recordText = recent.map(r =>
        `日期 ${r.date} 時間 ${r.time} 血糖 ${r.glucose} mg/dL，是否服藥：${r.medication ? "有" : "無"}`
    ).join("\n");

    const prompt = `
    你是一位健康照護助理，請根據以下血糖紀錄提供簡單、非醫療診斷的生活建議，語氣溫和、給一般使用者閱讀：

    ${recordText}

    請特別分析：
    1. 血糖值與服藥之間的關聯和趨勢 (例如：服藥後數值是否穩定下降)。
    2. 針對高/低血糖狀況提供生活建議。
    
    請將建議限制在 3 點清單，每點不超過兩句話。
    `; // 已是最終的 G 功能提示詞

    try {
        // ⭐ 使用您的 Render 後端 URL ⭐
        const response = await fetch("https://glucose-tracker-api.onrender.com/api/ai-advice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });
        
        if (!response.ok) {
            resultArea.innerText = `AI 服務錯誤：HTTP 狀態碼 ${response.status}。`;
            return;
        }
        
        const data = await response.json();
        
        if (data.error) {
            resultArea.innerText = `AI 服務錯誤：${data.error}`;
        } else {
            resultArea.innerText = data.result;
        }
        
    } catch (error) {
        resultArea.innerText = "無法連線到 AI 服務。請檢查網路或後端伺服器 (Render) 狀態。";
    } finally {
        aiButton.innerText = "產生 AI 建議";
        aiButton.disabled = false; // 重新啟用按鈕
    }
}
// ======= 數據統計函數 (放置在 updateChart 之後，以確保 DOM 元素已載入) =======
function updateSummaryStats(list = records) {
    if (list.length === 0) {
        // 檢查 avgGlucoseEl 是否為 null，如果為 null，表示元素未載入，跳出
        if (!avgGlucoseEl) return; 
        
        avgGlucoseEl.innerText = '--';
        tirPercentEl.innerText = '--';
        tarPercentEl.innerText = '--';
        return;
    }

    const totalCount = list.length;
    let totalGlucose = 0;
    let tirCount = 0; // Time In Range (70-140)
    let tarCount = 0; // Time Above Range (>140)
    
    list.forEach(r => {
        totalGlucose += r.glucose;
        if (r.glucose >= 70 && r.glucose <= 140) {
            tirCount++;
        } else if (r.glucose > 140) {
            tarCount++;
        }
    });

    const avg = (totalGlucose / totalCount).toFixed(1);
    const tirPercent = ((tirCount / totalCount) * 100).toFixed(0);
    const tarPercent = ((tarCount / totalCount) * 100).toFixed(0);
    
    // 設置結果
    avgGlucoseEl.innerText = `${avg} mg/dL`;
    tirPercentEl.innerText = `${tirPercent}%`;
    tarPercentEl.innerText = `${tarPercent}%`;

    // 根據 TIR 百分比給予顏色提示 (紅綠燈效果)
    if (parseFloat(tirPercent) < 50) {
        tirPercentEl.style.color = 'var(--high-color)'; // 紅色，表示 TIR 很差
    } else if (parseFloat(tirPercent) < 70) {
        tirPercentEl.style.color = '#ffc107'; // 黃色，表示中等
    } else {
        tirPercentEl.style.color = 'var(--normal-color)'; // 綠色，表示達標
    }
}

// 初始化畫面
displayRecords();
updateChart();
updateSummaryStats();
