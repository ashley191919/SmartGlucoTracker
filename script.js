// 取得 DOM 元素
const form = document.getElementById('glucoseForm');
const tableBody = document.getElementById('recordTableBody');
const ctx = document.getElementById('glucoseChart').getContext('2d');

let records = JSON.parse(localStorage.getItem('glucoseRecords')) || [];
let glucoseChart = null;

// ======= 顯示表格 =======
function displayRecords(list = records) {
    tableBody.innerHTML = "";

    list.forEach(r => {
        const row = `
        <tr>
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



// ======= 更新折線圖 =======
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
                borderColor: "rgb(75,192,192)",
                borderWidth: 2,
                fill: false,
                tension: 0.2,

                // 高低血糖點顏色
                pointBackgroundColor: data.map(g => {
                    if (g < 70) return "yellow";    // 低血糖
                    if (g > 140) return "red";     // 高血糖
                    return "green";               // 正常
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
            }
        }
    });
}

// ======= 表單送出 =======
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

    // 儲存到 localStorage
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
async function getAIAdvice() {
    const resultArea = document.getElementById("aiResult");

    if (records.length === 0) {
        resultArea.innerText = "尚無血糖資料可分析。";
        return;
    }

    // 取最近 5 筆資料
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
    `;

    const response = await fetch("https://glucose-tracker-api.onrender.com" + "/api/ai-advice", {
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
}


// 初始化畫面
displayRecords();
updateChart();
