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

// ⭐ 初始化 Gemini 客戶端 ⭐
// SDK 會自動從 process.env.GEMINI_API_KEY 讀取金鑰，不需要手動傳遞
const ai = new GoogleGenAI({});

app.post("/api/ai-advice", async (req, res) => {
    const { prompt } = req.body;

    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "Gemini API 金鑰未設定，請檢查 .env 檔案。" });
        }
        
        // ⭐ 使用 SDK 呼叫 generateContent ⭐
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt, // SDK 接受字串 prompt
            config: {
                maxOutputTokens: 2048, 
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_NONE",
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_NONE",
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_NONE",
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_NONE",
                    },
                ],
            },
        });

        // SDK 的回應格式更簡潔
        const textResult = response.text;
        
        if (!textResult) {
            // 如果 API 回應空內容，通常是因為安全設定或內容過短
            return res.status(500).json({ 
                error: "AI 模型未能產生有效的建議，請嘗試輸入更多血糖紀錄。" 
            });
        }
        
        res.json({ result: textResult });

    } catch (error) {
        // SDK 捕捉到的錯誤通常包含詳細資訊
        console.error("Server Error:", error.message); 
        
        // 檢查是否為 400 錯誤（例如 API 拒絕內容）
        if (error.message.includes("400")) {
            return res.status(400).json({ 
                error: `請求格式或內容錯誤：${error.message}` 
            });
        }

        res.status(500).json({ error: "後端服務內部錯誤或網路連線失敗" });
    }
});

const PORT = process.env.PORT || 3000; // 使用雲端提供的 PORT，否則使用 3000
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
