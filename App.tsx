
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { convertImagesToLatex } from './services/geminiService';
import { IconPhoto, IconClipboard, IconClipboardCheck, IconDownload, IconWand, IconLoader, IconFilePlus } from './components/Icons';

interface PastedImage {
  id: string;
  src: string;
  mime: string;
}

const App: React.FC = () => {
  const [images, setImages] = useState<PastedImage[]>([]);
  const [latexCode, setLatexCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [includeSolution, setIncludeSolution] = useState<boolean>(true);
  const [autoConvert, setAutoConvert] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const performConversion = useCallback(async (imgsToConvert: PastedImage[]) => {
    if (imgsToConvert.length === 0) return;
    setIsLoading(true);
    setLatexCode('');
    setError('');

    try {
      const base64Images = imgsToConvert.map(img => {
        const base64Data = img.src.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid image data format.');
        }
        return { base64: base64Data, mimeType: img.mime };
      });
      const result = await convertImagesToLatex(base64Images, includeSolution);
      setLatexCode(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Conversion failed: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [includeSolution]);

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    let hasNewImages = false;
    const newImages: PastedImage[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            const newImage = { src: result, mime: file.type, id: crypto.randomUUID() };
            newImages.push(newImage);
            setImages(prev => [...prev, newImage]);
            hasNewImages = true;
            setError('');
          };
          reader.readAsDataURL(file);
        }
      }
    }
    
    // We only trigger auto-convert on the next tick if the state is about to update, 
    // but reading is async, so this is handled slightly differently.
    // For simplicity, autoConvert with multiple images should probably be triggered 
    // when images change, but we'll leave it as a manual step or let the user click convert to be safe.
  }, []);

  useEffect(() => {
    const pasteTarget = document.documentElement;
    const handlePasteEvent = (e: Event) => handlePaste(e as ClipboardEvent);
    pasteTarget.addEventListener('paste', handlePasteEvent);
    return () => {
      pasteTarget.removeEventListener('paste', handlePasteEvent);
    };
  }, [handlePaste]);

  const handleConversion = async () => {
    if (images.length === 0) {
      setError('Please add at least one image first.');
      return;
    }
    await performConversion(images);
  };
  
  const handleCopy = () => {
    if (!latexCode) return;
    navigator.clipboard.writeText(latexCode).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleSave = () => {
    if (!latexCode) return;
    const blob = new Blob([latexCode], { type: 'application/x-tex' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.tex';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleAppendClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !latexCode) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const existingContent = e.target?.result as string;
        const newContent = existingContent.trimEnd() + '\n\n% --- Appended by Image2TeX ---\n\n' + latexCode;

        const blob = new Blob([newContent], { type: 'application/x-tex' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    reader.onerror = () => {
        setError(`Failed to read file: ${reader.error?.message || 'Unknown error'}`);
    };
    reader.readAsText(file);

    if (event.target) {
        event.target.value = '';
    }
  };

  const handleImageFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      Array.from(files).forEach(file => {
          if (file.type.indexOf('image') !== -1) {
              const reader = new FileReader();
              reader.onload = (e) => {
                  const result = e.target?.result as string;
                  setImages(prev => [...prev, { src: result, mime: file.type, id: crypto.randomUUID() }]);
                  setError('');
              };
              reader.readAsDataURL(file);
          }
      });
      
      if (event.target) {
          event.target.value = '';
      }
  };

  const handleReset = () => {
    setImages([]);
    setLatexCode('');
    setError('');
    setIsLoading(false);
  };

  const handeRemoveImage = (id: string) => {
      setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleLatexChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLatexCode(e.target.value);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
          Image2TeX
        </h1>
        <p className="text-slate-400 mt-2 text-lg">
          Paste or select images with math and convert them to LaTeX instantly.
        </p>
      </header>
      
      <main className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Image Input */}
        <div className="flex flex-col gap-4">
          <div 
            className={`relative w-full aspect-video rounded-lg border-2 border-dashed border-slate-600 flex flex-col items-center justify-center transition-all duration-300 ease-in-out bg-slate-800/50 overflow-hidden ${images.length === 0 ? 'hover:border-sky-500 hover:bg-slate-800 cursor-pointer' : ''}`}
            onClick={() => { if (images.length === 0) imageInputRef.current?.click(); }}
          >
            {images.length > 0 ? (
               <div className="absolute inset-0 p-2 overflow-y-auto w-full">
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {images.map(img => (
                        <div key={img.id} className="relative group rounded-md border border-slate-700 overflow-hidden bg-slate-900">
                           <img src={img.src} alt="Pasted content" className="object-contain w-full h-24" />
                           <button 
                              onClick={(e) => { e.stopPropagation(); handeRemoveImage(img.id); }} 
                              className="absolute top-1 right-1 bg-slate-900/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                              aria-label="Remove image"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                          </button>
                        </div>
                    ))}
                 </div>
               </div>
            ) : (
              <div className="text-center text-slate-400 p-4">
                <IconPhoto className="mx-auto h-16 w-16" />
                <p className="mt-2 font-semibold text-lg">Click or Paste Images Here</p>
                <p className="text-sm">Use Ctrl+V or select multiple files.</p>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
             <button
               onClick={() => imageInputRef.current?.click()}
               className="flex-1 flex items-center justify-center gap-2 bg-slate-700 text-white font-medium py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors"
             >
                <IconPhoto className="h-5 w-5" /> Add Images
             </button>
             {images.length > 0 && (
                <button
                 onClick={handleReset}
                 className="flex-none flex items-center justify-center gap-2 bg-red-600/80 text-white font-medium py-2 px-4 rounded-lg hover:bg-red-500 transition-colors"
               >
                  Clear All
               </button>
             )}
          </div>

          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageFileSelected}
            accept="image/*"
            multiple
            className="hidden"
            aria-hidden="true"
          />

          {/* Options Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-1 mt-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="includeSolution"
                checked={includeSolution}
                onChange={(e) => setIncludeSolution(e.target.checked)}
                disabled={images.length === 0 ? true : isLoading} 
                className="w-4 h-4 rounded text-sky-500 bg-slate-700 border-slate-500 focus:ring-sky-500 focus:ring-offset-slate-900 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
              <label htmlFor="includeSolution" className="text-slate-300 select-none cursor-pointer">
                Include solution (Kèm lời giải)
              </label>
            </div>
          </div>

          <button
            onClick={handleConversion}
            disabled={images.length === 0 || isLoading}
            className="w-full flex items-center justify-center gap-3 bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100 mt-2"
          >
            {isLoading ? (
              <>
                <IconLoader className="animate-spin h-5 w-5" />
                <span>Converting...</span>
              </>
            ) : (
              <>
                <IconWand className="h-5 w-5" />
                <span>Convert to LaTeX</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: LaTeX Output */}
        <div className="flex flex-col gap-4">
            <div className="relative flex flex-col flex-grow min-h-[400px] bg-slate-800 rounded-lg border border-slate-700">
                <div className="absolute top-2 right-2 flex gap-2 z-10">
                    <button
                        onClick={handleCopy}
                        disabled={!latexCode || isLoading}
                        className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Copy LaTeX code"
                        title="Copy LaTeX code"
                    >
                        {isCopied ? <IconClipboardCheck className="h-5 w-5 text-green-400" /> : <IconClipboard className="h-5 w-5" />}
                    </button>
                    <button
                        onClick={handleAppendClick}
                        disabled={!latexCode || isLoading}
                        className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Append to .tex file"
                        title="Append to .tex file"
                    >
                        <IconFilePlus className="h-5 w-5" />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!latexCode || isLoading}
                        className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Save as .tex file"
                        title="Save as .tex file"
                    >
                        <IconDownload className="h-5 w-5" />
                    </button>
                </div>
                {error && <div className="p-4 text-red-400 whitespace-pre-wrap font-mono text-sm">{error}</div>}
                <textarea
                  value={latexCode}
                  onChange={handleLatexChange}
                  readOnly={isLoading}
                  placeholder={isLoading ? 'Generating LaTeX...' : 'LaTeX output will appear here...'}
                  className="w-full flex-grow bg-transparent p-4 pt-12 font-mono text-sm text-cyan-300 resize-none focus:outline-none placeholder-slate-500"
                  aria-label="LaTeX Output"
                />
            </div>
        </div>
      </main>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept=".tex,application/x-tex"
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
};

export default App;
