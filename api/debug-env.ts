// api/debug-env.ts
// FILE TẠM THỜI DÙNG ĐỂ CHẨN ĐOÁN — XÓA FILE NÀY SAU KHI DÙNG XONG.
// Không trả về giá trị thật của key, chỉ trả về thông tin để xác nhận
// server có "nhìn thấy" biến môi trường hay không.

export default async function handler(req: any, res: any) {
  const key = process.env.GEMINI_API_KEY;

  res.status(200).json({
    hasGeminiApiKey: Boolean(key),
    keyLength: key ? key.length : 0,
    keyPrefix: key ? key.slice(0, 4) + "..." : null,
    vercelEnv: process.env.VERCEL_ENV || null, // "production" | "preview" | "development"
    nodeEnv: process.env.NODE_ENV || null,
    // Liệt kê TÊN các biến môi trường có chứa "GEMINI" hoặc "API" (không lộ giá trị)
    // để phát hiện lỗi đặt sai tên (ví dụ GEMINI_KEY thay vì GEMINI_API_KEY)
    relatedEnvVarNames: Object.keys(process.env).filter(
      (k) => k.includes("GEMINI") || k.includes("API")
    ),
  });
}
