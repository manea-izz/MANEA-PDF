import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { FileUpload } from './FileUpload';
import { Spinner } from './Spinner';
import { SendIcon, RobotIcon, UserIcon, ResetIcon, PdfIcon, SparklesIcon } from './icons';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const AiChat: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkApiKey = async () => {
        try {
            if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
                const hasKey = await (window as any).aistudio.hasSelectedApiKey();
                setHasApiKey(hasKey);
            } else {
                // If not in the specific environment with key selector, assume env var is handled externally
                setHasApiKey(true);
            }
        } catch (e) {
            setHasApiKey(true);
        }
    };
    checkApiKey();
  }, []);

  const handleConnectApiKey = async () => {
      try {
          if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
              await (window as any).aistudio.openSelectKey();
              // Assume success immediately to prevent race conditions
              setHasApiKey(true);
          }
      } catch (e) {
          console.error(e);
      }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const selectedFile = files[0];
    
    if (selectedFile.type !== 'application/pdf') {
      setError("الرجاء اختيار ملف PDF فقط.");
      return;
    }

    setFile(selectedFile);
    setIsInitializing(true);
    setError(null);

    try {
      const base64Data = await convertFileToBase64(selectedFile);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: 'أنت مساعد ذكي متخصص في تحليل مستندات PDF. أجب عن أسئلة المستخدم بناءً على محتوى الملف المرفق. اجعل إجاباتك دقيقة ومفيدة وباللغة العربية.',
        },
        history: [
            {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: 'application/pdf',
                            data: base64Data
                        }
                    },
                    {
                        text: "قم بتحليل هذا المستند وأخبرني بملخص قصير عنه."
                    }
                ]
            }
        ]
      });

      setChatSession(chat);
      
      // Get initial summary
      const result: GenerateContentResponse = await chat.sendMessage({ message: "لخص لي هذا المستند." });
      
      setMessages([
        { role: 'model', text: result.text || "مرحباً! لقد قمت بقراءة المستند. كيف يمكنني مساعدتك؟" }
      ]);
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء تهيئة المحادثة. تأكد من صحة الملف أو مفتاح API.");
      setFile(null);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatSession || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const result: GenerateContentResponse = await chatSession.sendMessage({ message: userMessage });
      const responseText = result.text;
      
      if (responseText) {
        setMessages(prev => [...prev, { role: 'model', text: responseText }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "عذراً، حدث خطأ أثناء معالجة طلبك." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setChatSession(null);
    setMessages([]);
    setError(null);
  };

  if (!hasApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center p-6 bg-white rounded-xl shadow-lg border border-slate-200">
          <div className="bg-blue-100 p-4 rounded-full mb-6 text-blue-600">
              <SparklesIcon />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">تفعيل المساعد الذكي</h2>
          <p className="text-slate-600 mb-8 max-w-md text-lg leading-relaxed">
              لتحليل مستندات PDF والإجابة على استفساراتك بدقة، يرجى ربط مفتاح API الخاص بـ Gemini.
          </p>
          <button 
              onClick={handleConnectApiKey} 
              className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-3 text-lg"
          >
             <SparklesIcon />
             <span>ربط مفتاح API</span>
          </button>
          <p className="mt-6 text-sm text-slate-400">
              سيتم استخدام المفتاح بشكل آمن لمعالجة ملفاتك.
          </p>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="max-w-2xl mx-auto">
        <FileUpload 
          onFilesSelected={handleFileSelected} 
          disabled={isInitializing} 
          descriptionText="اختر ملف PDF للمحادثة معه" 
          acceptTypes="application/pdf" 
        />
        {isInitializing && (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 text-slate-600">
            <Spinner className="h-8 w-8 text-blue-600"/>
            <span className="text-lg">جاري تحليل المستند...</span>
          </div>
        )}
        {error && <p className="mt-4 text-red-500 text-center">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <PdfIcon />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 truncate max-w-[200px] md:max-w-md">{file.name}</h3>
            <p className="text-xs text-slate-500">محادثة ذكية</p>
          </div>
        </div>
        <button 
          onClick={handleReset} 
          className="text-slate-500 hover:text-red-500 p-2 rounded-full hover:bg-slate-100 transition-colors"
          title="إنهاء المحادثة"
        >
          <ResetIcon />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
              {msg.role === 'user' ? <UserIcon /> : <RobotIcon />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0">
              <RobotIcon />
            </div>
            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <Spinner className="h-4 w-4 text-slate-400" />
              <span className="text-slate-400 text-xs">جاري الكتابة...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-200">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اسأل شيئاً عن المستند..."
            disabled={isLoading}
            className="w-full pl-12 pr-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-slate-800 placeholder-slate-400"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="absolute left-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <SendIcon />
          </button>
        </div>
      </form>
    </div>
  );
};