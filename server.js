// server.js 檔案內容（使用 Gemini SDK 的最終版本）

import express from "express";
// ❗ 移除 import fetch from "node-fetch"; 
import cors from "cors";
import dotenv from "dotenv";
// ⭐ 引入 Gemini SDK ⭐
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// 顯式處理 CORS 預檢請求
app.options("*", cors()); 

// ⭐ 初始化 Gemini 客戶端 ⭐
// SDK 會自動從 process.env.GEMINI_API_KEY 讀取金鑰，不需要手動傳遞
const ai = new GoogleGenAI({});

const PORT = process.env.PORT || 3000;

app.post("/api/ai-advice", async (req, res) => {
    const { prompt } = req.body;

    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "Gemini API 金鑰未設定。" });
        }
        if (!prompt) {
            return res.status(400).json({ error: "請求參數錯誤：缺少 prompt。" });
        }
        
        // ⭐ 使用 SDK 呼叫 generateContent ⭐
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            // SDK 接受字串 prompt，會自動轉換成正確的 contents 格式
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                maxOutputTokens: 2048, 
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                ],
            },
        });

        // SDK 的回應格式更簡潔
        const textResult = response.text;
        
        if (!textResult) {
             return res.status(500).json({ error: "AI 回應格式錯誤或內容空白。" });
        }
        
        res.json({ result: textResult });

    } catch (error) {
        console.error("Server Error (SDK Catch Block):", error.message);
        
        // 處理 SDK 拋出的錯誤，其中通常包含 400 錯誤的詳細資訊
        if (error.message.includes("400") || error.message.includes("403")) {
            return res.status(400).json({ 
                error: `請求或權限錯誤：${error.message}` 
            });
        }
        
        res.status(500).json({ error: "後端服務內部錯誤或網路連線失敗" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
