// services/geminiService.ts
// File này chạy TRONG TRÌNH DUYỆT — vì vậy tuyệt đối không import "@google/genai"
// hay đọc API key ở đây nữa. Toàn bộ việc đó đã chuyển sang api/convert.ts (server).

export async function convertImagesToLatex(
  images: Array<{ base64: string; mimeType: string }>,
  includeSolution: boolean
): Promise<string> {
  try {
    const response = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images, includeSolution }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error || `Yêu cầu thất bại với mã lỗi ${response.status}.`);
    }

    if (!data?.latex) {
      throw new Error("Server không trả về nội dung LaTeX hợp lệ.");
    }

    return data.latex as string;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Conversion failed: ${error.message}`);
    }
    throw new Error("An unknown error occurred while communicating with the server.");
  }
}

// Ghi chú: tham số `customApiKey` của phiên bản cũ đã được loại bỏ vì App.tsx
// chưa từng có UI (Settings/gear icon) để người dùng nhập key riêng — tính năng
// đó là code chết, gây thông báo lỗi gây hiểu lầm. Nếu sau này bạn muốn hỗ trợ
// người dùng tự nhập key của họ, hãy thêm UI tương ứng trong App.tsx VÀ truyền
// key đó trong body của fetch ở trên, đồng thời cho phép api/convert.ts ưu tiên
// dùng key từ request thay vì process.env.GEMINI_API_KEY.
