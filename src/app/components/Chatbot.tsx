import { useState } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

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

  const generateBotResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('cara donasi') || lowerMessage.includes('cara berdonasi')) {
      return 'Untuk berdonasi, Anda bisa:\n1. Pilih kampanye\n2. Klik "Donasi Sekarang"\n3. Masukkan nominal\n4. Pilih pembayaran\n5. Selesaikan pembayaran';
    }

    if (lowerMessage.includes('transparansi')) {
      return 'Semua kampanye memiliki laporan transparansi dana yang bisa Anda lihat di tab "Transparansi".';
    }

    if (lowerMessage.includes('aman')) {
      return 'Platform kami aman:\n✅ Kampanye diverifikasi\n✅ Payment gateway terpercaya\n✅ Data dilindungi';
    }

    if (lowerMessage.includes('kampanye')) {
      return 'Untuk membuat kampanye:\n1. Klik "Mulai Kampanye"\n2. Isi data\n3. Tunggu verifikasi';
    }

    if (lowerMessage.includes('halo') || lowerMessage.includes('hi')) {
      return 'Halo! Ada yang bisa saya bantu? 😊';
    }

    return 'Saya bisa bantu soal donasi, kampanye, transparansi, dan keamanan. Silakan tanya ya!';
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    setTimeout(() => {
      const botResponse: Message = {
        id: messages.length + 2,
        text: generateBotResponse(inputText),
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
    }, 500);
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
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ketik pesan..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}