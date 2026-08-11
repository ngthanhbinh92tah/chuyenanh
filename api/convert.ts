// api/convert.ts
// Vercel Serverless Function — chạy trên server, KHÔNG bao giờ được gửi tới trình duyệt.
// Đây là nơi duy nhất được phép đọc GEMINI_API_KEY.

import { GoogleGenAI } from "@google/genai";

// Lưu ý: nếu bạn dùng @vercel/node, có thể thay `any` bằng VercelRequest/VercelResponse
// để có type-safety đầy đủ: `npm i -D @vercel/node`
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const { images, includeSolution } = req.body as {
      images?: Array<{ base64: string; mimeType: string }>;
      includeSolution?: boolean;
    };

    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: "Vui lòng gửi ít nhất một ảnh." });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Đây là lỗi cấu hình server, không phải lỗi của người dùng
      console.error("Missing GEMINI_API_KEY environment variable on the server.");
      res.status(500).json({ error: "Server chưa được cấu hình API key. Vui lòng liên hệ quản trị viên." });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    const solutionInstructionMCQ = includeSolution
      ? `\\loigiai{Nội dung đáp án}
\\end{ex}
*   **Rules:**
    *   Replace "Nội dung câu hỏi" with the question text.
    *   For each choice, extract only the answer text. **Crucially, you must remove any leading labels like "A.", "B.", "C.", or "D." from the text.**
    *   **Ensure there is no period (.) at the very end of each choice's content.**
    *   Replace "Nội dung đáp án" in \\loigiai with the solution or explanation. If no solution is provided, determine the correct answer and provide a brief explanation.`
      : `\\end{ex}
*   **Rules:**
    *   Replace "Nội dung câu hỏi" with the question text.
    *   For each choice, extract only the answer text. **Crucially, you must remove any leading labels like "A.", "B.", "C.", or "D." from the text.**
    *   **Ensure there is no period (.) at the very end of each choice's content.**
    *   **DO NOT include the \\loigiai{} block in your output.**`;

    const solutionInstructionFRQ = includeSolution
      ? `\\loigiai{Nội dung lời giải}
\\end{ex}
*   **Rules:**
    *   Replace "Nội dung câu hỏi" with the question text.
    *   Generate a correct and detailed solution for the question and place it inside the \\loigiai{} block, replacing "Nội dung lời giải".`
      : `\\end{ex}
*   **Rules:**
    *   Replace "Nội dung câu hỏi" with the question text.
    *   **DO NOT include the \\loigiai{} block in your output.**`;

    const prompt = `You are an expert in mathematical OCR and LaTeX formatting. Your task is to analyze the provided image(s) and convert their content into LaTeX code based on its type. If multiple images are provided, treat them as consecutive parts of the same document or question set unless they are clearly distinct.

**General Formatting Rules:**
*   When generating fractions, you MUST use the \\dfrac command instead of \\frac to ensure they are always in display style.
*   For any kind of list or enumeration (liệt kê), you MUST NOT use the \\begin{enumerate} or \\begin{itemize} environments. Use plain text with manual numbering (e.g., "1. First item", "a) First item") and line breaks instead.
*   To represent an angle, such as angle ABC, you MUST use the \\widehat{ABC} command.

**Content-Specific Formatting Rules:**

**1. For Multiple-Choice Questions (câu hỏi trắc nghiệm):**
If the image contains a question with multiple choices (e.g., A, B, C, D), you MUST format it using this specific LaTeX structure:
\\begin{ex}
	Nội dung câu hỏi
	\\choice
	{Nội dung đáp án thứ nhất}
	{Nội dung đáp án thứ hai}
	{Nội dung đáp án thứ ba}
	{Nội dung đáp án thứ tư}
${solutionInstructionMCQ}

**2. For Free-Response Questions (câu hỏi tự luận):**
If the image contains a question that does not have multiple choices and expects a written answer, you MUST format it using this structure:
\\begin{ex}
	Nội dung câu hỏi
${solutionInstructionFRQ}

**3. For Other Content:**
If the image does NOT fit the above categories (e.g., it only contains a standalone formula, a diagram, or a block of text), then convert all mathematical formulas and text into a single, accurate block of raw LaTeX code. Do not wrap it in \\begin{ex}...\\end{ex}.

**Final Output Requirement:** For ALL cases, your final output must ONLY be the raw LaTeX code. Do not include any explanatory text before or after the code, and do not wrap it in markdown code fences like \`\`\`latex.
**Crucial:** Generate original LaTeX code based on the image content. Do not attempt to reproduce any text verbatim if it appears to be copyrighted or from a known source. Focus on the mathematical structure and content.`;

    const imageParts = images.map((img) => ({
      inlineData: {
        data: img.base64,
        mimeType: img.mimeType,
      },
    }));

    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [...imageParts, textPart] },
      config: { temperature: 0.1 },
    });

    const resultText = response.text;

    if (!resultText) {
      const finishReason = response.candidates?.[0]?.finishReason;
      res.status(502).json({ error: `Gemini trả về phản hồi rỗng. Finish reason: ${finishReason}` });
      return;
    }

    const cleanedText = resultText.replace(/^```latex\n?/, "").replace(/```$/, "").trim();

    res.status(200).json({ latex: cleanedText });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    const message =
      error instanceof Error ? error.message : "Lỗi không xác định khi gọi Gemini API.";
    res.status(500).json({ error: message });
  }
}

// Lưu ý về giới hạn dung lượng: Vercel Serverless Functions (gói Hobby) giới hạn
// request body ~4.5MB. Nếu người dùng paste nhiều ảnh lớn cùng lúc, có thể vượt
// giới hạn này và request sẽ bị từ chối trước khi tới được đoạn code trên.
// Cân nhắc resize/nén ảnh phía client trước khi gửi nếu gặp vấn đề này.
