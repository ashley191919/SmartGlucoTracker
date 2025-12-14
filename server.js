// server.js 檔案內容（優化版本）

import express from "express";
import fetch from "node-fetch"; 
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ⭐ 1. 啟用 CORS 並允許所有來源 ⭐
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ⭐ 2. 顯式處理 CORS 預檢請求 (OPTIONS) ⭐
// 這有助於消除一些 400/CORS 相關的錯誤
app.options("*", cors()); 

// 設置連接埠
const PORT = process.env.PORT || 3000;

app.post("/api/ai-advice", async (req, res) => {
    const { prompt } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    // 檢查金鑰是否有效 (雖然 400 錯誤不是金鑰問題，但這是一個好的檢查)
    if (!GEMINI_KEY) {
        return res.status(500).json({ error: "Gemini API 金鑰未設定，請檢查 Render 環境變數。" });
    }
    if (!prompt) {
        // 確保 prompt 不為空，否則會導致 400 錯誤
        return res.status(400).json({ error: "請求參數錯誤：缺少 prompt。" });
    }

    try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                maxOutputTokens: 2048, 
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                ],
            }
        };

        const response = await fetch(geminiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            // ⭐ 增加錯誤紀錄，幫助分析 Render 日誌 ⭐
            console.error("Gemini API Error Response:", response.status, data.error?.message); 

            return res.status(response.status).json({
                error: data.error?.message || `Gemini API 請求失敗，狀態碼: ${response.status}`
            });
        }
        
        const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textResult) {
             return res.status(500).json({ error: "AI 回應格式錯誤或內容空白。" });
        }
        
        res.json({ result: textResult });

    } catch (error) {
        console.error("Server Error (Catch Block):", error);
        res.status(500).json({ error: "後端服務內部錯誤或網路連線失敗" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
