// ⭐ 必須確保 index.html 中有 Chart.js 註釋外掛 CDN 才能使用功能 B ⭐

// 取得 DOM 元素
const form = document.getElementById('glucoseForm');
const tableBody = document.getElementById('recordTableBody');
const ctx = document.getElementById('glucoseChart').getContext('2d');
const aiButton = document.querySelector('button[onclick="getAIAdvice()"]'); // 取得 AI 按鈕

const chartStartDate = document.getElementById('chartStartDate');
const chartEndDate = document.getElementById('chartEndDate');
const applyChartFilterBtn = document.getElementById('applyChartFilter');
const resetChartFilterBtn = document.getElementById('resetChartFilter');
const chartStatusEl = document.getElementById('chartStatus');

let records = JSON.parse(localStorage.getItem('glucoseRecords')) || [];
let glucoseChart = null;

// 輔助函數：根據血糖值回傳 CSS class (功能 A)
function getStatusClass(glucose) {
    if (glucose > 140) return 'glucose-high';
    if (glucose < 70) return 'glucose-low';
    return 'glucose-normal';
}

// ======= 顯示表格 (整合功能 A：表格上色) =======
function displayRecords(list = records) {
    tableBody.innerHTML = "";

    list.forEach(r => {
        // ⭐ 新增: 根據血糖值判斷狀態 class ⭐
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
}


// ======= 更新折線圖 (整合功能 B：目標區間) =======
function updateChart(filteredList = null) {
    let dataToChart = [];
    let statusMessage = "";

    // 1. 選擇數據源
    if (filteredList && filteredList.length > 0) {
        // 方案 B: 使用自訂篩選的列表
        dataToChart = filteredList;
        const start = dataToChart[0].date;
        const end = dataToChart[dataToChart.length - 1].date;
        statusMessage = `目前顯示：${start} 至 ${end} 的 ${dataToChart.length} 筆紀錄。`;
    } else {
        // 方案 A: 預設使用所有紀錄 (用於計算最新 30 筆)
        dataToChart = records;

        if (records.length === 0) {
            statusMessage = "目前沒有血糖紀錄可供繪圖。";
        } else if (records.length <= 30) {
            statusMessage = `目前顯示：所有 ${records.length} 筆紀錄。`;
        } else {
            statusMessage = `目前顯示：最新 30 筆紀錄。`;
        }
    }


    // 2. ⭐ 排序：無論數據來自哪裡，都必須按時間排序 ⭐
    let sortedData = [...dataToChart].sort(
        (a, b) => new Date(a.date + " " + a.time) - new Date(b.date + " " + b.time)
    );

    // 3. 處理預設情況下的「只顯示最新 30 筆」
    if (!filteredList && records.length > 30) {
        // 如果是預設模式 (沒有傳入 filteredList 且資料超過 30 筆)，則只取最新的
        sortedData = sortedData.slice(-30);
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
            // ... (options 配置保持不變) ...
            responsive: true,
            scales: {
                y: {
                    suggestedMin: 50,
                    suggestedMax: 200
                }
            },
            // ⭐ 註釋外掛配置 (目標區間 70-140) 保持不變 ⭐
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

    if (!start || !end) {
        alert("請選擇開始和結束日期。");
        return;
    }
    
    // 篩選數據：日期必須在 [start, end] 之間
    const filtered = records.filter(r => r.date >= start && r.date <= end);
    
    if (filtered.length === 0) {
        alert("所選期間沒有資料。");
        updateChart([]); // 傳入空陣列來清空圖表
        return;
    }

    // 由於 updateChart 會重新排序，這裡直接傳遞篩選結果即可
    updateChart(filtered); 
});

// ⭐ 重設按鈕事件處理 (回到方案 A 的預設狀態) ⭐
resetChartFilterBtn.addEventListener('click', () => {
    // 清空篩選日期欄位
    chartStartDate.value = '';
    chartEndDate.value = '';
    // 呼叫 updateChart 不帶參數，恢復顯示最新 30 筆
    updateChart();
});

// ======= 表單送出 & 刪除 (保持不變) =======
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
        medication
    };

    records.push(newRecord);

    localStorage.setItem("glucoseRecords", JSON.stringify(records));

    displayRecords();
    updateChart();
    form.reset();
});

function deleteRecord(id) {
    if (!confirm("確定要刪除這筆紀錄嗎？")) return;

    records = records.filter(r => r.id !== id);
    localStorage.setItem("glucoseRecords", JSON.stringify(records));
    displayRecords();
    updateChart();
}


const filterSelect = document.getElementById("filterSelect");

filterSelect.addEventListener("change", () => {
    const value = filterSelect.value;

    let filtered = records;

    if (value === "high") {
        filtered = records.filter(r => r.glucose > 140);
    } else if (value === "normal") {
        filtered = records.filter(r => r.glucose >= 70 && r.glucose <= 140);
    } else if (value === "low") {
        filtered = records.filter(r => r.glucose < 70);
    }

    displayRecords(filtered);
});

// ======= AI 建議 (整合功能 G：藥物分析提示詞) =======
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


// 初始化畫面
displayRecords();
updateChart();
