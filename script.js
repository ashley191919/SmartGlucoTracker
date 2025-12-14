// ⭐ 必須確保 index.html 中有 Chart.js 註釋外掛 CDN 才能使用功能 B ⭐

// 取得 DOM 元素
const form = document.getElementById('glucoseForm');
const tableBody = document.getElementById('recordTableBody');
const ctx = document.getElementById('glucoseChart').getContext('2d');
const aiButton = document.querySelector('button[onclick="getAIAdvice()"]'); // 取得 AI 按鈕

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
function updateChart() {
    const sorted = [...records].sort(
        (a, b) => new Date(a.date + " " + a.time) - new Date(b.date + " " + b.time)
    );

    const labels = sorted.map(r => `${r.date} ${r.time}`);
    const data = sorted.map(r => r.glucose);

    // 每次先銷毀舊圖表，避免重疊
    if (glucoseChart) glucoseChart.destroy();

    glucoseChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "血糖值 (mg/dL)",
                data: data,
                borderColor: "rgb(0, 123, 255)", // 使用主題色
                borderWidth: 2,
                fill: false,
                tension: 0.2,

                // 高低血糖點顏色
                pointBackgroundColor: data.map(g => {
                    if (g < 70) return "var(--low-color)";    // 低血糖
                    if (g > 140) return "var(--high-color)";  // 高血糖
                    return "var(--normal-color)";              // 正常
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
            // ⭐ 新增: 註釋外掛配置 (目標區間 70-140) ⭐
            plugins: {
                annotation: {
                    annotations: {
                        normalRange: {
                            type: 'box',
                            yMin: 70,       // 正常範圍下限
                            yMax: 140,      // 正常範圍上限
                            backgroundColor: 'rgba(40, 167, 69, 0.15)', // 淺綠色背景
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
            let rawText = data.result;
            
            // 將 ** 和 * 替換成空字串
            // g 標記表示全域替換 (Global)
            rawText = rawText.replace(/\*\*/g, '').replace(/\*/g, '');
            
            resultArea.innerText = rawText; // 顯示已淨化的文字
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
