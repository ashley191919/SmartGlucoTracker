// server.js 檔案內容（請用這個替換您 Render 上的 server.js 內容）

import express from "express";
import fetch from "node-fetch"; // 確保您有 node-fetch
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// 設置連接埠
const PORT = process.env.PORT || 3000;

app.post("/api/ai-advice", async (req, res) => {
    // 從前端取得 prompt
    const { prompt } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_KEY) {
        // 如果金鑰未載入，發送 500 錯誤
        return res.status(500).json({ error: "Gemini API 金鑰未設定，請檢查環境變數。" });
    }

    try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                maxOutputTokens: 2048, // 確保輸出長度夠長
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
            // 處理 API 錯誤 (例如 400, 429)
            return res.status(response.status).json({
                error: data.error?.message || "Gemini API 請求失敗，請檢查金鑰或用量。"
            });
        }
        
        // 提取 Gemini 的回應文字
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
