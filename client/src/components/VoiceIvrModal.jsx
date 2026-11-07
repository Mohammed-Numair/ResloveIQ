import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall, PhoneOff, Volume2, ShieldCheck, Clock, User, CheckCircle2 } from 'lucide-react';
import { lookupTicketByCallPin } from '../services/ticketService';

const VoiceIvrModal = ({ isOpen, onClose, defaultPin = '' }) => {
  const [pin, setPin] = useState(defaultPin);
  const [isCalling, setIsCalling] = useState(false);
  const [callConnected, setCallConnected] = useState(false);
  const [callData, setCallData] = useState(null);
  const [error, setError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (defaultPin) setPin(defaultPin);
  }, [defaultPin]);

  // Clean up speech when modal is closed
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleDial = async () => {
    if (!pin || pin.trim().length !== 6) {
      setError('Please enter a valid 6-digit Call PIN.');
      return;
    }

    setError(null);
    setIsCalling(true);
    setCallConnected(false);
    setCallData(null);

    try {
      // Simulate telephony network handshake (600ms)
      await new Promise((r) => setTimeout(r, 600));
      const res = await lookupTicketByCallPin(pin.trim());
      setCallData(res);
      setCallConnected(true);
      setIsCalling(false);

      // Trigger Web Speech API voice synthesis
      if ('speechSynthesis' in window && res.spokenPrompt) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(res.spokenPrompt);
        utterance.rate = 0.95; // Clear telephony cadence
        utterance.pitch = 1.0;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      setIsCalling(false);
      setError(err.message || 'Call failed: PIN not recognized on telecommunication gateway.');
    }
  };

  const handleHangUp = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setCallConnected(false);
    setIsCalling(false);
    setCallData(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-white flex flex-col">
        {/* Phone Header / Screen Bar */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              ResolveIQ Telephony Gateway
            </span>
          </div>
          <button
            onClick={handleHangUp}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Call Display Area */}
        <div className="p-6 flex flex-col items-center text-center">
          {callConnected && callData ? (
            <div className="w-full space-y-4">
              <div className="w-16 h-16 rounded-full bg-indigo-500/20 border-2 border-indigo-500 flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
                <Volume2 className={`w-8 h-8 ${isSpeaking ? 'animate-bounce text-indigo-300' : ''}`} />
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800">
                  Call In Progress &bull; Connected
                </span>
                <h3 className="text-xl font-bold text-white mt-2">{callData.ticketId}</h3>
                <p className="text-xs text-slate-300 font-medium line-clamp-1">{callData.title}</p>
              </div>

              {/* Telephony Audio Waveform Animation */}
              <div className="flex items-center justify-center space-x-1.5 h-10 py-2">
                {[40, 75, 55, 90, 60, 30, 85, 45, 95, 70, 50, 35].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      height: isSpeaking ? `${h}%` : '20%',
                      animationDuration: `${0.4 + (i % 4) * 0.2}s`,
                    }}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      isSpeaking ? 'bg-indigo-400 animate-pulse' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              {/* Ticket Telephony Metadata Card */}
              <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 text-left text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current Status:</span>
                  <span className="font-bold text-white uppercase px-2 py-0.5 rounded bg-slate-700 border border-slate-600">
                    {callData.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Priority & SLA:</span>
                  <span className="font-medium text-amber-300">
                    {callData.priority} &bull; {callData.slaHours || 24}h Target
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Assigned Agent:</span>
                  <span className="font-semibold text-indigo-300">{callData.assignedTo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="text-slate-200">{callData.customerName}</span>
                </div>
              </div>

              {/* Telephony Voice Transcript Box */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-left">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                  🎙️ Automated Spoken Voice Script:
                </span>
                <p className="text-[11px] text-slate-300 italic leading-relaxed">
                  "{callData.spokenPrompt}"
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-5">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <Phone className={`w-8 h-8 ${isCalling ? 'animate-spin text-indigo-400' : ''}`} />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">Telephone IVR Simulator</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enter any 6-digit ticket Call PIN to simulate an automated phone status inquiry with voice readback.
                </p>
              </div>

              {/* PIN Input */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block text-left">
                  Enter 6-Digit Call PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 583921"
                  className="w-full tracking-widest text-center text-2xl font-mono font-bold bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-300">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Action Call Controls */}
          <div className="mt-6 flex items-center justify-center space-x-4 w-full">
            {callConnected ? (
              <button
                onClick={handleHangUp}
                className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-lg shadow-rose-900/40 transition-all"
              >
                <PhoneOff className="w-5 h-5" />
                <span>End Call & Hang Up</span>
              </button>
            ) : (
              <button
                onClick={handleDial}
                disabled={isCalling || pin.length !== 6}
                className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 transition-all cursor-pointer"
              >
                <PhoneCall className="w-5 h-5" />
                <span>{isCalling ? 'Connecting to IVR...' : 'Dial Call PIN'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceIvrModal;

