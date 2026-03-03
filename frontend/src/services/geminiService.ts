
import { GoogleGenAI } from "@google/genai";

// API Key is now passed from the caller (loaded from Firebase Config)
export const askAssistant = async (question: string, context: string, apiKey?: string): Promise<string> => {
  if (!apiKey) {
      return "⚠️ Chưa cấu hình API Key. Vui lòng liên hệ Admin để cập nhật trong phần Cấu hình hệ thống.";
  }

  try {
    // Initializing Gemini client with provided API KEY
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // Sử dụng model 2.5 flash cho độ ổn định cao hơn khi model 3 preview gặp lỗi empty response
    const model = 'gemini-2.5-flash'; 

    const systemInstruction = `You are a smart AI assistant for a Fintech Wallet app named 365 Wallet.
    Functionality: USDT deposits (TRC20) & KHQR payments.
    Current Context: ${context}
    Reply concisely and helpfully in the user's language (Vietnamese, English, Chinese, or Khmer).
    If the user asks about something outside of banking/wallet/crypto, politely refuse.`;

    // Direct use of ai.models.generateContent with model and prompt
    const response = await ai.models.generateContent({
        model: model,
        contents: [{ parts: [{ text: question }] }],
        config: { 
            systemInstruction,
            temperature: 0.7,
            topP: 0.95,
            topK: 40
        }
    });

    // 1. Kiểm tra text trả về trực tiếp
    if (response.text) {
        return response.text;
    }

    // 2. Nếu không có text, kiểm tra lý do kết thúc (Safety, Recitation, etc.)
    const candidate = response.candidates?.[0];
    if (candidate) {
        if (candidate.finishReason === 'SAFETY') {
            return "⚠️ Câu trả lời bị chặn do vi phạm chính sách an toàn nội dung.";
        }
        if (candidate.finishReason === 'RECITATION') {
            return "⚠️ Câu trả lời bị chặn do vấn đề bản quyền hoặc trích dẫn.";
        }
        if (candidate.finishReason === 'OTHER') {
            return "⚠️ AI không thể xử lý yêu cầu này vào lúc này.";
        }
    }

    // 3. Fallback nếu vẫn không có nội dung
    throw new Error("Empty response from AI (No text generated)");

  } catch (error: any) {
    console.error("AI Service Error Details:", error);
    
    // Phân loại lỗi để hiển thị thông báo rõ ràng hơn cho người dùng
    if (error.status === 403 || error.message?.includes('API key')) {
        return "⛔ Lỗi xác thực: API Key không hợp lệ hoặc đã hết hạn. Vui lòng báo Admin kiểm tra.";
    }
    
    if (error.status === 404 || error.message?.includes('model')) {
        return "⛔ Lỗi Model: Phiên bản AI hiện tại không khả dụng. Vui lòng thử lại sau.";
    }

    if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
        return "📡 Lỗi kết nối mạng. Vui lòng kiểm tra đường truyền internet hoặc VPN của bạn.";
    }
    
    // Trả về lỗi cụ thể để debug
    return `⚠️ Sự cố xử lý: ${error.message || "Không thể kết nối đến máy chủ AI."}`;
  }
};
