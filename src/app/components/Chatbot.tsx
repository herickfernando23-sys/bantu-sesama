import { useState } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface ChatbotResponsePayload {
  response?: string;
  needsClarification?: boolean;
  suggestions?: string[];
}

function resolveApiBaseUrl() {
  const envBaseUrl = String((import.meta as any).env?.VITE_API_URL || '').trim();

  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return 'http://localhost:8080';
}

const apiBaseUrl = resolveApiBaseUrl();

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'Halo! Saya Asisten BantuSesama. Ada yang bisa saya bantu?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchBotResponse = async (userMessage: string): Promise<string> => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/chatbot/response?message=${encodeURIComponent(userMessage)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Gagal mendapatkan respons dari chatbot');
      }

      const data = (await response.json()) as ChatbotResponsePayload;
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      const responseText = String(data.response || 'Maaf, terjadi kesalahan. Silakan coba lagi.');
      const alreadyHasExamples = /contoh pertanyaan|•\s+/i.test(responseText);
      const suggestionBlock = data.needsClarification && suggestions.length > 0 && !alreadyHasExamples
        ? `\n\nContoh pertanyaan:\n${suggestions.map((item) => `• ${item}`).join('\n')}`
        : '';

      return `${responseText}${suggestionBlock}`;
    } catch (error) {
      console.error('Chatbot API error:', error);
      return 'Maaf, terjadi kesalahan saat memproses pertanyaan Anda. Silakan hubungi tim support kami atau coba lagi nanti.';
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const botResponseText = await fetchBotResponse(inputText);
      
      setTimeout(() => {
        const botResponse: Message = {
          id: messages.length + 2,
          text: botResponseText,
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botResponse]);
        setIsLoading(false);
      }, 300);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* FLOATING BUTTON */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-70 animate-ping"></span>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="
            relative w-14 h-14 bg-blue-600 text-white rounded-full
            shadow-lg flex items-center justify-center
            transition-all duration-300
            hover:scale-110 hover:bg-blue-700
            animate-float
          "
        >
          {isOpen ? (
            <X className="w-6 h-6 transition-transform duration-300 rotate-90" />
          ) : (
            <MessageCircle className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* CHAT WINDOW */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl z-50 flex flex-col border border-gray-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* HEADER */}
          <div className="bg-blue-600 text-white p-4 rounded-t-xl flex items-center gap-3">
            <Bot className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Asisten BantuSesama</h3>
              <p className="text-xs text-blue-100">Online</p>
            </div>
          </div>

          {/* CHAT BODY */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {message.timestamp.toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* INPUT */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                placeholder={isLoading ? 'Menunggu respons...' : 'Ketik pesan...'}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}